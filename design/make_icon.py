# Lighter green this time, and the glyph rebuilt to match Tanken's actual
# icon shape: a solid-filled body with a punched-out window (not an
# outlined/hollow body like the previous drafts), plus the diagonal
# handle + trigger ring + hooked hose on the right that Tanken's real
# icon.png uses.
import math

from PIL import Image, ImageDraw

BG = (26, 138, 96)       # lighter green than the previous draft
GLYPH = (255, 255, 255)


def draw_pump(draw: ImageDraw.ImageDraw, cx: float, cy: float, s: float, color, bg):
    """Draws a fuel-pump glyph matching Tanken's icon composition:
    solid body with a cut-out window, a diagonal handle, a trigger ring,
    and a hose that hooks back on itself at the bottom.
    """
    lw = max(1, round(26 * s))

    # Measured directly off Tanken's real icon.png with pixel-column
    # scanning (not eyeballed) — body is 258x463, everything else below
    # as exact offsets from body_r/body_t.
    body_w, body_h = 258 * s, 463 * s
    hose_reach = 175 * s
    total_w = body_w + hose_reach

    body_l = cx - total_w / 2
    body_t = cy - body_h / 2
    body_r = body_l + body_w
    body_b = body_t + body_h

    draw.rounded_rectangle([body_l, body_t, body_r, body_b], radius=34 * s, fill=color)

    # Display window.
    win_l = body_l + 52 * s
    win_r = body_r - 52 * s
    win_t = body_t + 52 * s
    win_h = 122 * s
    draw.rectangle([win_l, win_t, win_r, win_t + win_h], fill=bg)

    # Diagonal handle — floats clear of the body, does not touch it.
    hx1, hy1 = body_r + 53 * s, body_t + 15 * s
    hx2, hy2 = body_r + 110 * s, body_t + 100 * s
    bar_w = 37 * s
    draw.line([(hx1, hy1), (hx2, hy2)], fill=color, width=round(bar_w))
    for p in ((hx1, hy1), (hx2, hy2)):
        r = bar_w / 2
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)

    # Trigger ring — concentric hole, not offset.
    ring_cx, ring_cy = body_r + 103 * s, body_t + 150 * s
    ring_r, hole_r = 64 * s, 25 * s
    draw.ellipse([ring_cx - ring_r, ring_cy - ring_r, ring_cx + ring_r, ring_cy + ring_r], fill=color)
    draw.ellipse([ring_cx - hole_r, ring_cy - hole_r, ring_cx + hole_r, ring_cy + hole_r], fill=bg)

    # Below the ring the hose splits into two PARALLEL bars — a short
    # riser on the left (which curves back to touch the body near its
    # top) and the main drop tube on the right — joined by a hook at the
    # bottom. This is the actual structure, not a single tube.
    # NB: all dy offsets here are relative to body_t (280 was the
    # reference's body top) — e.g. absolute y=690 in the reference is
    # dy=690-280=410, not 690. That mix-up sent the hook off-canvas
    # the first time.
    riser_cx = body_r + 58 * s
    tube_cx = body_r + 148 * s
    bars_top = body_t + 270 * s
    bars_bottom = body_t + 410 * s
    r = bar_w / 2

    def thick_polyline(points, steps_per_seg=12):
        # Stamp overlapping filled circles along the path instead of using
        # draw.line's joints — PIL's thick multi-segment line joints render
        # faceted/wavy at sharp turns, but a chain of circles is always
        # smooth regardless of how many points or how tight the curve.
        all_pts = []
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            for i in range(steps_per_seg + 1):
                t = i / steps_per_seg
                all_pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
        for x, y in all_pts:
            draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

    # Riser: straight down from bars_top, then a semicircular hook curving
    # under and up into the tube — one continuous path, so there's no
    # rectangle/arc seam to misalign (that's what caused the floating
    # "smile" earlier).
    hook_cx = (riser_cx + tube_cx) / 2
    hook_r = (tube_cx - riser_cx) / 2
    hook_pts = [
        (
            hook_cx + hook_r * math.cos(math.radians(deg)),
            bars_bottom + hook_r * math.sin(math.radians(deg)),
        )
        for deg in range(180, -1, -15)  # left, through 90° (image-down), to right
    ]
    thick_polyline([(riser_cx, bars_top)] + hook_pts)

    # Tube: from the hook's right end back up to just below the ring.
    thick_polyline([(tube_cx, bars_bottom), (tube_cx, body_t + 210 * s)])

    # Connector: from the body wall up to the riser's top.
    conn_top = body_t + 233 * s
    thick_polyline([(body_r, conn_top), (riser_cx, bars_top)])


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
    draw_pump(d, cx=256, cy=256, s=0.44, color=GLYPH, bg=transparent)
    img.save("/Users/annir/Tanka/design/android-icon-foreground.png")


def make_android_background():
    img = Image.new("RGBA", (512, 512), BG + (255,))
    img.save("/Users/annir/Tanka/design/android-icon-background.png")


def make_android_monochrome():
    transparent = (0, 0, 0, 0)
    img = Image.new("RGBA", (432, 432), transparent)
    d = ImageDraw.Draw(img)
    draw_pump(d, cx=216, cy=216, s=0.37, color=(255, 255, 255), bg=transparent)
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
