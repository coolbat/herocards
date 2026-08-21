/* ============================================================================
   华夏人物图鉴 — 主程序（v2 国风移动端 · 小红书小工具）
   ----------------------------------------------------------------------------
   四大系统（沿用原魔兽版架构并全面换皮）：

   1. WebGL2 光照层：在静态卡面之上叠加透明 WebGL2 canvas，指针驱动
      暖金主光源，作用于 diffuse / normal / roughness / height 四贴图。
      贴图来源：CardArt.paintFace(hero) / CardArt.paintBack('guofeng')。
   2. 指针跟随 3D 倾斜 + 空闲摇摆 + 动态阴影（pointermove，触摸拖动兼容）。
   3. 每日请卡：签筒摇签仪式 → 抽卡编排（旧卡飞出、新卡翻面入场）。
      每日 1 次（localStorage guofeng-daily 按日判定 + 连续天数 streak），
      优先未收集；收藏存 guofeng-collection（旧 wow key 一次性迁移）。
   4. 底部 Tab 双页（请卡 / 图鉴）+ 全屏详情视图（3D 大卡 + 探索入口）
      + 行旅大地图（AtlasMap 统一经纬度投影底图，四向拖动与缩放）
      + 分享闭环（XhsBridge：发笔记 / 存相册，判空降级）。
      路由：#/  #/dex  #/hero/<id>  #/hero/<id>/map（hashchange 驱动）。

   对接契约（由并行开发的其他文件提供，全部防御性访问）：
     window.WOW_HEROES       —— 人物对象数组（js/heroes-data.js，沿用旧全局名）
     window.WOW_CLASS_INFO   —— 职业表（遗留，仅 DOM 降级卡面用）
     window.CardArt          —— { W, H, paintFace, paintBack, paintMini }
     window.ATLAS_MODEL      —— 地点注册表、路线与投影配置（js/atlas-data.js）
     window.MapGeometry      —— 纯坐标/相机布局模块（js/map-geometry.js）
     window.AtlasMap         —— 行旅大地图渲染器（js/atlas-map.js）
     window.XhsBridge        —— 小红书端能力桥（js/xhs-bridge.js）
   ========================================================================== */
