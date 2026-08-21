import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import AtlasModel from '../js/atlas-data.js';
import MapGeometry from '../js/map-geometry.js';

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG dimensions are unavailable');
}

function loadHeroes() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../js/heroes-data.js', import.meta.url), 'utf8'), context);
  return context.window.WOW_HEROES;
}

test('reused historical places resolve to one geographic point', () => {
  const changan = AtlasModel.places.changan;
  assert.deepEqual(changan.coordinates, [108.94, 34.34]);

  for (const heroId of ['hanwudi', 'tangtaizong', 'wuzetian', 'dufu', 'zhangqian', 'xuanzang', 'libai']) {
    const route = AtlasModel.routes[heroId];
    assert.ok(route.includes('changan'), `${heroId} should reference the canonical Chang'an place`);
    assert.equal(AtlasModel.places[route[route.indexOf('changan')]], changan);
  }
});

test('Zheng He route uses real westward and southward geography', () => {
  const hero = { id: 'zhenghe', stops: AtlasModel.routes.zhenghe.map((placeId) => ({ placeId })) };
  const result = MapGeometry.layout(hero, { width: 390, height: 844 }, AtlasModel);
  const byId = Object.fromEntries(result.markers.map((marker) => [marker.placeId, marker]));

  assert.ok(byId.hormuz.x < byId.calicut.x, 'Hormuz should be west of Calicut');
  assert.ok(byId.malindi.x < byId.calicut.x, 'Malindi should be west of Calicut');
  assert.ok(byId.malindi.y > byId.calicut.y, 'Malindi should be south of Calicut');
  assert.equal(result.unresolvedStops.length, 0);
});

test('every biography stop resolves through the geographic registry', () => {
  const heroes = loadHeroes();

  for (const hero of heroes) {
    const route = AtlasModel.routes[hero.id];
    assert.ok(route, `${hero.id} should have a geographic route`);
    assert.equal(route.length, hero.stops.length, `${hero.id} should map every biography stop`);
    for (const stop of hero.stops) {
      assert.equal('mx' in stop, false, `${hero.id}/${stop.place} should not retain legacy map x coordinates`);
      assert.equal('my' in stop, false, `${hero.id}/${stop.place} should not retain legacy map y coordinates`);
    }

    const result = MapGeometry.layout(hero, { width: 390, height: 844 }, AtlasModel);
    assert.equal(result.unresolvedStops.length, 0, `${hero.id} should not contain unresolved stops`);
    assert.equal(result.markers.length, hero.stops.length);
  }
});

test('every registered place declares coordinates and uncertainty', () => {
  for (const [placeId, place] of Object.entries(AtlasModel.places)) {
    assert.match(placeId, /^[a-z0-9_]+$/);
    assert.equal(place.coordinates.length, 2);
    assert.ok(Number.isFinite(place.coordinates[0]));
    assert.ok(Number.isFinite(place.coordinates[1]));
    assert.ok(place.coordinates[0] >= AtlasModel.projection.bounds.west && place.coordinates[0] <= AtlasModel.projection.bounds.east,
      `${placeId} longitude should be inside the declared atlas bounds`);
    assert.ok(place.coordinates[1] >= AtlasModel.projection.bounds.south && place.coordinates[1] <= AtlasModel.projection.bounds.north,
      `${placeId} latitude should be inside the declared atlas bounds`);
    assert.ok(['site', 'city', 'region', 'unknown'].includes(place.precision));
    assert.ok(['high', 'medium', 'low'].includes(place.confidence));
    assert.ok(place.source, `${placeId} should record a source`);
  }
});

test('narrative regions do not claim point-level precision', () => {
  for (const placeId of ['zhongyuan', 'jiangnan', 'yellow_river', 'mulan_homeland', 'manyou', 'zhenghe_return']) {
    assert.ok(['region', 'unknown'].includes(AtlasModel.places[placeId].precision));
  }
});

