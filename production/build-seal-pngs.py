#!/usr/bin/env python3
"""预渲染印面 glyph PNG（崇羲篆体 → 白字透明底竖排印面，供 card-art.js 贴图）。

背景：崇羲篆体 CC-BY-ND 禁止改作字体文件（不能子集化进包），整字体 21MB
又超包体预算；用字体渲染成图片属于正常使用（与设计稿出图同理）。
输出：assets/seals/s-<djb2hex>.png，文件名哈希与 js/card-art.js 的 sealHash 一致。
"""
import json
import os
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_PATH = os.path.join(ROOT, 'assets/fonts/chongxi_seal.otf')
OUT_DIR = os.path.join(ROOT, 'assets/seals')
CELL = 176          # 每字单元边长（px）
FONT_SIZE = 150     # 单元内字号
PAD = 6             # 四周留白


def djb2(text):
    h = 5381
    for ch in text:
        h = ((h * 33) + ord(ch)) & 0xFFFFFFFF
    return format(h, 'x')


def collect_texts():
    src = open(os.path.join(ROOT, 'js/heroes-data.js'), encoding='utf-8').read()
    texts = set()
    for field in ('seal', 'dynasty', 'category'):
        texts.update(re.findall(r"\b%s:\s*'([^']+)'" % field, src))
    texts.add('群英')   # 卡背大印
    return sorted(texts)


def render_seal(text, font):
    n = len(text)
    w, h = CELL + PAD * 2, CELL * n + PAD * 2
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for i, ch in enumerate(text):
        bbox = font.getbbox(ch)
        gw, gh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = PAD + (CELL - gw) / 2 - bbox[0]
        y = PAD + i * CELL + (CELL - gh) / 2 - bbox[1]
        draw.text((x, y), ch, font=font, fill=(255, 255, 255, 255))
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
    texts = collect_texts()
    total = 0
    mapping = {}
    for text in texts:
        name = f's-{djb2(text)}.png'
        img = render_seal(text, font)
        p = os.path.join(OUT_DIR, name)
        img.save(p, 'PNG', optimize=True)
        size = os.path.getsize(p)
        total += size
        mapping[text] = name
        print(f'{text} -> {name}  {img.size}  {round(size/1024, 1)}KB')
    print('---')
    print(f'{len(texts)} 枚印面，合计 {round(total/1024)}KB')
    # 映射表存一份供人工核对（运行时不加载，hash 才是契约）
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
