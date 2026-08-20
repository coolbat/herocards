import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import AtlasModel from '../js/atlas-data.js';
import MapGeometry from '../js/map-geometry.js';

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

  const svg = fs.readFileSync(new URL('../assets/atlas/map-projected.svg', import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 2400 1600"/);
  assert.match(svg, /data-projection="web-mercator-eurasia-indian-ocean-v1"/);
  assert.match(svg, /Natural Earth/);
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
