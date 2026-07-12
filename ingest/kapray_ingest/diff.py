"""Pure diff engine + campaign-detection heuristics (spec §5.3, §5.5).

Nothing here touches a database or the network. Everything operates on plain
dicts so it can be unit-tested directly and ported to another runtime later.

Key semantics (spec §5):
  * A product whose external_id was not previously stored → one `new_product`.
  * For an existing variant: price went down → `price_drop`, up → `price_rise`;
    availability false→true → `restock`, true→false → `out_of_stock`.
    (A single variant can emit both a price and a stock event in one run.)
  * Products absent from N=3 consecutive feeds → `removed` (+ is_active=false).
  * Idempotency: re-running an unchanged feed yields zero events, because
    incoming state equals stored state so no comparison fires.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

# ── Event type constants ─────────────────────────────────────────────────────
NEW_PRODUCT = "new_product"
PRICE_DROP = "price_drop"
PRICE_RISE = "price_rise"
RESTOCK = "restock"
OUT_OF_STOCK = "out_of_stock"
REMOVED = "removed"

# ── Heuristic thresholds (spec §5.3, §5.5) ───────────────────────────────────
MISSING_THRESHOLD = 3          # feeds absent before a product is deactivated
CAMPAIGN_DROP_MIN_NEW = 20     # ≥20 new products in a run ⇒ suggest a 'drop'
CAMPAIGN_SALE_FRACTION = 0.30  # ≥30% of variants gain compare_at ⇒ suggest 'sale'


@dataclass
class Event:
    """A pending product_events row, keyed by external ids (resolved later)."""
    product_external_id: str
    type: str
    variant_external_id: Optional[str] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None


@dataclass
class RunDiff:
    """Everything the pipeline needs to apply one drop file's changes."""
    events: list[Event] = field(default_factory=list)
    new_product_count: int = 0
    compare_at_gained: int = 0     # variants that newly gained a compare_at_price
    incoming_variant_count: int = 0
    removed_product_ids: list[str] = field(default_factory=list)  # external ids


def _num(x: Any) -> Optional[float]:
    return None if x is None else float(x)


def compute_variant_events(
    product_ext_id: str,
    stored_variant: dict,
    incoming_variant: dict,
) -> list[Event]:
    """Compare one already-known variant; emit price/stock events as warranted."""
    events: list[Event] = []
    v_ext = incoming_variant["external_id"]

    old_price = _num(stored_variant.get("price"))
    new_price = _num(incoming_variant.get("price"))
    if old_price is not None and new_price is not None and new_price != old_price:
        events.append(Event(
            product_ext_id,
            PRICE_DROP if new_price < old_price else PRICE_RISE,
            variant_external_id=v_ext,
            old_value={"price": old_price},
            new_value={"price": new_price},
        ))

    old_avail = bool(stored_variant.get("available"))
    new_avail = bool(incoming_variant.get("available"))
    if old_avail != new_avail:
        events.append(Event(
            product_ext_id,
            RESTOCK if new_avail else OUT_OF_STOCK,
            variant_external_id=v_ext,
            old_value={"available": old_avail},
            new_value={"available": new_avail},
        ))

    return events


def _compare_at_gained(stored_variant: dict, incoming_variant: dict) -> bool:
    """True when a variant newly went on sale (compare_at null → set)."""
    was = _num(stored_variant.get("compare_at_price"))
    now = _num(incoming_variant.get("compare_at_price"))
    return was is None and now is not None


def diff_feed(stored: dict[str, dict], incoming: list[dict]) -> RunDiff:
    """Diff a whole brand feed.

    `stored`   : {product_external_id: {"variants": {v_ext: {...}}, ...}}
    `incoming` : validated list of product dicts from the drop file.
    """
    run = RunDiff()
    incoming_ids = {p["external_id"] for p in incoming}

    for prod in incoming:
        p_ext = prod["external_id"]
        variants = prod.get("variants", [])
        run.incoming_variant_count += len(variants)
        stored_prod = stored.get(p_ext)

        if stored_prod is None:
            # Unseen product → single new_product event; no per-variant diff.
            run.new_product_count += 1
            first = variants[0] if variants else {}
            run.events.append(Event(
                p_ext, NEW_PRODUCT,
                variant_external_id=first.get("external_id"),
                new_value={"title": prod.get("title"), "price": _num(first.get("price"))},
            ))
            continue

        stored_variants = stored_prod.get("variants", {})
        for v in variants:
            sv = stored_variants.get(v["external_id"])
            if sv is None:
                continue  # new variant on an existing product: upserted, no event
            run.events.extend(compute_variant_events(p_ext, sv, v))
            if _compare_at_gained(sv, v):
                run.compare_at_gained += 1

    # Products previously active but absent from this feed → bump missing_count;
    # the pipeline decides deactivation once it reaches MISSING_THRESHOLD. We
    # surface the candidates here so the pure layer stays deterministic.
    for p_ext, sp in stored.items():
        if p_ext not in incoming_ids and sp.get("is_active", True):
            run.removed_product_ids.append(p_ext)

    return run


@dataclass
class CampaignSuggestion:
    kind: str          # 'drop' | 'sale'
    reason: str        # human-readable, for the manual-review queue
    metric: float      # the value that tripped the heuristic


def detect_campaigns(run: RunDiff) -> list[CampaignSuggestion]:
    """Spec §5.5 heuristics. Both can fire in the same run."""
    out: list[CampaignSuggestion] = []

    if run.new_product_count >= CAMPAIGN_DROP_MIN_NEW:
        out.append(CampaignSuggestion(
            kind="drop",
            reason=f"{run.new_product_count} new products in one run",
            metric=float(run.new_product_count),
        ))

    if run.incoming_variant_count > 0:
        frac = run.compare_at_gained / run.incoming_variant_count
        if frac >= CAMPAIGN_SALE_FRACTION:
            out.append(CampaignSuggestion(
                kind="sale",
                reason=f"{run.compare_at_gained}/{run.incoming_variant_count} "
                       f"variants went on sale ({frac:.0%})",
                metric=frac,
            ))

    return out
