#!/usr/bin/env python3
"""Encode reviewed ImageGen masters once, at native size, without upscaling.

Usage: python3 production/build-wow-runtime.py [hero-id ...]
Art: WebP q94 / method 6. Depth: neutral grayscale lossless WebP.
The small-tool's separate size-limited guofeng pipeline is unchanged.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RECIPE = ROOT / 'production/wow-imagegen-v1.json'
MASTERS = ROOT / 'assets/portraits/wow-masters'
OUTPUT = ROOT / 'assets/portraits/wow-runtime'


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    heroes = json.loads(RECIPE.read_text())['heroes']
    selected = sys.argv[1:] or [h['id'] for h in heroes]
    allowed = {h['id'] for h in heroes}
    if not set(selected) <= allowed:
        raise SystemExit('Unknown hero id')
    pairs = []
    # Validate the complete requested batch before writing any runtime asset.
    for hid in selected:
        art = MASTERS / f'{hid}-imagegen-v1.png'
        depth = MASTERS / f'{hid}-depth-v2.png'
        with Image.open(art) as a, Image.open(depth) as d:
            if a.size != d.size or abs(a.width / a.height - 2 / 3) > .002:
                raise SystemExit(f'{hid}: art/depth dimensions must match and be 2:3')
            if a.width < 1024:
                raise SystemExit(f'{hid}: native source is too small, regenerate rather than upscale')
        pairs.append((hid, art, depth))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest_path = ROOT / 'production/wow-runtime-manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'version': 1, 'heroes': {}}
    for hid, art, depth in pairs:
        outputs = []
        for source, suffix, mode, settings in [
            (art, 'full', 'RGB', {'quality': 94, 'method': 6}),
            (depth, 'aiheight', 'L', {'lossless': True, 'method': 6}),
        ]:
            dest = OUTPUT / f'{hid}-imagegen-v1-{suffix}.webp'
            with Image.open(source) as im:
                im.convert(mode).save(dest, 'WEBP', **settings)
                dimensions = list(im.size)
            outputs.append({'source': str(source.relative_to(ROOT)), 'sourceSha256': checksum(source),
                            'output': str(dest.relative_to(ROOT)), 'outputSha256': checksum(dest),
                            'dimensions': dimensions, 'bytes': dest.stat().st_size, 'encoding': settings})
        manifest['heroes'][hid] = {'generator': 'built-in image_gen', 'recipe': str(RECIPE.relative_to(ROOT)),
                                  'cropBottom': 0, 'outputs': outputs}
        print(hid + ': ' + ', '.join(f"{x['bytes'] / 1024:.0f} KiB" for x in outputs))
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
