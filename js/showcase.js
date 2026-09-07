/* ============================================================================
 * herocards · 展示页共享驱动（js/showcase.js）
 * ----------------------------------------------------------------------------
 * 由 wow.html（艾泽拉斯英雄志）与 guofeng.html（华夏人物图鉴）共用：
 * 卡墙（筛选 chips + 缩略卡）→ 整页详情视图（大卡 + 资料，非弹层）→
 * 可选生平行旅图（hasMap，AtlasMap）。
 *
 * 每页以 window.SHOWCASE 注入配置（字段见 wow.html 内联注释），
 * DOM 契约：#view #viewBack #stage #tilt #cardCanvas #mTitleEn #mName
 *           #mTitleZh #mBadges #mQuote #mLore #mStats；
 *           地图页另需 #viewMap #mapBack #mapTitle #atlasMount #exploreBtn。
 * ============================================================================ */
(function () {
  'use strict';

  var CFG = window.SHOWCASE || {};
  var HEROES = window.WOW_HEROES || [];
  var hasArt = !!(window.CardArt && typeof CardArt.paintMini === 'function');

  var grid = document.getElementById(CFG.gridEl || 'grid');
  var chips = document.getElementById(CFG.chipsEl || 'chips');
  var countEl = document.getElementById(CFG.countEl || 'count');
  var view = document.getElementById('view');
  var tilt = document.getElementById('tilt');
  var stage = document.getElementById('stage');
  var cardCanvas = document.getElementById('cardCanvas');
  // Pages opt into live materials by providing the lighting canvas and module.
  var lightingCanvas = document.getElementById('cardLighting');
  var lighting = null;
  var pointerFrame = 0;
  var pendingPointer = null;
  var detailEpoch = 0;
  var viewMap = document.getElementById('viewMap');
  var atlasMount = document.getElementById('atlasMount');

  var rendered = {};   // hero.id → 缩略卡已渲染
  var currentHero = null;

  function byId(id) {
    for (var i = 0; i < HEROES.length; i++) {
      if (HEROES[i].id === id) return HEROES[i];
    }
    return null;
  }

  /* ------------------------------------------------------------ 卡墙 */
  function buildGrid() {
    HEROES.forEach(function (hero) {
      var cell = document.createElement('button');
      cell.className = 'cell is-pending';
      cell.type = 'button';
      cell.dataset.f = hero[CFG.chipField] || '';
      cell.dataset.rarity = hero.rarity || '';
      cell.dataset.id = hero.id;
      cell.setAttribute('aria-label', hero.name.zh + ' · ' + hero.title.zh);

      if (CFG.miniMode === 'thumb' && CFG.thumbSrc) {
        var img = document.createElement('img');
        img.alt = hero.name.zh;
        img.loading = 'lazy';
        img.src = CFG.thumbSrc(hero);
        img.addEventListener('load', function () { cell.classList.remove('is-pending'); });
        img.addEventListener('error', function () { cell.classList.remove('is-pending'); });
        cell.appendChild(img);
      } else {
        var canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 464;
        cell.appendChild(canvas);
      }

      var tagText = CFG.chipLabels && CFG.chipLabels[cell.dataset.f];
      if (tagText) {
        var tag = document.createElement('span');
        tag.className = 'cell-tag t-' + cell.dataset.f;
        tag.textContent = tagText;
        cell.appendChild(tag);
      }

      cell.addEventListener('click', function () { openHero(hero); });
      grid.appendChild(cell);
    });
  }

  function renderMini(cell) {
    var hero = byId(cell.dataset.id);
    if (!hero || rendered[hero.id] || !hasArt) return;
    var canvas = cell.querySelector('canvas');
    if (!canvas) return;                       // thumb 模式无需 canvas 渲染
    try {
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var width = Math.max(300, Math.min(640, Math.ceil((cell.clientWidth || 200) * dpr)));
      var height = Math.round(width * 464 / 300);
      var mini = CardArt.paintMini(hero, width, height);
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(mini, 0, 0);
      cell.classList.remove('is-pending');
      rendered[hero.id] = true;
    } catch (err) {
      console.warn('[showcase] 缩略卡渲染失败：' + hero.id, err);
    }
  }

  function observeGrid() {
    if (CFG.miniMode === 'thumb') return;      // <img> 自行懒加载
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(grid.children, renderMini);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          io.unobserve(entry.target);
          renderMini(entry.target);
        }
      });
    }, { rootMargin: '300px' });
    Array.prototype.forEach.call(grid.children, function (cell) { io.observe(cell); });
    /* 兜底：IO 在部分环境（headless/virtual-time）不派发时，1.2s 后全量补渲 */
    setTimeout(function () {
      Array.prototype.forEach.call(grid.children, renderMini);
    }, 1200);
  }

  /* ------------------------------------------------------------ 筛选 */
  if (chips) {
    chips.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.chip');
      if (!btn) return;
      Array.prototype.forEach.call(chips.children, function (c) {
        c.classList.toggle('is-active', c === btn);
      });
      var f = btn.dataset.f;
      var shown = 0;
      Array.prototype.forEach.call(grid.children, function (cell) {
        var show = f === 'all' || cell.dataset.f === f;
        cell.hidden = !show;
        if (show) shown++;
      });
      if (countEl) countEl.textContent = shown + ' ' + (CFG.countUnit || '位');
    });
  }

  /* ------------------------------------------------------------ 详情视图 */
  function fillMeta(hero) {
    document.getElementById('mTitleEn').textContent =
      CFG.titleEn ? CFG.titleEn(hero) : (hero.title.en || '');
    document.getElementById('mName').textContent = hero.name.zh;
    document.getElementById('mTitleZh').textContent =
      CFG.subtitle ? CFG.subtitle(hero) : hero.title.zh;

    var badges = document.getElementById('mBadges');
    badges.textContent = '';
    (CFG.badges ? CFG.badges(hero) : []).forEach(function (pair) {
      if (!pair || !pair[0]) return;
      var b = document.createElement('span');
      b.className = 'm-badge';
      b.textContent = pair[0];
      if (pair[1]) { b.style.borderColor = pair[1]; b.style.color = pair[1]; }
      badges.appendChild(b);
    });

    document.getElementById('mQuote').textContent = '「' + hero.quote + '」';
    document.getElementById('mLore').textContent = hero.lore;

    var stats = document.getElementById('mStats');
    stats.textContent = '';
    var labels = CFG.statLabels || { might: '武力', magic: '魔法', resolve: '意志' };
    var color = CFG.statColor ? CFG.statColor(hero) : '';
    ['might', 'magic', 'resolve'].forEach(function (key) {
      var row = document.createElement('div');
      row.className = 'm-stat';
      var label = document.createElement('span');
      label.textContent = labels[key] || key;
      var track = document.createElement('span');
      track.className = 'm-stat-track';
      var fill = document.createElement('span');
      fill.className = 'm-stat-fill';
      fill.style.width = (hero.stats[key] * 10) + '%';
      if (color) fill.style.background = color;
      track.appendChild(fill);
      var num = document.createElement('span');
      num.textContent = hero.stats[key];
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(num);
      stats.appendChild(row);
    });

    var exploreBtn = document.getElementById('exploreBtn');
    if (exploreBtn) exploreBtn.hidden = !(CFG.hasMap && hero.stops && hero.stops.length);
  }

  function openHero(hero) {
    var epoch = ++detailEpoch;
    currentHero = hero;
    if (lighting) { lighting.dispose(); lighting = null; }
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pendingPointer = null;
    tilt.style.transform = '';
    cardCanvas.getContext('2d').clearRect(0, 0, cardCanvas.width, cardCanvas.height);
    fillMeta(hero);
    view.hidden = false;
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#hero=' + hero.id); } catch (e) { /* file:// 忽略 */ }

    /* 详情卡渲染：同步 CPU 渲染，先让视图上屏再画（全幅管线约 700ms）。
       rAF 在无显示链路环境（headless）可能不派发，setTimeout 兜底。 */
    var painted = false;
    var paintDetail = function () {
      if (painted || epoch !== detailEpoch || currentHero !== hero || !hasArt) return;
      painted = true;
      try {
        var set = CardArt.paintFace(hero);
        cardCanvas.getContext('2d').drawImage(set.diffuse, 0, 0);
        if (window.CardLighting && lightingCanvas) {
          lighting = CardLighting.create(lightingCanvas);
          if (lighting) lighting.setMaps(set);
        }
      } catch (err) {
        console.warn('[showcase] 详情卡渲染失败：' + hero.id, err);
      }
    };
    requestAnimationFrame(function () { requestAnimationFrame(paintDetail); });
    setTimeout(paintDetail, 80);
  }

  function closeHero() {
    detailEpoch++;
    if (lighting) { lighting.dispose(); lighting = null; }
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pendingPointer = null;
    tilt.style.transform = '';
    currentHero = null;
    if (viewMap && !viewMap.hidden) closeMap();
    view.hidden = true;
    document.body.style.overflow = '';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  document.getElementById('viewBack').addEventListener('click', closeHero);
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (viewMap && !viewMap.hidden) { closeMap(); return; }
    if (!view.hidden) closeHero();
  });

  /* 详情卡悬停倾斜 + 高光跟随 */
  stage.addEventListener('pointermove', function (ev) {
    var rect = tilt.getBoundingClientRect();
    var px = (ev.clientX - rect.left) / rect.width;
    var py = (ev.clientY - rect.top) / rect.height;
    tilt.style.transform =
      'rotateY(' + ((px - 0.5) * 14).toFixed(2) + 'deg) rotateX(' + ((0.5 - py) * 10).toFixed(2) + 'deg)';
    tilt.style.setProperty('--sx', (px * 100).toFixed(1) + '%');
    tilt.style.setProperty('--sy', (py * 100).toFixed(1) + '%');
    pendingPointer = [Math.max(0, Math.min(1, px)), 1 - Math.max(0, Math.min(1, py))];
    if (lighting && !pointerFrame) pointerFrame = requestAnimationFrame(function () {
      pointerFrame = 0;
      if (lighting) lighting.draw(pendingPointer);
    });
  });
  stage.addEventListener('pointerleave', function () {
    tilt.style.transform = '';
    pendingPointer = null;
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    if (lighting) lighting.draw(null);
  });
  window.addEventListener('resize', function () { if (lighting) lighting.resize(); });

  /* ------------------------------------------------------------ 行旅图（可选） */
  function openMap() {
    if (!currentHero || !viewMap || !window.AtlasMap) return;
    view.hidden = true;
    viewMap.hidden = false;
    var mapTitle = document.getElementById('mapTitle');
    if (mapTitle) mapTitle.textContent = currentHero.name.zh + ' · 行旅图';
    AtlasMap.render(atlasMount, currentHero);
    try { history.replaceState(null, '', '#hero=' + currentHero.id + '/map'); } catch (e) { /* ignore */ }
  }

  function closeMap() {
    if (!viewMap) return;
    if (window.AtlasMap && typeof AtlasMap.destroy === 'function') AtlasMap.destroy(atlasMount);
    atlasMount.innerHTML = '';
    viewMap.hidden = true;
    if (currentHero) {
      view.hidden = false;
      try { history.replaceState(null, '', '#hero=' + currentHero.id); } catch (e) { /* ignore */ }
    }
  }

  if (CFG.hasMap) {
    var exploreBtn = document.getElementById('exploreBtn');
    if (exploreBtn) exploreBtn.addEventListener('click', openMap);
    var mapBack = document.getElementById('mapBack');
    if (mapBack) mapBack.addEventListener('click', closeMap);
  }

  /* ------------------------------------------------------------ 启动 */
  buildGrid();
  if (countEl) countEl.textContent = HEROES.length + ' ' + (CFG.countUnit || '位');

  if (!hasArt) {
    console.warn('[showcase] CardArt 缺失，卡墙无法渲染');
    return;
  }

  /* 卡面文字字体需先于 canvas 绘制就绪 */
  var fontSpecs = CFG.fonts || [];
  var fontsReady = (document.fonts && document.fonts.load && fontSpecs.length) ?
    Promise.all(fontSpecs.map(function (spec) {
      return document.fonts.load(spec);
    })).catch(function () { /* 字体失败用衬线兜底 */ }) :
    Promise.resolve();

  Promise.all([fontsReady, CardArt.preloadPortraits(HEROES)]).then(function () {
    observeGrid();
    var m = /^#hero=([a-z0-9-]+)$/.exec(location.hash);
    if (m) {
      var hero = byId(m[1]);
      if (hero) openHero(hero);
    }
  });
})();
