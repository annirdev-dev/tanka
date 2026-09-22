# Lighter green this time, and the glyph rebuilt to match Tanken's actual
# icon shape: a solid-filled body with a punched-out window (not an
# outlined/hollow body like the previous drafts), plus the diagonal
# handle + trigger ring + hooked hose on the right that Tanken's real
# icon.png uses.
from PIL import Image, ImageDraw

BG = (26, 138, 96)       # lighter green than the previous draft
GLYPH = (255, 255, 255)


def draw_pump(draw: ImageDraw.ImageDraw, cx: float, cy: float, s: float, color, bg):
    """Draws a fuel-pump glyph matching Tanken's icon composition:
    solid body with a cut-out window, a diagonal handle, a trigger ring,
    and a hose that hooks back on itself at the bottom.
    """
    lw = max(1, round(26 * s))

    body_w, body_h = 260 * s, 460 * s
    hose_reach = 90 * s
    total_w = body_w + hose_reach

    body_l = cx - total_w / 2
    body_t = cy - body_h / 2
    body_r = body_l + body_w
    body_b = body_t + body_h

    # Solid pump body (filled, not outlined — matches Tanken's silhouette).
    draw.rounded_rectangle([body_l, body_t, body_r, body_b], radius=34 * s, fill=color)

    # Display window: punched through the body using the background color.
    win_l = body_l + 45 * s
    win_r = body_r - 50 * s
    win_t = body_t + 53 * s
    win_b = win_t + 120 * s
    draw.rectangle([win_l, win_t, win_r, win_b], fill=bg)

    # Diagonal handle, upper-right of the body.
    hx1, hy1 = body_r + 30 * s, body_t + 8 * s
    hx2, hy2 = body_r + 88 * s, body_t + 66 * s
    draw.line([(hx1, hy1), (hx2, hy2)], fill=color, width=lw)
    for p in ((hx1, hy1), (hx2, hy2)):
        r = lw / 2
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)

    # Trigger ring below the handle.
    ring_cx, ring_cy = body_r + 88 * s, body_t + 150 * s
    ring_r = 40 * s
    draw.ellipse(
        [ring_cx - ring_r, ring_cy - ring_r, ring_cx + ring_r, ring_cy + ring_r],
        outline=color, width=lw,
    )

    # Short connector arm: ring down to the body wall.
    conn_bbox = [body_r - 30 * s, ring_cy - 10 * s, body_r + ring_r + 40 * s, ring_cy + 140 * s]
    draw.arc(conn_bbox, start=210, end=345, fill=color, width=lw)

    # Main hose dropping from the ring, hooking back at the bottom.
    hose_x = ring_cx + 14 * s
    hose_top = (hose_x, ring_cy + ring_r - 6 * s)
    hose_bottom_y = body_b - 90 * s
    draw.line([hose_top, (hose_x, hose_bottom_y)], fill=color, width=lw)
    hook_bbox = [hose_x - 70 * s, hose_bottom_y - 20 * s, hose_x + 40 * s, hose_bottom_y + 90 * s]
    draw.arc(hook_bbox, start=340, end=190, fill=color, width=lw)


def make_icon_1024():
    img = Image.new("RGB", (1024, 1024), BG)
    d = ImageDraw.Draw(img)
    draw_pump(d, cx=512, cy=512, s=1.0, color=GLYPH, bg=BG)
    img.save("/Users/annir/Tanka/design/icon.png")


def make_android_foreground():
    # Adaptive icon safe zone is the inner ~66% of the canvas. Transparent
    # bg so the window cutout shows whatever sits behind this layer.
    transparent = (0, 0, 0, 0)
    img = Image.new("RGBA", (512, 512), transparent)
    d = ImageDraw.Draw(img)
    draw_pump(d, cx=256, cy=256, s=0.5, color=GLYPH, bg=transparent)
    img.save("/Users/annir/Tanka/design/android-icon-foreground.png")


def make_android_background():
    img = Image.new("RGBA", (512, 512), BG + (255,))
    img.save("/Users/annir/Tanka/design/android-icon-background.png")


def make_android_monochrome():
    transparent = (0, 0, 0, 0)
    img = Image.new("RGBA", (432, 432), transparent)
    d = ImageDraw.Draw(img)
    draw_pump(d, cx=216, cy=216, s=0.42, color=(255, 255, 255), bg=transparent)
    img.save("/Users/annir/Tanka/design/android-icon-monochrome.png")


def make_favicon():
    img = Image.open("/Users/annir/Tanka/design/icon.png").resize((48, 48), Image.LANCZOS)
    img.save("/Users/annir/Tanka/design/favicon.png")


if __name__ == "__main__":
    make_icon_1024()
    make_android_foreground()
    make_android_background()
    make_android_monochrome()
    make_favicon()
    print("done")
