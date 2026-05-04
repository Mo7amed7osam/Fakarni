from __future__ import annotations

from pathlib import Path
from typing import Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path("/Users/mohamedhosam/Untitled/ghost")
ASSET_DIR = ROOT / ".tmp_appstore_assets"
OUT_DIR = ROOT / "out" / "app_store_screens"

CANVAS = (1284, 2778)
PHONE_OUTER = (786, 1638)
PHONE_SCREEN = (706, 1533)
PHONE_POS = ((CANVAS[0] - PHONE_OUTER[0]) // 2, 676)

HEADLINE_FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
SUBTITLE_FONT = "/System/Library/Fonts/HelveticaNeue.ttc"


SCREENS = [
    {
        "filename": "01-fakarni-hero.png",
        "title": "Speak Once. It's Done.",
        "subtitle": "Turn your voice into reminders instantly.",
        "asset": "hero-voice.png",
        "zoom": 1.0,
        "shift_y": 0,
        "gradient": ("#F8F4FF", "#EAE1FF"),
        "blob_a": ("#CDBDFF", 0.20, (-160, 2020), 640),
        "blob_b": ("#E4DAFF", 0.28, (850, -170), 710),
    },
    {
        "filename": "02-fakarni-understanding.png",
        "title": "Understands You Instantly",
        "subtitle": "No typing. No confusion.",
        "asset": "understanding-quick-review.png",
        "zoom": 1.03,
        "shift_y": -10,
        "gradient": ("#F9F5FF", "#EEE4FF"),
        "blob_a": ("#D6C6FF", 0.18, (-120, 2100), 600),
        "blob_b": ("#E2D7FF", 0.26, (870, 0), 650),
    },
    {
        "filename": "03-fakarni-follow-up.png",
        "title": "Never Miss a Reminder",
        "subtitle": "Smart follow-ups if you don't act.",
        "asset": "followup-calendar.png",
        "zoom": 1.16,
        "shift_y": -120,
        "gradient": ("#F8F3FF", "#E8DEFF"),
        "blob_a": ("#D7C5FF", 0.22, (-160, 2030), 640),
        "blob_b": ("#DDD1FF", 0.24, (870, -80), 690),
    },
    {
        "filename": "04-fakarni-calendar.png",
        "title": "Syncs with Your Calendar",
        "subtitle": "Saved automatically to Apple Calendar.",
        "asset": "followup-calendar.png",
        "zoom": 1.18,
        "shift_y": -455,
        "gradient": ("#F8F4FF", "#E7DEFF"),
        "blob_a": ("#D6C4FF", 0.20, (-120, 2100), 610),
        "blob_b": ("#E5DBFF", 0.28, (840, 40), 700),
    },
    {
        "filename": "05-fakarni-organization.png",
        "title": "Everything in One Place",
        "subtitle": "Track and manage your tasks easily.",
        "asset": "organization-list.png",
        "zoom": 1.0,
        "shift_y": 0,
        "gradient": ("#F8F3FF", "#E8DEFF"),
        "blob_a": ("#CEC0FF", 0.18, (-150, 2080), 620),
        "blob_b": ("#E3D7FF", 0.26, (860, -120), 740),
    },
    {
        "filename": "06-fakarni-edit.png",
        "title": "Edit Anytime",
        "subtitle": "Quickly adjust time and details.",
        "asset": "manual-edit.png",
        "zoom": 1.0,
        "shift_y": 0,
        "gradient": ("#F8F4FF", "#E9DFFF"),
        "blob_a": ("#D6C6FF", 0.18, (-140, 2080), 620),
        "blob_b": ("#E5DAFF", 0.24, (860, -100), 720),
    },
]


def hex_to_rgba(value: str, alpha: float = 1.0) -> Tuple[int, int, int, int]:
    value = value.lstrip("#")
    return (
        int(value[0:2], 16),
        int(value[2:4], 16),
        int(value[4:6], 16),
        int(alpha * 255),
    )


def rounded_mask(size: Tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def make_gradient(size: Tuple[int, int], top_hex: str, bottom_hex: str) -> Image.Image:
    top = hex_to_rgba(top_hex)
    bottom = hex_to_rgba(bottom_hex)
    img = Image.new("RGBA", size)
    px = img.load()
    width, height = size
    for y in range(height):
        t = y / (height - 1)
        for x in range(width):
            mix = (x / width) * 0.14 + t * 0.86
            color = tuple(int(top[i] * (1 - mix) + bottom[i] * mix) for i in range(4))
            px[x, y] = color
    return img


def add_blob(base: Image.Image, color_hex: str, alpha: float, pos: Tuple[int, int], size: int) -> None:
    blob = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(blob)
    x, y = pos
    draw.ellipse((x, y, x + size, y + size), fill=hex_to_rgba(color_hex, alpha))
    blob = blob.filter(ImageFilter.GaussianBlur(size // 5))
    base.alpha_composite(blob)


def fit_ui(asset_path: Path, zoom: float, shift_y: int) -> Image.Image:
    source = Image.open(asset_path).convert("RGBA")
    target_w = int(PHONE_SCREEN[0] * zoom)
    target_h = int(target_w * source.height / source.width)
    source = source.resize((target_w, target_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", PHONE_SCREEN, (255, 255, 255, 255))
    offset_x = (PHONE_SCREEN[0] - target_w) // 2
    offset_y = (PHONE_SCREEN[1] - target_h) // 2 + shift_y
    canvas.alpha_composite(source, (offset_x, offset_y))
    return canvas


def draw_centered_text(
    image: Image.Image,
    text: str,
    font: ImageFont.FreeTypeFont,
    box: Tuple[int, int, int, int],
    fill: Tuple[int, int, int, int],
    spacing: int = 0,
) -> None:
    draw = ImageDraw.Draw(image)
    bbox = draw.multiline_textbbox((0, 0), text, font=font, align="center", spacing=spacing)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = box[0] + (box[2] - box[0] - w) / 2
    y = box[1] + (box[3] - box[1] - h) / 2
    draw.multiline_text((x, y), text, font=font, fill=fill, align="center", spacing=spacing)


def fit_headline(text: str, max_width: int, max_lines: int = 2) -> tuple[ImageFont.FreeTypeFont, str]:
    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10), (0, 0, 0, 0)))
    words = text.split()

    def wrap(font: ImageFont.FreeTypeFont) -> str | None:
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            bbox = probe.multiline_textbbox((0, 0), candidate, font=font, spacing=4)
            width = bbox[2] - bbox[0]
            if width <= max_width or not current:
                current = candidate
                continue
            lines.append(current)
            current = word
        if current:
            lines.append(current)
        if len(lines) > max_lines:
            return None
        for line in lines:
            bbox = probe.textbbox((0, 0), line, font=font)
            if bbox[2] - bbox[0] > max_width:
                return None
        return "\n".join(lines)

    for size in range(102, 76, -2):
        font = ImageFont.truetype(HEADLINE_FONT, size)
        wrapped = wrap(font)
        if wrapped:
            return font, wrapped

    fallback = ImageFont.truetype(HEADLINE_FONT, 76)
    return fallback, text


def build_phone(base: Image.Image, cfg: dict) -> None:
    px, py = PHONE_POS

    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        (px + 20, py + PHONE_OUTER[1] - 40, px + PHONE_OUTER[0] - 20, py + PHONE_OUTER[1] + 62),
        fill=hex_to_rgba("#8B5CF6", 0.18),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(52))
    base.alpha_composite(shadow)

    phone_shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    phone_shadow_draw = ImageDraw.Draw(phone_shadow)
    phone_shadow_draw.rounded_rectangle(
        (px, py + 18, px + PHONE_OUTER[0], py + PHONE_OUTER[1] + 18),
        radius=112,
        fill=hex_to_rgba("#2B1E5E", 0.18),
    )
    phone_shadow = phone_shadow.filter(ImageFilter.GaussianBlur(40))
    base.alpha_composite(phone_shadow)

    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle(
        (px, py, px + PHONE_OUTER[0], py + PHONE_OUTER[1]),
        radius=112,
        fill=hex_to_rgba("#181427"),
        outline=hex_to_rgba("#6B5A92", 0.28),
        width=3,
    )
    draw.rounded_rectangle(
        (px + 16, py + 16, px + PHONE_OUTER[0] - 16, py + PHONE_OUTER[1] - 16),
        radius=100,
        fill=hex_to_rgba("#0F0B1D"),
    )

    ui = fit_ui(ASSET_DIR / cfg["asset"], cfg["zoom"], cfg["shift_y"])
    screen_mask = rounded_mask(PHONE_SCREEN, 82)
    screen = Image.new("RGBA", PHONE_SCREEN, (255, 255, 255, 255))
    screen.alpha_composite(ui)
    screen.putalpha(screen_mask)
    base.alpha_composite(screen, (px + 40, py + 38))

    draw.rounded_rectangle(
        (px + 279, py + 22, px + 507, py + 76),
        radius=27,
        fill=hex_to_rgba("#090A10"),
    )
    draw.rounded_rectangle(
        (px + 274, py + PHONE_OUTER[1] - 64, px + 512, py + PHONE_OUTER[1] - 54),
        radius=5,
        fill=hex_to_rgba("#FFFFFF", 0.84),
    )


def render_single(cfg: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base = make_gradient(CANVAS, cfg["gradient"][0], cfg["gradient"][1])
    add_blob(base, *cfg["blob_a"])
    add_blob(base, *cfg["blob_b"])

    headline_font, wrapped_title = fit_headline(cfg["title"], CANVAS[0] - 120)
    subtitle_font = ImageFont.truetype(SUBTITLE_FONT, 54, index=0)

    draw_centered_text(
        base,
        wrapped_title,
        headline_font,
        (60, 142, CANVAS[0] - 60, 372),
        hex_to_rgba("#17142C"),
        spacing=6,
    )
    draw_centered_text(
        base,
        cfg["subtitle"],
        subtitle_font,
        (120, 350, CANVAS[0] - 120, 470),
        hex_to_rgba("#6B6487"),
        spacing=4,
    )

    build_phone(base, cfg)

    out_path = OUT_DIR / cfg["filename"]
    base.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def build_contact_sheet(paths: list[Path]) -> None:
    thumbs = []
    for path in paths:
        image = Image.open(path).convert("RGB")
        image.thumbnail((340, 736), Image.Resampling.LANCZOS)
        tile = Image.new("RGB", (380, 790), "white")
        x = (tile.width - image.width) // 2
        y = 24
        tile.paste(image, (x, y))
        thumbs.append(tile)

    sheet = Image.new("RGB", (3 * 380 + 80, 2 * 790 + 60), "#F2EDFF")
    positions = [(20, 20), (400, 20), (780, 20), (20, 830), (400, 830), (780, 830)]
    for thumb, pos in zip(thumbs, positions):
        sheet.paste(thumb, pos)
    sheet.save(OUT_DIR / "overview.png", "PNG", optimize=True)


def main() -> None:
    outputs = [render_single(cfg) for cfg in SCREENS]
    build_contact_sheet(outputs)
    print("\n".join(str(path) for path in outputs))


if __name__ == "__main__":
    main()
