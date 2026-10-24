"""Genereaza iconita aplicatiei (build/icon.ico + src/renderer/assets/icon.png)."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 1024
BG = (16, 14, 12, 255)
GOLD = (216, 179, 110, 255)


def draw() -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, 40, S - 40, S - 40], radius=220, fill=BG)
    w = 34
    d.ellipse([150, 150, S - 150, S - 150], outline=GOLD, width=w)
    # furculita (stanga)
    x = 380
    d.line([(x - 60, 330), (x - 60, 470)], fill=GOLD, width=w)
    d.line([(x, 330), (x, 470)], fill=GOLD, width=w)
    d.line([(x + 60, 330), (x + 60, 470)], fill=GOLD, width=w)
    d.arc([x - 60, 400, x + 60, 540], 0, 180, fill=GOLD, width=w)
    d.line([(x, 540), (x, 720)], fill=GOLD, width=w)
    # nota muzicala (dreapta)
    d.line([(600, 360), (600, 680)], fill=GOLD, width=w)
    d.line([(720, 330), (720, 600)], fill=GOLD, width=w)
    d.line([(600, 360), (720, 330)], fill=GOLD, width=w)
    d.ellipse([530, 640, 620, 720], outline=GOLD, width=w)
    d.ellipse([650, 560, 740, 640], outline=GOLD, width=w)
    return img


def main() -> None:
    img = draw()
    (ROOT / "build").mkdir(exist_ok=True)
    assets = ROOT / "src" / "renderer" / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    img.resize((512, 512), Image.LANCZOS).save(assets / "icon.png")
    img.save(ROOT / "build" / "icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])


if __name__ == "__main__":
    main()
