"""Kapray ingest package: drops → validate → upsert → diff → events.

Layers (all importable without a database):
  * validate.py — JSON Schema validation of scraper drop files.
  * diff.py     — PURE diff engine + campaign-detection heuristics.
  * store.py    — Store interface; InMemoryStore (tests) + SupabaseRestStore.
  * pipeline.py — orchestration that wires a drop file through a Store.
"""

__all__ = ["validate", "diff", "store", "pipeline"]
