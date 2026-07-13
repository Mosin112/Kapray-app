"""Storage backends for the ingest pipeline.

`Store` is the seam that keeps the pipeline portable (spec §11.4). Two impls:
  * InMemoryStore   — deterministic, dependency-free; used by the test suite.
  * SupabaseRestStore — talks to a hosted Supabase project via PostgREST using
    the service-role key (spec §2: "upsert ... via the service-role API").

Both expose the same surface, so the pipeline never imports either directly.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _chunks(seq: list, n: int):
    """Yield successive n-sized chunks (keeps bulk requests within safe limits)."""
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ─────────────────────────────────────────────────────────────────────────────
# Interface
# ─────────────────────────────────────────────────────────────────────────────
class Store:
    """Minimal persistence surface the pipeline needs. Override everything."""

    def was_file_ingested(self, brand_slug: str, drop_file: str) -> bool:
        raise NotImplementedError

    def upsert_brand(self, slug: str, currency: str) -> str:
        """Ensure a brand row exists for slug; return its id."""
        raise NotImplementedError

    def get_products(self, brand_id: str) -> dict[str, dict]:
        """{external_id: {id, external_id, is_active, missing_count,
        variants: {v_ext: {id, price, compare_at_price, available}}}}"""
        raise NotImplementedError

    def upsert_product(self, brand_id: str, product: dict) -> str:
        raise NotImplementedError

    def replace_images(self, product_id: str, srcs: list[str]) -> None:
        raise NotImplementedError

    def upsert_variant(self, product_id: str, variant: dict) -> str:
        raise NotImplementedError

    def upsert_catalog(self, brand_id: str, products: list[dict]) -> tuple[dict, dict]:
        """Upsert every product + its images + variants for one brand.

        Returns (pid_by_ext, vid_by): {product_ext: uuid} and
        {(product_uuid, variant_ext): uuid}. The default loops the single-row
        methods (fine for tests / small feeds); SupabaseRestStore overrides it
        with bulk requests so a full catalog is a handful of round-trips, not
        thousands.
        """
        pid_by_ext: dict[str, str] = {}
        vid_by: dict[tuple, str] = {}
        for prod in products:
            pid = self.upsert_product(brand_id, prod)
            pid_by_ext[prod["external_id"]] = pid
            self.replace_images(pid, prod.get("images", []))
            for v in prod.get("variants", []):
                vid_by[(pid, v["external_id"])] = self.upsert_variant(pid, v)
        return pid_by_ext, vid_by

    def insert_events(self, rows: list[dict]) -> int:
        """rows: {product_id, variant_id|None, type, old_value, new_value}."""
        raise NotImplementedError

    def set_missing(self, product_id: str, missing_count: int, is_active: bool) -> None:
        raise NotImplementedError

    def insert_campaign(self, brand_id: str, kind: str, title: str,
                        subtitle: str, starts_at: str) -> str:
        raise NotImplementedError

    def record_ingest_run(self, **run: Any) -> None:
        raise NotImplementedError


# ─────────────────────────────────────────────────────────────────────────────
# In-memory (tests / dry runs)
# ─────────────────────────────────────────────────────────────────────────────
class InMemoryStore(Store):
    def __init__(self) -> None:
        self.brands: dict[str, dict] = {}                 # slug -> {id, currency}
        self.products: dict[tuple, dict] = {}             # (brand_id, ext) -> row
        self.variants: dict[tuple, dict] = {}             # (product_id, ext) -> row
        self.images: dict[str, list[str]] = {}            # product_id -> [src]
        self.events: list[dict] = []
        self.campaigns: list[dict] = []
        self.ingest_runs: list[dict] = []
        self._ingested: set[tuple] = set()                # (brand_slug, drop_file)

    def was_file_ingested(self, brand_slug: str, drop_file: str) -> bool:
        return (brand_slug, drop_file) in self._ingested

    def upsert_brand(self, slug: str, currency: str) -> str:
        b = self.brands.get(slug)
        if b is None:
            b = {"id": str(uuid.uuid4()), "currency": currency}
            self.brands[slug] = b
        else:
            b["currency"] = currency
        return b["id"]

    def get_products(self, brand_id: str) -> dict[str, dict]:
        out: dict[str, dict] = {}
        for (b_id, ext), row in self.products.items():
            if b_id != brand_id:
                continue
            variants = {
                v_ext: {
                    "id": v["id"], "price": v["price"],
                    "compare_at_price": v["compare_at_price"],
                    "available": v["available"],
                }
                for (p_id, v_ext), v in self.variants.items()
                if p_id == row["id"]
            }
            out[ext] = {
                "id": row["id"], "external_id": ext,
                "is_active": row["is_active"], "missing_count": row["missing_count"],
                "variants": variants,
            }
        return out

    def upsert_product(self, brand_id: str, product: dict) -> str:
        key = (brand_id, product["external_id"])
        row = self.products.get(key)
        if row is None:
            row = {
                "id": str(uuid.uuid4()), "brand_id": brand_id,
                "external_id": product["external_id"],
                "first_seen_at": _now_iso(), "is_active": True, "missing_count": 0,
            }
            self.products[key] = row
        row.update({
            "title": product["title"],
            "product_url": product["product_url"],
            "category": product.get("category"),
            "fabric": product.get("fabric"),
            "tags": product.get("tags", []),
            "last_seen_at": _now_iso(),
            "is_active": True,
            "missing_count": 0,
        })
        return row["id"]

    def replace_images(self, product_id: str, srcs: list[str]) -> None:
        self.images[product_id] = list(srcs)

    def upsert_variant(self, product_id: str, variant: dict) -> str:
        key = (product_id, variant["external_id"])
        row = self.variants.get(key)
        if row is None:
            row = {"id": str(uuid.uuid4()), "external_id": variant["external_id"]}
            self.variants[key] = row
        row.update({
            "title": variant.get("title"),
            "price": float(variant["price"]),
            "compare_at_price": (float(variant["compare_at_price"])
                                 if variant.get("compare_at_price") is not None else None),
            "available": bool(variant["available"]),
        })
        return row["id"]

    def insert_events(self, rows: list[dict]) -> int:
        for r in rows:
            self.events.append({**r, "created_at": _now_iso()})
        return len(rows)

    def set_missing(self, product_id: str, missing_count: int, is_active: bool) -> None:
        for row in self.products.values():
            if row["id"] == product_id:
                row["missing_count"] = missing_count
                row["is_active"] = is_active
                return

    def insert_campaign(self, brand_id: str, kind: str, title: str,
                        subtitle: str, starts_at: str) -> str:
        cid = str(uuid.uuid4())
        self.campaigns.append({
            "id": cid, "brand_id": brand_id, "kind": kind, "title": title,
            "subtitle": subtitle, "status": "scheduled", "source": "auto_detected",
            "starts_at": starts_at,
        })
        return cid

    def record_ingest_run(self, **run: Any) -> None:
        self.ingest_runs.append(run)
        self._ingested.add((run["brand_slug"], run["drop_file"]))


# ─────────────────────────────────────────────────────────────────────────────
# Supabase (PostgREST + service-role key)
# ─────────────────────────────────────────────────────────────────────────────
class SupabaseRestStore(Store):
    """Real backend. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

    Uses `requests`; kept behind the Store seam so tests never need a network.
    """

    def __init__(self, url: Optional[str] = None, service_key: Optional[str] = None) -> None:
        import requests  # local import: only needed for real runs
        self._requests = requests
        self.url = (url or os.environ["SUPABASE_URL"]).rstrip("/")
        self.key = service_key or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.rest = f"{self.url}/rest/v1"
        self._headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    # -- low-level helpers ----------------------------------------------------
    def _get(self, path: str, params: dict) -> list:
        r = self._requests.get(f"{self.rest}/{path}", headers=self._headers,
                               params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def _upsert(self, table: str, row: dict, on_conflict: str) -> dict:
        headers = {**self._headers,
                   "Prefer": "resolution=merge-duplicates,return=representation"}
        r = self._requests.post(f"{self.rest}/{table}", headers=headers,
                                params={"on_conflict": on_conflict},
                                data=json.dumps([row]), timeout=30)
        r.raise_for_status()
        return r.json()[0]

    def _insert(self, table: str, rows: list[dict]) -> list:
        if not rows:
            return []
        headers = {**self._headers, "Prefer": "return=minimal"}
        for chunk in _chunks(rows, 500):
            r = self._requests.post(f"{self.rest}/{table}", headers=headers,
                                    data=json.dumps(chunk), timeout=60)
            r.raise_for_status()
        return rows

    def _upsert_bulk(self, table: str, rows: list[dict], on_conflict: str,
                     select: str) -> list:
        """Bulk upsert; returns the merged rows (only the `select` columns).
        Chunked so a full catalog stays a few requests, not thousands."""
        if not rows:
            return []
        headers = {**self._headers,
                   "Prefer": "resolution=merge-duplicates,return=representation"}
        out: list = []
        for chunk in _chunks(rows, 500):
            r = self._requests.post(f"{self.rest}/{table}", headers=headers,
                                    params={"on_conflict": on_conflict, "select": select},
                                    data=json.dumps(chunk), timeout=60)
            r.raise_for_status()
            out.extend(r.json())
        return out

    def _patch(self, table: str, params: dict, patch: dict) -> None:
        r = self._requests.patch(f"{self.rest}/{table}", headers=self._headers,
                                 params=params, data=json.dumps(patch), timeout=30)
        r.raise_for_status()

    def _delete(self, table: str, params: dict) -> None:
        r = self._requests.delete(f"{self.rest}/{table}", headers=self._headers,
                                  params=params, timeout=30)
        r.raise_for_status()

    # -- Store surface --------------------------------------------------------
    def was_file_ingested(self, brand_slug: str, drop_file: str) -> bool:
        rows = self._get("ingest_runs", {
            "select": "id",
            "brand_slug": f"eq.{brand_slug}",
            "drop_file": f"eq.{drop_file}",
            "status": "eq.ok",
            "limit": "1",
        })
        return bool(rows)

    def upsert_brand(self, slug: str, currency: str) -> str:
        rows = self._get("brands", {"select": "id", "slug": f"eq.{slug}", "limit": "1"})
        if rows:
            self._patch("brands", {"slug": f"eq.{slug}"}, {"currency": currency})
            return rows[0]["id"]
        row = self._upsert("brands", {
            "slug": slug, "name": slug.title(), "domain": "", "base_url": "",
            "platform": "custom", "currency": currency, "sync_status": "onboarding",
        }, on_conflict="slug")
        return row["id"]

    def get_products(self, brand_id: str) -> dict[str, dict]:
        rows = self._get("products", {
            "select": "id,external_id,is_active,missing_count,"
                      "variants(id,external_id,price,compare_at_price,available)",
            "brand_id": f"eq.{brand_id}",
        })
        out: dict[str, dict] = {}
        for r in rows:
            out[r["external_id"]] = {
                "id": r["id"], "external_id": r["external_id"],
                "is_active": r["is_active"], "missing_count": r["missing_count"],
                "variants": {
                    v["external_id"]: {
                        "id": v["id"], "price": v["price"],
                        "compare_at_price": v["compare_at_price"],
                        "available": v["available"],
                    } for v in r.get("variants", [])
                },
            }
        return out

    def upsert_product(self, brand_id: str, product: dict) -> str:
        row = self._upsert("products", {
            "brand_id": brand_id,
            "external_id": product["external_id"],
            "title": product["title"],
            "product_url": product["product_url"],
            "category": product.get("category"),
            "fabric": product.get("fabric"),
            "tags": product.get("tags", []),
            "last_seen_at": _now_iso(),
            "is_active": True,
            "missing_count": 0,
        }, on_conflict="brand_id,external_id")
        return row["id"]

    def replace_images(self, product_id: str, srcs: list[str]) -> None:
        self._delete("product_images", {"product_id": f"eq.{product_id}"})
        self._insert("product_images", [
            {"product_id": product_id, "src": src, "position": i + 1}
            for i, src in enumerate(srcs)
        ])

    def upsert_variant(self, product_id: str, variant: dict) -> str:
        row = self._upsert("variants", {
            "product_id": product_id,
            "external_id": variant["external_id"],
            "title": variant.get("title"),
            "price": float(variant["price"]),
            "compare_at_price": (float(variant["compare_at_price"])
                                 if variant.get("compare_at_price") is not None else None),
            "available": bool(variant["available"]),
        }, on_conflict="product_id,external_id")
        return row["id"]

    def upsert_catalog(self, brand_id: str, products: list[dict]) -> tuple[dict, dict]:
        """Bulk version: 1 upsert for all products, 1 delete + 1 insert for
        images, 1 upsert for all variants — instead of ~4 round-trips per
        product. Turns a multi-thousand-product feed from thousands of HTTP
        calls into a handful."""
        if not products:
            return {}, {}

        prod_rows = [{
            "brand_id": brand_id,
            "external_id": p["external_id"],
            "title": p["title"],
            "product_url": p["product_url"],
            "category": p.get("category"),
            "fabric": p.get("fabric"),
            "tags": p.get("tags", []),
            "last_seen_at": _now_iso(),
            "is_active": True,
            "missing_count": 0,
        } for p in products]
        returned = self._upsert_bulk("products", prod_rows,
                                     on_conflict="brand_id,external_id",
                                     select="id,external_id")
        pid_by_ext = {r["external_id"]: r["id"] for r in returned}

        # Images: clear then re-insert for exactly the products in this feed.
        pids = list(pid_by_ext.values())
        for chunk in _chunks(pids, 100):
            self._delete("product_images", {"product_id": f"in.({','.join(chunk)})"})
        img_rows = []
        for p in products:
            pid = pid_by_ext.get(p["external_id"])
            if not pid:
                continue
            for i, src in enumerate(p.get("images", [])):
                img_rows.append({"product_id": pid, "src": src, "position": i + 1})
        self._insert("product_images", img_rows)

        # Variants: one bulk upsert, mapped back by (product_id, external_id).
        var_rows = []
        for p in products:
            pid = pid_by_ext.get(p["external_id"])
            if not pid:
                continue
            for v in p.get("variants", []):
                var_rows.append({
                    "product_id": pid,
                    "external_id": v["external_id"],
                    "title": v.get("title"),
                    "price": float(v["price"]),
                    "compare_at_price": (float(v["compare_at_price"])
                                         if v.get("compare_at_price") is not None else None),
                    "available": bool(v["available"]),
                })
        returned_v = self._upsert_bulk("variants", var_rows,
                                       on_conflict="product_id,external_id",
                                       select="id,product_id,external_id")
        vid_by = {(r["product_id"], r["external_id"]): r["id"] for r in returned_v}
        return pid_by_ext, vid_by

    def insert_events(self, rows: list[dict]) -> int:
        payload = [{
            "product_id": r["product_id"],
            "variant_id": r.get("variant_id"),
            "type": r["type"],
            "old_value": r.get("old_value"),
            "new_value": r.get("new_value"),
        } for r in rows]
        self._insert("product_events", payload)
        return len(payload)

    def set_missing(self, product_id: str, missing_count: int, is_active: bool) -> None:
        self._patch("products", {"id": f"eq.{product_id}"},
                    {"missing_count": missing_count, "is_active": is_active})

    def insert_campaign(self, brand_id: str, kind: str, title: str,
                        subtitle: str, starts_at: str) -> str:
        row = self._upsert("campaigns", {
            "brand_id": brand_id, "kind": kind, "title": title, "subtitle": subtitle,
            "status": "scheduled", "source": "auto_detected", "starts_at": starts_at,
        }, on_conflict="id")
        return row["id"]

    def record_ingest_run(self, **run: Any) -> None:
        self._insert("ingest_runs", [run])