test('legacy artwork calibration is exact at control points and rejects unsupported geography', () => {
  const libai = { id: 'libai', stops: AtlasModel.routes.libai.map((placeId) => ({ placeId })) };
  const calibrated = MapGeometry.layout(libai, { width: 390, height: 844 }, AtlasModel, { mode: 'legacy-calibrated' });
  const changan = calibrated.markers.find((marker) => marker.placeId === 'changan');

  assert.equal(changan.x, 0.50 * AtlasModel.legacyCalibration.image.width);
  assert.equal(changan.y, 0.34 * AtlasModel.legacyCalibration.image.height);

  const zhenghe = { id: 'zhenghe', stops: AtlasModel.routes.zhenghe.map((placeId) => ({ placeId })) };
  const unsupported = MapGeometry.layout(zhenghe, { width: 390, height: 844 }, AtlasModel, { mode: 'legacy-calibrated' });
  assert.ok(unsupported.unresolvedStops.some((item) => item.placeId === 'hormuz'));
  assert.ok(unsupported.unresolvedStops.some((item) => item.placeId === 'malindi'));
});

test('active atlas asset is generated from the same declared projection', () => {
  assert.equal(AtlasModel.asset.src, 'assets/atlas/map-projected.svg');
  assert.equal(AtlasModel.asset.projectionId, AtlasModel.projection.id);
  assert.equal(AtlasModel.asset.skinSrc, 'assets/atlas/map-terrain-natural-earth-v2.jpg');
  assert.equal(AtlasModel.asset.skinStyle, 'natural-earth-srtm-qinglu-v2');
  assert.equal(AtlasModel.asset.terrainManifest, 'assets/atlas/terrain-manifest.json');

  const svg = fs.readFileSync(new URL('../assets/atlas/map-projected.svg', import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(svg) < 1_500_000, 'runtime map asset should stay below 1.5 MB');
  assert.match(svg, /viewBox="0 0 2400 1600"/);
  assert.match(svg, /data-projection="web-mercator-eurasia-indian-ocean-v1"/);
  assert.match(svg, /data-skin="natural-earth-srtm-qinglu-v2"/);
  assert.match(svg, /data-skin-source="map-terrain-natural-earth-v2.jpg"/);
  assert.match(svg, /data-terrain-source="natural-earth-shaded-relief-srtm-plus"/);
  assert.match(svg, /id="ocean-mask"/);
  assert.doesNotMatch(svg, /data:image\//);
  assert.doesNotMatch(svg, /<image\b/);
  assert.match(svg, /id="china-mainland-outline" d="M[^"]+"/);
  assert.match(svg, /data-boundary-source="natural-earth-admin-0-110m"/);
  assert.match(svg, /Natural Earth/);
});

test('terrain derivative is traceable, projected and within the runtime budget', () => {
  const manifest = JSON.parse(fs.readFileSync(
    new URL('../assets/atlas/terrain-manifest.json', import.meta.url),
    'utf8'
  ));
  const terrain = fs.readFileSync(new URL('../assets/atlas/map-terrain-natural-earth-v2.jpg', import.meta.url));
  const checksum = crypto.createHash('sha256').update(terrain).digest('hex');

  assert.equal(manifest.provider, 'Natural Earth');
  assert.equal(manifest.product, '1:10m Shaded Relief Basic');
  assert.equal(manifest.embeddedVersion, '2.0.0');
  assert.equal(manifest.projectionId, AtlasModel.projection.id);
  assert.equal(manifest.source.sha256, 'b2619fff2fc73c17152983c066adfaa25c4b626916b822bad2fae8bcd9be41a5');
  assert.equal(checksum, manifest.output.sha256);
  assert.deepEqual(jpegDimensions(terrain), { width: AtlasModel.projection.width, height: AtlasModel.projection.height });
  assert.ok(terrain.length < 1_500_000, 'terrain texture should stay below 1.5 MB');
});

test('terrain derivative preserves two-dimensional geographic relief', () => {
  const manifest = JSON.parse(fs.readFileSync(
    new URL('../assets/atlas/terrain-manifest.json', import.meta.url),
    'utf8'
  ));
  const analysis = manifest.output.spatialAnalysis;
  assert.ok(analysis.horizontalMeanDifference > 1,
    `terrain should vary east-west, received ${analysis.horizontalMeanDifference}`);
  assert.ok(analysis.verticalMeanDifference > 1,
    `terrain should vary north-south, received ${analysis.verticalMeanDifference}`);
  assert.ok(analysis.luminanceRange[1] - analysis.luminanceRange[0] > 20);
});

test('terrain canvas bounds come from the declared projector without hand calibration', () => {
  const bounds = MapGeometry.fullCanvasBounds(AtlasModel);
  assert.ok(Math.abs(bounds.west - 20.29864) < 0.00001);
  assert.ok(Math.abs(bounds.east - 156.70136) < 0.00001);
  assert.ok(Math.abs(bounds.south - -15.532295) < 0.00001);
  assert.ok(Math.abs(bounds.north - 59.876223) < 0.00001);
  const northwest = MapGeometry.project([bounds.west, bounds.north], AtlasModel);
  const southeast = MapGeometry.project([bounds.east, bounds.south], AtlasModel);
  assert.ok(Math.abs(northwest.x) < 0.00001 && Math.abs(northwest.y) < 0.00001);
  assert.ok(Math.abs(southeast.x - AtlasModel.projection.width) < 0.00001);
  assert.ok(Math.abs(southeast.y - AtlasModel.projection.height) < 0.00001);
});

test('checked-in atlas asset matches a fresh deterministic build', (t) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'herocards-atlas-'));
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const generatedPath = path.join(temporaryDirectory, 'map-projected.svg');
  const scriptPath = fileURLToPath(new URL('../scripts/build-atlas.mjs', import.meta.url));
  const result = childProcess.spawnSync(process.execPath, [scriptPath, '--output', generatedPath], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    Buffer.compare(
      fs.readFileSync(generatedPath),
      fs.readFileSync(new URL('../assets/atlas/map-projected.svg', import.meta.url))
    ),
    0,
    'run npm run build:atlas after changing projection, geography, or skin inputs'
  );
});

