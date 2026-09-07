#!/usr/bin/env python3
"""Validate native pairs and passing QC before recording the final card assets.

Run after build-wow-runtime.py and the browser thumbnail bake. Pillow reads
dimensions only; this step never resizes or modifies an image.
"""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def dimensions(path):
    with Image.open(ROOT / path) as image:
        return list(image.size)


def main():
    roster = json.loads(subprocess.check_output([
        'node', '-e', "const fs=require('fs'),vm=require('vm'),c={window:{}};"
        "vm.runInNewContext(fs.readFileSync('js/heroes-data-wow.js','utf8'),c);"
        "process.stdout.write(JSON.stringify(c.window.WOW_HEROES));"
    ], cwd=ROOT, text=True))
    recipe = json.loads((ROOT / 'production/wow-imagegen-v1.json').read_text())
    path = ROOT / 'production/wow-runtime-manifest.json'
    manifest = json.loads(path.read_text())
    heroes = {hero['id']: hero for hero in roster}
    assert set(manifest['heroes']) == {hero['id'] for hero in recipe['heroes']}
    for hid, entry in manifest['heroes'].items():
        hero = heroes[hid]
        assert hero.get('fullArtLayout') is None, f'{hid}: unexpected layout'
        for output in entry['outputs']:
            assert digest(output['source']) == output['sourceSha256'], f'{hid}: stale source hash'
            assert digest(output['output']) == output['outputSha256'], f'{hid}: stale encoding hash'
            assert dimensions(output['source']) == dimensions(output['output']) == output['dimensions'] == [1024, 1536]
        qc_path = f'production/wow-imagegen/{hid}-qc.json'
        qc = json.loads((ROOT / qc_path).read_text())
        assert qc['id'] == hid and qc['nativeDimensions'] == [1024, 1536]
        assert qc['optimized']['roughPass'] and qc['optimized']['normalPass'], f'{hid}: material QC failed'
        assert qc['goldLines']['comps'] <= 30 and qc['lightPixelDelta'] >= 1, f'{hid}: lighting QC failed'
        assert qc['cropBottom'] == hero['fullArtCropBottom'], f'{hid}: stale framing QC'
        thumbnail = hero['fullArtThumb']
        assert dimensions(thumbnail) == [640, 986], f'{hid}: rebake Retina thumbnail'
        entry.update({
            'cropBottom': hero['fullArtCropBottom'],
            'heightSmoothingLogicalPixels': hero['fullArtHeightSmoothing'],
            'layout': 'warcraft-default', 'styleReference': 'sylvanas-windrunner',
            'thumbnail': {'output': thumbnail, 'sha256': digest(thumbnail),
                          'bytes': (ROOT / thumbnail).stat().st_size, 'dimensions': dimensions(thumbnail)},
            'qc': qc_path, 'qcSha256': digest(qc_path),
            'goldLineParams': hero['goldLineParams'],
            'nonMetalZones': hero.get('fullArtNonMetalZones', []),
        })
    manifest.update({
        'cardArtSha256': digest('js/card-art.js'),
        'heroDataSha256': digest('js/heroes-data-wow.js'),
        'qcScriptSha256': digest('test/wow-qc.js'),
        'coverage': {'totalHeroes': len(roster), 'fullArtHeroes': sum(bool(h.get('fullArt')) for h in roster),
                     'imagegenHeroes': len(manifest['heroes']), 'baseline': 'sylvanas-windrunner'},
    })
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f"Finalized {len(manifest['heroes'])} ImageGen cards; {len(roster)} full-art heroes including Sylvanas.")


if __name__ == '__main__':
    main()
