# Kapray Scraper

Pulls brand catalogs (Nishat Linen, Limelight, Khaadi) and writes canonical
product-feed JSON for the Kapray ingest pipeline (see `kapray-claude-code-spec.md` §5).
No dependencies — Python 3.10+ stdlib only.

## Run it

```bash
python3 scraper.py run                     # all enabled brands
python3 scraper.py run --brand nishat      # one brand
python3 scraper.py run --limit 20          # quick test run
python3 scraper.py status                  # what happened last
```

## Re-running

Safe to re-run any time, as often as you like:

- Output files are timestamped (`drops/nishat/20260712-140501.json`) — nothing is overwritten. `drops/{brand}/latest.json` always points to the newest snapshot.
- If a brand's catalog hasn't changed since the last run, **no new drop file is written** (so the ingest pipeline stays quiet). Force one anyway with `--force`.
- State lives in `state/state.json`; delete it to reset everything.
- Unattended re-runs: `python3 scraper.py loop --interval 30` (every 30 min), or cron:

```cron
*/30 * * * * cd ~/Scrapper && python3 scraper.py run >> scraper.log 2>&1
```

## Brands

Configured in `brands.json`. Sapphire is present but `enabled: false` — they block
automated access; flip it on when a partnership feed exists. Add a new Shopify brand
by adding a config entry with `"platform": "shopify"` — no code needed.

## Notes

- Politeness: 1 request / 2s per brand, honest User-Agent, 3 retries with backoff.
- Khaadi is scraped from the US storefront (`us.khaadi.com`, prices in USD) —
  the PK site blocks bots and redirects abroad.
- Errors never kill the whole run: each brand's status is recorded independently.
