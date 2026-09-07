/* ============================================================================
 * Geographic life-map renderer.
 *
 * Public interface:
 *   AtlasMap.render(container, hero)
 *   AtlasMap.destroy(container)
 *
 * Geographic resolution, projection, uncertainty and initial camera layout are
 * delegated to MapGeometry + ATLAS_MODEL. This module owns DOM rendering and
 * pointer interaction only.
 * ========================================================================== */
(function () {
  'use strict';

  var STYLE_ID = 'am-atlas-map-style';
  var PRECISION_LABELS = {
    site: '遗址级定位',
    city: '城市级定位',
    region: '区域约略',
    unknown: '位置存疑'
  };
  var STYLE_TEXT = [
    '.am-viewport{position:absolute;inset:0;overflow:hidden;touch-action:none;',
      'background:#0d303b;user-select:none;-webkit-user-select:none;}',
    '.am-world{position:absolute;top:0;left:0;transform-origin:0 0;',
      'will-change:transform;--am-marker-scale:1;}',
    '.am-map{position:absolute;inset:0;width:100%;height:100%;display:block;',
      'pointer-events:none;-webkit-user-drag:none;}',
    '.am-map-skin{opacity:.96;}',
    '.am-route{position:absolute;inset:0;width:100%;height:100%;overflow:visible;',
      'pointer-events:none;}',
    '.am-route-line{fill:none;stroke:#e0b958;stroke-width:4;',
      'stroke-dasharray:15 11;stroke-linecap:round;stroke-linejoin:round;',
      'vector-effect:non-scaling-stroke;filter:drop-shadow(0 1px 1px rgba(20,15,8,.55));}',
    '.am-route-dot{fill:#a6332a;stroke:#f6e3a8;stroke-width:2;',
      'vector-effect:non-scaling-stroke;}',
    '.am-stop{position:absolute;z-index:3;}',
    '.am-stop-anchor{position:absolute;left:0;top:0;transform:translate(-50%,-50%) ',
      'scale(var(--am-marker-scale));transform-origin:center;}',
    '.am-head{display:flex;align-items:center;white-space:nowrap;transform:translateX(-17px);}',
    '.am-seal{position:relative;flex:none;width:44px;height:44px;padding:0;border:none;',
      'border-radius:50%;cursor:pointer;background:#a6332a;color:#fff9e8;',
      'line-height:44px;font-size:16px;text-align:center;',
      "font-family:'Ma Shan Zheng',serif;",
      'box-shadow:0 1px 5px rgba(10,15,15,.7),inset 0 0 0 1.5px rgba(255,249,232,.42);}',
    '.am-seal:focus-visible{outline:2px solid #f3d27b;outline-offset:3px;}',
    '.am-place{flex:none;margin-left:7px;padding:3px 9px;border-radius:10px;',
      'background:rgba(249,241,216,.94);border:1px solid #c9a95b;',
      'font-size:12px;color:#3e392d;letter-spacing:1px;line-height:1.45;',
      "font-family:'Ma Shan Zheng',serif;box-shadow:0 1px 4px rgba(8,18,19,.4);}",
    '.am-stop-flip .am-head{flex-direction:row-reverse;transform:translateX(calc(-100% + 17px));}',
    '.am-stop-flip .am-place{margin-left:0;margin-right:7px;}',
    '.am-label-high .am-place{transform:translateY(-22px);}',
    '.am-label-low .am-place{transform:translateY(22px);}',
    '.am-stop-region .am-seal,.am-stop-unknown .am-seal{background:#926238;',
      'outline:2px dashed rgba(255,231,166,.9);outline-offset:3px;}',
    '.am-stop-unknown .am-seal{background:#6b6255;}',
    '.am-stop.am-active .am-seal{background:#81231d;',
      'box-shadow:0 0 0 4px rgba(239,201,101,.72),0 2px 8px rgba(8,18,19,.65);}',
    '.am-count{position:absolute;right:-6px;top:-7px;min-width:15px;height:15px;padding:0 3px;',
      'box-sizing:border-box;border-radius:8px;background:#f3d27b;color:#5b2c23;',
      'font:700 9px/15px system-ui,sans-serif;}',
    '.am-story{position:absolute;left:12px;right:12px;bottom:18px;z-index:8;',
      'max-height:min(42vh,330px);overflow:auto;padding:13px 15px;box-sizing:border-box;',
      'border-radius:8px;background:rgba(251,245,228,.97);border:1px solid #c9a95b;',
      'box-shadow:0 6px 22px rgba(5,14,17,.55);transform:translateY(calc(100% + 30px));',
      'opacity:0;transition:transform .26s ease-out,opacity .26s ease-out;pointer-events:auto;}',
    '.am-story-show{transform:translateY(0);opacity:1;}',
    '.am-story-place{margin:0;font-size:17px;letter-spacing:3px;color:#806028;',
      "font-family:'Ma Shan Zheng',serif;}",
    '.am-story-meta{margin:3px 0 9px;font-size:11px;color:#746b59;letter-spacing:.06em;}',
    '.am-story-item{margin:0;padding:0;font-size:13px;line-height:1.8;color:#292921;}',
    '.am-story-item+.am-story-item{margin-top:9px;padding-top:9px;border-top:1px dashed #d6c28f;}',
    '.am-story-index{display:inline-block;margin-right:6px;color:#a6332a;font-weight:700;}',
    '.am-zoom-controls{position:absolute;right:12px;top:calc(62px + env(safe-area-inset-top,0px));',
      'z-index:7;display:flex;flex-direction:column;gap:7px;}',
    '.am-zoom-btn{width:44px;height:44px;padding:0;border:1px solid rgba(228,194,105,.9);',
      'border-radius:50%;background:rgba(18,51,58,.88);color:#f8e7b8;',
      'font:500 23px/42px system-ui,sans-serif;box-shadow:0 2px 8px rgba(3,12,14,.38);}',
    '.am-map-note{position:absolute;left:12px;top:calc(60px + env(safe-area-inset-top,0px));',
      'z-index:6;max-width:230px;padding:5px 9px;border-radius:12px;',
      'background:rgba(17,48,55,.78);color:#f1ddb0;font-size:10px;letter-spacing:.04em;}',
    '.am-credit{position:absolute;right:12px;bottom:8px;z-index:4;color:rgba(245,229,188,.65);',
      'font-size:9px;pointer-events:none;text-shadow:0 1px 2px #071b20;}',
    '.am-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
      'padding:24px;box-sizing:border-box;background:#173c46;}',
    '.am-fallback-inner{max-width:340px;padding:20px 18px;background:#fbf5e4;',
      'border:1px solid #c9a95b;border-radius:8px;color:#2b2b26;font-size:13px;line-height:1.85;}',
    '.am-fallback-title{margin:0 0 10px;font-size:17px;letter-spacing:4px;color:#806028;',
      "text-align:center;font-family:'Ma Shan Zheng',serif;}",
    '@media (prefers-reduced-motion:reduce){.am-story{transition:none;}}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) { return; }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
  }

  function svgEl(tag, attrs) {
    var element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var key in attrs) {
      if (attrs.hasOwnProperty(key)) { element.setAttribute(key, attrs[key]); }
    }
    return element;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function destroy(container) {
    if (!container) { return; }
    if (typeof container._atlasCleanup === 'function') { container._atlasCleanup(); }
    container._atlasCleanup = null;
    while (container.firstChild) { container.removeChild(container.firstChild); }
  }

  function renderFallback(container, hero, reason) {
    var box = document.createElement('div');
    box.className = 'am-fallback';
    var inner = document.createElement('div');
    inner.className = 'am-fallback-inner';
    var title = document.createElement('h3');
    title.className = 'am-fallback-title';
    title.textContent = '生平';
    var body = document.createElement('p');
    body.style.margin = '0';
    body.textContent = (reason ? reason + '\n' : '') + (hero && hero.lore ? hero.lore : '生平暂无记载。');
    inner.appendChild(title);
    inner.appendChild(body);
    box.appendChild(inner);
    container.appendChild(box);
  }

  function render(container, hero) {
    if (!container) { return; }
    destroy(container);
    ensureStyle();

    var model = window.ATLAS_MODEL;
    var geometry = window.MapGeometry;
    if (!model || !geometry || typeof geometry.layout !== 'function') {
      renderFallback(container, hero, '地图坐标模块未能载入。');
      return;
    }

    var vw = container.clientWidth || window.innerWidth;
    var vh = container.clientHeight || window.innerHeight;
    var result;
    try {
      result = geometry.layout(hero || {}, { width: vw, height: vh }, model);
    } catch (error) {
      renderFallback(container, hero, '地图坐标数据异常。');
      return;
    }
    if (!result.markers.length) {
      renderFallback(container, hero, '没有可定位的生平站点。');
      return;
    }

    var viewport = document.createElement('div');
    viewport.className = 'am-viewport';
    var world = document.createElement('div');
    world.className = 'am-world';
    world.style.width = result.map.width + 'px';
    world.style.height = result.map.height + 'px';
    viewport.appendChild(world);

    var skin = document.createElement('img');
    skin.className = 'am-map am-map-skin';
    skin.alt = '';
    skin.setAttribute('aria-hidden', 'true');
    skin.draggable = false;
    skin.src = model.asset.skinSrc;
    skin.addEventListener('error', function () {
      if (skin.parentNode) skin.parentNode.removeChild(skin);
    });
    world.appendChild(skin);

    var image = document.createElement('img');
    image.className = 'am-map am-map-vectors';
    image.alt = '行旅大地图';
    image.draggable = false;
    image.src = model.asset.src;
    image.addEventListener('error', function () {
      destroy(container);
      renderFallback(container, hero, '投影底图未能展开。');
    });
    world.appendChild(image);

    var routeSvg = svgEl('svg', {
      'class': 'am-route',
      viewBox: '0 0 ' + result.map.width + ' ' + result.map.height,
      'aria-hidden': 'true',
      focusable: 'false'
    });
    var routeD = '';
    for (var r = 0; r < result.route.points.length; r++) {
      routeD += (r ? 'L' : 'M') + result.route.points[r][0].toFixed(1) + ',' + result.route.points[r][1].toFixed(1);
    }
    routeSvg.appendChild(svgEl('path', { 'class': 'am-route-line', d: routeD }));
    for (var d = 0; d < result.route.points.length; d++) {
      routeSvg.appendChild(svgEl('circle', {
        'class': 'am-route-dot', cx: result.route.points[d][0], cy: result.route.points[d][1], r: 7
      }));
    }
    world.appendChild(routeSvg);

    var story = document.createElement('section');
    story.className = 'am-story';
    story.setAttribute('role', 'region');
    story.setAttribute('aria-live', 'polite');
    var storyPlace = document.createElement('h3');
    storyPlace.className = 'am-story-place';
    var storyMeta = document.createElement('p');
    storyMeta.className = 'am-story-meta';
    var storyBody = document.createElement('div');
    story.appendChild(storyPlace);
    story.appendChild(storyMeta);
    story.appendChild(storyBody);
    viewport.appendChild(story);

    var grouped = {};
    var groupOrder = [];
    for (var i = 0; i < result.markers.length; i++) {
      var marker = result.markers[i];
      if (!grouped[marker.placeId]) {
        grouped[marker.placeId] = {
          placeId: marker.placeId,
          label: marker.label,
          modernName: marker.modernName,
          precision: marker.precision,
          confidence: marker.confidence,
          x: marker.x,
          y: marker.y,
          entries: []
        };
        groupOrder.push(marker.placeId);
      }
      grouped[marker.placeId].entries.push(marker);
    }

    var activeStop = null;
    var gestureMoved = false;
    var dragDistance = 0;

    function closeStory() {
      story.classList.remove('am-story-show');
      if (activeStop) { activeStop.classList.remove('am-active'); }
      activeStop = null;
    }

    function openStory(wrap, group) {
      if (activeStop && activeStop !== wrap) { activeStop.classList.remove('am-active'); }
      activeStop = wrap;
      wrap.classList.add('am-active');
      storyPlace.textContent = group.label;
      var precision = PRECISION_LABELS[group.precision] || PRECISION_LABELS.unknown;
      storyMeta.textContent = [group.modernName, precision, group.confidence === 'low' ? '低置信度' : ''].filter(Boolean).join(' · ');
      while (storyBody.firstChild) { storyBody.removeChild(storyBody.firstChild); }
      for (var index = 0; index < group.entries.length; index++) {
        var item = document.createElement('p');
        item.className = 'am-story-item';
        var seq = document.createElement('span');
        seq.className = 'am-story-index';
        seq.textContent = '第' + (group.entries[index].index + 1) + '站';
        item.appendChild(seq);
        item.appendChild(document.createTextNode(group.entries[index].stop && group.entries[index].stop.text ? group.entries[index].stop.text : '暂无详细记载。'));
        storyBody.appendChild(item);
      }
      story.classList.add('am-story-show');
    }

    for (var g = 0; g < groupOrder.length; g++) {
      (function (group, groupIndex) {
        var wrap = document.createElement('div');
        var sideFlip = group.x > result.map.width * 0.72;
        var labelOffset = groupIndex % 3 === 0 ? ' am-label-high' : (groupIndex % 3 === 1 ? ' am-label-low' : '');
        wrap.className = 'am-stop am-stop-' + group.precision + (sideFlip ? ' am-stop-flip' : '') + labelOffset;
        wrap.style.left = group.x + 'px';
        wrap.style.top = group.y + 'px';

        var anchor = document.createElement('div');
        anchor.className = 'am-stop-anchor';
        var head = document.createElement('div');
        head.className = 'am-head';
        var seal = document.createElement('button');
        seal.type = 'button';
        seal.className = 'am-seal';
        seal.textContent = group.label.charAt(0) || '行';
        seal.setAttribute('aria-label', group.label + ' 生平段落，' + (PRECISION_LABELS[group.precision] || '位置存疑'));
        var label = document.createElement('span');
        label.className = 'am-place';
        label.textContent = group.label;
        head.appendChild(seal);
        head.appendChild(label);
        if (group.entries.length > 1) {
          var count = document.createElement('span');
          count.className = 'am-count';
          count.textContent = group.entries.length;
          seal.appendChild(count);
        }
        anchor.appendChild(head);
        wrap.appendChild(anchor);
        seal.addEventListener('click', function (event) {
          event.stopPropagation();
          if (gestureMoved) { return; }
          if (activeStop === wrap) { closeStory(); return; }
          openStory(wrap, group);
        });
        world.appendChild(wrap);
      })(grouped[groupOrder[g]], g);
    }

    var controls = document.createElement('div');
    controls.className = 'am-zoom-controls';
    var zoomIn = document.createElement('button');
    zoomIn.type = 'button';
    zoomIn.className = 'am-zoom-btn';
    zoomIn.setAttribute('aria-label', '放大地图');
    zoomIn.textContent = '+';
    var zoomOut = document.createElement('button');
    zoomOut.type = 'button';
    zoomOut.className = 'am-zoom-btn';
    zoomOut.setAttribute('aria-label', '缩小地图');
    zoomOut.textContent = '−';
    controls.appendChild(zoomIn);
    controls.appendChild(zoomOut);
    viewport.appendChild(controls);

    var note = document.createElement('div');
    note.className = 'am-map-note';
    note.textContent = '实地坐标 · 双指缩放 · 虚线为叙事连线';
    if (result.unresolvedStops.length) { note.textContent += ' · ' + result.unresolvedStops.length + '处未定位'; }
    viewport.appendChild(note);

    var credit = document.createElement('div');
    credit.className = 'am-credit';
    credit.textContent = '地理与真实山势：Natural Earth / SRTM Plus · 青绿设色：程序生成';
    viewport.appendChild(credit);
    container.appendChild(viewport);

    var camera = {
      scale: result.camera.scale,
      tx: result.camera.tx,
      ty: result.camera.ty,
      minScale: result.camera.minScale,
      maxScale: result.camera.maxScale
    };
    var inertiaRaf = 0;
    var pointers = new Map();
    var dragSamples = [];
    var pinchState = null;

    function clampCamera() {
      var scaledW = result.map.width * camera.scale;
      var scaledH = result.map.height * camera.scale;
      camera.tx = scaledW <= vw ? (vw - scaledW) / 2 : clamp(camera.tx, vw - scaledW, 0);
      camera.ty = scaledH <= vh ? (vh - scaledH) / 2 : clamp(camera.ty, vh - scaledH, 0);
    }

    function applyCamera() {
      clampCamera();
      world.style.setProperty('--am-marker-scale', (1 / camera.scale).toFixed(4));
      world.style.transform = 'translate3d(' + camera.tx.toFixed(1) + 'px,' + camera.ty.toFixed(1) + 'px,0) scale(' + camera.scale.toFixed(5) + ')';
    }

    function stopInertia() {
      if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = 0; }
    }

    function zoomAt(nextScale, clientX, clientY) {
      stopInertia();
      var rect = viewport.getBoundingClientRect();
      var focalX = clientX == null ? vw / 2 : clientX - rect.left;
      var focalY = clientY == null ? vh / 2 : clientY - rect.top;
      var worldX = (focalX - camera.tx) / camera.scale;
      var worldY = (focalY - camera.ty) / camera.scale;
      camera.scale = clamp(nextScale, camera.minScale, camera.maxScale);
      camera.tx = focalX - worldX * camera.scale;
      camera.ty = focalY - worldY * camera.scale;
      applyCamera();
    }

    function pointerPair() {
      var values = Array.from(pointers.values());
      if (values.length < 2) { return null; }
      var a = values[0];
      var b = values[1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(dx, dy)) };
    }

    function beginPinch() {
      var pair = pointerPair();
      if (!pair) { pinchState = null; return; }
      var rect = viewport.getBoundingClientRect();
      var localX = pair.x - rect.left;
      var localY = pair.y - rect.top;
      pinchState = {
        distance: pair.distance,
        scale: camera.scale,
        worldX: (localX - camera.tx) / camera.scale,
        worldY: (localY - camera.ty) / camera.scale
      };
    }

    viewport.addEventListener('pointerdown', function (event) {
      if (event.target.closest && event.target.closest('.am-seal,.am-zoom-controls')) { return; }
      stopInertia();
      closeStory();
      if (!pointers.size) {
        gestureMoved = false;
        dragDistance = 0;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      dragSamples = [{ t: performance.now(), x: event.clientX, y: event.clientY }];
      if (pointers.size === 2) { beginPinch(); }
      try { viewport.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
    });

    viewport.addEventListener('pointermove', function (event) {
      var previous = pointers.get(event.pointerId);
      if (!previous) { return; }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size >= 2) {
        if (!pinchState) { beginPinch(); }
        var pair = pointerPair();
        var rect = viewport.getBoundingClientRect();
        var localX = pair.x - rect.left;
        var localY = pair.y - rect.top;
        camera.scale = clamp(pinchState.scale * pair.distance / pinchState.distance, camera.minScale, camera.maxScale);
        camera.tx = localX - pinchState.worldX * camera.scale;
        camera.ty = localY - pinchState.worldY * camera.scale;
        gestureMoved = true;
        applyCamera();
        return;
      }

      var dx = event.clientX - previous.x;
      var dy = event.clientY - previous.y;
      dragDistance += Math.hypot(dx, dy);
      if (dragDistance > 8) { gestureMoved = true; }
      camera.tx += dx;
      camera.ty += dy;
      applyCamera();
      dragSamples.push({ t: performance.now(), x: event.clientX, y: event.clientY });
      if (dragSamples.length > 6) { dragSamples.shift(); }
    });

    function endPointer(event) {
      if (!pointers.has(event.pointerId)) { return; }
      pointers.delete(event.pointerId);
      pinchState = null;
      if (pointers.size === 1) {
        var remaining = Array.from(pointers.values())[0];
        dragSamples = [{ t: performance.now(), x: remaining.x, y: remaining.y }];
        return;
      }
      if (!pointers.size && gestureMoved && dragSamples.length >= 2) {
        var first = dragSamples[0];
        var last = dragSamples[dragSamples.length - 1];
        var elapsed = last.t - first.t;
        if (elapsed > 10 && elapsed < 300) {
          var vx = (last.x - first.x) / elapsed;
          var vy = (last.y - first.y) / elapsed;
          if (Math.hypot(vx, vy) > 0.08) {
            var lastTime = performance.now();
            var step = function (now) {
              var frame = Math.min(40, now - lastTime);
              lastTime = now;
              vx *= 0.93;
              vy *= 0.93;
              var oldX = camera.tx;
              var oldY = camera.ty;
              camera.tx += vx * frame;
              camera.ty += vy * frame;
              applyCamera();
              if ((camera.tx === oldX && camera.ty === oldY) || Math.hypot(vx, vy) < 0.02) {
                inertiaRaf = 0;
                return;
              }
              inertiaRaf = requestAnimationFrame(step);
            };
            inertiaRaf = requestAnimationFrame(step);
          }
        }
      }
      setTimeout(function () { gestureMoved = false; }, 0);
    }

    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);
    viewport.addEventListener('click', function (event) {
      if (!gestureMoved && !event.target.closest('.am-seal') && !event.target.closest('.am-zoom-controls')) { closeStory(); }
    });
    viewport.addEventListener('wheel', function (event) {
      event.preventDefault();
      zoomAt(camera.scale * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    }, { passive: false });
    viewport.addEventListener('dblclick', function (event) {
      event.preventDefault();
      zoomAt(camera.scale * 1.45, event.clientX, event.clientY);
    });
    zoomIn.addEventListener('click', function (event) {
      event.stopPropagation();
      zoomAt(camera.scale * 1.3);
    });
    zoomOut.addEventListener('click', function (event) {
      event.stopPropagation();
      zoomAt(camera.scale / 1.3);
    });

    var resizeObserver = null;
    function onResize() {
      var nextW = container.clientWidth || window.innerWidth;
      var nextH = container.clientHeight || window.innerHeight;
      if (nextW === vw && nextH === vh) { return; }
      var worldCenterX = (vw / 2 - camera.tx) / camera.scale;
      var worldCenterY = (vh / 2 - camera.ty) / camera.scale;
      vw = nextW;
      vh = nextH;
      var nextLayout = geometry.layout(hero || {}, { width: vw, height: vh }, model);
      camera.minScale = nextLayout.camera.minScale;
      camera.maxScale = nextLayout.camera.maxScale;
      camera.scale = clamp(camera.scale, camera.minScale, camera.maxScale);
      camera.tx = vw / 2 - worldCenterX * camera.scale;
      camera.ty = vh / 2 - worldCenterY * camera.scale;
      applyCamera();
    }
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', onResize);
    }

    container._atlasCleanup = function () {
      stopInertia();
      if (resizeObserver) { resizeObserver.disconnect(); }
      else { window.removeEventListener('resize', onResize); }
    };
    applyCamera();
  }

  window.AtlasMap = { render: render, destroy: destroy };
})();
