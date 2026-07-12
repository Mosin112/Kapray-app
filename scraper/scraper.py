#!/usr/bin/env python3
"""
Kapray brand-catalog scraper.

Outputs canonical product-feed JSON (see kapray-claude-code-spec.md §5) into
drops/{brand}/{timestamp}.json for the ingest pipeline to pick up.

Re-runnable by design:
  * Every run is safe to repeat — output files are timestamped, never overwritten.
  * Per-brand state (last run, content hash) lives in state/state.json.
  * If a brand's catalog is unchanged since the last run, no new drop file is
    written (the ingest stays quiet) — override with --force.
  * `loop` mode re-runs on an interval for unattended operation.

Usage:
  python3 scraper.py run                    # all enabled brands
  python3 scraper.py run --brand nishat,limelight
  python3 scraper.py run --force            # write drops even if unchanged
  python3 scraper.py run --limit 50         # cap products per brand (testing)
  python3 scraper.py loop --interval 30     # re-run every 30 minutes
  python3 scraper.py status                 # last run per brand
"""
import argparse
import hashlib
import json
import logging
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DROPS = ROOT / "drops"
STATE_FILE = ROOT / "state" / "state.json"
BRANDS_FILE = ROOT / "brands.json"

USER_AGENT = "KaprayBot/0.1 (+catalog aggregator; contact: mohsin.hafeez@fasset.com)"
REQUEST_GAP_SECONDS = 2.0      # per-brand politeness delay between requests
MAX_RETRIES = 3
PKT = timezone(timedelta(hours=5))

log = logging.getLogger("kapray")


# ----------------------------------------------------------------- utilities

def http_get(url: str, timeout: int = 20) -> str:
    """GET with retries + exponential backoff. Returns body text ('' on 404)."""
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
            })
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return ""
            last_err = e
        except Exception as e:  # noqa: BLE001
            last_err = e
        sleep = 2 ** attempt
        log.warning("GET %s failed (%s) — retry %d/%d in %ds",
                    url, last_err, attempt, MAX_RETRIES, sleep)
        time.sleep(sleep)
    raise RuntimeError(f"GET {url} failed after {MAX_RETRIES} retries: {last_err}")


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def catalog_hash(products: list) -> str:
    """Stable hash of the parts that matter for diffing (id/price/stock)."""
    core = sorted(
        (p["external_id"],
         tuple(sorted((v["external_id"], str(v["price"]),
                       str(v.get("compare_at_price")), v["available"])
                      for v in p["variants"])))
        for p in products
    )
    return hashlib.sha256(json.dumps(core, default=str).encode()).hexdigest()


# ------------------------------------------------------------------ adapters

def scrape_shopify(cfg: dict, limit: int | None) -> list:
    """Any Shopify storefront exposing /products.json (Nishat, Limelight)."""
    products, page = [], 1
    while True:
        url = f"{cfg['base_url']}/products.json?limit=250&page={page}"
        body = http_get(url)
        time.sleep(REQUEST_GAP_SECONDS)
        batch = json.loads(body).get("products", []) if body else []
        if not batch:
            break
        for p in batch:
            products.append({
                "external_id": str(p["id"]),
                "title": p["title"].strip(),
                "product_url": f"{cfg['base_url']}/products/{p['handle']}",
                "category": (p.get("product_type") or "").lower() or None,
                "fabric": None,
                "tags": p.get("tags", []),
                "images": [img["src"] for img in p.get("images", [])][:6],
                "variants": [{
                    "external_id": str(v["id"]),
                    "title": v.get("title") or "Default",
                    "price": float(v["price"]),
                    "compare_at_price": float(v["compare_at_price"])
                        if v.get("compare_at_price") else None,
                    "available": bool(v.get("available", True)),
                } for v in p.get("variants", [])],
            })
            if limit and len(products) >= limit:
                return products
        page += 1
        if page > 40:   # safety valve (10k products)
            break
    return products


# Khaadi (Salesforce Commerce Cloud, US storefront) — parse the PLP HTML.
KHAADI_TILE = re.compile(
    r'\[!\[(?P<alt>[^\]]*)\]\((?P<img>https://us\.khaadi\.com/dw/image[^)]+)\)\]'
    r'\((?P<url>https://us\.khaadi\.com/[^)]+?\.html)[^)]*\)',
)
KHAADI_RAW_TILE = re.compile(
    r'<a[^>]+href="(?P<url>[^"]+\.html)[^"]*"[^>]*>\s*<img[^>]+src="(?P<img>[^"]+dw/image[^"]+)"[^>]*alt="(?P<alt>[^"]*)"',
    re.S,
)


