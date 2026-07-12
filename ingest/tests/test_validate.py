"""Schema validation + ingest against the REAL scraper drop fixtures."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from helpers import feed, product, variant
from kapray_ingest.pipeline import ingest_feed, ingest_path
from kapray_ingest.store import InMemoryStore
from kapray_ingest.validate import FeedValidationError, load_and_validate, validate_feed

FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.mark.parametrize("name", ["nishat_latest.json", "limelight_latest.json"])
def test_real_fixtures_validate(name):
    load_and_validate(FIXTURES / name)  # raises if invalid


@pytest.mark.parametrize("name", ["nishat_latest.json", "limelight_latest.json"])
def test_real_fixtures_ingest_as_new_products(name):
    s = InMemoryStore()
    res = ingest_path(s, FIXTURES / name, drop_file=f"test/{name}")
    assert res.status == "ok"
    assert res.products_seen > 0
    # First-ever ingest: every product is new.
    assert res.event_types.get("new_product") == res.products_seen


def test_valid_minimal_feed_passes():
    validate_feed(feed(products=[product("A", [variant("A1", 1000)])]))


def test_missing_required_field_fails():
    bad = feed(products=[{"external_id": "A", "variants": [variant("A1", 1000)]}])  # no title/url
    with pytest.raises(FeedValidationError):
        validate_feed(bad)


def test_negative_price_fails():
    bad = feed(products=[product("A", [variant("A1", -5)])])
    with pytest.raises(FeedValidationError):
        validate_feed(bad)


def test_product_without_variants_fails():
    bad = feed(products=[product("A", [])])
    with pytest.raises(FeedValidationError):
        validate_feed(bad)


def test_invalid_json_quarantined(tmp_path):
    bad = tmp_path / "broken.json"
    bad.write_text("{not json")
    failed = tmp_path / "_failed"
    s = InMemoryStore()
    res = ingest_path(s, bad, drop_file="x/broken.json", failed_dir=failed)
    assert res.status == "failed"
    assert (failed / "broken.json").exists()
    assert (failed / "broken.json.error.txt").exists()
