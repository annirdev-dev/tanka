# Deep green again per feedback, and the glyph itself simplified to a
# perfectly symmetric, centered silhouette — no more off-to-the-side hose
# geometry, which is what kept reading as "weird" across drafts.
from PIL import Image, ImageDraw

BG = (13, 92, 63)        # deep green
GLYPH = (255, 255, 255)


def draw_pump(draw: ImageDraw.ImageDraw, cx: float, cy: float, s: float, color):
    """Draws a plain, symmetric fuel-pump glyph centered at (cx, cy).

    Body + display + price lines, with a small nozzle unit centered on top
    (not off to the side) — fully left-right symmetric, nothing dangling.
    """
    lw = max(1, round(26 * s))

    body_w, body_h = 260 * s, 300 * s
    # The nozzle unit on top extends 70*s above body_t with nothing added
    # below, so shift the body down by half that to keep the whole glyph
    # (body + nozzle) vertically centered on cy, not just the body alone.
    body_l = cx - body_w / 2
    body_t = cy - body_h / 2 + 35 * s
    body_r = body_l + body_w
    body_b = body_t + body_h

    # Pump body
    draw.rounded_rectangle([body_l, body_t, body_r, body_b], radius=30 * s, outline=color, width=lw)

    # Display window
    win_pad_x, win_top, win_h = 34 * s, 32 * s, 100 * s
    draw.rounded_rectangle(
        [body_l + win_pad_x, body_t + win_top, body_r - win_pad_x, body_t + win_top + win_h],
        radius=12 * s, outline=color, width=lw,
    )

    # Two price/keypad lines below the window
    line_y1 = body_t + win_top + win_h + 34 * s
    line_y2 = line_y1 + 34 * s
    draw.line([(body_l + win_pad_x, line_y1), (body_r - win_pad_x, line_y1)], fill=color, width=lw)
    draw.line([(body_l + win_pad_x, line_y2), (body_r - win_pad_x, line_y2)], fill=color, width=lw)

    # Nozzle unit centered on top of the body: a small holster with a handle
    # poking straight up — symmetric around the body's own centerline.
    hol_w, hol_h = 90 * s, 40 * s
    hol_l = cx - hol_w / 2
    hol_t = body_t - hol_h + 14 * s
    draw.rounded_rectangle([hol_l, hol_t, hol_l + hol_w, hol_t + hol_h], radius=12 * s, outline=color, width=lw)

    handle_w = 30 * s
    draw.rounded_rectangle(
        [cx - handle_w / 2, hol_t - 44 * s, cx + handle_w / 2, hol_t + 10 * s],
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