test('China mainland outline comes from the projected administrative dataset', () => {
  const countries = JSON.parse(fs.readFileSync(
    new URL('../assets/atlas/sources/ne_110m_admin_0_countries.geojson', import.meta.url),
    'utf8'
  ));
  const china = countries.features.find((feature) => feature.properties.ISO_A3 === 'CHN');

  assert.ok(china, 'Natural Earth should contain the China feature');
  assert.equal(china.geometry.type, 'MultiPolygon');
  assert.deepEqual(china.bbox, [73.675379, 18.197701, 135.026311, 53.4588]);
});

test('camera zooms local routes closer than cross-region routes and keeps pan overflow', () => {
  const heroes = loadHeroes();
  const byId = Object.fromEntries(heroes.map((hero) => [hero.id, hero]));
  const local = MapGeometry.layout(byId.hanwudi, { width: 390, height: 844 }, AtlasModel);
  const global = MapGeometry.layout(byId.zhenghe, { width: 390, height: 844 }, AtlasModel);

  assert.ok(local.camera.scale > global.camera.scale);
  assert.ok(global.camera.scale >= global.camera.minScale);
  assert.ok(local.camera.scale <= local.camera.maxScale);

  for (const result of [local, global]) {
    assert.ok(result.map.width * result.camera.minScale > 390);
    assert.ok(result.map.height * result.camera.minScale > 844);
    assert.ok(result.camera.tx <= 0);
    assert.ok(result.camera.ty <= 0);
    assert.ok(result.camera.tx >= 390 - result.map.width * result.camera.scale);
    assert.ok(result.camera.ty >= 844 - result.map.height * result.camera.scale);
  }
});