def _khaadi_parse(html: str, base: str) -> dict:
    """Extract {url: product} from a Khaadi PLP page (markdown-ish or raw html)."""
    found = {}
    for rx in (KHAADI_TILE, KHAADI_RAW_TILE):
        for m in rx.finditer(html):
            url = m.group("url").split("?")[0]
            if not url.startswith("http"):
                url = base + url
            alt = m.group("alt")
            # alt format: "Technique | Fabric | Title | USD 35.00"
            parts = [x.strip() for x in alt.split("|")]
            price = None
            title = None
            for part in parts:
                pm = re.match(r"USD\s+([\d.]+)", part)
                if pm:
                    price = float(pm.group(1))
                elif part and not price:
                    title = part          # last non-price part before price
            if not title:
                title = url.rstrip("/").split("/")[-2].replace("-", " ").title()
            ext = url.rstrip("/").split("/")[-1].replace(".html", "")
            item = found.setdefault(url, {
                "external_id": ext,
                "title": title,
                "product_url": url,
                "category": "ready-to-wear",
                "fabric": parts[1] if len(parts) >= 3 else None,
                "tags": [],
                "images": [],
                "variants": [{
                    "external_id": ext,
                    "title": "Default",
                    "price": price or 0.0,
                    "compare_at_price": None,
                    "available": True,
                }],
            })
            img = m.group("img")
            if img not in item["images"]:
                item["images"].append(img)
            if price:
                item["variants"][0]["price"] = price
    return found


def scrape_khaadi(cfg: dict, limit: int | None) -> list:
    products: dict = {}
    for cat in cfg.get("categories", []):
        body = http_get(cfg["base_url"] + cat)
        time.sleep(REQUEST_GAP_SECONDS)
        products.update(_khaadi_parse(body, cfg["base_url"]))
        if limit and len(products) >= limit:
            break
    out = [p for p in products.values() if p["variants"][0]["price"] > 0]
    return out[:limit] if limit else out


ADAPTERS = {
    "shopify": scrape_shopify,
    "khaadi_sfcc": scrape_khaadi,
}


# ---------------------------------------------------------------------- core

def run_brand(slug: str, cfg: dict, state: dict, force: bool,
              limit: int | None) -> dict:
    started = datetime.now(PKT)
    log.info("▶ %s (%s)", slug, cfg["platform"])
    try:
        products = ADAPTERS[cfg["platform"]](cfg, limit)
    except Exception as e:  # noqa: BLE001
        log.error("✗ %s failed: %s", slug, e)
        return {"status": "error", "error": str(e), "last_run": started.isoformat()}

    if not products:
        log.warning("✗ %s returned 0 products (blocked or empty?)", slug)
        return {"status": "empty", "last_run": started.isoformat(), "products": 0}

    digest = catalog_hash(products)
    prev = state.get(slug, {})
    if digest == prev.get("hash") and not force:
        log.info("= %s unchanged (%d products) — no drop written. Use --force to override.",
                 slug, len(products))
        return {**prev, "status": "unchanged", "last_run": started.isoformat(),
                "products": len(products), "hash": digest}

    feed = {
        "brand_slug": slug,
        "scraped_at": started.isoformat(),
        "currency": cfg["currency"],
        "products": products,
    }
    fname = started.strftime("%Y%m%d-%H%M%S") + ".json"
    out = DROPS / slug / fname
    save_json(out, feed)
    save_json(DROPS / slug / "latest.json", feed)   # stable pointer for ingest
    log.info("✓ %s: %d products → %s%s", slug, len(products),
             out.relative_to(ROOT), " (forced)" if force and digest == prev.get("hash") else "")
    return {"status": "ok", "last_run": started.isoformat(),
            "products": len(products), "hash": digest, "file": str(out.relative_to(ROOT))}


def run(brand_filter: list | None, force: bool, limit: int | None) -> int:
    brands = load_json(BRANDS_FILE, {})
    state = load_json(STATE_FILE, {})
    failures = 0
    for slug, cfg in brands.items():
        if brand_filter and slug not in brand_filter:
            continue
        if not cfg.get("enabled", True):
            log.info("– %s skipped (disabled: %s)", slug, cfg.get("note", "no note"))
            continue
        result = run_brand(slug, cfg, state, force, limit)
        state[slug] = result
        save_json(STATE_FILE, state)     # persist after each brand — crash-safe
        if result["status"] == "error":
            failures += 1
    return failures


def status():
    state = load_json(STATE_FILE, {})
    if not state:
        print("No runs recorded yet. Try: python3 scraper.py run")
        return
    for slug, s in state.items():
        print(f"{slug:12} {s.get('status','?'):10} "
              f"products={s.get('products','-'):>5}  last_run={s.get('last_run','-')}"
              + (f"  err={s.get('error')}" if s.get("error") else ""))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_run = sub.add_parser("run", help="scrape once")
    p_run.add_argument("--brand", help="comma-separated slugs (default: all enabled)")
    p_run.add_argument("--force", action="store_true",
                       help="write a drop file even if the catalog is unchanged")
    p_run.add_argument("--limit", type=int, help="max products per brand (testing)")

    p_loop = sub.add_parser("loop", help="re-run forever on an interval")
    p_loop.add_argument("--interval", type=int, default=30, help="minutes between runs")
    p_loop.add_argument("--brand", help="comma-separated slugs")

    sub.add_parser("status", help="show last run per brand")

    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        datefmt="%H:%M:%S")

    if args.cmd == "status":
        status()
    elif args.cmd == "run":
        brands = args.brand.split(",") if args.brand else None
        sys.exit(1 if run(brands, args.force, args.limit) else 0)
    elif args.cmd == "loop":
        brands = args.brand.split(",") if args.brand else None
        log.info("Loop mode: every %d min. Ctrl-C to stop.", args.interval)
        while True:
            run(brands, force=False, limit=None)
            time.sleep(args.interval * 60)


if __name__ == "__main__":
    main()
