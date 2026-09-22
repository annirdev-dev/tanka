from PIL import Image, ImageDraw

# Portugal-distinct palette: deep green (flag-inspired), warm off-white glyph.
# Deliberately not navy (Tanken's color) so the two apps never get confused
# on a home screen, while keeping the same flat fuel-pump glyph language.
BG = (13, 92, 63)       # deep green
GLYPH = (255, 255, 255)


def draw_pump(draw: ImageDraw.ImageDraw, cx: float, cy: float, s: float, color):
    """Draws a flat fuel-pump glyph centered at (cx, cy), scaled by s.

    Simple boxy silhouette (body + display + a side nozzle holster), closer
    to well-tested minimal gas-station glyphs than a hand-drawn hose curve —
    reads cleanly at small sizes, which is what actually matters for an app
    icon.
    """
    lw = max(1, round(26 * s))

    # Overall glyph bounding box (for centering math): body + holster.
    body_w, body_h = 220 * s, 300 * s
    holster_w, holster_h = 70 * s, 110 * s
    total_w = body_w + holster_w + 14 * s
    total_h = body_h

    body_l = cx - total_w / 2
    body_t = cy - total_h / 2
    body_r = body_l + body_w
    body_b = body_t + body_h

    # Pump body
    draw.rounded_rectangle([body_l, body_t, body_r, body_b], radius=28 * s, outline=color, width=lw)

    # Display window
    win_pad_x, win_top, win_h = 30 * s, 30 * s, 110 * s
    draw.rounded_rectangle(
        [body_l + win_pad_x, body_t + win_top, body_r - win_pad_x, body_t + win_top + win_h],
        radius=12 * s, outline=color, width=lw,
    )

    # Two price/keypad lines below the window
    line_y1 = body_t + win_top + win_h + 34 * s
    line_y2 = line_y1 + 34 * s
    draw.line([(body_l + win_pad_x, line_y1), (body_r - win_pad_x, line_y1)], fill=color, width=lw)
    draw.line([(body_l + win_pad_x, line_y2), (body_r - win_pad_x, line_y2)], fill=color, width=lw)

    # Nozzle holster on the right side, attached to the body
    hol_l = body_r - 6 * s
    hol_t = body_t + 40 * s
    hol_r = hol_l + holster_w
    hol_b = hol_t + holster_h
    draw.rounded_rectangle([hol_l, hol_t, hol_r, hol_b], radius=16 * s, outline=color, width=lw)

    # Nozzle handle poking up out of the holster — outlined like every other
    # shape in the glyph, not filled, so the whole icon reads as one
    # consistent line-weight rather than mixing stroke and solid shapes.
    handle_w = 34 * s
    handle_x = hol_l + holster_w * 0.55
    draw.rounded_rectangle(
        [handle_x - handle_w / 2, hol_t - 50 * s, handle_x + handle_w / 2, hol_t + 14 * s],
        radius=15 * s, outline=color, width=lw,
    )


def make_icon_1024():
    img = Image.new("RGB", (1024, 1024), BG)
    d = ImageDraw.Draw(img)
    draw_pump(d, cx=512, cy=512, s=1.35, color=GLYPH)
    img.save("/Users/annir/Tanka/design/icon.png")


def make_android_foreground():
    # Adaptive icon safe zone is the inner ~66% of the canvas.
    img = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_pump(d, cx=256, cy=256, s=0.66, color=GLYPH)
    img.save("/Users/annir/Tanka/design/android-icon-foreground.png")


def make_android_background():
    img = Image.new("RGBA", (512, 512), BG + (255,))
    img.save("/Users/annir/Tanka/design/android-icon-background.png")


def make_android_monochrome():
    img = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_pump(d, cx=216, cy=216, s=0.56, color=(255, 255, 255))
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
