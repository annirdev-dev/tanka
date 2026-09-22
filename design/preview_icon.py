from PIL import Image, ImageDraw

ASSETS = "/Users/annir/Tanka/app/assets"
OUT = "/Users/annir/Tanka/design/preview.png"

CANVAS_W = 1400
CANVAS_H = 720
BG_PREVIEW = (235, 236, 239)
TILE = 300  # rendered icon tile size in the preview


def squircle_mask(size: int, corner_ratio: float = 0.223) -> Image.Image:
    """Approximates iOS's continuous-corner squircle using a supersampled
    rounded-rect (good enough at preview size to judge how the glyph reads
    once the corners are cut)."""
    ss = 4
    big = size * ss
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    r = int(big * corner_ratio)
    d.rounded_rectangle([0, 0, big - 1, big - 1], radius=r, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def circle_mask(size: int) -> Image.Image:
    ss = 4
    big = size * ss
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, big - 1, big - 1], fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def masked(img: Image.Image, mask: Image.Image) -> Image.Image:
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img.convert("RGBA"), (0, 0), mask)
    return out


def label(draw, text, x, y):
    draw.text((x, y), text, fill=(60, 62, 68))


def main():
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), BG_PREVIEW)
    d = ImageDraw.Draw(canvas)

    # --- iOS: plain icon.png, squircle-masked ---
    ios_src = Image.open(f"{ASSETS}/icon.png").convert("RGBA").resize((TILE, TILE), Image.LANCZOS)
    ios_icon = masked(ios_src, squircle_mask(TILE))
    canvas.paste(ios_icon, (150, 120), ios_icon)
    label(d, "iOS (squircle mask)", 150, 120 + TILE + 20)

    # Small-size legibility check for iOS, ~60pt @3x = 180px, and a tiny 60px
    for i, small in enumerate((120, 60)):
        tile = ios_src.resize((small, small), Image.LANCZOS)
        tile = masked(tile, squircle_mask(small))
        x = 150 + TILE + 60 + i * 160
        y = 120 + (TILE - small)
        canvas.paste(tile, (x, y), tile)
        label(d, f"{small}px", x, y + small + 10)

    # --- Android: composite background + foreground, circle-masked ---
    bg = Image.open(f"{ASSETS}/android-icon-background.png").convert("RGBA").resize((TILE, TILE), Image.LANCZOS)
    fg = Image.open(f"{ASSETS}/android-icon-foreground.png").convert("RGBA").resize((TILE, TILE), Image.LANCZOS)
    android_flat = Image.alpha_composite(bg, fg)
    android_icon = masked(android_flat, circle_mask(TILE))
    canvas.paste(android_icon, (150, 400), android_icon)
    label(d, "Android (circle mask)", 150, 400 + TILE + 20)

    for i, small in enumerate((120, 60)):
        tile = android_flat.resize((small, small), Image.LANCZOS)
        tile = masked(tile, circle_mask(small))
        x = 150 + TILE + 60 + i * 160
        y = 400 + (TILE - small)
        canvas.paste(tile, (x, y), tile)
        label(d, f"{small}px", x, y + small + 10)

    canvas.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    main()