(function () {
  'use strict';

  /* ============================================================ 契约检测 */

  var HEROES = Array.isArray(window.WOW_HEROES) ? window.WOW_HEROES : [];
  var CLASS_INFO = window.WOW_CLASS_INFO || null;
  var RARITY_INFO = window.WOW_RARITY_INFO || null;
  var CardArt = window.CardArt || null;
  var hasArt = !!(CardArt && typeof CardArt.paintFace === 'function' &&
                  typeof CardArt.paintBack === 'function');

  if (!HEROES.length) {
    console.warn('[英雄志] 未检测到 window.WOW_HEROES，召唤与图鉴功能暂停，仅展示静态卡面。');
  }
  if (!hasArt) {
    console.warn('[英雄志] 未检测到 window.CardArt（paintFace/paintBack），WebGL 卡面将回退为静态占位。');
  }

  /* 职业表 fallback：契约缺失时仍能渲染筛选 chips 与图鉴 */
  var CLASS_FALLBACK = {
    warrior:     { zh: '战士',     en: 'Warrior',      color: '#C79C6E' },
    paladin:     { zh: '圣骑士',   en: 'Paladin',      color: '#F58CBA' },
    mage:        { zh: '法师',     en: 'Mage',         color: '#69CCF0' },
    priest:      { zh: '牧师',     en: 'Priest',       color: '#FFFFFF' },
    druid:       { zh: '德鲁伊',   en: 'Druid',        color: '#FF7D0A' },
    shaman:      { zh: '萨满',     en: 'Shaman',       color: '#0070DE' },
    hunter:      { zh: '猎人',     en: 'Hunter',       color: '#ABD473' },
    rogue:       { zh: '潜行者',   en: 'Rogue',        color: '#FFF569' },
    warlock:     { zh: '术士',     en: 'Warlock',      color: '#9482C9' },
    deathknight: { zh: '死亡骑士', en: 'Death Knight', color: '#C41F3B' },
    demonhunter: { zh: '恶魔猎手', en: 'Demon Hunter', color: '#A330C9' }
  };
  var CLASS_ORDER = ['warrior', 'paladin', 'mage', 'priest', 'druid', 'shaman',
                     'hunter', 'rogue', 'warlock', 'deathknight', 'demonhunter'];

  var RARITY_FALLBACK = {
    legendary: { zh: '传说', color: '#FF8000' },
    epic:      { zh: '史诗', color: '#A335EE' },
    rare:      { zh: '稀有', color: '#0070DD' }
  };

  var FACTIONS = {
    alliance: { zh: '联盟', color: '#4a8fdd' },
    horde:    { zh: '部落', color: '#c41f3b' },
    neutral:  { zh: '中立', color: '#c8a55a' }
  };

  /* 门类表（图鉴筛选）：国风 roster 用 group 字段；旧魔兽条目无 group，
     过渡期只在「全部」下可见。 */
  var GROUPS = {
    emperor:  { zh: '帝王', color: '#B08D3E' },
    general:  { zh: '将相', color: '#8C3A3A' },
    literati: { zh: '文人', color: '#2E4A6B' },
    savant:   { zh: '奇士', color: '#3E6B4A' }
  };
  var GROUP_ORDER = ['emperor', 'general', 'literati', 'savant'];

  function groupInfo(key) {
    return GROUPS[key] || null;
  }

  function classInfo(key) {
    if (CLASS_INFO && CLASS_INFO[key]) return CLASS_INFO[key];
    return CLASS_FALLBACK[key] || { zh: key || '未知', en: '', color: '#c8a55a' };
  }
  function rarityInfo(key) {
    if (RARITY_INFO && RARITY_INFO[key]) return RARITY_INFO[key];
    return RARITY_FALLBACK[key] || { zh: key || '', color: '#c8a55a' };
  }
  function factionInfo(key) {
    return FACTIONS[key] || { zh: '中立', color: '#c8a55a' };
  }

  /* HTML 转义：英雄数据来自并行开发的文件，渲染前一律转义 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ============================================================ DOM 引用 */

  var stage = document.getElementById('cardStage');
  var mover = document.getElementById('cardMover');
  var tilt = document.getElementById('cardTilt');
  var shadow = document.getElementById('cardShadow');
  var obj = document.getElementById('cardObj');
  var faceEl = document.getElementById('cardFace');
  var backMount = tilt && tilt.querySelector('.card-back');
  var quoteEl = document.getElementById('quoteText');
  var quoteBox = document.getElementById('cardQuote');
  var summonBtn = document.getElementById('summonBtn');
  var tubeStage = document.getElementById('tubeStage');
  var tubeWrap = document.getElementById('tubeWrap');
  var fallenStick = document.getElementById('fallenStick');
  var tubeHint = document.getElementById('tubeHint');
  var streakEl = document.getElementById('drawStreak');
  var shareBar = document.getElementById('shareBar');
  var shareNoteBtn = document.getElementById('shareNoteBtn');
  var shareSaveBtn = document.getElementById('shareSaveBtn');
  var collectCountEl = document.getElementById('collectCount');
  var classChipsEl = document.getElementById('classChips');
  var dexGrid = document.getElementById('dex-grid');
  var progressTextEl = document.getElementById('progressText');
  var progressPctEl = document.getElementById('progressPct');
  var progressFillEl = document.getElementById('progressFill');
  var toastEl = document.getElementById('toast');
  var tabDrawBtn = document.getElementById('tabDraw');
  var tabDexBtn = document.getElementById('tabDex');
  var panelDraw = document.getElementById('panel-draw');
  var panelDex = document.getElementById('panel-dex');
  /* 人物详情页（全屏视图） */
  var panelHero = document.getElementById('panel-hero');
  var heroBack = document.getElementById('heroBack');
  var heroStage = document.getElementById('heroStage');
  var heroShadow = document.getElementById('heroShadow');
  var heroMover = document.getElementById('heroMover');
  var heroTilt = document.getElementById('heroTilt');
  var obj2 = document.getElementById('cardObj2');
  var faceEl2 = document.getElementById('cardFace2');
  var heroQuoteBox = document.getElementById('heroQuote');
  var heroQuoteText = document.getElementById('heroQuoteText');
  var exploreBtn = document.getElementById('exploreBtn');
  var heroShareBar = document.getElementById('heroShareBar');
  var heroNoteBtn = document.getElementById('heroNoteBtn');
  var heroSaveBtn = document.getElementById('heroSaveBtn');
  /* 行旅地图页（全屏视图） */
  var panelMap = document.getElementById('panel-map');
  var mapBack = document.getElementById('mapBack');
  var mapTitle = document.getElementById('mapTitle');
  var atlasMount = document.getElementById('atlasMount');
  var tabBar = document.querySelector('.tab-bar');

  /* 核心舞台元素缺失时直接退出（页面结构被破坏，无可挽回） */
  if (!stage || !mover || !tilt || !obj || !faceEl || !backMount) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  /* ==================================================== 英雄插画按需加载 */

  /* 小工具离线包不能让 48 张卡图阻塞首屏。只在抽中、打开详情或缩略卡进入
     视口时加载对应英雄资源；同一英雄的并发请求复用同一个 Promise。 */
  var hasPortraitLoader = !!(hasArt && typeof CardArt.preloadPortraits === 'function');
  var heroArtJobs = new Map();
  function prepareHeroArt(heroObj) {
    if (!heroObj || !hasPortraitLoader) return Promise.resolve();
    if (heroArtJobs.has(heroObj.id)) return heroArtJobs.get(heroObj.id);
    var job = Promise.resolve(CardArt.preloadPortraits([heroObj])).then(function () {
      if (typeof faceCache !== 'undefined' && faceCache) faceCache.delete(heroObj.id);
    }, function () { /* preloadPortraits 的失败不阻塞卡面降级 */ });
    heroArtJobs.set(heroObj.id, job);
    return job;
  }

  /* ============================================================ 收藏状态 */

  var STORAGE_KEY = 'guofeng-collection';
  var LEGACY_STORAGE_KEY = 'wow-hero-collection';   // 魔兽版旧 key（一次性迁移后删除）

  /* 每日请卡状态：{ date: 'YYYY-MM-DD', drawnId, streak, lastDate } */
  var DAILY_KEY = 'guofeng-daily';

  /* 预览模式（?preview=all）：解锁全部卡 + 取消每日一签限制，且不落盘，
     仅供开发期整站预览，打包前无需移除（无参数时完全不生效） */
  var PREVIEW_ALL = /[?&]preview=all/.test(window.location.search);

  var state = {
    collected: new Set(),   // 已收集英雄 id
    current: null,          // 当前舞台展示的英雄对象
    groupFilter: 'all'      // 图鉴门类过滤（emperor/general/literati/savant）
  };

  var daily = { date: '', drawnId: '', streak: 0, lastDate: '' };

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function loadDaily() {
    try {
      var raw = window.localStorage.getItem(DAILY_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          daily.date = typeof obj.date === 'string' ? obj.date : '';
          daily.drawnId = typeof obj.drawnId === 'string' ? obj.drawnId : '';
          daily.streak = Number(obj.streak) > 0 ? Math.floor(Number(obj.streak)) : 0;
          daily.lastDate = typeof obj.lastDate === 'string' ? obj.lastDate : '';
        }
      }
    } catch (err) { /* 静默降级为内存态 */ }
  }

  function saveDaily() {
    if (PREVIEW_ALL) return;   // 预览模式不落盘，避免占掉真实名额
    try {
      window.localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
    } catch (err) { /* 静默 */ }
  }

  function canDrawToday() {
    if (PREVIEW_ALL) return true;
    return daily.date !== todayStr();
  }

  /* 请卡成功后记账：streak 按「昨日连续」递增，中断归 1 */
  function markDrawnToday(heroId) {
    var today = todayStr();
    var y = new Date();
    y.setDate(y.getDate() - 1);
    var yesterday = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    daily.streak = (daily.lastDate === yesterday || daily.date === yesterday) ? daily.streak + 1 : 1;
    daily.lastDate = today;
    daily.date = today;
    daily.drawnId = heroId;
    saveDaily();
  }

  /* localStorage 全部 try/catch：隐私模式 / 配额异常时静默降级为内存态 */
  function loadCollection() {
    if (PREVIEW_ALL) {
      HEROES.forEach(function (h) { state.collected.add(h.id); });
    }
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        /* 旧版 key 一次性迁移 */
        var legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          raw = legacy;
          window.localStorage.setItem(STORAGE_KEY, legacy);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
      if (!raw) return;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      var valid = {};
      HEROES.forEach(function (h) { valid[h.id] = true; });
      arr.forEach(function (id) {
        // 只接受字符串 id；有英雄数据时还要求 id 在名录内
        if (typeof id !== 'string') return;
        if (HEROES.length && !valid[id]) return;
        state.collected.add(id);
      });
    } catch (err) {
      console.warn('[英雄志] 读取本地收藏失败，按空收藏继续：', err);
    }
  }

  function saveCollection() {
    if (PREVIEW_ALL) return;   // 预览模式不落盘，避免污染真实收藏
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.collected)));
    } catch (err) {
      console.warn('[英雄志] 写入本地收藏失败（本次收集仅保留在内存中）：', err);
    }
  }

  /* ============================================================ toast */

  var toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2400);
  }

  /* ====================================================== 静态卡面渲染 */
  /* WebGL 不可用 / CardArt 缺失时的 DOM 降级卡面；GL 就绪后整体隐藏。 */

  var SIGIL_SVG =
    '<svg class="cf-sigil" viewBox="0 0 80 80" aria-hidden="true">' +
      '<circle cx="40" cy="40" r="26" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<circle cx="40" cy="40" r="18.5" fill="none" stroke="currentColor" stroke-width="0.9" opacity="0.55"/>' +
      '<path d="M40 18 L45.5 34.5 L62 40 L45.5 45.5 L40 62 L34.5 45.5 L18 40 L34.5 34.5 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<circle cx="40" cy="40" r="3.2" fill="currentColor"/>' +
    '</svg>';

  function renderFace(heroObj, fEl, oEl) {
    fEl = fEl || faceEl;
    oEl = oEl || obj;
    var cls = classInfo(heroObj.class);
    var rar = rarityInfo(heroObj.rarity);
    var fac = factionInfo(heroObj.faction);
    var name = heroObj.name && heroObj.name.zh ? heroObj.name.zh : '未知英雄';
    var title = heroObj.title && heroObj.title.zh ? heroObj.title.zh : '';
    fEl.innerHTML =
      '<div class="cf-band" style="background:' + esc(fac.color) + '"></div>' +
      '<div class="cf-body">' +
        '<div class="cf-rarity" style="color:' + esc(rar.color) + '">' + esc(rar.zh) + '</div>' +
        SIGIL_SVG +
        '<div class="cf-name">' + esc(name) + '</div>' +
        '<div class="cf-title">' + esc(title) + '</div>' +
        '<div class="cf-meta">' + esc(cls.zh) + ' · ' + esc(fac.zh) + '</div>' +
      '</div>';
    oEl.setAttribute('aria-label', name + (title ? '，' + title : ''));
  }

  function setQuote(text) {
    if (quoteEl && typeof text === 'string' && text) quoteEl.textContent = text;
  }

  /* ==================================================== 进度徽章与进度条 */

  function renderProgress() {
    var total = HEROES.length || 24;
    var n = state.collected.size;
    var pct = total ? Math.round((n / total) * 100) : 0;
    if (collectCountEl) collectCountEl.textContent = n + '/' + total;
    if (progressTextEl) progressTextEl.textContent = '已集 ' + n + ' / ' + total;
    if (progressPctEl) progressPctEl.textContent = pct + '%';
    if (progressFillEl) progressFillEl.style.width = pct + '%';
  }

  /* ========================================================= 收藏图鉴 */

  var DEX_LOCK_SVG =
    '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
      '<path d="M60 26 L67 53 L94 60 L67 67 L60 94 L53 67 L26 60 L53 53 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<circle cx="60" cy="60" r="4.5" fill="currentColor"/>' +
    '</svg>';

  /* 图鉴缩略卡懒渲染：进入视口才 paintMini（移动端省 CPU/内存）。
     无 IntersectionObserver 时退回即时渲染。 */
  var dexObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      dexObserver.unobserve(en.target);
      paintDexMini(en.target);
    });
  }, { rootMargin: '80px 0px' }) : null;

  function paintDexMini(card) {
    var id = card.getAttribute('data-id');
    var h = null;
    for (var i = 0; i < HEROES.length; i++) {
      if (HEROES[i].id === id) { h = HEROES[i]; break; }
    }
    if (!h || card.hasAttribute('data-mini')) return;
    card.setAttribute('data-mini', 'loading');
    if (typeof h.fullArt === 'string' && h.fullArt) {
      var art = document.createElement('img');
      art.className = 'dex-art';
      art.alt = '';
      art.loading = 'lazy';
      art.decoding = 'async';
      art.src = h.fullArt.replace('assets/portraits/runtime/', 'assets/portraits/thumbs/');
      card.insertBefore(art, card.firstChild);
      card.setAttribute('data-mini', '1');
      return;
    }
    prepareHeroArt(h).then(function () {
      if (!card.isConnected) return;
      var mini = null;
      if (hasArt && typeof CardArt.paintMini === 'function') {
        try { mini = CardArt.paintMini(h, 300, 464); } catch (err) {
          console.warn('[英雄志] paintMini 失败（' + h.id + '），改用静态小卡：', err);
          mini = null;
        }
      }
      if (mini) {
        card.insertBefore(mini, card.firstChild);
      } else {
        var g0 = groupInfo(h.group);
        var ph = document.createElement('div');
        ph.className = 'dex-locked';
        ph.innerHTML = DEX_LOCK_SVG +
          '<span class="dex-q" style="letter-spacing:0.12em;padding:0;opacity:1">' +
          esc(h.name && h.name.zh ? h.name.zh : '') + '</span>' +
          (g0 ? '<span class="dex-q" style="font-size:11px;letter-spacing:0.2em">' + esc(g0.zh) + '</span>' : '');
        card.insertBefore(ph, card.firstChild);
      }
      card.setAttribute('data-mini', '1');
    });
  }

  /* 单个图鉴格子的 DOM（owned=已收集点亮 / 否则卡背剪影） */
  function buildDexCard(h, owned) {
    var card = document.createElement('div');
    card.className = 'dex-card ' + (owned ? 'owned' : 'locked');
    card.setAttribute('data-id', h.id);

    if (!owned) {
      var lock = document.createElement('div');
      lock.className = 'dex-locked';
      lock.innerHTML = DEX_LOCK_SVG + '<span class="dex-q">???</span>';
      card.appendChild(lock);
      card.addEventListener('click', function () {
        toast('尚未相遇，请到「请卡」页静候缘分');
      });
      return card;
    }

    /* 已收集：懒渲染缩略图 + 门类色名字条 + 点击进列传 */
    var cap = document.createElement('div');
    cap.className = 'dex-caption';
    var g = groupInfo(h.group);
    cap.innerHTML = '<i class="chip-dot" style="--dot:' + esc(g ? g.color : '#B08D3E') + '"></i><span>' +
      esc(h.name && h.name.zh ? h.name.zh : '未知') + '</span>';
    card.appendChild(cap);
    if (dexObserver) dexObserver.observe(card);
    else paintDexMini(card);
    card.addEventListener('click', function () { location.hash = '#/hero/' + h.id; });
    return card;
  }

  /* 全量渲染图鉴网格（初始化与门类筛选切换时调用） */
  function renderDex() {
    if (!dexGrid) return;
    if (dexObserver) dexObserver.disconnect();
    dexGrid.innerHTML = '';
    if (!HEROES.length) {
      var empty0 = document.createElement('p');
      empty0.className = 'dex-empty';
      empty0.textContent = '名录数据尚未就位。';
      dexGrid.appendChild(empty0);
      return;
    }
    var list = HEROES.filter(function (h) {
      return state.groupFilter === 'all' || h.group === state.groupFilter;
    });
    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'dex-empty';
      empty.textContent = '该门类暂无先贤在册。';
      dexGrid.appendChild(empty);
      return;
    }
    var frag = document.createDocumentFragment();
    list.forEach(function (h) {
      frag.appendChild(buildDexCard(h, state.collected.has(h.id)));
    });
    dexGrid.appendChild(frag);
  }

  /* 新收集英雄的增量点亮：只重建对应格子，避免全量重绘打断抽卡动画 */
  function unlockDexCard(id) {
    if (!dexGrid) return;
    var old = dexGrid.querySelector('.dex-card[data-id="' + id + '"]');
    if (!old) return; // 当前门类筛选下不可见，无需处理
    if (dexObserver) dexObserver.unobserve(old);
    var h = null;
    for (var i = 0; i < HEROES.length; i++) {
      if (HEROES[i].id === id) { h = HEROES[i]; break; }
    }
    if (!h) return;
    dexGrid.replaceChild(buildDexCard(h, true), old);
  }

  /* 门类筛选 chips：全部 + 帝王/将相/文人/奇士 */
  function buildClassChips() {
    if (!classChipsEl) return;
    classChipsEl.innerHTML = '';

    function makeChip(key, zh, color) {
      var b = document.createElement('button');
      b.className = 'chip' + (state.groupFilter === key ? ' is-active' : '');
      b.type = 'button';
      b.setAttribute('data-group', key);
      b.innerHTML = '<i class="chip-dot" style="--dot:' + esc(color) + '"></i>' + esc(zh);
      b.addEventListener('click', function () {
        state.groupFilter = key;
        classChipsEl.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('is-active', c.getAttribute('data-group') === key);
        });
        renderDex();
      });
      return b;
    }

    classChipsEl.appendChild(makeChip('all', '全部', '#B08D3E'));
    GROUP_ORDER.forEach(function (k) {
      classChipsEl.appendChild(makeChip(k, GROUPS[k].zh, GROUPS[k].color));
    });
  }

  /* ==================================================== 3D 倾斜 + 摇摆 */

  var MAX_TILT = 4.2;   // 朝向指针的最大倾角（度）
  var IDLE_AMP = 1.3;   // 空闲摇摆幅度（度）

  /* 极简 tween 池：apply(p) 收到线性 0..1，自行塑形缓动（全部 rig 共享） */
  var tweens = [];
  function tween(dur, apply, done) {
    tweens.push({ t0: performance.now(), dur: dur, apply: apply, done: done });
  }
  function stepTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      var p = Math.min(1, (now - tw.t0) / tw.dur);
      tw.apply(p);
      if (p >= 1) {
        tweens.splice(i, 1);
        if (tw.done) tw.done();
      }
    }
  }
  var easeOut3 = function (p) { return 1 - Math.pow(1 - p, 3); };

  /* 一套可复用的倾斜装备：请卡页主卡与人物详情页大卡各持一套。
     抽卡编排状态（flipAngle/move*）也内置于实例——详情页恒为初值不使用。 */
  function createTiltRig(refs) {
    var rig = {
      obj: refs.obj,
      tiltEl: refs.tiltEl,
      moverEl: refs.moverEl,
      shadowEl: refs.shadowEl,
      targetRX: 0, targetRY: 0,
      curRX: 0, curRY: 0,
      pointerActive: false,
      flipAngle: 0,
      moveX: 0, moveY: 0, moveRZ: 0, moveScale: 1,
      shadowMul: 1
    };

    rig.pointer = function (e) {
      if (!rig.obj) return;
      var r = rig.obj.getBoundingClientRect();
      if (r.width < 1) return;
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      // 归一化偏移并软化：指针远离卡牌时不至于把倾角打满
      var nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.5)));
      var ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight * 0.5)));
      rig.targetRY = nx * MAX_TILT;   // 水平方向：卡面转向指针
      rig.targetRX = -ny * MAX_TILT;  // 垂直方向同理
      rig.pointerActive = true;
    };

    rig.applyTransforms = function () {
      if (rig.moverEl) {
        rig.moverEl.style.transform =
          'translate3d(' + rig.moveX.toFixed(2) + 'px,' + rig.moveY.toFixed(2) + 'px,0)' +
          ' rotate(' + rig.moveRZ.toFixed(3) + 'deg) scale(' + rig.moveScale.toFixed(4) + ')';
      }
      if (rig.tiltEl) {
        rig.tiltEl.style.transform =
          'rotateX(' + rig.curRX.toFixed(3) + 'deg) rotateY(' + (rig.curRY + rig.flipAngle).toFixed(3) + 'deg)';
      }
    };

    rig.frame = function () {
      var t = performance.now() * 0.001;
      var idleX = Math.sin(t * 0.42) * IDLE_AMP;
      var idleY = Math.cos(t * 0.31) * IDLE_AMP;
      var goalRX = rig.targetRX + (rig.pointerActive ? idleX * 0.45 : idleX);
      var goalRY = rig.targetRY + (rig.pointerActive ? idleY * 0.45 : idleY);
      rig.curRX += (goalRX - rig.curRX) * 0.055;
      rig.curRY += (goalRY - rig.curRY) * 0.055;
      rig.applyTransforms();

      if (rig.shadowEl) {
        // 阴影背离主光源：与指针反向滑动，
        // 复用平滑后的倾斜状态，保持同一缓动滞后感。
        var nx = rig.curRY / MAX_TILT;  // -1…1 指针方位（水平）
        var ny = -rig.curRX / MAX_TILT; // -1…1 指针方位（垂直）
        var sx = -nx * 34;
        var sy = 22 - ny * 26;
        // 光源越偏轴 → 阴影越长、越软、越淡
        var d = Math.min(1, Math.hypot(nx, ny));
        var scale = 1 + d * 0.05;
        rig.shadowEl.style.transform =
          'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ')';
        rig.shadowEl.style.opacity = ((1 - d * 0.3) * rig.shadowMul).toFixed(3);
      }
    };

    return rig;
  }

  var rigs = [];
  var drawRig = createTiltRig({ obj: obj, tiltEl: tilt, moverEl: mover, shadowEl: shadow });
  rigs.push(drawRig);

  window.addEventListener('pointermove', function (e) {
    for (var i = 0; i < rigs.length; i++) rigs[i].pointer(e);
  }, { passive: true });

  function tiltFrame() {
    if (!reduceMotion) {
      stepTweens(performance.now());
      for (var i = 0; i < rigs.length; i++) rigs[i].frame();
    }
    requestAnimationFrame(tiltFrame);
  }
  requestAnimationFrame(tiltFrame);

  /* ======================================================== 抽卡编排 */

  /* 以下三个函数在 WebGL 段落中会被升级（同步更换 shader 贴图）；
     无 GL 时 DOM 静态卡面依然完成翻面与替换。 */
  var ensureCardLoaded = function (heroObj) {
    if (!hasArt) return Promise.resolve();
    return prepareHeroArt(heroObj).then(function () {
      try {
        loadFaceSet(heroObj); // 触发 paintFace 入缓存
      } catch (err) { /* 静默：applyCard 里会再走降级链 */ }
    });
  };

  var applyCard = function (heroObj) {
    renderFace(heroObj); // DOM 静态卡面（GL 隐藏它，但飞出克隆需要）
  };

  /* 飞出克隆的正面快照元素：默认克隆 DOM 静态卡面，
     GL 运行时升级为光照 canvas 的逐像素副本。 */
  var snapshotFront = function () {
    var clone = faceEl.cloneNode(true);
    clone.removeAttribute('id');
    return clone;
  };
  var snapshotBack = function () {
    var backFace = backMount.querySelector('.card-face');
    var clone = (backFace || backMount).cloneNode(true);
    clone.removeAttribute('id');
    return clone;
  };

  /* 旧卡：fixed 克隆覆盖在卡牌原位置，边翻向卡背边飞出页面左上角 */
  function spawnFlyOut(rect) {
    var fly = document.createElement('div');
    fly.className = 'card-fly';
    fly.style.left = rect.left + 'px';
    fly.style.top = rect.top + 'px';
    fly.style.width = rect.width + 'px';
    fly.style.height = rect.height + 'px';

    var inner = document.createElement('div');
    inner.className = 'card-fly-inner';
    var front = document.createElement('div');
    front.className = 'fly-face';
    front.appendChild(snapshotFront());
    var back = document.createElement('div');
    back.className = 'fly-face fly-back';
    back.appendChild(snapshotBack());
    inner.appendChild(front);
    inner.appendChild(back);
    fly.appendChild(inner);
    document.body.appendChild(fly);

    // 足够远，确保卡牌完全飞出左上角
    var ex = -(rect.left + rect.width + 80);
    var ey = -(rect.top + rect.height + 80);

    tween(680, function (p) {
      var q = p * p;          // 位移加速远离
      var r = easeOut3(p);    // 翻面早早完成，随后只是滑行
      inner.style.transform =
        'translate3d(' + (ex * q).toFixed(1) + 'px,' + (ey * q).toFixed(1) + 'px,0)' +
        ' rotate(' + (-16 * r).toFixed(2) + 'deg)' +
        ' rotateY(' + (-195 * r).toFixed(2) + 'deg)' +
        ' scale(' + (1 - 0.14 * q).toFixed(4) + ')';
    }, function () { fly.remove(); });
  }

  var flipping = false;

  /* 从名录抽取一名英雄：优先未收集；全部收集后必然重复（重逢） */
  function pickHero() {
    var pool = HEROES.slice();
    if (!pool.length) return { hero: null, isNew: false };
    var fresh = pool.filter(function (h) { return !state.collected.has(h.id); });
    var source = fresh.length ? fresh : pool;
    var h = source[Math.floor(Math.random() * source.length)];
    return { hero: h, isNew: !state.collected.has(h.id) };
  }

  /* 抽中后的结算：写入收藏、每日记账、更新题款 / 徽章 / 图鉴 / 分享条 */
  function settleSummon(heroObj, isNew) {
    state.current = heroObj;
    markDrawnToday(heroObj.id);
    if (isNew) {
      state.collected.add(heroObj.id);
      saveCollection();
      unlockDexCard(heroObj.id);
      toast('新卡入囊 · ' + (heroObj.name && heroObj.name.zh ? heroObj.name.zh : ''));
    } else {
      toast('重逢 · 此卡已在囊中');
    }
    if (heroObj.quote) setQuote(heroObj.quote);
    renderProgress();
    showStreak();
    showShareBar(heroObj);
  }

  function drawCard() {
    if (flipping) return;
    if (!HEROES.length) {
      console.warn('[英雄志] WOW_HEROES 缺失，无法召唤。');
      toast('英雄名录尚未就位');
      return;
    }
    var pick = pickHero();
    if (!pick.hero) {
      toast('该阵营暂无英雄在册');
      return;
    }
    flipping = true;
    var card = pick.hero;
    var loadP = ensureCardLoaded(card);

    if (reduceMotion) {
      // 减少动态偏好：无动画，直接换卡结算
      loadP.then(function () {
        applyCard(card);
        settleSummon(card, pick.isNew);
        flipping = false;
      });
      return;
    }

    var rect = stage.getBoundingClientRect();
    if (state.current) spawnFlyOut(rect);   // 有旧卡才放飞出克隆

    // 把真卡停泊到请卡面板之下（overflow 裁掉），卡背朝前、页面居中。
    // 同步应用，保证它不会在克隆底下于原位闪现。
    var heroRect = (panelDraw || document.body).getBoundingClientRect();
    drawRig.moveX = window.innerWidth / 2 - (rect.left + rect.width / 2);
    drawRig.moveY = (heroRect.bottom + rect.height * 0.6) - (rect.top + rect.height / 2);
    drawRig.moveRZ = 9;
    drawRig.moveScale = 0.95;
    drawRig.flipAngle = 180;
    drawRig.shadowMul = 0; // 停泊期间克隆自带阴影，真卡阴影先收起
    drawRig.applyTransforms();

    loadP.then(function () {
      applyCard(card);
      // 短暂停顿，让旧卡的离场先被看清，新卡再起程
      setTimeout(function () {
        var sx = drawRig.moveX;
        var sy = drawRig.moveY;
        var srz = drawRig.moveRZ;
        tween(920, function (p) {
          var m = easeOut3(p);
          drawRig.moveX = sx * (1 - m);
          drawRig.moveY = sy * (1 - m);
          drawRig.moveRZ = srz * (1 - m);
          drawRig.moveScale = 0.95 + 0.05 * m;
          // 上升前段保持卡背朝前，随后翻面，落位前正好正面朝上
          var f = Math.min(1, Math.max(0, (p - 0.12) / 0.72));
          drawRig.flipAngle = 180 * (1 - easeOut3(f));
        }, function () {
          drawRig.flipAngle = 0;
          tween(260, function (p) { drawRig.shadowMul = p; });
          settleSummon(card, pick.isNew);
          flipping = false;
        });
      }, 170);
    });
  }

  /* 请卡仪式：每日一签——摇签筒 → 签落 → 揭卡（每日 1 次，localStorage 判定） */
  function showCardStage() {
    if (tubeStage) tubeStage.hidden = true;
    stage.hidden = false;
    if (quoteBox) quoteBox.hidden = false;
  }

  function showStreak() {
    if (!streakEl) return;
    streakEl.hidden = false;
    streakEl.textContent = '已连续请卡 ' + Math.max(1, daily.streak) + ' 天 · 明日再来';
  }

  function startRitual() {
    if (flipping) return;
    if (!HEROES.length) {
      toast('名录尚未就位');
      return;
    }
    if (!canDrawToday()) {
      toast('今日一签已请，明日再来');
      return;
    }
    if (reduceMotion) {                        // 减少动态偏好：跳过仪式直接揭卡
      showCardStage();
      drawCard();
      return;
    }
    if (tubeWrap) tubeWrap.classList.add('is-shaking');
    setTimeout(function () {
      if (fallenStick) fallenStick.classList.add('is-fallen');
    }, 620);
    setTimeout(function () {
      showCardStage();
      drawCard();
    }, 1450);
  }

  if (summonBtn) {
    summonBtn.addEventListener('click', function (e) {
      e.preventDefault();
      startRitual();
    });
  }

  /* ==================================================== WebGL 光照层 */

  var VERT = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  var FRAG = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 frag;

  uniform sampler2D uDiffuse;
  uniform sampler2D uNormal;
  uniform sampler2D uRough;
  uniform sampler2D uHeight;

  uniform vec2  uMouse;       // 指针在 canvas UV 中的位置（y 向上）
  uniform float uHasMouse;
  uniform float uParallax;
  uniform float uLightZ;
  uniform float uNormalStr;
  uniform float uSpecStr;
  uniform float uDiffuseAmt;
  uniform float uAmbientAmt;
  uniform vec3  uLightColor;
  uniform vec3  uAmbientColor;
  uniform float uMotion;

  void main() {
    vec2 uv = vUv;

    // 高度视差：凸起像素随指针反向漂移
    float h0 = texture(uHeight, uv).r;
    if (uMotion > 0.5 && uHasMouse > 0.5) {
      vec2 viewOff = (uMouse - vec2(0.5)) * 2.0;
      uv = clamp(uv - viewOff * (h0 * uParallax), 0.001, 0.999);
    }

    vec4 diff = texture(uDiffuse, uv);
    float a = diff.a;
    if (a < 0.004) { frag = vec4(0.0); return; }

    vec3 albedo = diff.rgb;
    float rough = texture(uRough, uv).r;
    float h = texture(uHeight, uv).r;

    vec3 nRaw = texture(uNormal, uv).xyz * 2.0 - 1.0;
    nRaw.xy *= uNormalStr;
    vec3 N = normalize(vec3(nRaw.xy, max(nRaw.z, 0.08)));

    vec3 V = vec3(0.0, 0.0, 1.0);
    float ambRelief = 0.74 + 0.26 * max(N.z, 0.0);
    vec3 col = albedo * uAmbientColor * uAmbientAmt * ambRelief;

    // 跟随指针的奥术暖金主光源
    vec2 lightUv = (uHasMouse > 0.5) ? uMouse : vec2(0.44, 0.66);
    vec3 L = normalize(vec3(lightUv.x - uv.x, lightUv.y - uv.y, uLightZ));
    float ndl = max(dot(N, L), 0.0);
    float wrap = ndl * 0.8 + 0.2;
    col += albedo * uLightColor * (wrap * uDiffuseAmt);

    // 粗糙度塑形的高光：烧金线稿吃光，哑光墨色保持安静
    vec3 H = normalize(L + V);
    float shininess = mix(52.0, 6.0, clamp(rough, 0.0, 1.0));
    float spec = pow(max(dot(N, H), 0.0), shininess);
    spec *= (1.0 - rough * 0.85) * uSpecStr;
    spec *= 0.82 + 0.34 * h;
    col += uLightColor * spec;

    // 主光从侧面掠射时的微弱暖色轮廓光
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.4);
    float side = 1.0 - abs(L.z);
    col += uLightColor * rim * side * 0.1 * (1.0 - rough * 0.5);

    col = clamp(col, 0.0, 1.0);
    frag = vec4(col * a, a);
  }`;

  /* 一层光照平面：独立 canvas + GL2 上下文，覆盖在挂载元素之上。
     flipMouseX 为卡背镜像指针 X —— 卡背所在平面旋转了 180°，
     屏幕左侧对应其纹理右侧。 */
  function createLitLayer(mount, flipMouseX) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');

    var gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'default'
    });
    if (!gl) return null;

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[英雄志] 卡面 shader 编译失败：', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[英雄志] 卡面光照链接失败：', gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    [
      'uDiffuse', 'uNormal', 'uRough', 'uHeight',
      'uMouse', 'uHasMouse', 'uParallax', 'uLightZ', 'uNormalStr',
      'uSpecStr', 'uDiffuseAmt', 'uAmbientAmt', 'uLightColor', 'uAmbientColor',
      'uMotion'
    ].forEach(function (name) { U[name] = gl.getUniformLocation(prog, name); });

    gl.uniform1i(U.uDiffuse, 0);
    gl.uniform1i(U.uNormal, 1);
    gl.uniform1i(U.uRough, 2);
    gl.uniform1i(U.uHeight, 3);

    // 奥术暖金主光 + 冷蓝环境光：匹配暗夜圣所的场景气氛
    gl.uniform3f(U.uLightColor, 1.0, 0.90, 0.72);
    gl.uniform3f(U.uAmbientColor, 0.70, 0.79, 0.94);
    gl.uniform1f(U.uAmbientAmt, 0.56);
    gl.uniform1f(U.uDiffuseAmt, 0.62);
    gl.uniform1f(U.uSpecStr, 0.34);
    gl.uniform1f(U.uNormalStr, 1.35);
    gl.uniform1f(U.uLightZ, 0.5);
    gl.uniform1f(U.uParallax, reduceMotion ? 0.0 : 0.0034);
    gl.uniform1f(U.uMotion, reduceMotion ? 0.0 : 1.0);
    gl.uniform1f(U.uHasMouse, 0.0);
    gl.uniform2f(U.uMouse, 0.44, 0.66);

    function makeTex(unit, internalFormat, format) {
      var t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      var px = internalFormat === gl.RGBA ? new Uint8Array([0, 0, 0, 0]) : new Uint8Array([128, 128, 255]);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 1, 1, 0, format, gl.UNSIGNED_BYTE, px);
      return t;
    }

    var texDiffuse = makeTex(0, gl.RGBA, gl.RGBA);
    var texNormal = makeTex(1, gl.RGB, gl.RGB);
    var texRough = makeTex(2, gl.RGB, gl.RGB);
    var texHeight = makeTex(3, gl.RGB, gl.RGB);

    mount.appendChild(canvas);

    /* canvas 贴图直接上传（664×1024 NPOT 在 WebGL2 中可生成 mipmap） */
    function upload(tex, unit, image, internalFormat, format) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, format, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    var ready = false;
    var disposed = false;
    var needsDraw = true;
    var mouse = { x: 0.44, y: 0.66 };
    var hasMouse = false;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    function resize() {
      // 用布局尺寸而非 getBoundingClientRect：挂载元素在翻面/飞行途中
      // 的变换矩形会导致缓冲反复抖动重建
      var w0 = canvas.offsetWidth;
      var h0 = canvas.offsetHeight;
      if (w0 < 2 || h0 < 2) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(w0 * dpr));
      var h = Math.max(1, Math.round(h0 * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        needsDraw = true;
      }
    }

    function draw() {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(U.uMouse, flipMouseX ? 1 - mouse.x : mouse.x, mouse.y);
      gl.uniform1f(U.uHasMouse, hasMouse ? 1.0 : 0.0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texDiffuse);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texNormal);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, texRough);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, texHeight);

      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame() {
      if (!ready) return;
      if (needsDraw) {
        needsDraw = false;
        draw();
      }
      requestAnimationFrame(frame);
    }

    return {
      canvas: canvas,
      /* set = { diffuse, normal, rough, height }，四个 HTMLCanvasElement */
      setTextures: function (set) {
        if (disposed) return;
        upload(texDiffuse, 0, set.diffuse, gl.RGBA, gl.RGBA);
        upload(texNormal, 1, set.normal, gl.RGB, gl.RGB);
        upload(texRough, 2, set.rough, gl.RGB, gl.RGB);
        upload(texHeight, 3, set.height, gl.RGB, gl.RGB);
        needsDraw = true;
        if (!ready) {
          ready = true;
          resize();
          mount.classList.add('is-webgl');
          requestAnimationFrame(frame);
        }
      },
      pointer: function (e) {
        if (!ready) return;
        var r = canvas.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        // 允许越界，让主光源可以从卡牌外缘掠射进来
        var x = (e.clientX - r.left) / r.width;
        var y = 1.0 - (e.clientY - r.top) / r.height;
        mouse.x = Math.min(1.4, Math.max(-0.4, x));
        mouse.y = Math.min(1.4, Math.max(-0.4, y));
        hasMouse = true;
        needsDraw = true;
      },
      drawNow: function () {
        if (ready) draw();
      },
      redraw: function () { needsDraw = true; },
      onResize: function () {
        if (!ready) return;
        resize();
        needsDraw = true;
      },
      setUniform: function (name, args) {
        if (!U[name]) return;
        gl.useProgram(prog);
        if (name === 'uMouse' && args.length >= 2) {
          mouse.x = args[0];
          mouse.y = args[1];
          hasMouse = true;
        }
        if (name === 'uHasMouse' && args.length >= 1) hasMouse = args[0] > 0.5;
        if (args.length === 1) gl.uniform1f(U[name], args[0]);
        else if (args.length === 2) gl.uniform2f(U[name], args[0], args[1]);
        else if (args.length === 3) gl.uniform3f(U[name], args[0], args[1], args[2]);
        needsDraw = true;
      },
      dispose: function () {
        disposed = true;
        ready = false;
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        mount.classList.remove('is-webgl');
      }
    };
  }

  /* ---------------------------------------------------- 贴图集获取 */

  /* paintFace 结果缓存：hero.id → {diffuse,normal,rough,height}。
     上限 8 套，超出淘汰最旧（664×1024×4 贴图不宜全员常驻内存）。 */
  var faceCache = new Map();
  var FACE_CACHE_MAX = coarsePointer ? 3 : 8;   // 移动端降配：手机 WebView 内存吃紧

  function loadFaceSet(heroObj) {
    if (faceCache.has(heroObj.id)) {
      // 触碰刷新插入序（Map 迭代序 = 插入序），实现简易 LRU
      var hit = faceCache.get(heroObj.id);
      faceCache.delete(heroObj.id);
      faceCache.set(heroObj.id, hit);
      return hit;
    }
    var set = CardArt.paintFace(heroObj); // 可能抛异常 → 由调用方走降级
    if (!set || !set.diffuse || !set.normal || !set.rough || !set.height) {
      throw new Error('CardArt.paintFace 返回的贴图集不完整（' + heroObj.id + '）');
    }
    faceCache.set(heroObj.id, set);
    while (faceCache.size > FACE_CACHE_MAX) {
      faceCache.delete(faceCache.keys().next().value);
    }
    return set;
  }

  var backSet = null;
  var backTried = false;
  function loadBackSet() {
    if (backSet) return backSet;
    if (backTried) return null; // 已失败过，不再反复重试
    backTried = true;
    try {
      var set = CardArt.paintBack('guofeng');   // 国风卡背（回纹框 + 朱砂「群英」印）
      if (!set || !set.diffuse || !set.normal || !set.rough || !set.height) {
        throw new Error('CardArt.paintBack 返回的贴图集不完整');
      }
      backSet = set;
    } catch (err) {
      console.warn('[英雄志] 卡背贴图生成失败，回退静态卡背：', err);
      backSet = null;
    }
    return backSet;
  }

  /* ---------------------------------------------------- 光照层启动 */

  /* CardArt 缺失：整段 GL 跳过，DOM 静态卡面 + 完整抽卡编排依然可用 */
  var frontLayer = null;
  var backLayer = null;
  var layers = [];

  if (hasArt) {
    frontLayer = createLitLayer(obj, false);
    backLayer = createLitLayer(backMount, true);
    layers = [frontLayer, backLayer].filter(Boolean);
    if (!layers.length) {
      console.warn('[英雄志] WebGL2 不可用，卡面回退为静态绘制。');
    }
  }

  if (layers.length) {
    if (!reduceMotion) {
      window.addEventListener('pointermove', function (e) {
        layers.forEach(function (L) { L.pointer(e); });
      }, { passive: true });
    }
    window.addEventListener('resize', function () {
      layers.forEach(function (L) { L.onResize(); });
    }, { passive: true });
  }

  if (frontLayer) {
    /* 升级抽卡三件套：贴图经由 CardArt canvas 直接更换 */
    ensureCardLoaded = function (heroObj) {
      return prepareHeroArt(heroObj).then(function () {
        loadFaceSet(heroObj); // 异常将沿 promise 链传播
      }).catch(function (err) {
        console.warn('[英雄志] 卡面贴图生成失败，本次回退静态卡面：', err);
      });
    };

    applyCard = function (heroObj) {
      renderFace(heroObj); // DOM 兜底同步更新（飞出克隆 / GL 失效时用）
      if (!frontLayer) return; // 前层已降级拆除，仅保留静态卡面
      try {
        frontLayer.setTextures(loadFaceSet(heroObj));
      } catch (err) {
        console.warn('[英雄志] 卡面光照贴图失败，前层回退静态卡面：', err);
        try { frontLayer.dispose(); } catch (e) { /* 忽略二次异常 */ }
        frontLayer = null;
      }
    };

    snapshotFront = function () {
      var src = frontLayer && frontLayer.canvas;
      if (src && src.width > 1 && src.height > 1) {
        try {
          frontLayer.drawNow(); // 确保绘制缓冲是最新一帧
          var copy = document.createElement('canvas');
          copy.width = src.width;
          copy.height = src.height;
          copy.getContext('2d').drawImage(src, 0, 0);
          return copy;
        } catch (err) { /* 落入下方 DOM 克隆兜底 */ }
      }
      var clone = faceEl.cloneNode(true);
      clone.removeAttribute('id');
      return clone;
    };
  }

  if (backLayer) {
    snapshotBack = function () {
      var src = backLayer && backLayer.canvas;
      if (src && src.width > 1 && src.height > 1) {
        try {
          backLayer.drawNow();
          var copy = document.createElement('canvas');
          copy.width = src.width;
          copy.height = src.height;
          copy.getContext('2d').drawImage(src, 0, 0);
          return copy;
        } catch (err) { /* 落入下方 DOM 克隆兜底 */ }
      }
      var backFace = backMount.querySelector('.card-face');
      var clone = (backFace || backMount).cloneNode(true);
      clone.removeAttribute('id');
      return clone;
    };

    var bs = loadBackSet();
    if (bs) {
      backLayer.setTextures(bs);
    } else {
      backLayer.dispose();
      backLayer = null;
    }
  }

  /* ------------------------------------------------ 详情页 3D 卡 */

  /* 详情页：独立一套倾斜装备（heroRig）+ 单实例光照层（只要正面），
     与请卡页共享 faceCache LRU，切换人物零重复绘制。 */
  var heroLayer = null;
  var heroRig = null;
  if (obj2 && heroTilt) {
    heroRig = createTiltRig({ obj: obj2, tiltEl: heroTilt, moverEl: heroMover, shadowEl: heroShadow });
    rigs.push(heroRig);
    if (hasArt) {
      heroLayer = createLitLayer(obj2, false);
      if (heroLayer) layers.push(heroLayer);   // 复用全局 pointermove / resize 驱动
    }
  }

  /* 打开详情页时换装：DOM 静态面兜底 + GL 贴图 */
  function applyHeroCard(heroObj) {
    renderFace(heroObj, faceEl2, obj2);
    if (!heroLayer) return;
    try {
      heroLayer.setTextures(loadFaceSet(heroObj));
    } catch (err) {
      console.warn('[英雄志] 详情页卡面光照贴图失败，回退静态卡面：', err);
      try { heroLayer.dispose(); } catch (e) { /* 忽略二次异常 */ }
      heroLayer = null;
    }
  }

  /* 控制台调参旋钮（正面；背面用 CardLighting.back） */
  function knobs(layer) {
    return layer ? {
      set: function (name) {
        layer.setUniform(name, Array.prototype.slice.call(arguments, 1));
      },
      redraw: function () { layer.redraw(); }
    } : null;
  }
  window.CardLighting = Object.assign(knobs(frontLayer) || {}, { back: knobs(backLayer) });

  /* ==================================================== 分享条 */

  var heroDetail = null;   /* 当前详情页 / 地图页人物 */

  function setHeroShareReady(ready) {
    if (heroNoteBtn) heroNoteBtn.disabled = !ready;
    if (heroSaveBtn) heroSaveBtn.disabled = !ready;
    if (heroShareBar) heroShareBar.setAttribute('aria-busy', ready ? 'false' : 'true');
  }

  /* 当前卡面 diffuse 的 dataURL（分享/存相册用）；失败返回空串 */
  function cardDataUrl(heroObj) {
    if (!heroObj) return '';
    try {
      var set = loadFaceSet(heroObj);
      return set && set.diffuse ? set.diffuse.toDataURL('image/png') : '';
    } catch (err) { return ''; }
  }

  function wireShareButtons(noteBtn, saveBtn, getHero) {
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var h = getHero();
      if (!h || !window.XhsBridge) return;
      window.XhsBridge.saveImage(h, cardDataUrl(h)).then(function (ok) {
        toast(ok ? '已存入相册'
                 : '导出失败，请稍后再试');
      });
    });
    if (noteBtn) {
      if (!window.XhsBridge || !window.XhsBridge.available()) {
        noteBtn.style.display = 'none';            // 浏览器里隐藏「发笔记」入口
      } else {
        noteBtn.addEventListener('click', function () {
          var h = getHero();
          if (!h) return;
          window.XhsBridge.postNote(h, cardDataUrl(h)).then(function (ok) {
            if (!ok) toast('未能调起笔记，请稍后再试');
          });
        });
      }
    }
  }

  function showShareBar() {
    if (shareBar) shareBar.hidden = false;
  }

  wireShareButtons(shareNoteBtn, shareSaveBtn, function () { return state.current; });
  wireShareButtons(heroNoteBtn, heroSaveBtn, function () { return heroDetail; });

  /* ==================================================== 视图路由 */

  function findHeroById(id) {
    for (var i = 0; i < HEROES.length; i++) {
      if (HEROES[i].id === id) return HEROES[i];
    }
    return null;
  }

  /* 视图切换：draw/dex 为主 Tab；hero/map 为全屏覆盖视图（fixed 面板） */
  function switchView(view) {
    if (panelDraw) panelDraw.classList.toggle('is-active', view === 'draw');
    if (panelDex) panelDex.classList.toggle('is-active', view === 'dex');
    if (tabDrawBtn) tabDrawBtn.classList.toggle('is-active', view === 'draw');
    if (tabDexBtn) tabDexBtn.classList.toggle('is-active', view === 'dex');
    if (panelHero) panelHero.hidden = view !== 'hero';
    if (panelMap) panelMap.hidden = view !== 'map';
    // 覆盖视图打开时锁住底层页面滚动
    document.body.style.overflow = (view === 'hero' || view === 'map') ? 'hidden' : '';
    if (view !== 'map' && atlasMount) {
      if (window.AtlasMap && typeof window.AtlasMap.destroy === 'function') {
        window.AtlasMap.destroy(atlasMount);
      } else {
        atlasMount.innerHTML = '';
      }
    }
  }

  /* 底部 Tab 点击：切换视图并把 hash 就地改写（不留历史记录） */
  function switchTab(name) {
    switchView(name);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', name === 'dex' ? '#/dex' : '#/');
    }
  }

  /* 人物详情视图（hash 由调用方驱动，这里只做呈现） */
  function showHeroDetail(heroObj) {
    heroDetail = heroObj;
    renderFace(heroObj, faceEl2, obj2);                  // 立即替换旧人物，GL 层加载期间隐藏
    if (obj2) obj2.classList.add('is-loading-art');
    setHeroShareReady(false);
    if (heroQuoteBox) {
      heroQuoteBox.hidden = !heroObj.quote;
      if (heroQuoteText && heroObj.quote) heroQuoteText.textContent = heroObj.quote;
    }
    switchView('hero');
    prepareHeroArt(heroObj).then(function () {
      if (heroDetail !== heroObj) return;
      applyHeroCard(heroObj);
      if (obj2) obj2.classList.remove('is-loading-art');
      setHeroShareReady(true);
    });
  }

  /* 行旅地图视图 */
  function showHeroMap(heroObj) {
    heroDetail = heroObj;
    if (mapTitle) {
      mapTitle.textContent = (heroObj.name && heroObj.name.zh ? heroObj.name.zh : '') + ' · 行旅图';
    }
    switchView('map');
    if (atlasMount && window.AtlasMap && typeof window.AtlasMap.render === 'function') {
      window.AtlasMap.render(atlasMount, heroObj);
    }
  }

  /* hash 路由：#/  #/dex  #/hero/<id>  #/hero/<id>/map（兼旧版 #hero=<id>） */
  function applyRoute() {
    var hash = window.location.hash || '';

    /* 旧版深链兼容：#hero=<id> → #/hero/<id> */
    var legacy = /[#&]hero=([\w-]+)/.exec(hash);
    if (legacy && findHeroById(legacy[1])) {
      hash = '#/hero/' + legacy[1];
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', hash);
      }
    }

    var m = /^#\/hero\/([\w-]+)(\/map)?$/.exec(hash);
    if (m) {
      var heroObj = findHeroById(m[1]);
      if (!heroObj || !state.collected.has(heroObj.id)) {
        if (heroObj) toast('尚未相遇，请到「请卡」页静候缘分');
        switchTab('dex');
        return;
      }
      if (m[2]) showHeroMap(heroObj);
      else showHeroDetail(heroObj);
      return;
    }
    switchView(hash.indexOf('#/dex') === 0 ? 'dex' : 'draw');
  }

  window.addEventListener('hashchange', applyRoute);

  if (heroBack) heroBack.addEventListener('click', function () { location.hash = '#/dex'; });
  if (mapBack) mapBack.addEventListener('click', function () {
    if (heroDetail) location.hash = '#/hero/' + heroDetail.id;
  });
  if (exploreBtn) exploreBtn.addEventListener('click', function () {
    if (heroDetail) location.hash = '#/hero/' + heroDetail.id + '/map';
  });

  if (tabDrawBtn) tabDrawBtn.addEventListener('click', function () { switchTab('draw'); });
  if (tabDexBtn) tabDexBtn.addEventListener('click', function () { switchTab('dex'); });

  /* ============================================================ 初始化 */

  loadCollection();
  loadDaily();
  buildClassChips();
  renderProgress();

  /* 首屏只等本地 woff2 字体；人物插画在使用时按需加载。 */
  var fontsReady = (document.fonts && document.fonts.load) ? Promise.all([
    document.fonts.ready,
    document.fonts.load('30px "Ma Shan Zheng"', '华夏人物图鉴今日请卡签李白举杯邀明月对影成三人名录生平')
  ]).catch(function () {}) : Promise.resolve();
  var bootReady = fontsReady;

  bootReady.then(function () {
    renderDex();                                         // 图鉴缩略卡（懒渲染）

    /* 今日已请过卡：恢复今日卡面 + 连续天数；否则保持签筒待请状态 */
    if (daily.date === todayStr() && daily.drawnId) {
      for (var i = 0; i < HEROES.length; i++) {
        if (HEROES[i].id === daily.drawnId) {
          state.current = HEROES[i];
          showCardStage();
          ensureCardLoaded(HEROES[i]).then(function () {
            if (state.current) applyCard(state.current);
          });
          if (HEROES[i].quote) setQuote(HEROES[i].quote);
          showStreak();
          break;
        }
      }
    }

    /* 初始路由：#/  #/dex  #/hero/<id>  #/hero/<id>/map（兼旧版 #hero=<id>） */
    applyRoute();
  });
})();
