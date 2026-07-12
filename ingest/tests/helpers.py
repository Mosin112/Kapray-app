"""Small builders for constructing feeds/products/variants in tests."""
from __future__ import annotations


def variant(ext, price, compare=None, available=True, title="Default"):
    return {
        "external_id": ext, "title": title, "price": price,
        "compare_at_price": compare, "available": available,
    }


def product(ext, variants, title=None, category="pret", images=None, tags=None):
    return {
        "external_id": ext,
        "title": title or f"Product {ext}",
        "product_url": f"https://brand.example/products/{ext}",
        "category": category,
        "fabric": None,
        "tags": tags or [],
        "images": images or [],
        "variants": variants,
    }


def feed(slug="nishat", products=None, currency="PKR",
         scraped_at="2026-07-12T09:00:00+05:00"):
    return {
        "brand_slug": slug,
        "scraped_at": scraped_at,
        "currency": currency,
        "products": products or [],
    }
