import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const source = fs.readFileSync(new URL('../js/card-art.js', import.meta.url), 'utf8');

function fixture(available) {
  const requests = [], drawings = [];
  class Image {
    set src(value) {
      this.url = value; requests.push(value);
      queueMicrotask(() => {
        if (available.includes(value)) { this.naturalWidth=400; this.naturalHeight=616; this.onload(); }
        else this.onerror();
      });
    }
  }
  const context = { window: {}, Image, document: {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return { getContext() { return { drawImage(...args) { drawings.push(args); } }; } };
    }
  }};
  vm.runInNewContext(source, context);
  return { art: context.window.CardArt, requests, drawings };
}

test('a missing full-art asset loads its existing portrait fallback', async () => {
  const f = fixture(['assets/portraits/thrall.webp']);
  await f.art.preloadPortraits([{id:'thrall',fullArt:'missing-full.webp'}]);
  assert.equal(f.art.hasPortrait({id:'thrall'}), true);
  assert.deepEqual(f.requests.filter(p=>!p.startsWith('assets/seals/')), ['missing-full.webp','assets/portraits/thrall.webp']);
});

test('a successful full-art preload avoids obsolete portrait probes', async () => {
  const f = fixture(['full.webp']);
  await f.art.preloadPortraits([{id:'thrall',fullArt:'full.webp'}]);
  assert.deepEqual(f.requests.filter(p=>!p.startsWith('assets/seals/')), ['full.webp']);
});

test('gallery uses the baked card without allocating full material canvases', async () => {
  const f = fixture(['full.webp','thumb.webp']);
  const hero = {id:'thrall',fullArt:'full.webp',fullArtThumb:'thumb.webp'};
  await f.art.preloadPortraits([hero]);
  const canvas = f.art.paintMini(hero,300,464);
  assert.equal(canvas.width,300);
  assert.equal(f.drawings.length,1);
  assert.equal(f.drawings[0][0].url,'thumb.webp');
});

test('ImageGen cards have complete assets, independent framing and reproducible encodings', () => {
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(new URL('../js/heroes-data-wow.js', import.meta.url),'utf8'),context);
  const manifest=JSON.parse(fs.readFileSync(new URL('../production/wow-runtime-manifest.json',import.meta.url),'utf8'));
  const heroes=context.window.WOW_HEROES.filter(h=>manifest.heroes[h.id]);
  const baseline=context.window.WOW_HEROES.find(h=>h.id==='sylvanas-windrunner');
  assert.equal(context.window.WOW_HEROES.length,24);
  assert.equal(heroes.length,23);
  for (const hero of context.window.WOW_HEROES) {
    for (const field of ['fullArt','fullArtHeight']) {
      assert.equal(typeof hero[field],'string',`${hero.id}: missing ${field}`);
      assert.ok(fs.statSync(new URL('../'+hero[field],import.meta.url)).size>1000);
    }
  }
  const recipe=JSON.parse(fs.readFileSync(new URL('../production/wow-imagegen-v1.json',import.meta.url),'utf8'));
  assert.deepEqual(recipe.heroes.map(h=>h.id).sort(),Object.keys(manifest.heroes).sort());
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../js/heroes-data-wow.js',import.meta.url))).digest('hex'),manifest.heroDataSha256);
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../test/wow-qc.js',import.meta.url))).digest('hex'),manifest.qcScriptSha256);
  assert.equal(createHash('sha256').update(source).digest('hex'),manifest.cardArtSha256);
  for(const hero of heroes) {
    assert.equal(hero.fullArtLayout,baseline.fullArtLayout);
    const entry=manifest.heroes[hero.id];
    assert.equal(entry.layout,'warcraft-default');
    assert.equal(entry.styleReference,baseline.id);
    const thumbnail=fs.readFileSync(new URL('../'+hero.fullArtThumb,import.meta.url));
    assert.equal(createHash('sha256').update(thumbnail).digest('hex'),entry.thumbnail.sha256);
    assert.deepEqual(entry.thumbnail.dimensions,[1329,2048]);
    assert.equal(thumbnail.length,entry.thumbnail.bytes);
    assert.equal(hero.fullArtCropBottom,entry.cropBottom);
    assert.equal(hero.fullArtHeightSmoothing,entry.heightSmoothingLogicalPixels);
    assert.deepEqual(JSON.parse(JSON.stringify(hero.goldLineParams)),entry.goldLineParams);
    assert.deepEqual(JSON.parse(JSON.stringify(hero.fullArtNonMetalZones||[])),entry.nonMetalZones);
    const qcBytes=fs.readFileSync(new URL('../'+entry.qc,import.meta.url));
    assert.equal(createHash('sha256').update(qcBytes).digest('hex'),entry.qcSha256);
    const qc=JSON.parse(qcBytes);
    assert.ok(qc.optimized.roughPass && qc.optimized.normalPass,hero.id+': material QC failed');
    assert.ok(qc.lightPixelDelta>=1 && qc.goldLines.comps<=30,hero.id+': lighting QC failed');
    assert.ok(hero.goldLineParams.skipZones.length>=4);
    for(const field of ['fullArt','fullArtHeight','fullArtThumb']) {
      assert.equal(typeof hero[field],'string',`${hero.id}: missing ${field}`);
      assert.ok(fs.statSync(new URL('../'+hero[field],import.meta.url)).size>1000);
    }
    for(const output of manifest.heroes[hero.id].outputs) {
      const bytes=fs.readFileSync(new URL('../'+output.output,import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),output.outputSha256);
      const master=fs.readFileSync(new URL('../'+output.source,import.meta.url));
      assert.equal(createHash('sha256').update(master).digest('hex'),output.sourceSha256);
      assert.deepEqual(output.dimensions,[1024,1536]);
    }
  }
});
