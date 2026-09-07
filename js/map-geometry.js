/* Pure geographic layout for AtlasMap. Plain-script + Node compatible. */
(function (root, factory) {
  var geometry = factory();
  if (typeof module === 'object' && module.exports) { module.exports = geometry; }
  if (root) { root.MapGeometry = geometry; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function mercatorY(latitude) {
    var limited = Math.max(-85, Math.min(85, Number(latitude)));
    var radians = limited * Math.PI / 180;
    return Math.log(Math.tan(Math.PI / 4 + radians / 2));
  }

  function inverseMercatorY(value) {
    return (2 * Math.atan(Math.exp(value)) - Math.PI / 2) * 180 / Math.PI;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function projectionMetrics(config) {
    var width = config.width;
    var height = config.height;
    var padding = config.padding || 0;
    var bounds = config.bounds;
    var west = bounds.west * Math.PI / 180;
    var east = bounds.east * Math.PI / 180;
    var north = mercatorY(bounds.north);
    var south = mercatorY(bounds.south);
    var scale = Math.min((width - padding * 2) / (east - west), (height - padding * 2) / (north - south));
    var contentW = (east - west) * scale;
    var contentH = (north - south) * scale;
    var offsetX = (width - contentW) / 2;
    var offsetY = (height - contentH) / 2;

    return {
      width: width,
      height: height,
      west: west,
      north: north,
      scale: scale,
      offsetX: offsetX,
      offsetY: offsetY
    };
  }

  function createProjector(config) {
    var metrics = projectionMetrics(config);

    return function project(coordinates) {
      var longitude = Number(coordinates[0]) * Math.PI / 180;
      var latitudeY = mercatorY(coordinates[1]);
      return {
        x: metrics.offsetX + (longitude - metrics.west) * metrics.scale,
        y: metrics.offsetY + (metrics.north - latitudeY) * metrics.scale
      };
    };
  }

  function project(coordinates, model) {
    var source = model || (typeof globalThis !== 'undefined' ? globalThis.ATLAS_MODEL : null);
    if (!source || !source.projection) { throw new Error('Atlas geographic model is required'); }
    return createProjector(source.projection)(coordinates);
  }

  function fullCanvasBounds(model) {
    var source = model || (typeof globalThis !== 'undefined' ? globalThis.ATLAS_MODEL : null);
    if (!source || !source.projection) { throw new Error('Atlas geographic model is required'); }
    var metrics = projectionMetrics(source.projection);

    return {
      west: (metrics.west - metrics.offsetX / metrics.scale) * 180 / Math.PI,
      east: (metrics.west + (metrics.width - metrics.offsetX) / metrics.scale) * 180 / Math.PI,
      south: inverseMercatorY(metrics.north - (metrics.height - metrics.offsetY) / metrics.scale),
      north: inverseMercatorY(metrics.north + metrics.offsetY / metrics.scale)
    };
  }

  function barycentric(point, a, b, c) {
    var denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(denominator) < 1e-8) { return null; }
    var wa = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
    var wb = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;
    var wc = 1 - wa - wb;
    if (wa < -1e-7 || wb < -1e-7 || wc < -1e-7) { return null; }
    return [wa, wb, wc];
  }

  function createLegacyProjector(model) {
    var calibration = model.legacyCalibration;
    if (!calibration) { return null; }
    var geographicProject = createProjector(model.projection);
    var projectedControls = {};

    for (var controlId in calibration.controlPoints) {
      if (!calibration.controlPoints.hasOwnProperty(controlId)) { continue; }
      var control = calibration.controlPoints[controlId];
      var place = model.places[control.placeId];
      if (!place) { continue; }
      projectedControls[controlId] = geographicProject(place.coordinates);
    }

    return function projectLegacy(coordinates) {
      var point = geographicProject(coordinates);
      for (var i = 0; i < calibration.triangles.length; i++) {
        var ids = calibration.triangles[i];
        var a = projectedControls[ids[0]];
        var b = projectedControls[ids[1]];
        var c = projectedControls[ids[2]];
        if (!a || !b || !c) { continue; }
        var weights = barycentric(point, a, b, c);
        if (!weights) { continue; }
        var ta = calibration.controlPoints[ids[0]];
        var tb = calibration.controlPoints[ids[1]];
        var tc = calibration.controlPoints[ids[2]];
        return {
          x: (weights[0] * ta.x + weights[1] * tb.x + weights[2] * tc.x) * calibration.image.width,
          y: (weights[0] * ta.y + weights[1] * tb.y + weights[2] * tc.y) * calibration.image.height
        };
      }
      return null;
    };
  }

  function fitCamera(markers, mapSize, viewport) {
    var vw = Math.max(1, Number(viewport && viewport.width) || 1);
    var vh = Math.max(1, Number(viewport && viewport.height) || 1);
    var coverScale = Math.max(vw / mapSize.width, vh / mapSize.height);
    var minScale = coverScale * 1.08;
    var maxScale = Math.max(minScale * 5, 2.4);
    var minX = mapSize.width / 2;
    var maxX = minX;
    var minY = mapSize.height / 2;
    var maxY = minY;

    if (markers.length) {
      minX = maxX = markers[0].x;
      minY = maxY = markers[0].y;
      for (var i = 1; i < markers.length; i++) {
        minX = Math.min(minX, markers[i].x);
        maxX = Math.max(maxX, markers[i].x);
        minY = Math.min(minY, markers[i].y);
        maxY = Math.max(maxY, markers[i].y);
      }
    }

    var availableW = Math.max(80, vw - 144);
    var availableH = Math.max(120, vh - 220);
    var routeScale = Math.min(availableW / Math.max(80, maxX - minX), availableH / Math.max(80, maxY - minY));
    var scale = clamp(routeScale, minScale, maxScale);
    var centerX = (minX + maxX) / 2;
    var centerY = (minY + maxY) / 2;
    var tx = vw / 2 - centerX * scale;
    var ty = vh / 2 - centerY * scale;
    tx = clamp(tx, vw - mapSize.width * scale, 0);
    ty = clamp(ty, vh - mapSize.height * scale, 0);

    return {
      scale: scale,
      tx: tx,
      ty: ty,
      minScale: minScale,
      maxScale: maxScale,
      center: { x: centerX, y: centerY }
    };
  }

  function layout(hero, viewport, model, options) {
    var source = model || (typeof globalThis !== 'undefined' ? globalThis.ATLAS_MODEL : null);
    if (!source || !source.projection) { throw new Error('Atlas geographic model is required'); }

    var useLegacy = options && options.mode === 'legacy-calibrated';
    var project = useLegacy ? createLegacyProjector(source) : createProjector(source.projection);
    if (!project) { throw new Error('Requested atlas projection is unavailable'); }
    var mapSize = useLegacy ? source.legacyCalibration.image : source.projection;
    var routeIds = source.routes[hero && hero.id] || [];
    var stops = hero && Array.isArray(hero.stops) ? hero.stops : [];
    if (!routeIds.length && stops.length) {
      routeIds = stops.map(function (stop) { return stop.placeId; });
    }

    var markers = [];
    var unresolvedStops = [];
    for (var i = 0; i < routeIds.length; i++) {
      var placeId = routeIds[i];
      var place = source.places[placeId];
      if (!place || !Array.isArray(place.coordinates)) {
        unresolvedStops.push({ index: i, placeId: placeId || null, stop: stops[i] || null });
        continue;
      }
      var point = project(place.coordinates);
      if (!point) {
        unresolvedStops.push({ index: i, placeId: placeId, stop: stops[i] || null, reason: 'outside-calibration' });
        continue;
      }
      markers.push({
        index: i,
        placeId: placeId,
        label: place.label,
        modernName: place.modernName || '',
        precision: place.precision || 'unknown',
        confidence: place.confidence || 'low',
        x: point.x,
        y: point.y,
        stop: stops[i] || null
      });
    }

    var map = { width: mapSize.width, height: mapSize.height };
    var view = { width: Number(viewport && viewport.width) || 0, height: Number(viewport && viewport.height) || 0 };
    return {
      map: map,
      viewport: view,
      markers: markers,
      route: { points: markers.map(function (marker) { return [marker.x, marker.y]; }) },
      unresolvedStops: unresolvedStops,
      camera: fitCamera(markers, map, view)
    };
  }

  return { project: project, fullCanvasBounds: fullCanvasBounds, layout: layout };
});
