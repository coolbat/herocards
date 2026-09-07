/* ============================================================================
 * 艾泽拉斯英雄志 · 展示页逻辑（js/wow-app.js）
 * ----------------------------------------------------------------------------
 * 纯展示页（GitHub Pages 用）：阵营筛选卡墙 + 点击看详情。
 * 卡面全部由 CardArt 实时渲染（缩略卡 paintMini / 详情卡 paintFace），
 * 无收藏、无每日请卡——与国风主站（index/app.html）互不干扰。
 * ============================================================================ */
(function () {
  'use strict';

  var HEROES = window.WOW_HEROES || [];
  var CLASS_INFO = window.WOW_CLASS_INFO || {};
  var RARITY_INFO = window.WOW_RARITY_INFO || {};
  var FACTION_INFO = {
    alliance: { zh: '联盟', color: '#4a8fdd' },
    horde:    { zh: '部落', color: '#c41f3b' },
    neutral:  { zh: '中立', color: '#c8a55a' }
  };
  var STAT_LABELS = { might: '武力', magic: '魔法', resolve: '意志' };

  var grid = document.getElementById('wowGrid');
  var chips = document.getElementById('wowChips');
  var countEl = document.getElementById('wowCount');
  var overlay = document.getElementById('wowOverlay');
  var overlayBg = document.getElementById('wowOverlayBg');
  var closeBtn = document.getElementById('wowClose');
  var tilt = document.getElementById('wowTilt');
  var stage = document.getElementById('wowStage');
  var cardCanvas = document.getElementById('wowCardCanvas');

  var hasArt = !!(window.CardArt && typeof CardArt.paintMini === 'function');
  var rendered = {};   // hero.id → 已渲染缩略卡
  var currentHero = null;

  /* ------------------------------------------------------------ 卡墙 */
  function buildGrid() {
    HEROES.forEach(function (hero) {
      var cell = document.createElement('button');
      cell.className = 'wc-card is-pending';
      cell.type = 'button';
      cell.dataset.faction = hero.faction;
      cell.dataset.rarity = hero.rarity;
      cell.dataset.id = hero.id;
      cell.setAttribute('aria-label', hero.name.zh + ' · ' + hero.title.zh);

      var canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 464;
      cell.appendChild(canvas);

      var fac = FACTION_INFO[hero.faction];
      if (fac) {
        var tag = document.createElement('span');
        tag.className = 'wc-faction ' + hero.faction;
        tag.textContent = fac.zh;
        cell.appendChild(tag);
      }

      cell.addEventListener('click', function () { openHero(hero); });
      grid.appendChild(cell);
    });
  }

  function renderMini(cell) {
    var hero = byId(cell.dataset.id);
    if (!hero || rendered[hero.id] || !hasArt) return;
    rendered[hero.id] = true;
    try {
      var mini = CardArt.paintMini(hero, 300, 464);
      var canvas = cell.querySelector('canvas');
      canvas.getContext('2d').drawImage(mini, 0, 0, 300, 464);
      cell.classList.remove('is-pending');
    } catch (err) {
      console.warn('[wow] 缩略卡渲染失败：' + hero.id, err);
    }
  }

  function byId(id) {
    for (var i = 0; i < HEROES.length; i++) {
      if (HEROES[i].id === id) return HEROES[i];
    }
    return null;
  }

  var io = null;
  function observeGrid() {
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(grid.children, renderMini);
      return;
    }
    io = new IntersectionObserver(function (entries) {
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
  chips.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.chip');
    if (!btn) return;
    Array.prototype.forEach.call(chips.children, function (c) {
      c.classList.toggle('is-active', c === btn);
    });
    var faction = btn.dataset.faction;
    var shown = 0;
    Array.prototype.forEach.call(grid.children, function (cell) {
      var show = faction === 'all' || cell.dataset.faction === faction;
      cell.hidden = !show;
      if (show) shown++;
    });
    countEl.textContent = shown + ' 位英雄';
  });

  /* ------------------------------------------------------------ 详情 */
  function openHero(hero) {
    currentHero = hero;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    try { history.replaceState(null, '', '#hero=' + hero.id); } catch (e) { /* file:// 忽略 */ }

    document.getElementById('wmTitleEn').textContent = hero.title.en;
    document.getElementById('wmName').textContent = hero.name.zh;
    document.getElementById('wmTitleZh').textContent =
      hero.title.zh + ' · ' + hero.race.zh;

    var badges = document.getElementById('wmBadges');
    badges.textContent = '';
    var fac = FACTION_INFO[hero.faction];
    var cls = CLASS_INFO[hero.class];
    var rar = RARITY_INFO[hero.rarity];
    [[fac && fac.zh, fac && fac.color],
     [cls && cls.zh, cls && cls.color],
     [rar && rar.zh, rar && rar.color]].forEach(function (pair) {
      if (!pair[0]) return;
      var b = document.createElement('span');
      b.className = 'wm-badge';
      b.textContent = pair[0];
      if (pair[1]) { b.style.borderColor = pair[1]; b.style.color = pair[1]; }
      badges.appendChild(b);
    });

    document.getElementById('wmQuote').textContent = '「' + hero.quote + '」';
    document.getElementById('wmLore').textContent = hero.lore;

    var stats = document.getElementById('wmStats');
    stats.textContent = '';
    ['might', 'magic', 'resolve'].forEach(function (key) {
      var row = document.createElement('div');
      row.className = 'wm-stat';
      var label = document.createElement('span');
      label.textContent = STAT_LABELS[key];
      var track = document.createElement('span');
      track.className = 'wm-stat-track';
      var fill = document.createElement('span');
      fill.className = 'wm-stat-fill';
      fill.style.width = (hero.stats[key] * 10) + '%';
      if (cls && cls.color) fill.style.background = cls.color;
      track.appendChild(fill);
      var num = document.createElement('span');
      num.textContent = hero.stats[key];
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(num);
      stats.appendChild(row);
    });

    /* 详情卡渲染：同步 CPU 渲染，先让浮层上屏再画（希瓦全幅管线约 700ms）。
       rAF 在无显示链路环境（headless）可能不派发，setTimeout 兜底。 */
    var painted = false;
    var paintDetail = function () {
      if (painted || currentHero !== hero || !hasArt) return;
      painted = true;
      try {
        var set = CardArt.paintFace(hero);
        cardCanvas.getContext('2d').drawImage(set.diffuse, 0, 0);
      } catch (err) {
        console.warn('[wow] 详情卡渲染失败：' + hero.id, err);
      }
    };
    requestAnimationFrame(function () { requestAnimationFrame(paintDetail); });
    setTimeout(paintDetail, 80);
  }

  function closeHero() {
    currentHero = null;
    overlay.hidden = true;
    document.body.style.overflow = '';
    try { history.replaceState(null, '', ' '); } catch (e) { /* ignore */ }
  }

  closeBtn.addEventListener('click', closeHero);
  overlayBg.addEventListener('click', closeHero);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !overlay.hidden) closeHero();
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
  });
  stage.addEventListener('pointerleave', function () {
    tilt.style.transform = '';
  });

  /* ------------------------------------------------------------ 启动 */
  buildGrid();
  countEl.textContent = HEROES.length + ' 位英雄';

  if (!hasArt) {
    console.warn('[wow] CardArt 缺失，卡墙无法渲染');
    return;
  }

  /* 卡面文字（Cinzel / Noto Serif SC / Jost）需先于 canvas 绘制就绪 */
  var fontsReady = (document.fonts && document.fonts.ready) ?
    Promise.all([
      document.fonts.load('700 40px "Noto Serif SC"'),
      document.fonts.load('500 13px Cinzel'),
      document.fonts.load('500 18px Jost'),
      document.fonts.load('400 22px "Noto Serif SC"')
    ]).catch(function () { /* 字体失败用衬线兜底 */ }) :
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
