#!/usr/bin/env python3
"""Renders the trailer titles as transparent PNGs. Used by assemble.sh because the
Homebrew ffmpeg build has no drawtext filter. Requires Pillow (python3 -m pip install pillow)."""
import pathlib
from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).parent
OUT = HERE / 'out' / 'titles'
OUT.mkdir(parents=True, exist_ok=True)
W = 720
PAD = 12
TITLE = HERE / 'fonts' / 'CormorantSC-Bold.ttf'
BODY = HERE / 'fonts' / 'AlegreyaSans-Medium.ttf'
BRASS = (0xEC, 0xD0, 0x8A, 255)   # --brass-hi in src/style.css
PARCH = (0xEC, 0xDF, 0xC2, 255)   # --parch

LINES = [
    ('t1', TITLE, 64, BRASS, '1 Decembrie 1918'),
    ('t2', BODY, 34, PARCH, '1.228 de delegați. O singură zi.'),
    ('t3', TITLE, 78, BRASS, 'Drumul spre Unire'),
    ('t4', BODY, 34, PARCH, 'Joacă istoria. Din 1 Decembrie 2026.'),
]

for name, font_path, size, color, text in LINES:
    font = ImageFont.truetype(str(font_path), size)
    left, top, right, bottom = font.getbbox(text)
    img = Image.new('RGBA', (W, bottom - top + 2 * PAD), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    x = (W - (right - left)) // 2 - left
    y = PAD - top
    draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 180))
    draw.text((x, y), text, font=font, fill=color)
    img.save(OUT / f'{name}.png')
    print(f'{name}.png {img.size[0]}x{img.size[1]}')
