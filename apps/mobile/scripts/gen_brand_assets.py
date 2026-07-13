#!/usr/bin/env python3
"""Generate Kapray app icon, Android adaptive foreground, and splash mark.

Matches the approved brand marks: a Georgia serif "K" over the letter-spaced
KAPRAY wordmark, black on white. Run with the ingest venv's Pillow:

    source ../../ingest/.venv/bin/activate
    python scripts/gen_brand_assets.py

Regenerate whenever the brand mark changes. Outputs into assets/images/.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parent.parent / "assets" / "images"
GEORGIA = "/System/Library/Fonts/Supplemental/Georgia.ttf"
GEORGIA_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"

INK = (17, 17, 17, 255)      # #111
WHITE = (255, 255, 255, 255)


def draw_tracked(draw, text, font, cx, y, tracking, fill):
    """Draw letter-spaced text horizontally centered on cx. Returns width."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking
    return total


def mark(size, bg, fg, k_frac=0.42, word_frac=0.085, gap_frac=0.03,
         word=True, cx_off=0):
    """A centered K + KAPRAY wordmark on a `size`x`size` canvas."""
    img = Image.new("RGBA", (size, size), bg)
    d = ImageDraw.Draw(img)
    cx = size / 2 + cx_off

    k_font = ImageFont.truetype(GEORGIA, int(size * k_frac))
    # Measure the K by its ink bbox so we can optically center it.
    kb = d.textbbox((0, 0), "K", font=k_font)
    kw, kh = kb[2] - kb[0], kb[3] - kb[1]

    word_font = ImageFont.truetype(GEORGIA_BOLD, int(size * word_frac)) if word else None
    tracking = size * word_frac * 0.42
    word_h = 0
    if word:
        wb = d.textbbox((0, 0), "K", font=word_font)
        word_h = wb[3] - wb[1]

    gap = size * gap_frac
    block_h = kh + (gap + word_h if word else 0)
    top = (size - block_h) / 2

    d.text((cx - kw / 2 - kb[0], top - kb[1]), "K", font=k_font, fill=fg)
    if word:
        wy = top + kh + gap
        draw_tracked(d, "KAPRAY", word_font, cx, wy - wb[1], tracking, fg)
    return img


def rounded(img, radius_frac=0.225):
    """Apply an iOS-style rounded-rect mask (for the plain icon preview)."""
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size, size], radius=int(size * radius_frac), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)

    # 1. App icon — full-bleed white square, K + wordmark. iOS/Android both
    #    apply their own corner masking, so keep it square with a safe margin.
    icon = mark(1024, WHITE, INK, k_frac=0.40, word_frac=0.082, gap_frac=0.035)
    icon.convert("RGB").save(ASSETS / "icon.png")
    # Reuse as favicon (small).
    icon.resize((196, 196)).save(ASSETS / "favicon.png")

    # 2. Android adaptive foreground — transparent, art kept inside the ~66%
    #    safe circle so the launcher mask never clips it. White background
    #    layer is set in app.json.
    fg = mark(1024, (0, 0, 0, 0), INK, k_frac=0.26, word_frac=0.055, gap_frac=0.028)
    fg.save(ASSETS / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), WHITE).save(ASSETS / "android-icon-background.png")
    # Monochrome (Android 13 themed icons): the mark in solid black on transparent.
    fg.save(ASSETS / "android-icon-monochrome.png")

    # 3. Splash — just the K mark, centered; splash bg color is white (app.json).
    splash = mark(1024, (0, 0, 0, 0), INK, k_frac=0.30, word_frac=0.06, gap_frac=0.03)
    splash.save(ASSETS / "splash-icon.png")

    # 4. Rounded preview (not used by the build, handy for docs/README).
    rounded(icon).save(ASSETS / "icon-rounded-preview.png")

    for f in ["icon.png", "favicon.png", "android-icon-foreground.png",
              "android-icon-background.png", "android-icon-monochrome.png",
              "splash-icon.png"]:
        print("wrote", (ASSETS / f).relative_to(ASSETS.parent.parent))


if __name__ == "__main__":
    main()
