from PIL import Image, ImageDraw

# Light, bright blue — distinct from Tanken's dark navy, still in the same
# "clean/trustworthy" family the user asked for ("make the blue little
# light" = a light blue, not the green from the first draft).
BG = (46, 137, 227)      # light/bright blue
GLYPH = (255, 255, 255)


def draw_pump(draw: ImageDraw.ImageDraw, cx: float, cy: float, s: float, color):
    """Draws a simplified flat fuel-pump glyph centered at (cx, cy).

    Dropped the separate nozzle-holster box + floating handle from the first
    draft (that's what read as "weird") in favor of a single smooth spout
    line off the body, ending in a small round nozzle tip — fewer disjointed
    parts, cleaner silhouette.
    """
    lw = max(1, round(26 * s))

    body_w, body_h = 240 * s, 300 * s
    spout_reach = 130 * s
    total_w = body_w + spout_reach
    total_h = body_h

    body_l = cx - total_w / 2
    body_t = cy - total_h / 2
    body_r = body_l + body_w
    body_b = body_t + body_h

    # Pump body
    draw.rounded_rectangle([body_l, body_t, body_r, body_b], radius=30 * s, outline=color, width=lw)

    # Display window
    win_pad_x, win_top, win_h = 32 * s, 32 * s, 110 * s
    draw.rounded_rectangle(
        [body_l + win_pad_x, body_t + win_top, body_r - win_pad_x, body_t + win_top + win_h],
        radius=12 * s, outline=color, width=lw,
    )

    # Two price/keypad lines below the window
    line_y1 = body_t + win_top + win_h + 34 * s
    line_y2 = line_y1 + 34 * s
    draw.line([(body_l + win_pad_x, line_y1), (body_r - win_pad_x, line_y1)], fill=color, width=lw)
    draw.line([(body_l + win_pad_x, line_y2), (body_r - win_pad_x, line_y2)], fill=color, width=lw)

    # Single spout: one straight diagonal stroke from the body's upper-right
    # corner to a small round nozzle tip. No bend point — a kinked line was
    # what made the previous draft look like a golf club.
    spout_start = (body_r - 8 * s, body_t + 50 * s)
    spout_end = (body_r + spout_reach * 0.85, body_t + 130 * s)
    draw.line([spout_start, spout_end], fill=color, width=lw)
    r = lw / 2
    draw.ellipse([spout_start[0] - r, spout_start[1] - r, spout_start[0] + r, spout_start[1] + r], fill=color)

    tip_r = 22 * s
    draw.ellipse(
        [spout_end[0] - tip_r, spout_end[1] - tip_r, spout_end[0] + tip_r, spout_end[1] + tip_r],
        outline=color, width=lw,
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
