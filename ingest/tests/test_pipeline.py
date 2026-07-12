"""Phase 1 acceptance tests (spec §10):
  * same file twice  = 0 new events
  * a price change   = 1 price_drop
  * a restock        = detected
  * 25 new products  = auto campaign suggestion
plus removed-after-3-feeds, out_of_stock, price_rise, and sale detection.
"""
from __future__ import annotations

from helpers import feed, product, variant
from kapray_ingest.diff import (NEW_PRODUCT, OUT_OF_STOCK, PRICE_DROP, PRICE_RISE,
                                RESTOCK, REMOVED)
from kapray_ingest.pipeline import ingest_feed
from kapray_ingest.store import InMemoryStore


def test_new_products_emit_new_product_events():
    s = InMemoryStore()
    f = feed(products=[product("A", [variant("A1", 8000)]),
                       product("B", [variant("B1", 5000)])])
    res = ingest_feed(s, f, "nishat/20260712-090000.json")
    assert res.status == "ok"
    assert res.event_types == {NEW_PRODUCT: 2}
    assert len(s.events) == 2


def test_same_file_twice_zero_new_events():
    s = InMemoryStore()
    f = feed(products=[product("A", [variant("A1", 8000)])])
    ingest_feed(s, f, "nishat/drop1.json")
    assert len(s.events) == 1  # new_product

    # Re-ingesting the SAME file is skipped by the ingest_runs guard.
    res2 = ingest_feed(s, f, "nishat/drop1.json")
    assert res2.status == "skipped"
    assert len(s.events) == 1

    # Same CONTENT under a new filename: diff sees no change → zero new events.
    res3 = ingest_feed(s, f, "nishat/drop2.json")
    assert res3.status == "ok"
    assert res3.events_written == 0
    assert len(s.events) == 1


def test_price_drop_emits_one_event():
    s = InMemoryStore()
    ingest_feed(s, feed(products=[product("A", [variant("A1", 8000)])]), "n/1.json")
    res = ingest_feed(s, feed(products=[product("A", [variant("A1", 6000)])]), "n/2.json")
    assert res.event_types == {PRICE_DROP: 1}
    drop = [e for e in s.events if e["type"] == PRICE_DROP][0]
    assert drop["old_value"] == {"price": 8000.0}
    assert drop["new_value"] == {"price": 6000.0}


def test_price_rise_emits_one_event():
    s = InMemoryStore()
    ingest_feed(s, feed(products=[product("A", [variant("A1", 6000)])]), "n/1.json")
    res = ingest_feed(s, feed(products=[product("A", [variant("A1", 9000)])]), "n/2.json")
    assert res.event_types == {PRICE_RISE: 1}


def test_restock_detected():
    s = InMemoryStore()
    ingest_feed(s, feed(products=[product("A", [variant("A1", 8000, available=False)])]), "n/1.json")
    res = ingest_feed(s, feed(products=[product("A", [variant("A1", 8000, available=True)])]), "n/2.json")
    assert res.event_types == {RESTOCK: 1}


def test_out_of_stock_detected():
    s = InMemoryStore()
    ingest_feed(s, feed(products=[product("A", [variant("A1", 8000, available=True)])]), "n/1.json")
    res = ingest_feed(s, feed(products=[product("A", [variant("A1", 8000, available=False)])]), "n/2.json")
    assert res.event_types == {OUT_OF_STOCK: 1}


def test_price_and_stock_change_same_variant():
    s = InMemoryStore()
    ingest_feed(s, feed(products=[product("A", [variant("A1", 8000, available=False)])]), "n/1.json")
    res = ingest_feed(s, feed(products=[product("A", [variant("A1", 6000, available=True)])]), "n/2.json")
    assert res.event_types == {PRICE_DROP: 1, RESTOCK: 1}


def test_25_new_products_suggests_drop_campaign():
    s = InMemoryStore()
    prods = [product(f"P{i}", [variant(f"P{i}-1", 3000)]) for i in range(25)]
    res = ingest_feed(s, feed(products=prods), "n/1.json")
    assert res.event_types.get(NEW_PRODUCT) == 25
    assert res.campaigns_suggested == 1
    assert s.campaigns[0]["kind"] == "drop"
    assert s.campaigns[0]["source"] == "auto_detected"
    assert s.campaigns[0]["status"] == "scheduled"


def test_19_new_products_no_campaign():
    s = InMemoryStore()
    prods = [product(f"P{i}", [variant(f"P{i}-1", 3000)]) for i in range(19)]
    res = ingest_feed(s, feed(products=prods), "n/1.json")
    assert res.campaigns_suggested == 0


def test_sale_campaign_when_30pct_gain_compare_at():
    s = InMemoryStore()
    base = [product(f"P{i}", [variant(f"P{i}-1", 3000)]) for i in range(10)]
    ingest_feed(s, feed(products=base), "n/1.json")

    # 4 of 10 variants go on sale (40% ≥ 30%), price unchanged.
    updated = [product(f"P{i}", [variant(f"P{i}-1", 3000,
                                         compare=4000 if i < 4 else None)])
               for i in range(10)]
    res = ingest_feed(s, feed(products=updated), "n/2.json")
    kinds = {c["kind"] for c in s.campaigns}
    assert "sale" in kinds
    assert res.campaigns_suggested == 1


def test_removed_after_three_consecutive_absences():
    s = InMemoryStore()
    present = feed(products=[product("A", [variant("A1", 8000)]),
                             product("B", [variant("B1", 5000)])])
    ingest_feed(s, present, "n/1.json")

    only_b = feed(products=[product("B", [variant("B1", 5000)])])
    r2 = ingest_feed(s, only_b, "n/2.json")   # A absent: miss 1
    r3 = ingest_feed(s, only_b, "n/3.json")   # miss 2
    assert not any(e["type"] == REMOVED for e in s.events)
    r4 = ingest_feed(s, only_b, "n/4.json")   # miss 3 → removed

    removed = [e for e in s.events if e["type"] == REMOVED]
    assert len(removed) == 1
    a_row = [r for r in s.products.values() if r["external_id"] == "A"][0]
    assert a_row["is_active"] is False

    # Still absent on a 5th feed → no duplicate removed event.
    ingest_feed(s, only_b, "n/5.json")
    assert len([e for e in s.events if e["type"] == REMOVED]) == 1


def test_reappearing_product_resets_missing_count():
    s = InMemoryStore()
    present = feed(products=[product("A", [variant("A1", 8000)]),
                             product("B", [variant("B1", 5000)])])
    ingest_feed(s, present, "n/1.json")
    ingest_feed(s, feed(products=[product("B", [variant("B1", 5000)])]), "n/2.json")  # A miss 1

    a_row = [r for r in s.products.values() if r["external_id"] == "A"][0]
    assert a_row["missing_count"] == 1

    ingest_feed(s, present, "n/3.json")  # A back
    assert a_row["missing_count"] == 0
    assert a_row["is_active"] is True
