/* ============================================================================
 * 艾泽拉斯英雄志 · 卡牌绘师（js/card-art.js）
 * ----------------------------------------------------------------------------
 * 本文件是全站视觉核心，由「卡牌绘师」维护。以普通 <script> 标签在
 * js/heroes-data.js 之后、js/app.js 之前引入，不使用 module。
 *
 * 【对外契约】（三个 agent 并行协作的接口，改动前必须三方对齐）：
 *
 *   window.CardArt = {
 *     W: 1329, H: 2048,                        // 卡面贴图物理分辨率（px，= 逻辑 664×1024 的 2×）
 *     paintFace(hero)  → { diffuse, normal, rough, height },
 *     paintBack()      → { diffuse, normal, rough, height },
 *     paintMini(hero, w, h) → HTMLCanvasElement, // 图鉴墙缩略卡面
 *     preloadPortraits(heroes) → Promise,       // 预载英雄肖像（永不 reject）
 *     hasPortrait(hero) → boolean,              // 该英雄是否已有可用肖像
 *     paintFaceFull(hero, artImage, opts) → 四贴图   // 【试验·方案A】全幅场景卡面
 *   };
 *   opts.mode：'relief'（默认，宏观浮雕：亮度多尺度大半径低通 → 圆雕体块
 *              height，低通金域 / 亮度软分档 → 镜面 42 / 半哑光 145 / 哑光 215
 *              三档 rough，档间平滑过渡，细线细节不进高度图）|
 *              'auto'（按放宽金域覆盖率 ≥6% 自动判定 painting / goldline）|
 *              'painting'（油画全幅）| 'goldline'（金线蚀刻，掩膜 1px 膨胀，
 *              金线 220–250 高凸起 / 12–40 纯金箔，蓝底低平 / 哑光 200–225）；
 *   返回值附带试验信息字段 artMode / goldCover（非契约键）。
 *   opts.externalMaps = { normal: Image, height: Image }（可选，仅 relief
 *   模式生效）：AI 语义化贴图试验。与 diffuse 走完全相同的底裁 8% +
 *   cover 变换保证几何对齐。normal 存在时画芯直接采用、跳过
 *   heightToNormal（叠加层法线仍按 Sobel 生成并覆盖其上）；height
 *   存在时灰度整体缩放至 ≤160 画芯域替换低通浮雕；rough 恒为
 *   relief 分区材质。缺省行为不变。
 *
 *   其中 paintFace / paintBack 返回的四张贴图均为 1329×2048 的
 *   HTMLCanvasElement（全部装饰代码在 664×1024 逻辑坐标系作画，
 *   makePack 以 CTM scale 物理 2× 输出，视觉不变、细节更精细），语义与参考站（html.non.io/tarot）的 WebGL2 PBR
 *   shader 严格对齐：
 *     - diffuse：反照率（整卡不透明，alpha 恒为 255）；
 *     - height ：浮雕高度图，白 = 凸起（边框脊线 / 徽记 / 名牌 / 烫金文字），
 *                黑 = 凹陷底纹；shader 用它做逐像素高度视差；
 *     - rough  ：粗糙度图，【暗 = 光滑高光强，亮 = 哑光】——金箔 / 宝石区域
 *                接近 0（黑），哑光墨底接近 1（白）。注意 shader 约定
 *                rough 值低 = 高光强，与直觉相反，切勿画反；
 *     - normal ：由 height 经 Sobel 梯度推导的切线空间法线图
 *                （RGB = n * 0.5 + 0.5，绿通道按 GL y-up 约定翻转）。
 *
 * 【防御性说明】
 *   - 读不到 window.WOW_CLASS_INFO / window.WOW_RARITY_INFO 时，自动回退到
 *     本文件内置的同名常量表（第「一」节），保证单独引入本文件也能出图；
 *   - hero 字段缺失时逐项降级（未知英雄 / 默认稀有度 / 默认徽记……），
 *     仅当 hero 本身不是对象时才抛出带中文说明的 Error；
 *   - paintFace 结果按 hero.id 做 LRU 缓存（上限 8 套，防止 24 张全量
 *     驻留内存）；paintBack 全站只画一次。
 *
 * 【性能预算】
 *   单张 paintFace ≈ 60–150ms（含 1329×2048 全分辨率 Sobel），命中缓存 ≈ 0ms。
 *
 * 【版本 · 卡面工艺师】
 *   - 肖像接入：preloadPortraits() 按 assets/portraits/<id>.webp → .png
 *     顺序探测并预载英雄肖像；有肖像的英雄卡面中央改为「圆拱肖像窗」，
 *     肖像 cover 裁入、窗后衬职业色氛围渐变、底部暗角渐隐融入卡底；
 *     无肖像时保持 sigil 徽记方案完整可用（降级链不断）。预载全部 settle
 *     后自动清空 paintFace LRU——早先按无图降级渲染的缓存作废，下次
 *     paintFace 即按最新肖像状态重绘。
 *   - 工艺升级（有无肖像均生效）：极细扭索纹（guilloché）底纹刻线；
 *     外框金色斜角高光（bevel）+ 内框暗部压边；稀有度宝石改为弧面
 *     （cabochon）高光；四角落叶卷草加密一层；名牌底加织物质感；整体
 *     统一暗角 vignette；legendary 边框额外加连珠繁缛金饰。
 *     height：肖像窗内低平（哑光画芯），窗沿 / 边框 / 名牌保持浮雕；
 *     rough：肖像区哑光（196–212），金箔 / 宝石保持低粗糙。
 *   - 【试验 · 方案A】paintFaceFull(hero, artImage)：全幅场景卡面。插画
 *     cover 铺满整卡（源图底部裁 ≥7% 去水印），无拱窗遮罩；装饰管线以
 *     半透明底「铭牌压在画上」（translucent 参数默认关，零影响现有路径）；
 *     height / rough 从插画像素派生（金色 / 亮金属 → 凸起低粗糙，其余
 *     亮度浅浮雕 + 哑光 190–220），叠加层照旧精确写入，Sobel 出 normal。
 *   - 【数据驱动接入】英雄数据声明 fullArt 字段（插画路径）后，
 *     preloadPortraits 一并预载；renderFace / paintMini 检测就绪即改走
 *     paintFaceFull（relief），paintFace 的 LRU 缓存照常生效；加载失败
 *     或未声明的英雄保持常规肖像窗 / sigil 路径零影响。
 *     可选伴生 fullArtHeight（AI 灰度高度图路径）：就绪时按融合模式
 *     增强画芯立体感（relief 宏观 ×0.6 + AI 层次 ×0.4 + AI 细节 ×0.5）。
 *   - 【v5.1 烫金刻线层】relief 模式默认叠加：大尺度 DoG（σ≈1.4/4.5）
 *     滞回提取主轮廓（宁少勿碎）+ 月亮金环 / 塔罗内框双线程序装饰，
 *     Chamfer 距离场扩散成平滑金脊，diffuse 錾刻金 / height 分级脊峰
 *     （max 叠加）/ rough 金属低粗糙同步写入；opts.goldLines===false
 *     可关。颗粒噪声照旧不进 height；normal 由最终 height Sobel 派生。
 * ============================================================================ */
(function (global) {
  'use strict';

  /* --------------------------------------------------------------------------
   * 一、常量与契约回退表
   * ------------------------------------------------------------------------ */

  /* 【4K 分辨率升级】物理贴图 1329×2048（对齐参考站塔罗牌物理分辨率，
   * = 逻辑坐标 2×）。全部装饰 / 布局代码继续在 664×1024 逻辑坐标系
   * 作画，makePack 为每个 ctx 挂上 scale(SCX, SCY)，字号 / 线宽 / 辉光 /
   * 图案纹理随之物理 2×，视觉效果不变、细节更精细。逐像素派生
   * （getImageData / createImageData）绕过 CTM，直接工作于物理像素，
   * 其空间参数（模糊半径 / 法线强度）需按 SC 显式缩放。 */
  var LW = 664, LH = 1024;  // 逻辑布局坐标系
  var W = 1329;   // 卡面宽（物理 px）——与契约一致
  var H = 2048;   // 卡面高（物理 px）——与契约一致
  var SCX = W / LW, SCY = H / LH;
  var SC = (SCX + SCY) / 2;                       // ≈2.0：标量空间参数缩放系数

  /* 字体族约定（页面已通过 Google Fonts 加载，离屏 canvas 同样可用）：
   *   标题：'Cinzel', 'Noto Serif SC', serif
   *   正文：'Noto Serif SC', serif
   *   标签：'Jost', 'Noto Sans SC', sans-serif */
  var FONT_TITLE = "'Cinzel', 'Noto Serif SC', serif";
  var FONT_BODY  = "'Noto Serif SC', serif";
  var FONT_BRUSH = "'Ma Shan Zheng', 'Noto Serif SC', serif";  // 题款/匾额毛笔体（本地子集 woff2）
  var FONT_SEAL  = "'Ma Shan Zheng', serif";  // 小工具仅打包受支持的本地 woff2 字体
  var FONT_LABEL = "'Jost', 'Noto Sans SC', sans-serif";

  /* 内置职业常量表：与 js/heroes-data.js 的 window.WOW_CLASS_INFO 同名同构。
   * 当全局数据缺失时按【键】逐项回退到这里，保证本文件可独立运行。 */
  var FALLBACK_CLASS_INFO = {
    warrior:     { zh: '战士',     en: 'Warrior',      color: '#C79C6E' },
    paladin:     { zh: '圣骑士',   en: 'Paladin',      color: '#F58CBA' },
    mage:        { zh: '法师',     en: 'Mage',         color: '#69CCF0' },
    priest:      { zh: '牧师',     en: 'Priest',       color: '#F5F0E6' },
    druid:       { zh: '德鲁伊',   en: 'Druid',        color: '#FF7D0A' },
    shaman:      { zh: '萨满',     en: 'Shaman',       color: '#0070DE' },
    hunter:      { zh: '猎人',     en: 'Hunter',       color: '#ABD473' },
    rogue:       { zh: '潜行者',   en: 'Rogue',        color: '#FFF569' },
    warlock:     { zh: '术士',     en: 'Warlock',      color: '#9482C9' },
    deathknight: { zh: '死亡骑士', en: 'Death Knight', color: '#C41F3B' },
    demonhunter: { zh: '恶魔猎手', en: 'Demon Hunter', color: '#A330C9' }
  };

  /* 内置稀有度常量表：魔兽官方物品品质配色（传说橙 / 史诗紫 / 稀有蓝）。 */
  var FALLBACK_RARITY_INFO = {
    legendary: { zh: '传说', color: '#FF8000' },
    epic:      { zh: '史诗', color: '#A335EE' },
    rare:      { zh: '稀有', color: '#0070DD' }
  };

  /* 阵营配色：联盟蓝 / 部落红 / 中立金（共享视觉基调约定）。 */
  var FACTION_INFO = {
    alliance: { zh: '联盟', color: '#4A8FDD' },
    horde:    { zh: '部落', color: '#C41F3B' },
    neutral:  { zh: '中立', color: '#C8A55A' }
  };

  /* 奥术蓝 accent（共享视觉基调约定），用于卡面顶部的微弱辉光。 */
  var ARCANE_BLUE = '#69CCF0';

  /* 法线图强度：值越大浮雕感越强。Sobel 梯度峰值约 ±1020（4×255），
   * 2.6 时边框脊线法线倾角约 80°，烫金细线约 30–50°，底纹近乎水平。
   * 物理分辨率 2× 后同一棱的逐像素梯度减半，强度随 SC 同步缩放保持手感。 */
  var NORMAL_STRENGTH = 2.6 * SC;

  /* paintFace LRU 缓存上限：每套四张 1329×2048 画布约 43.5MB，
   * 4 套约 174MB；分辨率 2× 后全量驻留成本过高，上限相应减半。 */
  var FACE_CACHE_MAX = 4;

  /* --------------------------------------------------------------------------
   * 二、基础工具
   * ------------------------------------------------------------------------ */

  /** 新建一块指定尺寸的离屏画布。 */
  function mkCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /** 数值截断到 [lo, hi]。 */
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /** 字符串 → 32 位哈希（用作确定性伪随机种子，让同一英雄的噪点偏移稳定）。 */
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** mulberry32 伪随机数发生器：小巧、确定、分布均匀。 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** '#RRGGBB' → {r,g,b}；非法输入回退为金色，绝不让绘制崩溃。 */
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return { r: 216, g: 178, b: 106 };
    var v = parseInt(m[1], 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }

  /** '#RRGGBB' + alpha → 'rgba(r,g,b,a)'。 */
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /** 两个 '#RRGGBB' 按 t∈[0,1] 线性混合，返回 '#RRGGBB'。 */
  function mixHex(h1, h2, t) {
    var a = hexToRgb(h1), b = hexToRgb(h2);
    var r = Math.round(a.r + (b.r - a.r) * t);
    var g = Math.round(a.g + (b.g - a.g) * t);
    var bl = Math.round(a.b + (b.b - a.b) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  /** 0–255 灰度 → canvas 颜色串。 */
  function gray(v) { v = clamp(Math.round(v), 0, 255); return 'rgb(' + v + ',' + v + ',' + v + ')'; }

  /**
   * 烧金渐变：纵向贯穿整卡的金箔色带（上暗 → 中亮 → 下暗），
   * 所有描金元素共用同一支渐变，保证「同一盏灯下的金箔」观感一致。
   */
  function goldGradient(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, LH);         // 逻辑坐标系纵向贯穿整卡
    g.addColorStop(0.00, '#7A5C22');
    g.addColorStop(0.28, '#D9B968');
    g.addColorStop(0.50, '#F4E2A4');
    g.addColorStop(0.72, '#CAA653');
    g.addColorStop(1.00, '#7A5C22');
    return g;
  }

  /** 暗淡金线（次要装饰用）。 */
  var GOLD_DIM = 'rgba(212,178,106,0.55)';

  /**
   * 手动字距排版的 fillText：canvas 的 letterSpacing 属性尚未全平台普及，
   * 这里逐字测量、逐字绘制，整体仍以 (cx, y) 为中心。
   */
  function fillSpacedText(ctx, text, cx, y, spacing) {
    var chars = Array.from(String(text));
    if (!chars.length) return;
    var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * (chars.length - 1);
    var prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    var x = cx - total / 2;
    for (var i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, y);
      x += widths[i] + spacing;
    }
    ctx.textAlign = prevAlign;
  }

  /** 圆角矩形路径（兼容不支持 ctx.roundRect 的环境）。 */
  function pathRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** 菱形（宝石）路径，带一道横向切面线。 */
  function pathGem(ctx, cx, cy, r) {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.72, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.72, cy);
    ctx.closePath();
    ctx.moveTo(cx - r * 0.72, cy);
    ctx.lineTo(cx + r * 0.72, cy);
  }

  /** 四角星路径（圣光 / 星芒装饰）。 */
  function pathStar4(ctx, cx, cy, rLong, rShort) {
    ctx.moveTo(cx, cy - rLong);
    ctx.lineTo(cx + rShort, cy - rShort);
    ctx.lineTo(cx + rLong, cy);
    ctx.lineTo(cx + rShort, cy + rShort);
    ctx.lineTo(cx, cy + rLong);
    ctx.lineTo(cx - rShort, cy + rShort);
    ctx.lineTo(cx - rLong, cy);
    ctx.lineTo(cx - rShort, cy - rShort);
    ctx.closePath();
  }

  /**
   * 肖像窗几何常量与路径：圆拱（Roman arch）——顶部半圆 + 直边 + 平底。
   * 窗体 x76–588（宽 512），拱顶 y250，拱肩 y506（半圆半径 256），窗底 y688，
   * 窗高 438，占卡面上部区域（0–716，稀有度绶带上缘）约 61%。
   * 与 paintPortraitZone 严格共用，paintMini 复用同一坐标系（其 ctx 已缩放）。
   */
  var PORTRAIT_WIN = { x: 76, yTop: 250, ySpring: 506, yBottom: 688, w: 512, cx: 332, r: 256 };

  function pathPortraitArch(ctx) {
    var V = PORTRAIT_WIN;
    ctx.moveTo(V.x, V.yBottom);
    ctx.lineTo(V.x, V.ySpring);
    ctx.arc(V.cx, V.ySpring, V.r, Math.PI, 0, false);
    ctx.lineTo(V.x + V.w, V.yBottom);
    ctx.closePath();
  }

  /* --------------------------------------------------------------------------
   * 三、噪点纹理（全模块共享一块 192×192 瓦片，各层按随机偏移平铺）
   * ------------------------------------------------------------------------ */

  var _noiseTile = null;

  /**
   * 生成细腻噪点瓦片：约 2400 个亮粒 + 700 个暗粒 + 6 条扫描细线。
   * 只生成一次并缓存；使用时通过平移图案避免平铺感。
   */
  function noiseTile() {
    if (_noiseTile) return _noiseTile;
    var c = mkCanvas(192, 192);
    var x = c.getContext('2d');
    var rnd = mulberry32(0xC0FFEE);
    var i, v, y;
    for (i = 0; i < 2400; i++) {                       // 亮粒：纸面纤维感
      v = 200 + (rnd() * 55) | 0;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.10 + rnd() * 0.35).toFixed(3) + ')';
      x.fillRect((rnd() * 192) | 0, (rnd() * 192) | 0, 1, 1);
    }
    for (i = 0; i < 700; i++) {                        // 暗粒：墨底深浅变化
      v = 30 + (rnd() * 60) | 0;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.08 + rnd() * 0.25).toFixed(3) + ')';
      x.fillRect((rnd() * 192) | 0, (rnd() * 192) | 0, 1, 1);
    }
    for (i = 0; i < 6; i++) {                          // 扫描细线：版刻肌理
      y = (rnd() * 192) | 0;
      x.fillStyle = 'rgba(255,255,255,' + (0.03 + rnd() * 0.04).toFixed(3) + ')';
      x.fillRect(0, y, 192, 1);
    }
    _noiseTile = c;
    return c;
  }

  /**
   * 把噪点瓦片平铺到 diffuse / height / rough 三层。
   * seed 决定平移偏移，同一英雄每次绘制的颗粒位置一致。
   */
  function applyNoise(P, seed, alphaScale, mask) {
    var k = (alphaScale == null ? 1 : alphaScale);
    var tile = noiseTile();
    var rnd = mulberry32(seed ^ 0x9E3779B9);
    var ox = (rnd() * 192) | 0;
    var oy = (rnd() * 192) | 0;
    var layers = [
      { ctx: P.d, alpha: 0.55 * k },   // diffuse：颗粒主要落在这里
      { ctx: P.h, alpha: 0.50 * k },   // height：微浮雕，让法线有细密起伏
      { ctx: P.r, alpha: 0.22 * k }    // rough：轻微粗糙度扰动
    ];
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      if (!L.ctx) continue;
      /* relief 宏观浮雕要求 height / rough 严格平滑（碎闪治理），
         可通过 mask { h:false, r:false } 只保留 diffuse 印刷颗粒 */
      if (mask && ((i === 0 && mask.d === false) ||
                   (i === 1 && mask.h === false) ||
                   (i === 2 && mask.r === false))) continue;
      L.ctx.save();
      L.ctx.globalAlpha = L.alpha;
      L.ctx.translate(-ox, -oy);
      L.ctx.fillStyle = L.ctx.createPattern(tile, 'repeat');
      L.ctx.fillRect(ox, oy, LW, LH);
      L.ctx.restore();
    }
  }

  /** 织物质感瓦片（6×6：经纬双向细线），用于名牌匾额底衬。 */
  var _fabricTile = null;
  function fabricTile() {
    if (_fabricTile) return _fabricTile;
    var c = mkCanvas(6, 6);
    var x = c.getContext('2d');
    x.fillStyle = 'rgba(255,240,200,0.05)';              // 经线（亮）
    x.fillRect(0, 0, 1, 6);
    x.fillRect(3, 0, 1, 6);
    x.fillStyle = 'rgba(0,0,0,0.06)';                    // 纬线（暗）
    x.fillRect(0, 1, 6, 1);
    x.fillRect(0, 4, 6, 1);
    _fabricTile = c;
    return c;
  }

  /**
   * 扭索纹（guilloché）瓦片：正弦刻线横竖交织的极细防伪底纹（288×288）。
   * 只生成一次；使用时按英雄种子平移平铺，位置稳定可复现。
   */
  var _guillocheTile = null;
  function guillocheTile() {
    if (_guillocheTile) return _guillocheTile;
    var S = 288;
    var c = mkCanvas(S, S);
    var x = c.getContext('2d');
    var i, j, y0, x0, y, xx;
    x.lineWidth = 1;
    for (i = 0; i < 12; i++) {                           // 横向波带
      y0 = i * 24 + 12;
      x.strokeStyle = 'rgba(222,192,124,' + (i % 2 ? 0.05 : 0.035) + ')';
      x.beginPath();
      for (j = 0; j <= 72; j++) {
        xx = j * (S / 72);
        y = y0 + Math.sin(xx * 0.10 + i * 1.7) * 5 + Math.sin(xx * 0.031 + i * 0.6) * 3;
        j ? x.lineTo(xx, y) : x.moveTo(xx, y);
      }
      x.stroke();
    }
    for (i = 0; i < 12; i++) {                           // 纵向波带（交织感）
      x0 = i * 24 + 12;
      x.strokeStyle = 'rgba(222,192,124,' + (i % 2 ? 0.035 : 0.05) + ')';
      x.beginPath();
      for (j = 0; j <= 72; j++) {
        y = j * (S / 72);
        xx = x0 + Math.sin(y * 0.10 + i * 2.3) * 5 + Math.sin(y * 0.031 + i * 0.5) * 3;
        j ? x.lineTo(xx, y) : x.moveTo(xx, y);
      }
      x.stroke();
    }
    _guillocheTile = c;
    return c;
  }

  /**
   * 把扭索纹平铺到 diffuse（alpha 0.5）与 rough（alpha 0.12，哑光扰动）。
   * height 不叠加：规则刻线进法线图会产生可察觉的定向条纹，
   * 刻线深度交给噪点微浮雕表达。
   */
  function applyGuilloche(P, seed) {
    var tile = guillocheTile();
    var rnd = mulberry32(seed ^ 0x51E15EED);
    var ox = (rnd() * 288) | 0;
    var oy = (rnd() * 288) | 0;
    var layers = [
      { ctx: P.d, alpha: 0.50 },
      { ctx: P.r, alpha: 0.12 }
    ];
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      if (!L.ctx) continue;
      L.ctx.save();
      L.ctx.globalAlpha = L.alpha;
      L.ctx.translate(-ox, -oy);
      L.ctx.fillStyle = L.ctx.createPattern(tile, 'repeat');
      L.ctx.fillRect(ox, oy, LW, LH);
      L.ctx.restore();
    }
  }

  /**
   * 整体统一暗角 vignette（卡面 / 卡背 / 缩略卡共用）：
   * diffuse 四周压暗收拢视线；height 边缘轻微下压，
   * 让边框 / 窗沿浮于「内凹展台」之上。在整卡绘制收尾时调用。
   */
  function paintVignette(P, strength) {
    var k = (strength == null ? 1 : strength);           // 全幅卡用 <1 的极轻暗角
    var g;
    if (P.d) {
      g = P.d.createRadialGradient(332, 470, 240, 332, 512, 760);
      g.addColorStop(0, 'rgba(3,5,10,0)');
      g.addColorStop(0.62, 'rgba(3,5,10,' + (0.10 * k).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(3,5,10,' + (0.42 * k).toFixed(3) + ')');
      P.d.fillStyle = g;
      P.d.fillRect(0, 0, LW, LH);
    }
    if (P.h) {
      g = P.h.createRadialGradient(332, 470, 260, 332, 512, 780);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,' + (0.35 * k).toFixed(3) + ')');
      P.h.fillStyle = g;
      P.h.fillRect(0, 0, LW, LH);
    }
  }

  /* --------------------------------------------------------------------------
   * 四、三层同步绘制助手
   * ----------------------------------------------------------------------------
   * 一次渲染持有三只 2D 上下文：P.d（diffuse 反照率）、P.h（height 高度）、
   * P.r（rough 粗糙度）。所有装饰件通过 strokeAll / fillAll / textAll
   * 同步落墨：同一几何，三种材质语义。paintMini 只传 P.d（h/r 为 null），
   * 三个助手遇到 null 层会自动跳过，迷你卡因此零成本复用全部装饰件。
   * ------------------------------------------------------------------------ */

  function makePack() {
    var cD = mkCanvas(W, H), cH = mkCanvas(W, H), cR = mkCanvas(W, H);
    var contextOptions = { willReadFrequently: true };
    var d = cD.getContext('2d', contextOptions);
    var h = cH.getContext('2d', contextOptions);
    var r = cR.getContext('2d', contextOptions);
    d.scale(SCX, SCY); h.scale(SCX, SCY); r.scale(SCX, SCY);   // 逻辑坐标作画，物理 2× 输出
    return { cD: cD, cH: cH, cR: cR, d: d, h: h, r: r };
  }

  /**
   * 同步描边。opts：
   *   path               构建路径的回调（接收 ctx，内部 beginPath + 路径命令）
   *   dStyle/dWidth      diffuse 描边样式与线宽（dStyle 为空则跳过 diffuse）
   *   dGlow/dGlowBlur    diffuse 辉光（shadowColor/shadowBlur）
   *   hVal/hWidth        height 灰度值与线宽（hVal 为 null 跳过）
   *   rVal/rWidth        rough 灰度值与线宽（rVal 为 null 跳过）
   *   hBlur              height 边缘柔化（让法线过渡圆润）
   */
  function strokeAll(P, opts) {
    var ctx;
    if (opts.dStyle && P.d) {
      ctx = P.d;
      ctx.save();
      if (opts.dGlow) { ctx.shadowColor = opts.dGlow; ctx.shadowBlur = opts.dGlowBlur || 0; }
      ctx.strokeStyle = opts.dStyle;
      ctx.lineWidth = opts.dWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      opts.path(ctx);
      ctx.stroke();
      ctx.restore();
    }
    if (opts.hVal != null && P.h) {
      ctx = P.h;
      ctx.save();
      if (opts.hBlur) { ctx.shadowColor = 'rgba(255,255,255,0.6)'; ctx.shadowBlur = opts.hBlur; }
      ctx.strokeStyle = gray(opts.hVal);
      ctx.lineWidth = opts.hWidth != null ? opts.hWidth : opts.dWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      opts.path(ctx);
      ctx.stroke();
      ctx.restore();
    }
    if (opts.rVal != null && P.r) {
      ctx = P.r;
      ctx.save();
      ctx.strokeStyle = gray(opts.rVal);
      ctx.lineWidth = opts.rWidth != null ? opts.rWidth : opts.dWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      opts.path(ctx);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 同步填充，语义同 strokeAll。 */
  function fillAll(P, opts) {
    var ctx;
    if (opts.dStyle && P.d) {
      ctx = P.d;
      ctx.save();
      if (opts.dGlow) { ctx.shadowColor = opts.dGlow; ctx.shadowBlur = opts.dGlowBlur || 0; }
      ctx.fillStyle = opts.dStyle;
      opts.path(ctx);
      ctx.fill();
      ctx.restore();
    }
    if (opts.hVal != null && P.h) {
      ctx = P.h;
      ctx.save();
      ctx.fillStyle = gray(opts.hVal);
      opts.path(ctx);
      ctx.fill();
      ctx.restore();
    }
    if (opts.rVal != null && P.r) {
      ctx = P.r;
      ctx.save();
      ctx.fillStyle = gray(opts.rVal);
      opts.path(ctx);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 同步文字。opts：{ font, x, y, align, spacing, dStyle, dGlow, dGlowBlur,
   * hVal, rVal }。spacing>0 时走手动字距排版（fillSpacedText）。
   */
  function textAll(P, str, opts) {
    if (!str) return;
    function draw(ctx, style, glow, blur) {
      ctx.save();
      ctx.font = opts.font;
      ctx.textAlign = opts.align || 'center';
      ctx.textBaseline = 'alphabetic';
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur || 0; }
      ctx.fillStyle = style;
      if (opts.spacing) fillSpacedText(ctx, str, opts.x, opts.y, opts.spacing);
      else ctx.fillText(str, opts.x, opts.y);
      ctx.restore();
    }
    if (opts.dStyle && P.d) draw(P.d, opts.dStyle, opts.dGlow, opts.dGlowBlur);
    if (opts.hVal != null && P.h) draw(P.h, gray(opts.hVal), 'rgba(255,255,255,0.5)', 3);
    if (opts.rVal != null && P.r) draw(P.r, gray(opts.rVal), null, 0);
  }

  /* --------------------------------------------------------------------------
   * 五、高度图 → 法线图（Sobel 梯度 → 切线空间 RGB 编码）
   * ----------------------------------------------------------------------------
   * 约定（与参考站 shader 对齐，其法线解码为 n = tex*2-1，且贴图上传时做
   * UNPACK_FLIP_Y_WEBGL，即 GL 中 v 轴向上）：
   *   nx = -∂h/∂x          （高度向右升高 ⇒ 表面法线向左倾）
   *   ny = +∂h/∂y_canvas   （canvas y 向下 = GL v 向下，故符号为正）
   *   nz = 1
   * 编码 RGB = normalize(n) * 0.5 + 0.5，alpha 恒 255。
   * ------------------------------------------------------------------------ */
  function heightToNormal(hCanvas, strength) {
    var w = hCanvas.width, h = hCanvas.height;
    var src = hCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    var out = mkCanvas(w, h);
    var octx = out.getContext('2d');
    var img = octx.createImageData(w, h);
    var d = img.data;
    var s = strength / 1020;               // Sobel 梯度峰值 4×255 归一
    for (var y = 0; y < h; y++) {
      var y0 = (y > 0 ? y - 1 : 0) * w;
      var y1 = y * w;
      var y2 = (y < h - 1 ? y + 1 : h - 1) * w;
      for (var x = 0; x < w; x++) {
        var x0 = x > 0 ? x - 1 : 0;
        var x2 = x < w - 1 ? x + 1 : w - 1;
        // 灰度图 RGB 三通道相同，只取 R
        var tl = src[(y0 + x0) * 4], t = src[(y0 + x) * 4], tr = src[(y0 + x2) * 4];
        var l = src[(y1 + x0) * 4], r = src[(y1 + x2) * 4];
        var bl = src[(y2 + x0) * 4], b = src[(y2 + x) * 4], br = src[(y2 + x2) * 4];
        var gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
        var gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
        var nx = -gx * s, ny = gy * s, nz = 1;
        var il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        var i = (y1 + x) * 4;
        d[i]     = (nx * il * 0.5 + 0.5) * 255;
        d[i + 1] = (ny * il * 0.5 + 0.5) * 255;
        d[i + 2] = (nz * il * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  /* --------------------------------------------------------------------------
   * 六、徽记 glyph 库（21 种 sigil 键，纯手工几何线稿）
   * ----------------------------------------------------------------------------
   * 约定：绘制前 ctx 已 translate 到徽记中心；r 为外接圆半径；lw 为基准线宽
   * （约 r×0.075，调用方按「辉光 pass 加宽、金线 pass 标准」缩放）。
   * 每个 painter 只负责路径与描边分组，颜色 / 辉光全部由调用方注入，
   * 因此同一份几何可在 diffuse（金 + 职业色辉光）、height（亮灰凸起）、
   * rough（深灰光滑）三层上复用。
   * 全部为描边线稿（线稿即气质）；实心点用「小圆填充 = 当前描边色」实现。
   * ------------------------------------------------------------------------ */

  /** 实心圆点（余烬 / 眼睛 / 符点等），颜色跟随当前 strokeStyle。 */
  function inkDot(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  var SIGILS = {

    /* 狮 · 联盟雄狮：锯齿鬃毛环 + 圆面 + 吻鼻 */
    lion: function (ctx, r, lw) {
      var i, a, rr;
      ctx.beginPath();                                   // 12 芒鬃毛
      for (i = 0; i < 24; i++) {
        a = -Math.PI / 2 + i * Math.PI / 12;
        rr = (i % 2 ? r * 0.62 : r * 0.95);
        var x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();                                   // 双目
      ctx.moveTo(-r * 0.22, -r * 0.06); ctx.lineTo(-r * 0.08, -r * 0.06);
      ctx.moveTo(r * 0.08, -r * 0.06); ctx.lineTo(r * 0.22, -r * 0.06);
      ctx.lineWidth = lw * 0.9; ctx.stroke();
      ctx.beginPath();                                   // 吻鼻
      ctx.moveTo(-r * 0.12, r * 0.14); ctx.lineTo(r * 0.12, r * 0.14);
      ctx.lineTo(0, r * 0.3); ctx.closePath();
      ctx.moveTo(0, r * 0.3); ctx.lineTo(0, r * 0.38);
      ctx.lineWidth = lw * 0.8; ctx.stroke();
    },

    /* 狼 · 霜狼：折线狼首（双耳 / 额心线 / 三角鼻） */
    wolf: function (ctx, r, lw) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.52, -r * 0.1);
      ctx.lineTo(-r * 0.72, -r * 0.78);                  // 左耳尖
      ctx.lineTo(-r * 0.28, -r * 0.5);
      ctx.lineTo(0, -r * 0.6);
      ctx.lineTo(r * 0.28, -r * 0.5);
      ctx.lineTo(r * 0.72, -r * 0.78);                   // 右耳尖
      ctx.lineTo(r * 0.52, -r * 0.1);
      ctx.lineTo(r * 0.34, r * 0.32);                    // 右颊 → 吻
      ctx.lineTo(0, r * 0.72);
      ctx.lineTo(-r * 0.34, r * 0.32);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 额心线 + 斜眼
      ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.05);
      ctx.moveTo(-r * 0.3, -r * 0.02); ctx.lineTo(-r * 0.12, r * 0.06);
      ctx.moveTo(r * 0.3, -r * 0.02); ctx.lineTo(r * 0.12, r * 0.06);
      ctx.lineWidth = lw * 0.8; ctx.stroke();
      ctx.beginPath();                                   // 鼻
      ctx.moveTo(-r * 0.1, r * 0.42); ctx.lineTo(r * 0.1, r * 0.42);
      ctx.lineTo(0, r * 0.6); ctx.closePath();
      ctx.stroke();
    },

    /* 霜 · 冰霜：六出雪花（两级分枝 + 中心六边形） */
    frost: function (ctx, r, lw) {
      var i, j, a;
      ctx.lineWidth = lw;
      for (i = 0; i < 6; i++) {
        a = i * Math.PI / 3;
        var dx = Math.cos(a), dy = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(dx * r * 0.9, dy * r * 0.9);
        for (j = 0; j < 2; j++) {                        // 两级侧枝
          var t = 0.42 + j * 0.26;
          var bx = dx * r * t, by = dy * r * t;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a + 0.6) * r * 0.2, by + Math.sin(a + 0.6) * r * 0.2);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a - 0.6) * r * 0.2, by + Math.sin(a - 0.6) * r * 0.2);
        }
        ctx.stroke();
      }
      ctx.beginPath();                                   // 中心六边形
      for (i = 0; i < 6; i++) {
        a = i * Math.PI / 3 + Math.PI / 6;
        var x = Math.cos(a) * r * 0.16, y = Math.sin(a) * r * 0.16;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.lineWidth = lw * 0.8; ctx.stroke();
    },

    /* 月 · 新月：双圆相切的月牙 + 一颗四角星 */
    moon: function (ctx, r, lw) {
      // 两圆交点：外圆 (0,0,R=0.8r)，内圆 (0.5r,0,R=0.62r)
      // 交角 ≈ ±0.888rad（外圆）/ ±1.562rad（内圆）
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0.888, -0.888, false);      // 外弧（绕左侧）
      ctx.arc(r * 0.5, 0, r * 0.62, -1.562, 1.562, false); // 内弧（向右鼓出）
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 伴星
      pathStar4(ctx, r * 0.62, -r * 0.42, r * 0.13, r * 0.04);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
    },

    /* 叶 · 羽叶：梭形叶身 + 主脉 + 三对侧脉 */
    leaf: function (ctx, r, lw) {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.quadraticCurveTo(r * 0.6, -r * 0.2, 0, r * 0.78);
      ctx.quadraticCurveTo(-r * 0.6, -r * 0.2, 0, -r * 0.85);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 叶柄
      ctx.moveTo(0, r * 0.78); ctx.lineTo(0, r * 0.98);
      ctx.lineWidth = lw * 0.8; ctx.stroke();
      ctx.beginPath();                                   // 主脉 + 侧脉
      ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, r * 0.66);
      for (var i = 0; i < 3; i++) {
        var t = -0.4 + i * 0.34;
        ctx.moveTo(0, r * t); ctx.lineTo(r * 0.28, r * (t - 0.16));
        ctx.moveTo(0, r * t); ctx.lineTo(-r * 0.28, r * (t - 0.16));
      }
      ctx.lineWidth = lw * 0.7; ctx.stroke();
    },

    /* 颅 · 天灾颅骨：颅穹 + 方颌 + 眼窝 + 鼻 + 齿线 */
    skull: function (ctx, r, lw) {
      ctx.beginPath();
      ctx.arc(0, -r * 0.12, r * 0.52, Math.PI * 0.78, Math.PI * 2.22, false);
      ctx.lineTo(r * 0.3, r * 0.5);
      ctx.lineTo(-r * 0.3, r * 0.5);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.08, r * 0.13, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.08, r * 0.13, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();                                   // 鼻
      ctx.moveTo(0, r * 0.1); ctx.lineTo(-r * 0.06, r * 0.22);
      ctx.lineTo(r * 0.06, r * 0.22); ctx.closePath();
      ctx.lineWidth = lw * 0.7; ctx.stroke();
      ctx.beginPath();                                   // 齿
      for (var i = -1; i <= 1; i++) {
        ctx.moveTo(i * r * 0.14, r * 0.34);
        ctx.lineTo(i * r * 0.14, r * 0.5);
      }
      ctx.lineWidth = lw * 0.6; ctx.stroke();
    },

    /* 邪能焰 · 恶魔之火：外焰 + 内焰 + 两粒余烬 */
    felflame: function (ctx, r, lw) {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.78);
      ctx.bezierCurveTo(-r * 0.62, r * 0.5, -r * 0.6, -r * 0.05, -r * 0.18, -r * 0.38);
      ctx.bezierCurveTo(-r * 0.3, -r * 0.62, -r * 0.05, -r * 0.7, 0, -r * 0.92);
      ctx.bezierCurveTo(r * 0.05, -r * 0.6, r * 0.55, -r * 0.5, r * 0.42, -r * 0.05);
      ctx.bezierCurveTo(r * 0.38, r * 0.35, r * 0.3, r * 0.6, 0, r * 0.78);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 内焰
      ctx.moveTo(0, r * 0.5);
      ctx.bezierCurveTo(-r * 0.28, r * 0.3, -r * 0.24, -r * 0.05, 0, -r * 0.3);
      ctx.bezierCurveTo(r * 0.24, -r * 0.05, r * 0.28, r * 0.3, 0, r * 0.5);
      ctx.closePath();
      ctx.lineWidth = lw * 0.7; ctx.stroke();
      inkDot(ctx, r * 0.5, -r * 0.55, lw * 1.2);         // 余烬
      inkDot(ctx, -r * 0.42, -r * 0.75, lw * 0.9);
    },

    /* 锤 · 毁灭之锤：梯形锤首 + 棱线 + 缠纹锤柄 + 柄首 */
    hammer: function (ctx, r, lw) {
      ctx.beginPath();                                   // 锤首
      ctx.moveTo(-r * 0.58, -r * 0.68); ctx.lineTo(r * 0.58, -r * 0.68);
      ctx.lineTo(r * 0.46, -r * 0.22); ctx.lineTo(-r * 0.46, -r * 0.22);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 锤首端棱 + 中部刻线
      ctx.moveTo(-r * 0.44, -r * 0.68); ctx.lineTo(-r * 0.36, -r * 0.22);
      ctx.moveTo(r * 0.44, -r * 0.68); ctx.lineTo(r * 0.36, -r * 0.22);
      ctx.moveTo(-r * 0.2, -r * 0.45); ctx.lineTo(r * 0.2, -r * 0.45);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.beginPath();                                   // 锤柄
      ctx.moveTo(0, -r * 0.22); ctx.lineTo(0, r * 0.72);
      ctx.lineWidth = lw * 1.3; ctx.stroke();
      ctx.beginPath();                                   // 缠绕纹 + 柄首圆珠
      ctx.moveTo(-r * 0.09, r * 0.3); ctx.lineTo(r * 0.09, r * 0.38);
      ctx.moveTo(-r * 0.09, r * 0.48); ctx.lineTo(r * 0.09, r * 0.56);
      ctx.arc(0, r * 0.82, r * 0.1, 0, Math.PI * 2);
      ctx.lineWidth = lw * 0.7; ctx.stroke();
    },

    /* 潮汐 · 浪潮：三重浪卷 + 浪沫 + 两道水流 */
    tide: function (ctx, r, lw) {
      ctx.beginPath();                                   // 主浪外弧
      ctx.arc(0, 0, r * 0.62, -Math.PI * 0.55, Math.PI * 0.85, false);
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 内卷
      ctx.arc(r * 0.12, -r * 0.1, r * 0.34, Math.PI * 0.2, Math.PI * 1.5, false);
      ctx.stroke();
      ctx.beginPath();                                   // 卷心
      ctx.arc(r * 0.16, -r * 0.14, r * 0.14, Math.PI * 0.4, Math.PI * 1.5, false);
      ctx.lineWidth = lw * 0.7; ctx.stroke();
      inkDot(ctx, r * 0.5, -r * 0.45, lw * 0.9);         // 浪沫
      inkDot(ctx, r * 0.68, -r * 0.2, lw * 0.7);
      inkDot(ctx, r * 0.34, -r * 0.62, lw * 0.6);
      ctx.beginPath();                                   // 底部水流
      ctx.moveTo(-r * 0.7, r * 0.45);
      ctx.quadraticCurveTo(-r * 0.35, r * 0.32, 0, r * 0.45);
      ctx.quadraticCurveTo(r * 0.35, r * 0.58, r * 0.7, r * 0.45);
      ctx.moveTo(-r * 0.5, r * 0.68);
      ctx.quadraticCurveTo(-r * 0.2, r * 0.58, r * 0.1, r * 0.68);
      ctx.quadraticCurveTo(r * 0.4, r * 0.78, r * 0.6, r * 0.66);
      ctx.lineWidth = lw * 0.7; ctx.stroke();
    },

    /* 眼 · 肯瑞托之眼：杏仁眼睑 + 虹膜瞳孔 + 上睫 + 坠泪 */
    eye: function (ctx, r, lw) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.82, 0);
      ctx.quadraticCurveTo(0, -r * 0.66, r * 0.82, 0);
      ctx.quadraticCurveTo(0, r * 0.66, -r * 0.82, 0);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.11, 0, Math.PI * 2);
      ctx.lineWidth = lw * 0.8; ctx.stroke();
      ctx.beginPath();                                   // 上睫（贴着睑缘起笔）
      ctx.moveTo(-r * 0.34, -r * 0.28); ctx.lineTo(-r * 0.44, -r * 0.46);
      ctx.moveTo(0, -r * 0.33); ctx.lineTo(0, -r * 0.55);
      ctx.moveTo(r * 0.34, -r * 0.28); ctx.lineTo(r * 0.44, -r * 0.46);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.beginPath();                                   // 坠泪三线
      ctx.moveTo(0, r * 0.33); ctx.lineTo(0, r * 0.6);
      ctx.moveTo(-r * 0.34, r * 0.26); ctx.lineTo(-r * 0.4, r * 0.5);
      ctx.moveTo(r * 0.34, r * 0.26); ctx.lineTo(r * 0.4, r * 0.5);
      ctx.stroke();
    },

    /* 凤凰 · 火凰：上扬双翼 + 羽层 + 躯干 + 三条尾羽 */
    phoenix: function (ctx, r, lw) {
      ctx.beginPath();                                   // 双翼外缘
      ctx.moveTo(0, r * 0.15);
      ctx.quadraticCurveTo(-r * 0.45, -r * 0.15, -r * 0.88, -r * 0.62);
      ctx.moveTo(0, r * 0.15);
      ctx.quadraticCurveTo(r * 0.45, -r * 0.15, r * 0.88, -r * 0.62);
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 翼内羽层
      ctx.moveTo(-r * 0.1, r * 0.05);
      ctx.quadraticCurveTo(-r * 0.4, -r * 0.1, -r * 0.66, -r * 0.42);
      ctx.moveTo(r * 0.1, r * 0.05);
      ctx.quadraticCurveTo(r * 0.4, -r * 0.1, r * 0.66, -r * 0.42);
      ctx.moveTo(-r * 0.2, r * 0.18);
      ctx.quadraticCurveTo(-r * 0.42, r * 0.06, -r * 0.5, -r * 0.2);
      ctx.moveTo(r * 0.2, r * 0.18);
      ctx.quadraticCurveTo(r * 0.42, r * 0.06, r * 0.5, -r * 0.2);
      ctx.lineWidth = lw * 0.65; ctx.stroke();
      ctx.beginPath();                                   // 躯干 + 首
      ctx.moveTo(0, -r * 0.42); ctx.lineTo(0, r * 0.3);
      ctx.arc(0, -r * 0.52, r * 0.1, 0, Math.PI * 2);
      ctx.lineWidth = lw * 0.9; ctx.stroke();
      ctx.beginPath();                                   // 喙 + 冠羽
      ctx.moveTo(0, -r * 0.52); ctx.lineTo(r * 0.14, -r * 0.48);
      ctx.moveTo(0, -r * 0.6); ctx.lineTo(-r * 0.1, -r * 0.76);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.beginPath();                                   // 尾羽
      ctx.moveTo(0, r * 0.3);
      ctx.quadraticCurveTo(-r * 0.12, r * 0.6, -r * 0.3, r * 0.82);
      ctx.moveTo(0, r * 0.3); ctx.lineTo(0, r * 0.88);
      ctx.moveTo(0, r * 0.3);
      ctx.quadraticCurveTo(r * 0.12, r * 0.6, r * 0.3, r * 0.82);
      ctx.lineWidth = lw * 0.7; ctx.stroke();
    },

    /* 符文 · 符石：双层菱廓 + 如尼文 ᚠ（fehu） */
    rune: function (ctx, r, lw) {
      ctx.beginPath();                                   // 外廓
      ctx.moveTo(0, -r * 0.88); ctx.lineTo(r * 0.62, 0);
      ctx.lineTo(0, r * 0.88); ctx.lineTo(-r * 0.62, 0);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 内廓
      ctx.moveTo(0, -r * 0.68); ctx.lineTo(r * 0.46, 0);
      ctx.lineTo(0, r * 0.68); ctx.lineTo(-r * 0.46, 0);
      ctx.closePath();
      ctx.lineWidth = lw * 0.5; ctx.stroke();
      ctx.beginPath();                                   // 如尼文 ᚠ
      ctx.moveTo(-r * 0.08, -r * 0.5); ctx.lineTo(-r * 0.08, r * 0.5);
      ctx.moveTo(-r * 0.08, -r * 0.32); ctx.lineTo(r * 0.28, -r * 0.52);
      ctx.moveTo(-r * 0.08, -r * 0.02); ctx.lineTo(r * 0.28, -r * 0.22);
      ctx.lineWidth = lw * 1.1; ctx.stroke();
    },

    /* 弓 · 长弓：弓臂弧 + 弦 + 箭（箭头 + 箭羽） */
    bow: function (ctx, r, lw) {
      ctx.beginPath();                                   // 弓臂
      ctx.arc(-r * 0.15, 0, r * 0.78, -Math.PI * 0.42, Math.PI * 0.42, false);
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 弦
      ctx.moveTo(r * 0.044, -r * 0.755); ctx.lineTo(r * 0.044, r * 0.755);
      ctx.lineWidth = lw * 0.5; ctx.stroke();
      ctx.beginPath();                                   // 箭杆
      ctx.moveTo(-r * 0.72, 0); ctx.lineTo(r * 0.62, 0);
      ctx.lineWidth = lw * 0.8; ctx.stroke();
      ctx.beginPath();                                   // 箭头
      ctx.moveTo(r * 0.86, 0); ctx.lineTo(r * 0.58, -r * 0.12);
      ctx.lineTo(r * 0.58, r * 0.12); ctx.closePath();
      ctx.lineWidth = lw * 0.7; ctx.stroke();
      ctx.beginPath();                                   // 箭羽
      ctx.moveTo(-r * 0.72, 0); ctx.lineTo(-r * 0.5, -r * 0.14);
      ctx.moveTo(-r * 0.72, 0); ctx.lineTo(-r * 0.5, r * 0.14);
      ctx.stroke();
    },

    /* 影 · 虚空：三圈半螺线 + 两缕暗影 + 虚空之眼 */
    shadow: function (ctx, r, lw) {
      ctx.beginPath();                                   // 漩涡螺线
      for (var i = 0; i <= 90; i++) {
        var t = i / 90;
        var a = t * Math.PI * 3.5 - Math.PI * 0.5;
        var rr = r * (0.08 + 0.62 * t);
        var x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 两缕外溢暗影
      ctx.moveTo(-r * 0.7, -r * 0.2);
      ctx.quadraticCurveTo(-r * 0.4, -r * 0.42, -r * 0.18, -r * 0.3);
      ctx.moveTo(r * 0.25, r * 0.55);
      ctx.quadraticCurveTo(r * 0.5, r * 0.42, r * 0.68, r * 0.52);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
      inkDot(ctx, 0, 0, lw * 1.3);                       // 虚空之眼
    },

    /* 日 · 烈阳：双环日轮 + 十二道长短光芒 */
    sun: function (ctx, r, lw) {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.beginPath();
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6 - Math.PI / 2;
        var r0 = r * 0.5, r1 = (i % 2 ? r * 0.68 : r * 0.9);
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      }
      ctx.lineWidth = lw * 0.8; ctx.stroke();
    },

    /* 斧 · 双刃战斧：长柄 + 左右月牙刃 + 顶刺 + 刃口刻线 */
    axe: function (ctx, r, lw) {
      ctx.beginPath();                                   // 柄
      ctx.moveTo(0, -r * 0.85); ctx.lineTo(0, r * 0.85);
      ctx.lineWidth = lw * 1.2; ctx.stroke();
      ctx.beginPath();                                   // 双刃
      ctx.moveTo(0, -r * 0.52);
      ctx.quadraticCurveTo(-r * 0.85, -r * 0.18, 0, r * 0.34);
      ctx.moveTo(0, -r * 0.52);
      ctx.quadraticCurveTo(-r * 0.38, -r * 0.14, 0, r * 0.34);
      ctx.moveTo(0, -r * 0.52);
      ctx.quadraticCurveTo(r * 0.85, -r * 0.18, 0, r * 0.34);
      ctx.moveTo(0, -r * 0.52);
      ctx.quadraticCurveTo(r * 0.38, -r * 0.14, 0, r * 0.34);
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 顶刺 + 柄首
      ctx.moveTo(0, -r * 0.98); ctx.lineTo(-r * 0.08, -r * 0.8);
      ctx.lineTo(r * 0.08, -r * 0.8); ctx.closePath();
      ctx.moveTo(-r * 0.07, r * 0.85); ctx.lineTo(r * 0.07, r * 0.85);
      ctx.lineWidth = lw * 0.7; ctx.stroke();
      ctx.beginPath();                                   // 刃口刻线
      ctx.moveTo(-r * 0.5, -r * 0.28);
      ctx.quadraticCurveTo(-r * 0.62, -r * 0.08, -r * 0.5, r * 0.12);
      ctx.moveTo(r * 0.5, -r * 0.28);
      ctx.quadraticCurveTo(r * 0.62, -r * 0.08, r * 0.5, r * 0.12);
      ctx.lineWidth = lw * 0.5; ctx.stroke();
    },

    /* 光 · 圣光：四芒星 + 对角短芒 + 光环核心 */
    light: function (ctx, r, lw) {
      ctx.beginPath();                                   // 四芒星
      pathStar4(ctx, 0, 0, r * 0.9, r * 0.14);
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 对角短芒
      for (var i = 0; i < 4; i++) {
        var a = Math.PI / 4 + i * Math.PI / 2;
        ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        ctx.lineTo(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52);
      }
      ctx.lineWidth = lw * 0.7; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.lineWidth = lw * 0.7; ctx.stroke();
      inkDot(ctx, 0, 0, lw * 1.1);                       // 圣光核心
    },

    /* 蛇 · 毒蛇：S 形蛇身 + 三角蛇首 + 信子 + 腹鳞 */
    serpent: function (ctx, r, lw) {
      ctx.beginPath();                                   // 蛇身
      ctx.moveTo(-r * 0.55, r * 0.62);
      ctx.bezierCurveTo(-r * 0.85, r * 0.2, r * 0.55, r * 0.5, r * 0.55, r * 0.05);
      ctx.bezierCurveTo(r * 0.55, -r * 0.4, -r * 0.5, -r * 0.2, -r * 0.28, -r * 0.5);
      ctx.lineWidth = lw * 1.1; ctx.stroke();
      ctx.beginPath();                                   // 蛇首
      ctx.moveTo(-r * 0.42, -r * 0.66); ctx.lineTo(-r * 0.12, -r * 0.6);
      ctx.lineTo(-r * 0.28, -r * 0.4); ctx.closePath();
      ctx.lineWidth = lw * 0.8; ctx.stroke();
      ctx.beginPath();                                   // 信子
      ctx.moveTo(-r * 0.38, -r * 0.64); ctx.lineTo(-r * 0.56, -r * 0.78);
      ctx.moveTo(-r * 0.56, -r * 0.78); ctx.lineTo(-r * 0.66, -r * 0.74);
      ctx.moveTo(-r * 0.56, -r * 0.78); ctx.lineTo(-r * 0.58, -r * 0.88);
      ctx.lineWidth = lw * 0.5; ctx.stroke();
      ctx.beginPath();                                   // 腹鳞刻线
      ctx.moveTo(r * 0.35, r * 0.32); ctx.lineTo(r * 0.48, r * 0.22);
      ctx.moveTo(r * 0.08, r * 0.42); ctx.lineTo(r * 0.18, r * 0.3);
      ctx.moveTo(-r * 0.4, r * 0.42); ctx.lineTo(-r * 0.28, r * 0.34);
      ctx.lineWidth = lw * 0.5; ctx.stroke();
    },

    /* 风暴 · 雷云：三段云丘 + 锯齿闪电 + 雨丝 */
    storm: function (ctx, r, lw) {
      ctx.beginPath();                                   // 云丘
      ctx.moveTo(-r * 0.78, r * 0.02);
      ctx.quadraticCurveTo(-r * 0.72, -r * 0.42, -r * 0.38, -r * 0.34);
      ctx.quadraticCurveTo(-r * 0.2, -r * 0.72, r * 0.12, -r * 0.5);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.6, r * 0.6, -r * 0.2);
      ctx.quadraticCurveTo(r * 0.78, -r * 0.05, r * 0.66, r * 0.02);
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 闪电
      ctx.moveTo(r * 0.08, r * 0.08);
      ctx.lineTo(-r * 0.18, r * 0.42);
      ctx.lineTo(r * 0.02, r * 0.42);
      ctx.lineTo(-r * 0.22, r * 0.82);
      ctx.lineTo(r * 0.3, r * 0.3);
      ctx.lineTo(r * 0.08, r * 0.3);
      ctx.closePath();
      ctx.lineWidth = lw * 0.9; ctx.stroke();
      ctx.beginPath();                                   // 雨丝
      ctx.moveTo(-r * 0.5, r * 0.2); ctx.lineTo(-r * 0.58, r * 0.38);
      ctx.moveTo(-r * 0.68, r * 0.12); ctx.lineTo(-r * 0.76, r * 0.3);
      ctx.lineWidth = lw * 0.5; ctx.stroke();
    },

    /* 书 · 奥术典籍：摊开的双页 + 书脊 + 字行 + 书签 */
    book: function (ctx, r, lw) {
      ctx.beginPath();                                   // 双页外廓
      ctx.moveTo(0, -r * 0.42);
      ctx.quadraticCurveTo(-r * 0.4, -r * 0.58, -r * 0.72, -r * 0.42);
      ctx.lineTo(-r * 0.72, r * 0.4);
      ctx.quadraticCurveTo(-r * 0.4, r * 0.26, 0, r * 0.42);
      ctx.quadraticCurveTo(r * 0.4, r * 0.26, r * 0.72, r * 0.4);
      ctx.lineTo(r * 0.72, -r * 0.42);
      ctx.quadraticCurveTo(r * 0.4, -r * 0.58, 0, -r * 0.42);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 书脊
      ctx.moveTo(0, -r * 0.42); ctx.lineTo(0, r * 0.42);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.beginPath();                                   // 页上字行
      for (var s = -1; s <= 1; s += 2) {
        for (var j = 0; j < 3; j++) {
          var y = -0.18 + j * 0.2;
          ctx.moveTo(s * r * 0.14, r * y);
          ctx.lineTo(s * r * 0.56, r * (y - 0.04));
        }
      }
      ctx.lineWidth = lw * 0.45; ctx.stroke();
      ctx.beginPath();                                   // 顶部书签小菱
      pathGem(ctx, 0, -r * 0.66, r * 0.09);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
    },

    /* 图腾 · 先祖图腾：顶羽 + 菱形首节 + 锯齿中节 + 梯形基座 */
    totem: function (ctx, r, lw) {
      ctx.beginPath();                                   // 顶羽三支
      ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, -r * 0.88);
      ctx.moveTo(-r * 0.12, -r * 0.58); ctx.lineTo(-r * 0.3, -r * 0.8);
      ctx.moveTo(r * 0.12, -r * 0.58); ctx.lineTo(r * 0.3, -r * 0.8);
      ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.beginPath();                                   // 菱形首节
      ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.3, -r * 0.32);
      ctx.lineTo(0, -r * 0.04); ctx.lineTo(-r * 0.3, -r * 0.32);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      inkDot(ctx, 0, -r * 0.32, lw * 1.1);               // 首节之眼
      ctx.beginPath();                                   // 中节矩形
      ctx.moveTo(-r * 0.36, r * 0.04); ctx.lineTo(r * 0.36, r * 0.04);
      ctx.lineTo(r * 0.36, r * 0.36); ctx.lineTo(-r * 0.36, r * 0.36);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();                                   // 中节锯齿纹
      ctx.moveTo(-r * 0.36, r * 0.2); ctx.lineTo(-r * 0.18, r * 0.08);
      ctx.lineTo(0, r * 0.2); ctx.lineTo(r * 0.18, r * 0.08);
      ctx.lineTo(r * 0.36, r * 0.2);
      ctx.lineWidth = lw * 0.55; ctx.stroke();
      ctx.beginPath();                                   // 梯形基座
      ctx.moveTo(-r * 0.26, r * 0.36); ctx.lineTo(r * 0.26, r * 0.36);
      ctx.lineTo(r * 0.4, r * 0.72); ctx.lineTo(-r * 0.4, r * 0.72);
      ctx.closePath();
      ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath();                                   // 基座刻线 + 地线
      ctx.moveTo(0, r * 0.44); ctx.lineTo(0, r * 0.64);
      ctx.moveTo(-r * 0.55, r * 0.86); ctx.lineTo(r * 0.55, r * 0.86);
      ctx.lineWidth = lw * 0.55; ctx.stroke();
    }
  };

  /* --------------------------------------------------------------------------
   * 七、数据解析与防御性回退
   * ------------------------------------------------------------------------ */

  /** 取职业信息：优先 window.WOW_CLASS_INFO，缺失时按键回退内置表。 */
  function classInfoOf(key) {
    var g = global.WOW_CLASS_INFO;
    var gi = (g && typeof g === 'object') ? g[key] : null;
    var fb = FALLBACK_CLASS_INFO[key] || FALLBACK_CLASS_INFO.mage;
    if (gi && gi.color) {
      return { zh: gi.zh || fb.zh, en: gi.en || fb.en, color: gi.color };
    }
    return fb;
  }

  /** 取稀有度信息：优先 window.WOW_RARITY_INFO，缺失时回退内置表。 */
  function rarityInfoOf(key) {
    var g = global.WOW_RARITY_INFO;
    var gi = (g && typeof g === 'object') ? g[key] : null;
    var fb = FALLBACK_RARITY_INFO[key] || FALLBACK_RARITY_INFO.rare;
    if (gi && gi.color) {
      return { zh: gi.zh || fb.zh, color: gi.color };
    }
    return fb;
  }

  /**
   * 规范化 hero：字段缺失逐项降级，非法枚举回退默认值。
   * 契约字段见 js/heroes-data.js 文件头。
   */
  function normalizeHero(h) {
    function num(v) {
      var n = Number(v);
      return isFinite(n) ? clamp(Math.round(n), 0, 99) : 5;
    }
    var st = h.stats || {};
    return {
      nameZh:  (h.name && h.name.zh)   || '未知英雄',
      nameEn:  String((h.name && h.name.en) || 'UNKNOWN').toUpperCase(),
      titleZh: (h.title && h.title.zh) || '',
      raceZh:  (h.race && h.race.zh)   || '未知种族',
      classKey: FALLBACK_CLASS_INFO[h.class]  ? h.class   : 'mage',
      rarity:   FALLBACK_RARITY_INFO[h.rarity] ? h.rarity : 'rare',
      faction:  FACTION_INFO[h.faction] ? h.faction : 'neutral',
      sigil:    SIGILS[h.sigil]         ? h.sigil   : 'rune',
      theme:    h.theme === 'guofeng' ? 'guofeng' : '',      // 国风装饰层开关
      quote:    typeof h.quote === 'string' ? h.quote : '',  // 题款文案（竖排，题画诗传统）
      quotePos: h.quotePos === 'tl' ? 'tl' : 'tr',           // 题款列位置：右上（默认）/左上
      dynasty:  typeof h.dynasty === 'string' ? h.dynasty : '',   // 朝代印（左下）
      category: typeof h.category === 'string' ? h.category : '', // 类别印（右下）
      sealZh:   typeof h.seal === 'string' ? h.seal : '',         // 称号镂空朱文印印文（繁体小篆，题款列末）
      stats: {
        might:   num(st.might),
        magic:   num(st.magic),
        resolve: num(st.resolve)
      }
    };
  }

  /* --------------------------------------------------------------------------
   * 八、装饰件（每件同步落墨 diffuse / height / rough 三层）
   * ------------------------------------------------------------------------ */

  /**
   * 徽记四遍渲染：职业色辉光底衬 → 烧金线稿 → 高度凸起 → 金箔低粗糙。
   * paintMini 场景下 P.h / P.r 为 null，对应遍自动跳过。
   */
  function drawGlyph(P, key, cx, cy, r, classColor) {
    var paint = SIGILS[key] || SIGILS.rune;
    var lwBase = r * 0.075;
    function pass(ctx, style, widthScale, glow, blur) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = style;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur; }
      paint(ctx, r, lwBase * widthScale);
      ctx.restore();
    }
    pass(P.d, rgba(classColor, 0.30), 1.9, rgba(classColor, 0.85), r * 0.45); // 职业色辉光
    pass(P.d, P.gold, 1.0, 'rgba(240,214,140,0.55)', r * 0.12);               // 烧金线稿
    pass(P.h, gray(232), 1.0, 'rgba(255,255,255,0.55)', r * 0.05);            // 高度：凸起
    pass(P.r, gray(26), 1.0, null, 0);                                        // 粗糙度：金箔光滑
  }

  /**
   * 卡面底：暗夜蓝黑径向渐变 + 奥术蓝顶部微光 + 职业色氛围光 +
   * 极淡奥术刻环底纹 + 暗角；height 为低浮雕基底（徽记后方带柔和穹顶）；
   * rough 为哑光墨底（中央略低于边缘，如常被指腹摩挲）。
   */
  function paintBackground(P, glowColor) {
    var d = P.d, g;
    g = d.createRadialGradient(332, 430, 60, 332, 512, 780);
    g.addColorStop(0, '#1B2745');
    g.addColorStop(0.45, '#121A30');
    g.addColorStop(1, '#070B16');
    d.fillStyle = g;
    d.fillRect(0, 0, LW, LH);

    g = d.createLinearGradient(0, 0, 0, LH);             // 顶部奥术蓝微光
    g.addColorStop(0, rgba(ARCANE_BLUE, 0.06));
    g.addColorStop(0.35, rgba(ARCANE_BLUE, 0));
    d.fillStyle = g;
    d.fillRect(0, 0, LW, LH);

    var lc = hexToRgb(glowColor);                        // 亮色职业（牧师白等）压暗辉光
    var lum = (0.299 * lc.r + 0.587 * lc.g + 0.114 * lc.b) / 255;
    g = d.createRadialGradient(332, 452, 10, 332, 452, 300);
    g.addColorStop(0, rgba(glowColor, lum > 0.8 ? 0.12 : 0.20));
    g.addColorStop(1, rgba(glowColor, 0));
    d.fillStyle = g;
    d.fillRect(0, 0, LW, LH);

    d.save();                                            // 奥术刻环底纹（极淡）
    d.translate(332, 452);
    d.strokeStyle = 'rgba(216,182,110,0.06)';
    d.lineWidth = 1.2;
    [240, 262, 292].forEach(function (rr) {
      d.beginPath(); d.arc(0, 0, rr, 0, Math.PI * 2); d.stroke();
    });
    d.strokeStyle = 'rgba(216,182,110,0.05)';
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      d.beginPath();
      d.moveTo(Math.cos(a) * 246, Math.sin(a) * 246);
      d.lineTo(Math.cos(a) * 286, Math.sin(a) * 286);
      d.stroke();
    }
    d.restore();

    if (P.h) {                                           // height 基底
      g = P.h.createRadialGradient(332, 452, 40, 332, 512, 760);
      g.addColorStop(0, gray(46));
      g.addColorStop(1, gray(22));
      P.h.fillStyle = g;
      P.h.fillRect(0, 0, LW, LH);
      g = P.h.createRadialGradient(332, 452, 20, 332, 452, 300); // 中央柔和穹顶
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      P.h.fillStyle = g;
      P.h.fillRect(0, 0, LW, LH);
    }
    if (P.r) {                                           // rough 哑光墨底
      g = P.r.createRadialGradient(332, 512, 60, 332, 512, 780);
      g.addColorStop(0, gray(196));
      g.addColorStop(1, gray(216));
      P.r.fillStyle = g;
      P.r.fillRect(0, 0, LW, LH);
    }

    // 极细扭索纹刻线（须在 rough 基底之后，否则会被覆盖）；
    // 整体统一暗角 vignette 由 paintVignette 在整卡绘尾施加
    // （renderFace / paintBack / paintMini）。
    applyGuilloche(P, hashStr('guilloche|' + String(glowColor)));
  }

  /**
   * 符文刻环：双环 + 一圈楔形刻符 / 符点 + 四正向菱形。
   * 卡面徽记外圈与卡背罗盘共用。
   */
  function paintRuneRing(P, cx, cy, rIn, rOut) {
    strokeAll(P, {
      dStyle: P.gold, dWidth: 2,
      dGlow: 'rgba(240,214,140,0.35)', dGlowBlur: 6,
      hVal: 205, rVal: 40,
      path: function (ctx) {
        ctx.beginPath();
        ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
        ctx.moveTo(cx + rOut, cy);
        ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
      }
    });
    var rMid = (rIn + rOut) / 2;
    fillAll(P, {
      dStyle: 'rgba(216,182,110,0.85)',
      hVal: 210, rVal: 36,
      path: function (ctx) {
        ctx.beginPath();
        var n = 48, i, a;
        for (i = 0; i < n; i++) {
          a = i * Math.PI * 2 / n - Math.PI / 2;
          if (i % 4 === 0) {                             // 楔形刻符（梯形）
            var w = 0.032;
            ctx.moveTo(cx + Math.cos(a - w) * (rIn + 6),     cy + Math.sin(a - w) * (rIn + 6));
            ctx.lineTo(cx + Math.cos(a - w * 0.4) * (rOut - 6), cy + Math.sin(a - w * 0.4) * (rOut - 6));
            ctx.lineTo(cx + Math.cos(a + w * 0.4) * (rOut - 6), cy + Math.sin(a + w * 0.4) * (rOut - 6));
            ctx.lineTo(cx + Math.cos(a + w) * (rIn + 6),     cy + Math.sin(a + w) * (rIn + 6));
            ctx.closePath();
          } else {                                       // 符点
            ctx.moveTo(cx + Math.cos(a) * rMid + 2.4, cy + Math.sin(a) * rMid);
            ctx.arc(cx + Math.cos(a) * rMid, cy + Math.sin(a) * rMid, 2.4, 0, Math.PI * 2);
          }
        }
        for (i = 0; i < 4; i++) {                        // 四正向菱形符
          a = i * Math.PI / 2 - Math.PI / 2;
          pathGem(ctx, cx + Math.cos(a) * rMid, cy + Math.sin(a) * rMid, 6.5);
        }
      }
    });
  }

  /** 中央徽记区：符文刻环 + 两侧小菱饰 + 大型 sigil 徽记。 */
  function paintSigilZone(P, hero, classColor) {
    paintRuneRing(P, 332, 452, 168, 216);
    strokeAll(P, {                                       // 左右小菱 + 短射线
      dStyle: GOLD_DIM, dWidth: 1.5, hVal: 170, rVal: 50,
      path: function (ctx) {
        ctx.beginPath();
        pathGem(ctx, 86, 452, 8);
        pathGem(ctx, 578, 452, 8);
        ctx.moveTo(66, 452); ctx.lineTo(52, 452);
        ctx.moveTo(598, 452); ctx.lineTo(612, 452);
      }
    });
    drawGlyph(P, hero.sigil, 332, 452, 118, classColor);
  }

  /** 顶部弧形名牌：拱形匾额 + 英文名（小字宽字距）+ 中文名（金字粗体）。
      translucent=true（全幅卡面）时匾额底改半透明，让插画隐约透出。 */
  function paintNameplate(P, hero, translucent) {
    function pathPlaque(ctx) {
      ctx.beginPath();
      ctx.moveTo(128, 148);
      ctx.lineTo(128, 100);
      ctx.quadraticCurveTo(332, 24, 536, 100);
      ctx.lineTo(536, 148);
      ctx.closePath();
    }
    var g = P.d.createLinearGradient(0, 24, 0, 148);     // 匾额底
    if (translucent) {
      g.addColorStop(0, 'rgba(16,24,46,0.62)');
      g.addColorStop(1, 'rgba(8,13,26,0.74)');
    } else {
      g.addColorStop(0, '#141E38');
      g.addColorStop(1, '#0A1122');
    }
    fillAll(P, { dStyle: g, hVal: 150, rVal: 118, path: pathPlaque });
    if (P.d) {                                           // 织物质感（经纬细线，裁入匾额）
      P.d.save();
      P.d.beginPath();
      pathPlaque(P.d);
      P.d.clip();
      P.d.globalAlpha = 0.55;
      P.d.fillStyle = P.d.createPattern(fabricTile(), 'repeat');
      P.d.fillRect(120, 20, 424, 132);
      P.d.restore();
    }
    if (P.h) {                                           // 织物微浮雕
      P.h.save();
      P.h.beginPath();
      pathPlaque(P.h);
      P.h.clip();
      P.h.globalAlpha = 0.10;
      P.h.fillStyle = P.h.createPattern(fabricTile(), 'repeat');
      P.h.fillRect(120, 20, 424, 132);
      P.h.restore();
    }
    strokeAll(P, {                                       // 匾额金边
      dStyle: P.gold, dWidth: 2.5,
      dGlow: 'rgba(240,214,140,0.4)', dGlowBlur: 8,
      hVal: 225, rVal: 30, path: pathPlaque
    });
    strokeAll(P, {                                       // 匾额内侧细线
      dStyle: GOLD_DIM, dWidth: 1,
      path: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(136, 142);
        ctx.lineTo(136, 104);
        ctx.quadraticCurveTo(332, 34, 528, 104);
        ctx.lineTo(528, 142);
        ctx.closePath();
      }
    });
    strokeAll(P, {                                       // 左右小菱饰
      dStyle: P.gold, dWidth: 1.5, hVal: 200, rVal: 40,
      path: function (ctx) {
        ctx.beginPath();
        pathGem(ctx, 106, 116, 6);
        pathGem(ctx, 558, 116, 6);
      }
    });
    textAll(P, hero.nameEn, {                            // 英文名（宽字距小字）
      font: '500 13px ' + FONT_TITLE, x: 332, y: 92, spacing: 4,
      dStyle: '#C8A55A', hVal: 175, rVal: 44
    });
    textAll(P, hero.nameZh, {                            // 中文名（金字粗体）
      font: '700 37px ' + FONT_BODY, x: 332, y: 136, spacing: 2,
      dStyle: P.gold,
      dGlow: 'rgba(240,214,140,0.55)', dGlowBlur: 12,
      hVal: 190, rVal: 38
    });
  }

  /** 称号一行 + 两侧饰线小菱（饰线按文字实测宽度定位）。
      translucent=true（全幅卡面）时文字下垫一团柔光暗底，保证压在画上可读。 */
  function paintTitleLine(P, hero, translucent) {
    if (!hero.titleZh) return;
    if (translucent && P.d) {
      var bg = P.d.createRadialGradient(332, 184, 8, 332, 184, 150);
      bg.addColorStop(0, 'rgba(5,8,15,0.55)');
      bg.addColorStop(1, 'rgba(5,8,15,0)');
      P.d.save();
      P.d.fillStyle = bg;
      P.d.fillRect(112, 142, 440, 84);
      P.d.restore();
    }
    var font = '400 19px ' + FONT_BODY;
    textAll(P, hero.titleZh, {
      font: font, x: 332, y: 190,
      dStyle: '#CBB27A',
      dGlow: 'rgba(240,214,140,0.25)', dGlowBlur: 4,
      hVal: 165, rVal: 44
    });
    P.d.save();
    P.d.font = font;
    var tw = P.d.measureText(hero.titleZh).width;
    P.d.restore();
    var lx1 = 332 - tw / 2 - 84, lx2 = 332 - tw / 2 - 24;
    var rx1 = 332 + tw / 2 + 24, rx2 = 332 + tw / 2 + 84;
    strokeAll(P, {
      dStyle: GOLD_DIM, dWidth: 1, hVal: 140, rVal: 60,
      path: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(lx1, 184); ctx.lineTo(lx2, 184);
        ctx.moveTo(rx1, 184); ctx.lineTo(rx2, 184);
        pathGem(ctx, lx1 - 10, 184, 4.5);
        pathGem(ctx, rx2 + 10, 184, 4.5);
      }
    });
  }

  /**
   * 稀有度绶带：燕尾横幅（稀有度色染边）+ 顶端宝石 +
   * 「稀有度 · 职业 · 种族」标签行。
   */
  function paintRibbon(P, hero, rar, cls, translucent) {
    function pathRibbon(ctx) {
      ctx.beginPath();
      ctx.moveTo(112, 716);
      ctx.lineTo(552, 716);
      ctx.lineTo(538, 737);
      ctx.lineTo(552, 758);
      ctx.lineTo(112, 758);
      ctx.lineTo(126, 737);
      ctx.closePath();
    }
    var g = P.d.createLinearGradient(0, 716, 0, 758);    // 暗底浸稀有度色
    if (translucent) {                                   // 全幅卡：半透明，让画隐约透出
      g.addColorStop(0, rgba(mixHex(rar.color, '#0A1122', 0.75), 0.72));
      g.addColorStop(1, rgba(mixHex(rar.color, '#0A1122', 0.88), 0.82));
    } else {
      g.addColorStop(0, mixHex(rar.color, '#0A1122', 0.75));
      g.addColorStop(1, mixHex(rar.color, '#0A1122', 0.88));
    }
    fillAll(P, { dStyle: g, hVal: 120, rVal: 150, path: pathRibbon });
    strokeAll(P, {                                       // 绶带染边
      dStyle: rar.color, dWidth: 2.5,
      dGlow: rgba(rar.color, 0.5), dGlowBlur: 8,
      hVal: 205, rVal: 34, path: pathRibbon
    });
    strokeAll(P, {                                       // 上缘细线
      dStyle: rgba(rar.color, 0.4), dWidth: 1,
      path: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(122, 722); ctx.lineTo(542, 722);
      }
    });
    cabochonDraw(P, 332, 716, 13, rar.color);            // 顶端稀有度宝石（弧面高光）
    textAll(P, rar.zh + ' · ' + cls.zh + ' · ' + hero.raceZh, {
      font: '500 18px ' + FONT_LABEL, x: 332, y: 743, spacing: 2,
      dStyle: '#E8D49A', hVal: 175, rVal: 46
    });
  }

  /** 底部三枚属性印：武力 / 奥能 / 意志（双环圆印 + 数值）。
      translucent=true（全幅卡面）时印面改半透明。 */
  function paintStats(P, hero, translucent) {
    strokeAll(P, {                                       // 印章间连络细线
      dStyle: GOLD_DIM, dWidth: 1.5, hVal: 120, rVal: 90,
      path: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(150, 872); ctx.lineTo(514, 872);
      }
    });
    var seals = [
      { x: 172, label: '武力', key: 'might' },
      { x: 332, label: '奥能', key: 'magic' },
      { x: 492, label: '意志', key: 'resolve' }
    ];
    seals.forEach(function (seal) {
      var cx = seal.x, cy = 872;
      fillAll(P, {                                       // 印面暗底
        dStyle: translucent ? 'rgba(13,21,38,0.74)' : '#0D1526', hVal: 90, rVal: 205,
        path: function (ctx) {
          ctx.beginPath(); ctx.arc(cx, cy, 45, 0, Math.PI * 2);
        }
      });
      strokeAll(P, {                                     // 外环
        dStyle: P.gold, dWidth: 3,
        dGlow: 'rgba(240,214,140,0.3)', dGlowBlur: 6,
        hVal: 215, rVal: 30,
        path: function (ctx) {
          ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2);
        }
      });
      strokeAll(P, {                                     // 内环细线
        dStyle: GOLD_DIM, dWidth: 1, hVal: 160,
        path: function (ctx) {
          ctx.beginPath(); ctx.arc(cx, cy, 45, 0, Math.PI * 2);
        }
      });
      textAll(P, seal.label, {                           // 属性名
        font: '500 13px ' + FONT_LABEL, x: cx, y: 856, spacing: 2,
        dStyle: '#B89B62', hVal: 150, rVal: 60
      });
      textAll(P, String(hero.stats[seal.key]), {         // 属性值
        font: '600 30px ' + FONT_TITLE, x: cx, y: 898,
        dStyle: P.gold,
        dGlow: 'rgba(240,214,140,0.45)', dGlowBlur: 8,
        hVal: 185, rVal: 40
      });
    });
  }

  /** 宝石通用件：切面菱形 + 金边 + 高光点（三层同步）。 */
  function gemDraw(P, cx, cy, r, colorHex) {
    var g = P.d.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, mixHex(colorHex, '#FFFFFF', 0.55));
    g.addColorStop(0.5, colorHex);
    g.addColorStop(1, mixHex(colorHex, '#000000', 0.45));
    function path(ctx) {
      ctx.beginPath();
      pathGem(ctx, cx, cy, r);
    }
    fillAll(P, { dStyle: g, hVal: 235, rVal: 12, path: path });
    strokeAll(P, { dStyle: P.gold, dWidth: 2, hVal: 240, rVal: 20, path: path });
    if (P.d) {                                           // 高光点（仅 diffuse）
      P.d.save();
      P.d.fillStyle = 'rgba(255,255,255,0.85)';
      P.d.beginPath();
      P.d.arc(cx - r * 0.22, cy - r * 0.3, r * 0.12, 0, Math.PI * 2);
      P.d.fill();
      P.d.restore();
    }
  }

  /**
   * 弧面宝石（cabochon）：稀有度主宝石专用（绶带顶珠 / 缩略卡顶珠）。
   * 半球穹面（光源在左上）+ 金托 + 上缘高光弧 + 高光点；
   * height 为穹顶浮雕（中心最高），rough 整体低粗糙、高光弧处最光滑。
   */
  function cabochonDraw(P, cx, cy, r, colorHex) {
    var g;
    if (P.d) {
      g = P.d.createRadialGradient(cx - r * 0.32, cy - r * 0.36, r * 0.1, cx, cy, r * 1.05);
      g.addColorStop(0, mixHex(colorHex, '#FFFFFF', 0.74));
      g.addColorStop(0.42, colorHex);
      g.addColorStop(0.78, mixHex(colorHex, '#000000', 0.32));
      g.addColorStop(1, mixHex(colorHex, '#000000', 0.58));
      P.d.save();
      P.d.beginPath(); P.d.arc(cx, cy, r, 0, Math.PI * 2);
      P.d.fillStyle = g; P.d.fill();
      P.d.restore();
    }
    if (P.h) {                                           // 穹顶高度（中心凸起）
      g = P.h.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, gray(246));
      g.addColorStop(0.7, gray(226));
      g.addColorStop(1, gray(178));
      P.h.save();
      P.h.beginPath(); P.h.arc(cx, cy, r, 0, Math.PI * 2);
      P.h.fillStyle = g; P.h.fill();
      P.h.restore();
    }
    if (P.r) {                                           // 低粗糙（宝石光滑）
      P.r.save();
      P.r.beginPath(); P.r.arc(cx, cy, r, 0, Math.PI * 2);
      P.r.fillStyle = gray(14); P.r.fill();
      P.r.restore();
    }
    strokeAll(P, {                                       // 金托
      dStyle: P.gold, dWidth: 2, hVal: 240, rVal: 22,
      path: function (ctx) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
    });
    if (P.d) {                                           // 上缘高光弧 + 高光点（仅 diffuse）
      P.d.save();
      P.d.strokeStyle = 'rgba(255,255,255,0.78)';
      P.d.lineWidth = Math.max(1.2, r * 0.14);
      P.d.lineCap = 'round';
      P.d.beginPath();
      P.d.arc(cx, cy, r * 0.62, Math.PI * 1.02, Math.PI * 1.52);
      P.d.stroke();
      P.d.fillStyle = 'rgba(255,255,255,0.85)';
      P.d.beginPath();
      P.d.arc(cx - r * 0.3, cy - r * 0.38, r * 0.11, 0, Math.PI * 2);
      P.d.fill();
      P.d.restore();
    }
    if (P.r) {                                           // 高光弧处最光滑
      P.r.save();
      P.r.strokeStyle = gray(6);
      P.r.lineWidth = Math.max(1.2, r * 0.14);
      P.r.lineCap = 'round';
      P.r.beginPath();
      P.r.arc(cx, cy, r * 0.62, Math.PI * 1.02, Math.PI * 1.52);
      P.r.stroke();
      P.r.restore();
    }
  }

  /** 四角卷草饰：贴角弧 + 内卷螺旋 + 弧端双叶 + 加密层（落叶 + 二级卷草）。 */
  function cornerFlourish(P, x, y, sx, sy) {
    strokeAll(P, {
      dStyle: P.gold, dWidth: 2,
      dGlow: 'rgba(240,214,140,0.3)', dGlowBlur: 5,
      hVal: 215, rVal: 32,
      path: function (ctx) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(sx, sy);
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI / 2);               // 贴角弧
        ctx.moveTo(26 + 13 * Math.cos(-Math.PI / 2), 26 + 13 * Math.sin(-Math.PI / 2));
        ctx.arc(26, 26, 13, -Math.PI / 2, Math.PI * 1.25, false);  // 外卷
        ctx.arc(29, 29, 6, Math.PI * 1.25, Math.PI * 2.9, false);  // 内卷
        ctx.moveTo(38, 8);                               // 弧端双叶
        ctx.quadraticCurveTo(50, 8, 56, 2);
        ctx.quadraticCurveTo(50, 14, 38, 8);
        ctx.moveTo(8, 38);
        ctx.quadraticCurveTo(8, 50, 2, 56);
        ctx.quadraticCurveTo(14, 50, 8, 38);
        ctx.restore();
      }
    });
    strokeAll(P, {                                       // 加密层：落叶卷草二级饰
      dStyle: GOLD_DIM, dWidth: 1.1, hVal: 165, rVal: 58,
      path: function (ctx) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(sx, sy);
        ctx.beginPath();
        ctx.arc(0, 0, 47, Math.PI * 0.08, Math.PI * 0.42); // 外圈落叶弧
        ctx.moveTo(52 + 8 * Math.cos(Math.PI * 0.22), 26 + 8 * Math.sin(Math.PI * 0.22));
        ctx.arc(52, 26, 8, Math.PI * 0.22, Math.PI * 1.7, false); // 二级小卷
        ctx.moveTo(26 + 8 * Math.cos(Math.PI * 0.78), 52 + 8 * Math.sin(Math.PI * 0.78));
        ctx.arc(26, 52, 8, Math.PI * 0.78, Math.PI * 2.26, false);
        ctx.moveTo(58, 12);                              // 弧端落叶一对
        ctx.quadraticCurveTo(70, 12, 76, 6);
        ctx.quadraticCurveTo(70, 18, 58, 12);
        ctx.moveTo(12, 58);
        ctx.quadraticCurveTo(12, 70, 6, 76);
        ctx.quadraticCurveTo(18, 70, 12, 58);
        ctx.restore();
      }
    });
  }

  /** legendary 专属繁缛金饰：外框与内框之间的连珠（圆珠 + 隔菱）饰带。 */
  function legendaryBeading(P) {
    fillAll(P, {
      dStyle: 'rgba(232,205,138,0.9)', hVal: 218, rVal: 24,
      path: function (ctx) {
        ctx.beginPath();
        var t, n = 0;
        for (t = 78; t <= 586; t += 22) {                // 上 / 下两边
          ctx.moveTo(t + 2.6, 31);
          ctx.arc(t, 31, 2.6, 0, Math.PI * 2);
          ctx.moveTo(t + 2.6, 993);
          ctx.arc(t, 993, 2.6, 0, Math.PI * 2);
          if (n % 5 === 2) {                             // 每隔五珠一枚隔菱
            pathGem(ctx, t, 31, 4.2);
            pathGem(ctx, t, 993, 4.2);
          }
          n++;
        }
        n = 0;
        for (t = 78; t <= 946; t += 22) {                // 左 / 右两边
          ctx.moveTo(31 + 2.6, t);
          ctx.arc(31, t, 2.6, 0, Math.PI * 2);
          ctx.moveTo(633 + 2.6, t);
          ctx.arc(633, t, 2.6, 0, Math.PI * 2);
          if (n % 5 === 2) {
            pathGem(ctx, 31, t, 4.2);
            pathGem(ctx, 633, t, 4.2);
          }
          n++;
        }
      }
    });
  }

  /**
   * 双层烧金边框：外框粗金线（金色斜角 bevel 高光）+ 暗部压边 + 内侧细线 +
   * 内框（暗部压边凹槽）+ 四角卷草饰 + 左右边框宝石（稀有度色）；
   * rarityKey === 'legendary' 时在外框与内框之间加连珠繁缛金饰带。
   */
  function paintFrame(P, rarityColor, rarityKey) {
    strokeAll(P, {                                       // 外框粗金线
      dStyle: P.gold, dWidth: 6,
      dGlow: 'rgba(240,214,140,0.35)', dGlowBlur: 10,
      hVal: 235, rVal: 24,
      path: function (ctx) { ctx.beginPath(); ctx.rect(22, 22, 620, 980); }
    });
    if (P.d) {                                           // 金色斜角 bevel：左上受光 / 右下背光
      P.d.save();
      P.d.lineCap = 'square';
      P.d.strokeStyle = 'rgba(255,241,196,0.8)';         // 高光棱（上 + 左）
      P.d.lineWidth = 1.6;
      P.d.beginPath();
      P.d.moveTo(642, 23.2); P.d.lineTo(22, 23.2); P.d.lineTo(22, 1002);
      P.d.stroke();
      P.d.strokeStyle = 'rgba(46,30,8,0.6)';             // 暗棱（下 + 右）
      P.d.beginPath();
      P.d.moveTo(22, 1000.8); P.d.lineTo(642, 1000.8); P.d.lineTo(642, 22);
      P.d.stroke();
      P.d.restore();
    }
    if (P.d) {                                           // 外框暗部压边（仅 diffuse）
      P.d.save();
      P.d.strokeStyle = 'rgba(0,0,0,0.55)';
      P.d.lineWidth = 1;
      P.d.strokeRect(28.5, 28.5, 607, 967);
      P.d.restore();
    }
    strokeAll(P, {                                       // 内侧细金线
      dStyle: GOLD_DIM, dWidth: 1.2, hVal: 150, rVal: 50,
      path: function (ctx) { ctx.beginPath(); ctx.rect(36, 36, 592, 952); }
    });
    strokeAll(P, {                                       // 内框
      dStyle: P.gold, dWidth: 2, hVal: 220, rVal: 30,
      path: function (ctx) { ctx.beginPath(); ctx.rect(48, 48, 568, 928); }
    });
    if (P.d) {                                           // 内框暗部压边（浮雕凹槽）
      P.d.save();
      P.d.strokeStyle = 'rgba(0,0,0,0.42)';
      P.d.lineWidth = 1.4;
      P.d.strokeRect(51, 51, 562, 922);
      P.d.restore();
    }
    if (rarityKey === 'legendary') legendaryBeading(P);  // 传说专属繁缛金饰
    cornerFlourish(P, 48, 48, 1, 1);                     // 四角卷草
    cornerFlourish(P, 616, 48, -1, 1);
    cornerFlourish(P, 48, 976, 1, -1);
    cornerFlourish(P, 616, 976, -1, -1);
    gemDraw(P, 22, 470, 15, rarityColor);                // 左右边框宝石
    gemDraw(P, 642, 470, 15, rarityColor);
  }

  /** 阵营简化几何徽记路径（联盟狮盾 / 部落战徽 / 中立八芒星）。 */
  function pathFaction(ctx, faction, r) {
    var i, a, rr;
    if (faction === 'alliance') {                        // 狮盾 + 十字纹
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(r * 0.75, -r * 0.5);
      ctx.lineTo(r * 0.75, r * 0.05);
      ctx.quadraticCurveTo(r * 0.75, r * 0.62, 0, r * 0.95);
      ctx.quadraticCurveTo(-r * 0.75, r * 0.62, -r * 0.75, r * 0.05);
      ctx.lineTo(-r * 0.75, -r * 0.5);
      ctx.closePath();
      ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, r * 0.95);
      ctx.moveTo(-r * 0.75, -r * 0.24); ctx.lineTo(r * 0.75, -r * 0.24);
    } else if (faction === 'horde') {                    // 尖角战徽 + 双角獠牙
      ctx.moveTo(0, -r * 0.5); ctx.lineTo(r * 0.4, 0);
      ctx.lineTo(0, r * 0.8); ctx.lineTo(-r * 0.4, 0);
      ctx.closePath();
      ctx.moveTo(-r * 0.18, -r * 0.34);
      ctx.quadraticCurveTo(-r * 0.72, -r * 0.66, -r * 0.88, -r * 0.2);
      ctx.moveTo(r * 0.18, -r * 0.34);
      ctx.quadraticCurveTo(r * 0.72, -r * 0.66, r * 0.88, -r * 0.2);
      ctx.moveTo(-r * 0.4, r * 0.26); ctx.lineTo(-r * 0.72, r * 0.58);
      ctx.moveTo(r * 0.4, r * 0.26); ctx.lineTo(r * 0.72, r * 0.58);
    } else {                                             // 中立八芒星
      for (i = 0; i < 16; i++) {
        a = i * Math.PI / 8 - Math.PI / 2;
        rr = (i % 2 ? r * 0.42 : r * 0.9);
        var x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.moveTo(r * 0.28, 0);
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    }
  }

  /** 底部双章：右下阵营角标 + 左下职业宝石章。
      translucent=true（全幅卡面）时章面改半透明。 */
  function paintMedallions(P, hero, classColor, factionColor, translucent) {
    [[566, 'faction'], [98, 'class']].forEach(function (item) {
      var cx = item[0], cy = 916;
      fillAll(P, {                                       // 章面暗底
        dStyle: translucent ? 'rgba(11,19,38,0.74)' : '#0B1326', hVal: 120, rVal: 190,
        path: function (ctx) {
          ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        }
      });
      strokeAll(P, {                                     // 章面金环
        dStyle: P.gold, dWidth: 2.5, hVal: 220, rVal: 28,
        path: function (ctx) {
          ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        }
      });
      if (item[1] === 'faction') {
        strokeAll(P, {                                   // 阵营色内环
          dStyle: factionColor, dWidth: 1.5, hVal: 150, rVal: 60,
          path: function (ctx) {
            ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2);
          }
        });
        strokeAll(P, {                                   // 阵营几何徽记
          dStyle: mixHex(factionColor, '#FFFFFF', 0.35), dWidth: 2,
          dGlow: rgba(factionColor, 0.6), dGlowBlur: 6,
          hVal: 190, rVal: 50,
          path: function (ctx) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.beginPath();
            pathFaction(ctx, hero.faction, 16);
            ctx.restore();
          }
        });
      } else {
        gemDraw(P, cx, cy, 13, classColor);              // 职业宝石章
      }
    });
  }

  /* --------------------------------------------------------------------------
   * 八·c、国风装饰层（theme:'guofeng'，掐丝珐琅主题）
   *   回纹边框 + 如意云头角 + 直边匾额 + 称号朱文印 + 竖排题款 + 底角双印。
   *   设计理念「装饰即掐丝」：所有纹样都是连续金丝，与画芯掐丝同源；
   *   金丝工艺参数与金线层同域（h 215–235 / r 24–30），印章是压在画面上的
   *   平面印泥（高度平 h≈122、哑光 r≈200，白文刻入感 h≈102）。
   * ------------------------------------------------------------------------ */

  var GUOFENG_SEAL = '#B03A2E';    // 朱砂印泥
  var GUOFENG_INK  = '#E6D6A8';    // 题款泥金（比边框金稍暖白，拉开层次）

  /** 回纹单元：s×s 方格内的方形螺旋（掐丝珐琅器经典边饰，几何可平铺）。 */
  function pathLeiwen(ctx, s) {
    var u = s / 10;
    ctx.moveTo(1 * u, 1 * u);
    ctx.lineTo(9 * u, 1 * u);
    ctx.lineTo(9 * u, 9 * u);
    ctx.lineTo(1 * u, 9 * u);
    ctx.lineTo(1 * u, 3 * u);
    ctx.lineTo(7 * u, 3 * u);
    ctx.lineTo(7 * u, 7 * u);
    ctx.lineTo(3 * u, 7 * u);
    ctx.lineTo(3 * u, 5 * u);
    ctx.lineTo(5 * u, 5 * u);
  }

  /** 如意云头（简化卷涡）：半径 r 的螺旋由外向内收 2.2 圈，起角 faceA 朝向卡缘。 */
  function pathRuyi(ctx, cx, cy, r, faceA) {
    var turns = 2.2, steps = 40, i, t, a, rr, x, y;
    ctx.moveTo(cx + Math.cos(faceA) * r, cy + Math.sin(faceA) * r);
    for (i = 1; i <= steps; i++) {
      t = i / steps;
      a = faceA + t * turns * Math.PI * 2;
      rr = r * (1 - 0.78 * t);
      x = cx + Math.cos(a) * rr; y = cy + Math.sin(a) * rr;
      ctx.lineTo(x, y);
    }
  }

  /** 印泥质感（离屏印面专用）：积墨深斑 + 虫蚀残损 + 边缘磨泐。
      seed 由印章位置/尺寸决定——同印每次渲染纹理一致，光位重绘不闪。 */
  function sealTexture(oc, size, seed) {
    var s = (seed >>> 0) || 1, i, a, rr, x, y, g;
    function rnd() {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var half = size / 2;
    oc.save();
    oc.globalCompositeOperation = 'source-atop';           // 积墨：只落在已有印面上
    for (i = 0; i < 7; i++) {
      x = half + (rnd() * 2 - 1) * half * 0.85;
      y = half + (rnd() * 2 - 1) * half * 0.85;
      rr = size * (0.16 + rnd() * 0.26);
      g = oc.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, 'rgba(88,18,12,' + (0.12 + rnd() * 0.14).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(88,18,12,0)');
      oc.fillStyle = g;
      oc.beginPath(); oc.arc(x, y, rr, 0, Math.PI * 2); oc.fill();
    }
    oc.globalCompositeOperation = 'destination-out';       // 虫蚀：印泥斑驳残损
    for (i = 0; i < 90; i++) {
      a = rnd() * Math.PI * 2; rr = Math.pow(rnd(), 0.7) * half;
      x = half + Math.cos(a) * rr; y = half + Math.sin(a) * rr;
      oc.globalAlpha = 0.05 + rnd() * 0.20;
      oc.beginPath(); oc.arc(x, y, 0.4 + rnd() * rnd() * 1.8, 0, Math.PI * 2); oc.fill();
    }
    for (i = 0; i < 26; i++) {                             // 边缘磨泐（边框处更重）
      a = rnd() * Math.PI * 2;
      x = half + Math.cos(a) * half * (0.82 + rnd() * 0.24);
      y = half + Math.sin(a) * half * (0.82 + rnd() * 0.24);
      oc.globalAlpha = 0.10 + rnd() * 0.28;
      oc.beginPath(); oc.arc(x, y, 0.6 + rnd() * 2.0, 0, Math.PI * 2); oc.fill();
    }
    oc.restore();
  }

  /** 离屏印面绘制 + 质感 + 回贴 diffuse：质感只作用于印面自身像素，
      不蚀穿、不染污印面底下的画芯（镂空印透出画面必需）。
      drawFn(oc, size) 以逻辑坐标在 [0,size]² 内作画。 */
  function blitSealFace(P, cx, cy, size, seed, drawFn) {
    if (!P.d) return;
    var off = document.createElement('canvas');
    off.width = Math.max(2, Math.ceil(size * SCX));
    off.height = Math.max(2, Math.ceil(size * SCY));
    var oc = off.getContext('2d');
    oc.scale(SCX, SCY);
    drawFn(oc, size);
    sealTexture(oc, size, seed);
    var half = size / 2;
    P.d.save();
    P.d.drawImage(off, 0, 0, off.width, off.height, cx - half, cy - half, size, size);
    P.d.restore();
  }

  /** 白文朱砂方印：圆角红底 + 阴刻白字（小篆，1–2 字，2 字竖排）+ 印泥斑驳。 */
  function paintSeal(P, cx, cy, size, chars) {
    var half = size / 2, rad = Math.max(2.5, size * 0.12);
    fillAll(P, {                                       // 高度/粗糙度：印泥平面哑光
      hVal: 122, rVal: 200,
      path: function (ctx) {
        ctx.beginPath(); pathRoundRect(ctx, cx - half, cy - half, size, size, rad);
      }
    });
    if (chars) {                                       // 白文刻入（高度反压、更哑光）
      var fsH = chars.length === 2 ? size * 0.42 : size * 0.58;
      if (chars.length === 2) {
        textAll(P, chars[0], { font: fsH + 'px ' + FONT_SEAL, x: cx, y: cy - size * 0.02, hVal: 100, rVal: 220 });
        textAll(P, chars[1], { font: fsH + 'px ' + FONT_SEAL, x: cx, y: cy + size * 0.37, hVal: 100, rVal: 220 });
      } else {
        textAll(P, chars, { font: fsH + 'px ' + FONT_SEAL, x: cx, y: cy + fsH * 0.35, hVal: 100, rVal: 220 });
      }
    }
    blitSealFace(P, cx, cy, size, cx * 31 + cy * 7 + size, function (oc) {
      var g = oc.createRadialGradient(                 // 印泥：中心朱亮、四边沉浓
        half * 0.9, half * 0.85, size * 0.06, half, half, size * 0.78);
      g.addColorStop(0, '#C64B39');
      g.addColorStop(0.62, GUOFENG_SEAL);
      g.addColorStop(1, '#8E2A1F');
      oc.fillStyle = g;
      oc.beginPath(); pathRoundRect(oc, 0.6, 0.6, size - 1.2, size - 1.2, rad); oc.fill();
      oc.strokeStyle = 'rgba(60,10,8,0.55)';           // 印泥深色收边
      oc.lineWidth = 1;
      oc.beginPath(); pathRoundRect(oc, 0.6, 0.6, size - 1.2, size - 1.2, rad); oc.stroke();
      if (!chars) return;
      oc.fillStyle = '#F3E9CF';                        // 阴刻白字（小篆）
      oc.textAlign = 'center'; oc.textBaseline = 'alphabetic';
      var fs = chars.length === 2 ? size * 0.42 : size * 0.58;
      oc.font = fs + 'px ' + FONT_SEAL;
      if (chars.length === 2) {
        oc.fillText(chars[0], half, half - size * 0.02);
        oc.fillText(chars[1], half, half + size * 0.37);
      } else {
        oc.fillText(chars, half, half + fs * 0.35);
      }
    });
  }

  /** 镂空朱文大印（称号印，题款列末）：无底透空见画，
      双线边框 + 小篆朱字 + 斑驳残边。 */
  function paintSealOpen(P, cx, cy, size, chars) {
    if (!chars) return;
    var half = size / 2, rad = Math.max(3, size * 0.10);
    var fs = chars.length === 2 ? size * 0.44 : size * 0.60;
    var ys = chars.length === 2
      ? [cy - size * 0.02, cy + size * 0.37]
      : [cy + fs * 0.35];
    function borderPath(ctx, inset) {
      ctx.beginPath();
      pathRoundRect(ctx, cx - half + inset, cy - half + inset, size - inset * 2, size - inset * 2, rad);
    }
    strokeAll(P, { hVal: 124, rVal: 200, dWidth: 2.8, path: function (ctx) { borderPath(ctx, 1.6); } });
    strokeAll(P, { hVal: 124, rVal: 200, dWidth: 0.9, path: function (ctx) { borderPath(ctx, 5.5); } });
    chars.split('').forEach(function (ch, i) {         // 朱文线条的印泥厚度（h/r 层）
      if (i < ys.length) textAll(P, ch, { font: fs + 'px ' + FONT_SEAL, x: cx, y: ys[i], hVal: 124, rVal: 200 });
    });
    blitSealFace(P, cx, cy, size, cx * 13 + cy * 41 + size, function (oc) {
      oc.shadowColor = 'rgba(40,8,6,0.45)';            // 微影与画底分离，保可读
      oc.shadowBlur = 2.5;
      oc.strokeStyle = GUOFENG_SEAL;
      oc.lineJoin = 'round';
      oc.lineWidth = 2.8;
      oc.beginPath(); pathRoundRect(oc, 1.6, 1.6, size - 3.2, size - 3.2, rad); oc.stroke();
      oc.lineWidth = 0.9;
      oc.beginPath(); pathRoundRect(oc, 5.5, 5.5, size - 11, size - 11, Math.max(2, rad - 3)); oc.stroke();
      oc.fillStyle = '#BE4132';
      oc.textAlign = 'center'; oc.textBaseline = 'alphabetic';
      oc.font = fs + 'px ' + FONT_SEAL;
      for (var i = 0; i < chars.length && i < ys.length; i++) {
        oc.fillText(chars[i], half, ys[i] - cy + half);
      }
    });
  }

  /** 国风外框：外细线 + 回纹带 + 内细线 + 四角如意云头。 */
  function paintGuofengFrame(P) {
    strokeAll(P, {                                     // 最外细金丝
      dStyle: P.gold, dWidth: 2, hVal: 235, rVal: 24,
      path: function (ctx) { ctx.beginPath(); ctx.rect(14, 14, LW - 28, LH - 28); }
    });
    strokeAll(P, {                                     // 内侧细金丝
      dStyle: P.gold, dWidth: 1.6, hVal: 220, rVal: 30,
      path: function (ctx) { ctx.beginPath(); ctx.rect(46, 46, LW - 92, LH - 92); }
    });
    var s = 20;                                        // 回纹带（inset 22–42，四角让位云头）
    strokeAll(P, {
      dStyle: P.gold, dWidth: 1.3,
      dGlow: 'rgba(240,214,140,0.25)', dGlowBlur: 4,
      hVal: 215, rVal: 28,
      path: function (ctx) {
        var i, n, m, x0;
        n = Math.floor((LW - 124) / s);                // 上下边（两端各留 62 给云头）
        x0 = (LW - n * s) / 2;
        for (i = 0; i < n; i++) {
          ctx.save(); ctx.translate(x0 + i * s, 22); pathLeiwen(ctx, s); ctx.restore();
          ctx.save(); ctx.translate(x0 + i * s, LH - 42); pathLeiwen(ctx, s); ctx.restore();
        }
        m = Math.floor((LH - 124) / s);                // 左右列（竖向单元旋转 90°）
        var y0 = (LH - m * s) / 2;
        for (i = 0; i < m; i++) {
          ctx.save(); ctx.translate(42, y0 + i * s); ctx.rotate(Math.PI / 2); pathLeiwen(ctx, s); ctx.restore();
          ctx.save(); ctx.translate(LW - 22, y0 + i * s); ctx.rotate(Math.PI / 2); pathLeiwen(ctx, s); ctx.restore();
        }
      }
    });
    [[20, 20, 0], [LW - 20, 20, Math.PI / 2],
     [LW - 20, LH - 20, Math.PI], [20, LH - 20, -Math.PI / 2]].forEach(function (c) {
      strokeAll(P, {                                   // 四角回纹角花（与回纹带同源，旋转合角）
        dStyle: P.gold, dWidth: 1.8,
        dGlow: 'rgba(240,214,140,0.45)', dGlowBlur: 8,
        hVal: 228, rVal: 26,
        path: function (ctx) {
          ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(c[2]);
          ctx.beginPath(); pathLeiwen(ctx, 30);
          ctx.restore();
        }
      });
    });
  }

  /** 国风匾额名牌：直边漆底金字（称号印已移至右侧题款列末镂空大印）。 */
  function paintGuofengPlaque(P, hero) {
    var px0 = 182, px1 = 482, py0 = 48, py1 = 112;     // 匾额 300×64
    var g = P.d.createLinearGradient(0, py0, 0, py1);
    g.addColorStop(0, 'rgba(14,22,40,0.88)');          // 高不透明度漆底：月亮在匾额后会洗掉金字
    g.addColorStop(1, 'rgba(7,12,24,0.94)');
    fillAll(P, { dStyle: g, hVal: 148, rVal: 120,      // 漆底（半透明压画）
      path: function (ctx) { ctx.beginPath(); ctx.rect(px0, py0, px1 - px0, py1 - py0); } });
    strokeAll(P, {                                     // 匾额金边
      dStyle: P.gold, dWidth: 2.2,
      dGlow: 'rgba(240,214,140,0.4)', dGlowBlur: 8,
      hVal: 225, rVal: 30,
      path: function (ctx) { ctx.beginPath(); ctx.rect(px0, py0, px1 - px0, py1 - py0); }
    });
    strokeAll(P, {                                     // 匾额内细线
      dStyle: GOLD_DIM, dWidth: 1,
      path: function (ctx) { ctx.beginPath(); ctx.rect(px0 + 4, py0 + 4, px1 - px0 - 8, py1 - py0 - 8); }
    });
    strokeAll(P, {                                     // 两端小云头饰
      dStyle: P.gold, dWidth: 1.5, hVal: 205, rVal: 36,
      path: function (ctx) {
        ctx.beginPath();
        pathRuyi(ctx, px0 - 13, 80, 8, Math.PI);       // 左端（朝左）
        pathRuyi(ctx, px1 + 13, 80, 8, 0);             // 右端（朝右）
      }
    });
    textAll(P, hero.nameZh, {                          // 名字（毛笔金字，大字距）
      font: '46px ' + FONT_BRUSH, x: 332, y: 97, spacing: 10,
      dStyle: P.gold,
      dGlow: 'rgba(240,214,140,0.55)', dGlowBlur: 12,
      hVal: 190, rVal: 38
    });
  }

  /** 竖排题款（题画诗传统）：quote 按断句拆双列——先句居外列、
      后句居内列并下沉 1.6 字距，断句之间错落有致、不同列齐平；
      列末压称号镂空朱文大印（hero.sealZh，繁体小篆）。 */
  function paintGuofengInscription(P, hero) {
    var phrases = (hero.quote || '').split(/[，。；！？、,.!?;]/)
      .map(function (s) { return s.replace(/[^一-龥]/g, ''); })
      .filter(function (s) { return s.length > 0; });
    if (!phrases.length) return;
    var col1 = phrases[0], col2 = phrases.slice(1).join('');
    var tr = hero.quotePos !== 'tl';
    var size = 29, step = 37, colGap = 42, y0 = 88;
    var x1 = tr ? 588 : 76, x2 = x1 + (tr ? -colGap : colGap);
    var y2 = y0 + step * 1.6;                          // 后句列下沉，断句错落
    function drawCol(text, cx, top) {
      for (var i = 0; i < text.length; i++) {
        textAll(P, text[i], {
          font: size + 'px ' + FONT_BRUSH, x: cx, y: top + i * step,
          dStyle: GUOFENG_INK,
          dGlow: 'rgba(8,12,20,0.85)', dGlowBlur: 7,   // 深色衬影保可读（亮底处显影）
          hVal: 185, rVal: 46
        });
      }
      return top + (text.length - 1) * step + size;    // 列底沿 y
    }
    var end1 = drawCol(col1, x1, y0);
    var end2 = col2 ? drawCol(col2, x2, y2) : 0;
    if (hero.sealZh) {                                 // 称号印：压长列之末（钤印收尾）
      var sealSize = 62;
      var sx = col2 ? x2 : x1;
      paintSealOpen(P, sx, Math.max(end1, end2) + 20 + sealSize / 2, sealSize, hero.sealZh);
    }
  }

  /** 底角双印：左下朝代印、右下类别印（白文小篆，放大款）。 */
  function paintGuofengCornerSeals(P, hero) {
    if (hero.dynasty)  paintSeal(P, 72, 946, 34, hero.dynasty);
    if (hero.category) paintSeal(P, 592, 946, 34, hero.category);
  }

  /* --------------------------------------------------------------------------
   * 八·b、英雄肖像：预载注册表 + 拱形肖像窗
   * ------------------------------------------------------------------------ */

  var _portraits = new Map();   // hero.id → HTMLImageElement（null = 已探测无图）
  var _fullArt = new Map();     // hero.id → 全幅场景插画 Image（null = 已探测无图；数据驱动：hero.fullArt 字段）
  var _fullArtHeight = new Map();  // hero.id → 全幅 AI 高度图 Image（null = 无图；数据驱动：hero.fullArtHeight 字段）

  function _loadImageOnce(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  /**
   * preloadPortraits(heroes) → Promise（契约：永不 reject）
   * 按 assets/portraits/<id>.webp → .png 顺序探测英雄肖像：
   * 成功的登记入 _portraits，两级都落空则登记 null（后续走 sigil 降级）。
   * 另对声明了 fullArt 字段的英雄并行预载全幅场景插画，登记入 _fullArt
   * （加载失败登记 null，自动回退常规肖像 / sigil 路径）。
   * 全部 settle 后清空 paintFace LRU——此前按无图降级渲染的缓存作废，
   * 下次 paintFace 自动按最新肖像状态重绘。
   */
  function preloadPortraits(heroes) {
    var list = Array.isArray(heroes) ? heroes : [];
    var jobs = list.map(function (h) {
      var id = h && h.id != null ? String(h.id) : '';
      if (!id) return Promise.resolve();
      if (_portraits.has(id)) return Promise.resolve();  // 已有定论（含「无图」标记）
      if (h && typeof h.fullArt === 'string' && h.fullArt) {
        _portraits.set(id, null);                         // 全幅英雄无需探测不存在的肖像窗资源
        return Promise.resolve();
      }
      return _loadImageOnce('assets/portraits/' + encodeURIComponent(id) + '.webp')
        .then(function (img) {
          if (img) return img;
          return _loadImageOnce('assets/portraits/' + encodeURIComponent(id) + '.png');
        })
        .then(function (img) {
          _portraits.set(id, img || null);
        })
        .catch(function () {
          _portraits.set(id, null);                      // 任何异常都吞掉：永不 reject
        });
    });
    list.forEach(function (h) {                          // 全幅插画：仅声明了 fullArt 的英雄
      var id = h && h.id != null ? String(h.id) : '';
      var src = h && typeof h.fullArt === 'string' ? h.fullArt : '';
      if (id && src && !_fullArt.has(id)) {              // 其他英雄零影响
        jobs.push(_loadImageOnce(src).then(function (img) {
          _fullArt.set(id, img || null);
        }).catch(function () {
          _fullArt.set(id, null);                        // 异常吞掉：永不 reject
        }));
      }
      var hsrc = h && typeof h.fullArtHeight === 'string' ? h.fullArtHeight : '';
      if (id && hsrc && !_fullArtHeight.has(id)) {       // v5.1 AI 高度图（可选伴生）
        jobs.push(_loadImageOnce(hsrc).then(function (img) {
          _fullArtHeight.set(id, img || null);
        }).catch(function () {
          _fullArtHeight.set(id, null);
        }));
      }
    });
    return Promise.all(jobs).then(function () {
      _faceCache.clear();                                // 肖像状态定型，旧缓存全部重画
    });
  }

  /** hasPortrait(hero)：该英雄当前是否有已登记的可用肖像。 */
  function hasPortrait(hero) {
    var id = hero && hero.id != null ? String(hero.id) : '';
    return !!(id && _portraits.get(id));
  }

  /**
   * 拱形肖像窗（paintFace / paintMini 共用；paintMini 场景 P.h / P.r 为 null 自动跳过）：
   *   窗体：圆拱（几何见 PORTRAIT_WIN），窗后衬职业色氛围渐变 + 脸部聚光；
   *   肖像：cover 裁入窗内，脸部落在窗上部约 1/5 处，底部渐隐融入卡底；
   *   窗沿：双层描金 + 拱顶 / 底角小菱饰；
   *   height：窗内低平（哑光画芯），窗沿保持浮雕凸起；
   *   rough ：窗内哑光（196–212），描金窗沿低粗糙。
   */
  function paintPortraitZone(P, img, classColor) {
    var V = PORTRAIT_WIN;
    var winW = V.w, winH = V.yBottom - V.yTop;
    var d = P.d, g;

    if (d) {
      d.save();
      d.beginPath();
      pathPortraitArch(d);
      d.clip();

      g = d.createLinearGradient(0, V.yTop, 0, V.yBottom);   // 窗后职业色氛围渐变
      g.addColorStop(0, rgba(classColor, 0.26));
      g.addColorStop(0.45, rgba(classColor, 0.10));
      g.addColorStop(1, 'rgba(8,12,22,0.55)');
      d.fillStyle = g;
      d.fillRect(V.x, V.yTop, winW, winH);

      g = d.createRadialGradient(V.cx, V.yTop + winH * 0.20, 20, V.cx, V.yTop + winH * 0.20, 300);
      g.addColorStop(0, rgba(classColor, 0.20));             // 脸部位置聚光
      g.addColorStop(1, rgba(classColor, 0));
      d.fillStyle = g;
      d.fillRect(V.x, V.yTop, winW, winH);

      var iw = img.naturalWidth || img.width;                // 肖像 cover 裁入
      var ih = img.naturalHeight || img.height;
      if (iw > 0 && ih > 0) {
        var scale = Math.max(winW / iw, winH / ih);
        var sw = iw * scale, sh = ih * scale;
        var faceY = V.yTop + winH * 0.20;                    // 脸部基准线（窗上部 1/5）
        var dx = V.cx - sw / 2;
        var dy = faceY - (ih * 0.33) * scale;                // 源图脸约在 1/3 高度处
        var temp = mkCanvas(winW, winH);
        var tx = temp.getContext('2d');
        tx.drawImage(img, dx - V.x, dy - V.yTop, sw, sh);
        tx.globalCompositeOperation = 'destination-in';      // 底部渐隐融入卡底
        var fade = tx.createLinearGradient(0, winH * 0.74, 0, winH);
        fade.addColorStop(0, 'rgba(0,0,0,1)');
        fade.addColorStop(1, 'rgba(0,0,0,0)');
        tx.fillStyle = fade;
        tx.fillRect(0, 0, winW, winH);
        d.drawImage(temp, V.x, V.yTop);
      }

      g = d.createLinearGradient(0, V.yBottom - 150, 0, V.yBottom); // 窗底暗角渐隐
      g.addColorStop(0, 'rgba(6,9,16,0)');
      g.addColorStop(1, 'rgba(6,9,16,0.52)');
      d.fillStyle = g;
      d.fillRect(V.x, V.yBottom - 150, winW, 150);

      g = d.createRadialGradient(V.cx, V.yTop + winH * 0.4, winW * 0.34, V.cx, V.yTop + winH * 0.45, winW * 0.95);
      g.addColorStop(0, 'rgba(3,5,10,0)');                   // 窗内暗角（内凹进深感）
      g.addColorStop(1, 'rgba(3,5,10,0.30)');
      d.fillStyle = g;
      d.fillRect(V.x, V.yTop, winW, winH);

      d.strokeStyle = 'rgba(0,0,0,0.5)';                     // 内缘压线
      d.lineWidth = 2;
      d.beginPath();
      pathPortraitArch(d);
      d.stroke();
      d.restore();
    }

    if (P.h) {                                               // height：窗内低平（哑光画芯）
      fillAll(P, { hVal: 26, path: function (ctx) { ctx.beginPath(); pathPortraitArch(ctx); } });
      g = P.h.createRadialGradient(V.cx, V.yTop + winH * 0.45, 150, V.cx, V.yTop + winH * 0.5, 560);
      g.addColorStop(0, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      P.h.save();
      P.h.beginPath();
      pathPortraitArch(P.h);
      P.h.clip();
      P.h.fillStyle = g;
      P.h.fillRect(V.x, V.yTop, winW, winH);
      P.h.restore();
    }
    if (P.r) {                                               // rough：窗内哑光 196–212
      P.r.save();
      P.r.beginPath();
      pathPortraitArch(P.r);
      P.r.clip();
      g = P.r.createRadialGradient(V.cx, V.yTop + winH * 0.4, 60, V.cx, V.yTop + winH * 0.5, 560);
      g.addColorStop(0, gray(196));
      g.addColorStop(1, gray(212));
      P.r.fillStyle = g;
      P.r.fillRect(V.x, V.yTop, winW, winH);
      P.r.restore();
    }

    strokeAll(P, {                                           // 窗沿描金（主）
      dStyle: P.gold, dWidth: 5,
      dGlow: 'rgba(240,214,140,0.45)', dGlowBlur: 12,
      hVal: 232, hWidth: 5, hBlur: 2, rVal: 28,
      path: function (ctx) { ctx.beginPath(); pathPortraitArch(ctx); }
    });
    strokeAll(P, {                                           // 窗沿内侧细线
      dStyle: GOLD_DIM, dWidth: 1.2, hVal: 160, rVal: 55,
      path: function (ctx) { ctx.beginPath(); pathPortraitArch(ctx); }
    });
    strokeAll(P, {                                           // 拱顶 / 底角小菱饰
      dStyle: P.gold, dWidth: 1.8, hVal: 215, rVal: 34,
      path: function (ctx) {
        ctx.beginPath();
        pathGem(ctx, V.cx, V.yTop, 9);
        pathGem(ctx, V.x, V.yBottom, 7);
        pathGem(ctx, V.x + V.w, V.yBottom, 7);
      }
    });
  }

  /* --------------------------------------------------------------------------
   * 八·c、全幅场景卡面（试验 · 方案A）：插画即卡面 + 像素派生材质
   * ------------------------------------------------------------------------ */

  var FULLART_CROP_BOTTOM = 0.08;   // 源图底部裁剪比例（≥7%，去除左下「AI生成」水印）

  /**
   * 全幅插画 cover 变换（唯一实现）：源图底部按 FULLART_CROP_BOTTOM 多裁
   * 弃除水印带，cover 铺满 tw×th 居中溢出即裁。tw/th 取调用方坐标系：
   * diffuse（CTM 已挂 2×）传逻辑 LW×LH；外部贴图临时画布（无 CTM）
   * 传物理 W×H——两种调用最终落在同一物理像素网格，几何逐像素对齐。
   */
  function drawFullArtCover(ctx, img, tw, th) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var srcH = Math.max(1, Math.round(ih * (1 - FULLART_CROP_BOTTOM)));
    var scale = Math.max(tw / iw, th / srcH);
    var sw = iw * scale, sh = srcH * scale;
    ctx.drawImage(img, 0, 0, iw, srcH, (tw - sw) / 2, (th - sh) / 2, sw, sh);
  }

  /* 金线蚀刻风格（goldline）派生参数——实测定阈：
   * 对三张试验图做全像素 HSV 统计：油画版（bust / full）在放宽金域
   * h[22,70] · s≥0.20 · v≥0.25 下覆盖率仅 2.1%，金线蚀刻版 13.2%，
   * 故 auto 判定界取 6%；金线亮部 hue 集中于 30–50°（古金 / 青铜），
   * 窗取 [22,70] 包容暗线边缘；掩膜 1px 膨胀平滑法线棱脊。 */
  var FULLART_GOLD = {
    autoCover: 0.06,
    h0: 22, h1: 70, s0: 0.20, v0: 0.25,
    goldH0: 220, goldH1: 30,     // 金线 height = 220 + v*30 → 220–250
    goldR0: 12,  goldR1: 28,     // 金线 rough  = 12 + (1-v)*28 → 12–40
    baseH0: 20,  baseH1: 0.047,  // 蓝底 height = 20 + lum*0.047 → 20–32
    baseR0: 200, baseR1: 25      // 蓝底 rough  = 200 + (1-lum/255)*25 → 200–225
  };

  /** 3×3（1px）二值掩膜膨胀：让金线棱脊在法线图上过渡平滑。 */
  function dilateMask(m, w, h) {
    var out = new Uint8Array(m.length);
    for (var y = 0; y < h; y++) {
      var y0 = (y > 0 ? y - 1 : 0) * w;
      var y1 = y * w;
      var y2 = (y < h - 1 ? y + 1 : h - 1) * w;
      for (var x = 0; x < w; x++) {
        var x0 = x > 0 ? x - 1 : 0;
        var x2 = x < w - 1 ? x + 1 : w - 1;
        if (m[y0 + x0] | m[y0 + x] | m[y0 + x2] |
            m[y1 + x0] | m[y1 + x] | m[y1 + x2] |
            m[y2 + x0] | m[y2 + x] | m[y2 + x2]) out[y1 + x] = 1;
      }
    }
    return out;
  }

  /* --------------------------------------------------------------------------
   * relief 宏观浮雕模式（碎闪治理，对齐参考站圆雕质感）：
   *   height ＝ 亮度多尺度大半径低通（1/8 分辨率 r6 ≈ 全幅 48px 为主，
   *             1/4 r5 ≈ 20px 为辅）→ 圆雕体块，细线细节不进入高度图；
   *             另加「主体抬升」：亮度软阈二值化 → 全幅小半径（r4）模糊，
   *             棱只出现在主体轮廓（宽约 12–16px），内部平台平整；
   *   rough  ＝ 材质三档：金属区（低通金域）42 镜面 / 主体 145 半哑光 /
   *             深背景 215 哑光；分档依据全部来自低通场，档间天然平滑，
   *             禁止逐像素；
   *   normal ＝ 由平滑 height 照旧 Sobel 派生（NORMAL_STRENGTH 不变）。
   * ------------------------------------------------------------------------ */
  var FULLART_RELIEF = {
    dsBig: 8, rBig: 6,        // 超大低通：1/8 分辨率 + 半径6（≈全幅 48px）
    dsMid: 4, rMid: 5,        // 中低通：1/4 + 半径5（≈全幅 20px）
    wBig: 0.65,               // 宏观体块权重（超大为主，中为辅）
    hBase: 24,                // 背景下沉基准
    hMacro: 0.70,             // 宏观体块幅度（圆雕穹面）
    hSubj: 70,                // 主体整体抬升幅度
    dsTex: 2, rTex: 4,        // 低频起伏场：1/2 分辨率 + 半径4（≈全幅 8px，波长 ~16px）
    hTex: 0.30,               // 低频起伏幅度：让 8bit 高度在内部保有连续梯度
                              // （法线倾角仅 1–2°，肉眼不可见、不构成碎闪，
                              //  但对齐参考站 height 梯度 p50≈1.6–2.1 的连续感）
    hCap: 160,                // 画芯高度上限：叠加层 hVal ≥180，恒压在画芯之上
    subjQ: 0.55,              // 主体软阈：宏观场分位（约 45% 面积被抬升）
    subjBand: 8,              // 软阈半带宽（先窄带 sigmoid 再小半径模糊定棱宽）
    dsSubj: 1, rSubj: 4,      // 主体掩膜模糊：全幅 r4 两轮（棱宽 ≈12–16px）
    bgQ0: 0.25, bgQ1: 0.55,   // 深背景判定：宏观场分位区间
    rMetal: 42,               // 金属档（镜面）
    rMid: 145,                // 主体档（半哑光）
    rBg: 215,                 // 背景档（哑光）
    metalS0: 0.22, metalS1: 0.55  // 金属软阈（作用于低通金域 0–1）
  };

  /** 平滑阶跃（smoothstep）：x 在 [a,b] 上 0→1 平滑过渡。 */
  function sstep(x, a, b) {
    if (b <= a) return x < a ? 0 : 1;
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /** 水平 / 垂直分离盒式模糊（滑窗 O(n)，作用于 Float32Array）。 */
  function boxBlurH(src, dst, w, h, r) {
    var k = 2 * r + 1;
    for (var y = 0; y < h; y++) {
      var row = y * w, acc = 0, x;
      for (x = -r; x <= r; x++) acc += src[row + clamp(x, 0, w - 1)];
      for (x = 0; x < w; x++) {
        dst[row + x] = acc / k;
        acc += src[row + clamp(x + r + 1, 0, w - 1)] - src[row + clamp(x - r, 0, w - 1)];
      }
    }
  }
  function boxBlurV(src, dst, w, h, r) {
    var k = 2 * r + 1;
    for (var x = 0; x < w; x++) {
      var acc = 0, y;
      for (y = -r; y <= r; y++) acc += src[clamp(y, 0, h - 1) * w + x];
      for (y = 0; y < h; y++) {
        dst[y * w + x] = acc / k;
        acc += src[clamp(y + r + 1, 0, h - 1) * w + x] - src[clamp(y - r, 0, h - 1) * w + x];
      }
    }
  }

  /**
   * 大半径低通场：块平均降采样（1/ds）→ 两轮分离盒式模糊（≈高斯）→
   * 双线性放大回全幅。ds=1 时退化为全幅直接模糊。细线细节在降采样 +
   * 模糊中被彻底抹除，只剩宏观体块。输入输出均为 0–255 灰度。
   */
  function lowpassField(src, w, h, ds, r) {
    var ws = Math.max(2, Math.round(w / ds)), hs = Math.max(2, Math.round(h / ds));
    var small = new Float32Array(ws * hs);
    var cnt = new Float32Array(ws * hs);
    var x, y, sx, sy, p;
    for (y = 0; y < h; y++) {
      sy = (y * hs / h) | 0;
      for (x = 0; x < w; x++) {
        sx = (x * ws / w) | 0;
        p = sy * ws + sx;
        small[p] += src[y * w + x];
        cnt[p] += 1;
      }
    }
    for (p = 0; p < small.length; p++) small[p] /= cnt[p];
    var tmp = new Float32Array(ws * hs);
    boxBlurH(small, tmp, ws, hs, r); boxBlurV(tmp, small, ws, hs, r);
    boxBlurH(small, tmp, ws, hs, r); boxBlurV(tmp, small, ws, hs, r);
    var out = new Float32Array(w * h);
    for (y = 0; y < h; y++) {
      var fy = clamp((y + 0.5) * hs / h - 0.5, 0, hs - 1);
      var y0 = fy | 0, y1 = y0 < hs - 1 ? y0 + 1 : y0, ty = fy - y0;
      for (x = 0; x < w; x++) {
        var fx = clamp((x + 0.5) * ws / w - 0.5, 0, ws - 1);
        var x0 = fx | 0, x1 = x0 < ws - 1 ? x0 + 1 : x0, tx = fx - x0;
        var a = small[y0 * ws + x0], b = small[y0 * ws + x1];
        var c = small[y1 * ws + x0], d = small[y1 * ws + x1];
        out[y * w + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
      }
    }
    return out;
  }

  /** 灰度场分位值（256 桶直方图）：返回使 q 比例像素 ≤ 它的场值。 */
  function percentileOf(field, q) {
    var hist = new Int32Array(256), n = field.length, i, v;
    for (i = 0; i < n; i++) {
      v = field[i] | 0;
      hist[v < 0 ? 0 : (v > 255 ? 255 : v)]++;
    }
    var target = q * n, acc = 0;
    for (i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= target) return i;
    }
    return 255;
  }

  /**
   * relief 派生：由已统计好的 vA / lumA / wideMask 生成宏观 height 与
   * 分档 rough，写入 hImg / rImg 像素（调用方负责 putImageData）。
   */
  function deriveReliefMaps(lumA, wideMask, hd, rd, skipHeight) {
    var REL = FULLART_RELIEF;
    var n = W * H, p, i;
    /* 半径常量按 664 逻辑坐标定义，物理 2× 后随 SC 缩放（视觉尺度不变） */
    var rB = Math.max(1, Math.round(REL.rBig * SC));
    var rM = Math.max(1, Math.round(REL.rMid * SC));
    var rT = Math.max(1, Math.round(REL.rTex * SC));
    var rS = Math.max(1, Math.round(REL.rSubj * SC));
    var metalSrc = new Uint8Array(n);
    for (p = 0; p < n; p++) metalSrc[p] = wideMask[p] ? 255 : 0;

    var macroB = lowpassField(lumA, W, H, REL.dsBig, rB);            // 超大尺度
    var macroM = lowpassField(lumA, W, H, REL.dsMid, rM);            // 中尺度
    var metalF = lowpassField(metalSrc, W, H, REL.dsBig, rB);        // 低通金域
    var texF = lowpassField(lumA, W, H, REL.dsTex, rT);              // 低频起伏

    /* 主体掩膜：中尺度场窄带 sigmoid（近二值）→ 全幅 r4 模糊 →
     * 内部平台平整、轮廓棱宽 ≈12–16px（棱即参考站的「物体轮廓棱」）。 */
    var sT = percentileOf(macroM, REL.subjQ);
    var subjSrc = new Uint8Array(n);
    for (p = 0; p < n; p++) {
      subjSrc[p] = sstep(macroM[p], sT - REL.subjBand, sT + REL.subjBand) * 255;
    }
    var subjF = lowpassField(subjSrc, W, H, REL.dsSubj, rS);

    /* 深背景判定：超大尺度场分位软阈（按图自适应，跨图风格稳健）。 */
    var b0 = percentileOf(macroB, REL.bgQ0), b1 = percentileOf(macroB, REL.bgQ1);

    var macro, subj, metal, bg, hv, rv;
    for (p = 0, i = 0; p < n; p++, i += 4) {
      macro = REL.wBig * macroB[p] + (1 - REL.wBig) * macroM[p];
      subj = subjF[p] / 255;
      metal = sstep(metalF[p] / 255, REL.metalS0, REL.metalS1);
      bg = 1 - sstep(macroB[p], b0, Math.max(b1, b0 + 6));

      hv = REL.hBase + macro * REL.hMacro + texF[p] * REL.hTex + subj * REL.hSubj;
      hv = clamp(hv, 0, REL.hCap);                                  // 画芯让位叠加层
      rv = REL.rMid - (REL.rMid - REL.rMetal) * metal + (REL.rBg - REL.rMid) * bg;
      rv = clamp(rv, 20, 230);

      if (!skipHeight) { hd[i] = hd[i + 1] = hd[i + 2] = hv; hd[i + 3] = 255; }
      rd[i] = rd[i + 1] = rd[i + 2] = rv; rd[i + 3] = 255;
    }
  }

  /* --------------------------------------------------------------------------
   * v5.2 烫金刻线层（relief 模式追加，paintGoldLines）：
   *   大尺度 DoG（三轮盒式 ≈ σ2.45 / σ7.48）提取主轮廓 → 头部椭圆禁区 →
   *   闭运算 r3 并合 ≤6px 平行双线（修 DoG 在亮描边两侧各出一峰的「线特征」
   *   成簇划痕）→ 滞回阈值 + 连通域碎斑剔除（minComp 450）→ Zhang-Suen
   *   骨架化出 1px 线种（按骨架点 DoG 响应分级）→ Kasa 最小二乘圆拟合月环
   *   （四项验证超差弃环；环带被人物中调遮挡处局部擦除，人物在前环让位）→
   *   Chamfer 3-4 距离场把线种扩散成平滑脊（高斯截面，脊心高、缘渐隐）→
   *   同步写 diffuse（錾刻金：古金同色系 #6B4C1A / #D9B968，对齐边框金，
   *   消除 v5.1 荧光黄绿）/ height（分级脊峰，max 叠加不压叠加层）/
   *   rough（金属低粗糙，对齐边框金 r24）。
   *   叠加顺序：在 relief 高度模糊平滑「之后」落脊，脊线不被抹掉；
   *   颗粒噪声照旧只落 diffuse（mask）；normal 仍由最终 height Sobel 派生。
   * ------------------------------------------------------------------------ */
  var FULLART_GOLDLINE_V52 = {
    dogR1: 2, dogR2: 7,        // DoG 盒半径（w=5/15 三轮 ≈ σ2.45/7.48，物理 px；大尺度压碎纹理）
    tHigh: 30, tLow: 15,       // 滞回阈值（DoG 响应，0–255 亮度域）
    minComp: 450,              // 连通域最小像素：碎斑剔除（宁少勿碎）
    mergeR: 3,                 // 闭运算半径：并合 ≤6px 平行双线（亮描边双侧峰）
    skipZones: [               // 弱线禁区（逻辑 px 椭圆，区内置零 weak/strong，在闭运算前）
      { x: 335, y: 250, rx: 135, ry: 110 },  // 头部：兜帽/双耳/发丝/箭袋（v7 全身构图）
      { x: 105, y: 505, rx: 70,  ry: 110 },  // v7 女妖幽灵·左（半透明 apparition，不应有烫金线）
      { x: 525, y: 570, rx: 80,  ry: 175 },  // v7 女妖幽灵·右（含下垂纱摆，与栅栏区交叠）
      { x: 530, y: 380, rx: 125, ry: 170 },  // 残破教堂：山墙/十字架/玫瑰窗/塌拱（场景细节不描金）
      { x: 520, y: 615, rx: 110, ry: 80 },   // 铸铁栅栏（弓右梢 y535-580 段损失可接受）
      { x: 640, y: 520, rx: 45,  ry: 120 },  // 右侧十字架墓碑+高石板
      { x: 600, y: 840, rx: 80,  ry: 170 },  // 右下石板群+破灯笼+暖光+杂草
      { x: 35,  y: 460, rx: 55,  ry: 120 },  // 左侧十字架墓碑群（左幽灵身后）
      { x: 150, y: 420, rx: 45,  ry: 60 },   // 中央远景尖塔群（剪影描金；收窄下移到 y360+ 避让月亮左下缘拟合点）
      { x: 60,  y: 890, rx: 85,  ry: 150 },  // 左下墓碑群
      { x: 330, y: 985, rx: 200, ry: 75 },   // 底部中央杂草（上延至 y910；披风金绣为脊线类不受禁区影响）
      { x: 635, y: 55,  rx: 55,  ry: 75 },   // 右上枯枝框景
      { x: 30,  y: 40,  rx: 55,  ry: 60 },   // 左上枯枝框景
      { x: 200, y: 255, rx: 45,  ry: 55 },   // 月亮左下云边碎金段
      { x: 490, y: 180, rx: 45,  ry: 55 },   // 月亮右上云边碎金段
      { x: 100, y: 700, rx: 75,  ry: 90 },   // 左下冷绿幽光雾
      { x: 505, y: 745, rx: 60,  ry: 75 }    // 塌陷斜置石板（与披风右褴褛边少量交叠，可接受）
    ],
    hMain: 225, hFine: 192,    // 脊峰分级（画芯 ≤160 / 边框金 235 之间）
    ridgeMain: 2.6, ridgeFine: 1.4,  // 脊半径（物理 px）→ 线宽 ≈4–5 / 2–2.5px
    rGold: 26,                 // 脊心金属粗糙（对齐边框金 rVal 24）
    goldDark: [107, 76, 26],   // 錾刻暗金 #6B4C1A（古金同色系）
    goldLite: [217, 185, 104], // 脊心亮金 #D9B968（＝边框金，消除荧光黄绿）
    alphaMax: 0.9,
    moonLum: 165,              // 月亮检测：低通场亮度阈
    moonHint: null,            // 引导式月环检测（逻辑坐标 {x,y,r}）：柔光/晕染月缘
                               // DoG 骨架几乎无点、RANSAC 失效时使用；null＝原 RANSAC
    moonHintGradMin: 12,       // 引导检测径向梯度证据阈（σ7.48 低通场，四邻域差分和）
    moonMaxY: 0.5,             // 月亮搜索区（卡面上部 50%）
    moonPad: 1,                // 金环外扩（逻辑 px，拟合真月缘后只需微扩）
    moonRing: true,            // 程序月环开关（false 时只留 DoG 月缘线兜底）
    moonFitTol: 8,             // Kasa 精化 RMS 径向残差上限（物理 px）
    moonMinArc: 250,           // RANSAC 内点弧长绝对下限（物理 px）
    moonMinArcFrac: 0.15,      // RANSAC 内点弧长占圆周比下限
    ringMidLo: 70, ringMidHi: 150,  // 环带遮挡判定：中调亮度带（人物在前）
    ringMidFrac: 0.22,         // 11×11 邻域中调占比 > 此值 → 擦除该环种子
    decoH: 205, decoRidge: 1.7 // 程序装饰线（月亮环 / 内框双线）统一中档
  };

  /** 三轮盒式模糊 ≈ 高斯（σ=√(3((2r+1)²−1)/12)），返回 Float32 灰度场。 */
  function box3(src, w, h, r) {
    var a = Float32Array.from(src);
    var b = new Float32Array(src.length);
    for (var k = 0; k < 3; k++) {
      boxBlurH(a, b, w, h, r);
      boxBlurV(b, a, w, h, r);
    }
    return a;
  }

  /**
   * 月亮检测（v5.2 RANSAC 圆拟合）：在搜索区骨架点（skel 已过头部禁区 /
   * 闭运算 / 碎斑剔除 / 骨架化，剩下的都是真实边缘 1px 线）中随机采样
   * 三点定圆，取 ±2.5px 内点最多者，再对内点做 Kasa 最小二乘精化一轮。
   * 月亮缘弧是搜索区唯一的长圆弧（人物 / 云 / 披风边缘都是短弧或折线，
   * 凑不出大圆内点）。验证半径区间 / 内点弧长（绝对 px 与占圆周比双阈）/
   * RMS / 圆心位置，超差返回 null（弃程序环，DoG 月缘线兜底）。
   * 返回内点角域 [a0,a1]（最大缺口的补集 ±7°）：程序环只画「有真实月缘
   * 证据」的弧段，不悬空横穿披风 / 夜空。
   */
  function detectMoon(gLow, skel) {
    var GL = FULLART_GOLDLINE_V52;
    var yMax = Math.floor(H * GL.moonMaxY);
    var pts = [], x, y, p;
    for (y = 1; y < yMax; y++) {
      for (x = 1; x < W - 1; x++) {
        p = y * W + x;
        if (skel[p]) pts.push(x, y);
      }
    }
    var np = pts.length / 2;
    if (np < 120) return null;

    /* RANSAC：三点定圆（外接圆公式），平方距离带免开方统计内点 */
    var rng = 987654321;                               // 确定性伪随机，结果可复现
    function rnd() { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; }
    var best = null, bestN = 0, t, i;
    for (t = 0; t < 600; t++) {
      var a = (rnd() * np) | 0, b = (rnd() * np) | 0, c = (rnd() * np) | 0;
      if (a === b || b === c || a === c) continue;
      var ax = pts[a * 2], ay = pts[a * 2 + 1];
      var bx = pts[b * 2], by = pts[b * 2 + 1];
      var cx = pts[c * 2], cy = pts[c * 2 + 1];
      var det = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      if (Math.abs(det) < 1e-6) continue;
      var a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
      var ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / det;
      var uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / det;
      var rr = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));
      if (rr < 60 || rr > 420) continue;
      var lo = (rr - 2.5) * (rr - 2.5), hi = (rr + 2.5) * (rr + 2.5), cnt = 0;
      for (i = 0; i < np; i++) {
        var tdx = pts[i * 2] - ux, tdy = pts[i * 2 + 1] - uy;
        var td2 = tdx * tdx + tdy * tdy;
        if (td2 >= lo && td2 <= hi) cnt++;
      }
      if (cnt > bestN) { bestN = cnt; best = { x: ux, y: uy, r: rr }; }
    }
    if (!best) return null;
    if (bestN < Math.max(GL.moonMinArc, GL.moonMinArcFrac * 2 * Math.PI * best.r)) return null;

    /* Kasa 精化：±3px 内点最小二乘 x²+y²+Dx+Ey+F=0（3×3 高斯消元） */
    var sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, sxz = 0, syz = 0, sz = 0, m = 0;
    var inX = [], inY = [];
    for (i = 0; i < np; i++) {
      var px = pts[i * 2], py = pts[i * 2 + 1];
      var pdx = px - best.x, pdy = py - best.y;
      if (Math.abs(Math.sqrt(pdx * pdx + pdy * pdy) - best.r) > 3) continue;
      var z = px * px + py * py;
      sxx += px * px; sxy += px * py; sx += px;
      syy += py * py; sy += py;
      sxz += px * z; syz += py * z; sz += z;
      inX.push(px); inY.push(py); m++;
    }
    if (m < 40) return null;
    var A = [[sxx, sxy, sx, -sxz], [sxy, syy, sy, -syz], [sx, sy, m, -sz]];
    var col, row, piv, f, tmp;
    for (col = 0; col < 3; col++) {
      piv = col;
      for (row = col + 1; row < 3; row++) if (Math.abs(A[row][col]) > Math.abs(A[piv][col])) piv = row;
      if (Math.abs(A[piv][col]) < 1e-9) return null;
      tmp = A[col]; A[col] = A[piv]; A[piv] = tmp;
      for (row = col + 1; row < 3; row++) {
        f = A[row][col] / A[col][col];
        for (var k = col; k < 4; k++) A[row][k] -= f * A[col][k];
      }
    }
    var F = A[2][3] / A[2][2];
    var E = (A[1][3] - A[1][2] * F) / A[1][1];
    var D = (A[0][3] - A[0][1] * E - A[0][2] * F) / A[0][0];
    var fx = -D / 2, fy = -E / 2;
    var r2 = (D * D + E * E) / 4 - F;
    if (!(r2 > 0)) return null;
    var fr = Math.sqrt(r2);
    if (fr < 60 || fr > 420) return null;              // 半径合理区间（物理 px）
    if (fx < -fr * 0.6 || fx > W + fr * 0.6 || fy < -fr * 0.6 || fy > yMax + fr * 0.6) return null;

    /* 最终内点 ±3px：RMS 校验 + 角域（排序找最大缺口，弧 = 缺口补集） */
    var se2 = 0, fn = 0, angles = [];
    for (i = 0; i < m; i++) {
      var ddx = inX[i] - fx, ddy = inY[i] - fy;
      var drr = Math.abs(Math.sqrt(ddx * ddx + ddy * ddy) - fr);
      if (drr > 3) continue;
      se2 += drr * drr; fn++;
      angles.push(Math.atan2(ddy, ddx));
    }
    if (fn < Math.max(GL.moonMinArc, GL.moonMinArcFrac * 2 * Math.PI * fr)) return null;
    var rms = Math.sqrt(se2 / fn);
    if (rms > GL.moonFitTol) return null;
    angles.sort(function (u, v) { return u - v; });
    var gapMax = -1, gapAt = 0;
    for (i = 0; i < angles.length; i++) {
      var nxtA = (i + 1 < angles.length) ? angles[i + 1] : angles[0] + Math.PI * 2;
      var gap = nxtA - angles[i];
      if (gap > gapMax) { gapMax = gap; gapAt = i; }
    }
    var a0 = angles[(gapAt + 1) % angles.length] - 0.12;   // 弧起点（缺口终点外延 ~7°）
    var a1 = angles[gapAt] + 0.12;                         // 弧终点（缺口始点外延 ~7°）
    if (a1 <= a0) a1 += Math.PI * 2;
    return { x: fx, y: fy, r: fr, a0: a0, a1: a1, rms: rms, arc: fn };
  }

  /**
   * 引导式月环（GL.moonHint，逻辑坐标 {x,y,r}）：
   * 工笔/晕染风格的月缘是柔光过渡，DoG 滞回阈值内几乎不留骨架点
   * （李白 v3 实测：月缘 DoG 响应 p50=2.8，仅 14% ≥tLow），RANSAC 无米下锅；
   * 柔光缘的梯度证据点自身离散（径向残差 p50≈10px，月表纹理/内外光晕
   * 多峰竞争），残缺弧上圆拟合病态（Kasa 实测拟合 r 漂到 203/真值 ~280）。
   * 故 hint 即环几何——与 skipZones 同为逐卡目检配置，100% 放大 QC 验收
   * 贴缘；σ7.48 低通场径向梯度只做「证据弧门控」：逐 1° 在 [0.7r,1.35r]
   * 环带取最大梯度，≥ moonHintGradMin 的角度记为有真实月缘证据，只画
   * 证据弧（最大缺口补集 ±7°），人物遮挡 / 柔光无证据弧段让位。
   * 证据角不足 moonMinArcFrac×360° 判失败返回 null（回退 RANSAC / DoG 兜底）。
   */
  function detectMoonGuided(gLow, hint, GL) {
    var cx = hint.x * SCX, cy = hint.y * SCY, r0 = hint.r * SCX;
    var gradMin = GL.moonHintGradMin || 12;
    var angles = [], deg, a, dx, dy, rr, x, y, p, g, bg;
    for (deg = 0; deg < 360; deg++) {
      a = deg * Math.PI / 180; dx = Math.cos(a); dy = Math.sin(a);
      bg = 0;
      for (rr = r0 * 0.7; rr <= r0 * 1.35; rr += 1) {
        x = Math.round(cx + dx * rr); y = Math.round(cy + dy * rr);
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        p = y * W + x;
        g = Math.abs(gLow[p + 1] - gLow[p - 1]) + Math.abs(gLow[p + W] - gLow[p - W]);
        if (g > bg) bg = g;
      }
      if (bg >= gradMin) angles.push(a);
    }
    if (angles.length < Math.max(40, GL.moonMinArcFrac * 360)) return null;
    var gapMax = -1, gapAt = 0, i, nxtA, gap;
    for (i = 0; i < angles.length; i++) {
      nxtA = (i + 1 < angles.length) ? angles[i + 1] : angles[0] + Math.PI * 2;
      gap = nxtA - angles[i];
      if (gap > gapMax) { gapMax = gap; gapAt = i; }
    }
    var a0 = angles[(gapAt + 1) % angles.length] - 0.12;
    var a1 = angles[gapAt] + 0.12;
    if (a1 <= a0) a1 += Math.PI * 2;
    return { x: cx, y: cy, r: r0, a0: a0, a1: a1, rms: 0, arc: angles.length };
  }

  /**
   * 程序装饰线画布（v5.2 双色分流）：内框双线画成 #808080（灰档，直接收）、
   * 月亮金环画成 #ffffff（白档，调用方按中调遮挡判定后取舍）。
   */
  function paintDecoLines(moon, GL) {
    GL = GL || FULLART_GOLDLINE_V52;
    var c = mkCanvas(W, H);
    var x = c.getContext('2d');
    x.scale(SCX, SCY);                               // 逻辑坐标作画
    if (GL.decoInnerFrame !== false) {               // 国风主题下关闭（新外框自带细线承接）
      x.strokeStyle = '#808080';                     // 内框双线（灰档）
      x.lineWidth = 0.9;
      [46, 54].forEach(function (inset) {
        x.beginPath();
        pathRoundRect(x, inset, inset, LW - inset * 2, LH - inset * 2, 8);
        x.stroke();
      });
    }
    if (moon) {
      x.strokeStyle = '#ffffff';                     // 月环（白档）
      x.lineWidth = 1;
      x.beginPath();
      if (typeof moon.a0 === 'number') {
        x.arc(moon.x / SCX, moon.y / SCY, moon.r / SCX + GL.moonPad, moon.a0, moon.a1);  // 只画有月缘证据的弧段
      } else {
        x.arc(moon.x / SCX, moon.y / SCY, moon.r / SCX + GL.moonPad, 0, Math.PI * 2);
      }
      x.stroke();
    }
    return c;
  }

  /** 3×3 迭代形态学：dilate=true 膨胀 r 轮，false 腐蚀 r 轮（图外按 0）。 */
  function morphMask(m, w, h, r, dilate) {
    if (r <= 0) return m.slice();
    var cur = m, nxt = new Uint8Array(m.length), x, y, dx, dy, p;
    for (var it = 0; it < r; it++) {
      nxt.fill(0);
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          p = y * w + x;
          if (dilate) {
            if (cur[p]) { nxt[p] = 1; continue; }
            var hit = 0;
            for (dy = -1; dy <= 1 && !hit; dy++) {
              var ny = y + dy;
              if (ny < 0 || ny >= h) continue;
              for (dx = -1; dx <= 1; dx++) {
                var nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                if (cur[ny * w + nx]) { hit = 1; break; }
              }
            }
            nxt[p] = hit;
          } else {
            if (!cur[p]) continue;
            var keep = 1;
            for (dy = -1; dy <= 1 && keep; dy++) {
              var ny2 = y + dy;
              if (ny2 < 0 || ny2 >= h) { keep = 0; break; }   // 图外按 0
              for (dx = -1; dx <= 1; dx++) {
                var nx2 = x + dx;
                if (nx2 < 0 || nx2 >= w) { keep = 0; break; }
                if (!cur[ny2 * w + nx2]) { keep = 0; break; }
              }
            }
            nxt[p] = keep;
          }
        }
      }
      var swap = cur; cur = nxt; nxt = swap;
    }
    return cur;
  }

  /**
   * Zhang-Suen 骨架化：二值掩膜 → 1px 骨架。双子迭代（kill 标记后统一删除）：
   * B=非零邻居数 ∈[2,6]，A=P2..P9,P2 环序 0→1 跳变计数 ===1；
   * 子迭代 1 删 P2·P4·P6=0 且 P4·P6·P8=0，子迭代 2 删 P2·P4·P8=0 且
   * P2·P6·P8=0。只在掩膜包围盒内扫描，iter 上限 60。原地修改并返回。
   */
  function skeletonize(m, w, h) {
    var x0 = w, y0 = h, x1 = -1, y1 = -1, p, x, y;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        p = y * w + x;
        if (m[p]) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return m;
    if (x0 > 1) x0--; if (y0 > 1) y0--;
    if (x1 < w - 2) x1++; if (y1 < h - 2) y1++;
    var kill = new Int32Array((x1 - x0 + 1) * (y1 - y0 + 1));
    for (var iter = 0; iter < 60; iter++) {
      var changed = 0;
      for (var sub = 0; sub < 2; sub++) {
        var nk = 0;
        for (y = y0; y <= y1; y++) {
          for (x = x0; x <= x1; x++) {
            p = y * w + x;
            if (!m[p]) continue;
            var p2 = m[p - w], p3 = m[p - w + 1], p4 = m[p + 1], p5 = m[p + w + 1],
                p6 = m[p + w], p7 = m[p + w - 1], p8 = m[p - 1], p9 = m[p - w - 1];
            var B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (B < 2 || B > 6) continue;
            var A = ((p2 === 0 && p3 === 1) ? 1 : 0) + ((p3 === 0 && p4 === 1) ? 1 : 0) +
                    ((p4 === 0 && p5 === 1) ? 1 : 0) + ((p5 === 0 && p6 === 1) ? 1 : 0) +
                    ((p6 === 0 && p7 === 1) ? 1 : 0) + ((p7 === 0 && p8 === 1) ? 1 : 0) +
                    ((p8 === 0 && p9 === 1) ? 1 : 0) + ((p9 === 0 && p2 === 1) ? 1 : 0);
            if (A !== 1) continue;
            if (sub === 0) {
              if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue;
            } else {
              if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
            }
            kill[nk++] = p;
          }
        }
        if (!nk) continue;
        changed = 1;
        for (var k = 0; k < nk; k++) m[kill[k]] = 0;
      }
      if (!changed) break;
    }
    return m;
  }

  /**
   * 烫金刻线层主函数：从画芯亮度场提取主轮廓线并与程序装饰线合并，
   * 以平滑金脊同步写入 diffuse / height / rough。返回调参统计。
   */
  function paintGoldLines(P, lumA, overrides) {
    var GL = Object.assign({}, FULLART_GOLDLINE_V52, overrides || {});
    var n = W * H, p, i, x, y;
    var t0 = (typeof performance !== 'undefined' ? performance.now() : 0);

    /* 1) DoG 带通：σ2.45 − σ7.48 → 主轮廓响应，细碎纹理天然衰减（记录响应场） */
    var g1 = box3(lumA, W, H, GL.dogR1);
    var g2 = box3(lumA, W, H, GL.dogR2);
    var strong = new Uint8Array(n), weak = new Uint8Array(n);
    var resp = new Float32Array(n);
    for (p = 0; p < n; p++) {
      var rv = g1[p] - g2[p];
      if (rv < 0) rv = -rv;
      resp[p] = rv;
      if (rv >= GL.tHigh) { strong[p] = 1; weak[p] = 1; }
      else if (rv >= GL.tLow) { weak[p] = 1; }
    }

    /* 1b) 弱线禁区（逻辑坐标椭圆 → 物理）：头部（兜帽/双耳/发丝/箭袋）与
     *     v6 女妖幽灵的亮描边是「线特征」，DoG 双侧成峰难干净并合，且幽灵
     *     是半透明远景不该有烫金线——整区弃线（本体仍有 relief 立体感）。 */
    var zones = GL.skipZones || (GL.skipEllipse ? [GL.skipEllipse] : null);
    if (zones) {
      for (var zi = 0; zi < zones.length; zi++) {
        var se = zones[zi];
        var ecx = se.x * SCX, ecy = se.y * SCY, erx = se.rx * SCX, ery = se.ry * SCY;
        var ey0 = Math.max(0, Math.floor(ecy - ery)), ey1 = Math.min(H - 1, Math.ceil(ecy + ery));
        var ex0 = Math.max(0, Math.floor(ecx - erx)), ex1 = Math.min(W - 1, Math.ceil(ecx + erx));
        for (y = ey0; y <= ey1; y++) {
          for (x = ex0; x <= ex1; x++) {
            var exn = (x - ecx) / erx, eyn = (y - ecy) / ery;
            if (exn * exn + eyn * eyn > 1) continue;
            p = y * W + x;
            strong[p] = 0; weak[p] = 0;
          }
        }
      }
    }

    /* 1c) 闭运算 r3（膨 3 + 腐 3）：把 ≤6px 平行双线并成单线 */
    weak = morphMask(weak, W, H, GL.mergeR, true);
    weak = morphMask(weak, W, H, GL.mergeR, false);

    /* 2) 滞回生长：8 连通域标记，只留「含强核且 ≥minComp」的域（宁少勿碎） */
    var labels = new Int32Array(n).fill(-1);
    var stack = new Int32Array(n);
    var comps = [];                                // size<<1 | hasStrong
    for (p = 0; p < n; p++) {
      if (!weak[p] || labels[p] >= 0) continue;
      var label = comps.length, sp = 0, size = 0, hasStrong = 0;
      stack[sp++] = p; labels[p] = label;
      while (sp > 0) {
        var q = stack[--sp]; size++;
        if (strong[q]) hasStrong = 1;
        var qx = q % W, qy = (q / W) | 0, dx, dy, nq;
        for (dy = -1; dy <= 1; dy++) {
          var ny = qy + dy;
          if (ny < 0 || ny >= H) continue;
          for (dx = -1; dx <= 1; dx++) {
            var nx = qx + dx;
            if (nx < 0 || nx >= W || (dx === 0 && dy === 0)) continue;
            nq = ny * W + nx;
            if (weak[nq] && labels[nq] < 0) { labels[nq] = label; stack[sp++] = nq; }
          }
        }
      }
      comps.push((size << 1) | hasStrong);
    }
    var compOk = new Uint8Array(comps.length), keepComps = 0;
    for (i = 0; i < comps.length; i++) {
      if ((comps[i] & 1) && (comps[i] >> 1) >= GL.minComp) { compOk[i] = 1; keepComps++; }
    }

    /* 2b) 保留域 → Zhang-Suen 骨架化出 1px 线种（修双线 / 阈值带宽线） */
    var kept = new Uint8Array(n);
    for (p = 0; p < n; p++) {
      var lb = labels[p];
      if (lb >= 0 && compOk[lb]) kept[p] = 1;
    }
    skeletonize(kept, W, H);

    /* 3) 距离场初始化：骨架种子按 DoG 响应分级 + 程序装饰线种子。
     *    月环像素（含抗锯齿缘，按环带几何距离判定）逐点做遮挡判定：
     *    11×11 邻域中调（lumA 70–150）占比 > ringMidFrac → 人物在前，环让位；
     *    内框双线（灰档，远离环带）直接收。 */
    var moon = null;
    if (GL.moonRing) {
      /* 引导式月环（可选）：柔光月缘 DoG 响应低于滞回阈值、骨架几乎无月缘
         点时（工笔重彩的晕染月缘即如此），RANSAC 无米下锅。moonHint（逻辑
         坐标，逐卡目检配置，同 skipZones）即环几何，低通场径向梯度只做
         证据弧门控：只画「有真实月缘证据」的弧段；无 hint 或证据不足时
         回退原 RANSAC。 */
      if (GL.moonHint) moon = detectMoonGuided(g2, GL.moonHint, GL);
      if (!moon) moon = detectMoon(g2, kept);
    }
    var deco = paintDecoLines(moon, GL);
    var dd = deco.getContext('2d').getImageData(0, 0, W, H).data;
    var dN = new Uint8Array(n).fill(63);           // d×3，上限 21px
    var seedAmp = new Float32Array(n), seedR = new Float32Array(n);
    var keepSeeds = 0;
    var rr = moon ? moon.r + GL.moonPad * SCX : -1;  // 环带半径（物理 px）
    for (p = 0; p < n; p++) {
      if (kept[p]) {
        dN[p] = 0; keepSeeds++;
        if (resp[p] >= GL.tHigh) { seedAmp[p] = GL.hMain; seedR[p] = GL.ridgeMain; }
        else { seedAmp[p] = GL.hFine; seedR[p] = GL.ridgeFine; }
      }
      var dv = dd[p * 4];
      if (dv > 100) {
        if (moon) {
          x = p % W; y = (p / W) | 0;
          var mdx = x - moon.x, mdy = y - moon.y;
          if (Math.abs(Math.sqrt(mdx * mdx + mdy * mdy) - rr) <= 3.5) {
            var mid = 0, tot = 0;
            for (var oy = -5; oy <= 5; oy++) {
              var yy = y + oy;
              if (yy < 0 || yy >= H) continue;
              for (var ox = -5; ox <= 5; ox++) {
                var xx = x + ox;
                if (xx < 0 || xx >= W) continue;
                tot++;
                var lv = lumA[yy * W + xx];
                if (lv >= GL.ringMidLo && lv <= GL.ringMidHi) mid++;
              }
            }
            if (tot && mid / tot > GL.ringMidFrac) continue;   // 人物在前，环让位
          }
        }
        dN[p] = 0; seedAmp[p] = GL.decoH; seedR[p] = GL.decoRidge; keepSeeds++;
      }
    }
    if (!keepSeeds) return { seeds: 0, comps: 0, moon: moon, ms: 0 };

    /* 4) Chamfer 3-4 距离场两遍扫描，同步传播最近种子的脊参数 */
    for (y = 0; y < H; y++) {                      // 前向（左 / 左上 / 上 / 右上）
      for (x = 0; x < W; x++) {
        p = y * W + x;
        var best = dN[p], src = p;
        if (x > 0) {
          if (dN[p - 1] + 3 < best) { best = dN[p - 1] + 3; src = p - 1; }
          if (y > 0 && dN[p - 1 - W] + 4 < best) { best = dN[p - 1 - W] + 4; src = p - 1 - W; }
        }
        if (y > 0) {
          if (dN[p - W] + 3 < best) { best = dN[p - W] + 3; src = p - W; }
          if (x < W - 1 && dN[p + 1 - W] + 4 < best) { best = dN[p + 1 - W] + 4; src = p + 1 - W; }
        }
        if (src !== p) { dN[p] = best; seedAmp[p] = seedAmp[src]; seedR[p] = seedR[src]; }
      }
    }
    for (y = H - 1; y >= 0; y--) {                 // 后向（右 / 右下 / 下 / 左下）
      for (x = W - 1; x >= 0; x--) {
        p = y * W + x;
        var best2 = dN[p], src2 = p;
        if (x < W - 1) {
          if (dN[p + 1] + 3 < best2) { best2 = dN[p + 1] + 3; src2 = p + 1; }
          if (y < H - 1 && dN[p + 1 + W] + 4 < best2) { best2 = dN[p + 1 + W] + 4; src2 = p + 1 + W; }
        }
        if (y < H - 1) {
          if (dN[p + W] + 3 < best2) { best2 = dN[p + W] + 3; src2 = p + W; }
          if (x > 0 && dN[p - 1 + W] + 4 < best2) { best2 = dN[p - 1 + W] + 4; src2 = p - 1 + W; }
        }
        if (src2 !== p) { dN[p] = best2; seedAmp[p] = seedAmp[src2]; seedR[p] = seedR[src2]; }
      }
    }

    /* 5) 合成：diffuse 錾刻金 / height 平滑脊（max）/ rough 金属低粗糙 */
    var dImg = P.d.getImageData(0, 0, W, H);
    var hImg = P.h.getImageData(0, 0, W, H);
    var rImg = P.r.getImageData(0, 0, W, H);
    var dpx = dImg.data, hpx = hImg.data, rpx = rImg.data;
    var gkd = GL.goldDark, gkl = GL.goldLite;
    for (p = 0, i = 0; p < n; p++, i += 4) {
      var R = seedR[p];
      if (!R) continue;
      var d = dN[p] / 3;
      if (d > R + 0.75) continue;
      var prof = Math.exp(-2.0 * (d / R) * (d / R));   // 高斯截面：脊心 1 → 脊缘 ~0.13
      var ridgeH = seedAmp[p] * prof;
      if (ridgeH > hpx[i]) { hpx[i] = hpx[i + 1] = hpx[i + 2] = ridgeH; }
      var rw = prof * 1.35;
      if (rw > 1) rw = 1;
      var rTarget = GL.rGold + (1 - prof) * 34;
      var rNew = rpx[i] * (1 - rw) + rTarget * rw;
      rpx[i] = rpx[i + 1] = rpx[i + 2] = rNew;
      var a = prof * 1.2;
      if (a > GL.alphaMax) a = GL.alphaMax;
      dpx[i]     = dpx[i]     * (1 - a) + (gkd[0] + (gkl[0] - gkd[0]) * prof) * a;
      dpx[i + 1] = dpx[i + 1] * (1 - a) + (gkd[1] + (gkl[1] - gkd[1]) * prof) * a;
      dpx[i + 2] = dpx[i + 2] * (1 - a) + (gkd[2] + (gkl[2] - gkd[2]) * prof) * a;
    }
    P.d.putImageData(dImg, 0, 0);
    P.h.putImageData(hImg, 0, 0);
    P.r.putImageData(rImg, 0, 0);
    var t1 = (typeof performance !== 'undefined' ? performance.now() : 0);
    return { seeds: keepSeeds, comps: keepComps, moon: moon, ms: Math.round(t1 - t0) };
  }

  /**
   * 外部高度图（AI 浮雕深度）：与 diffuse 完全相同的 cover 变换画入临时
   * 画布，灰度整体缩放到 ≤FULLART_RELIEF.hCap（画芯高度域，给叠加层让位），
   * 整体替换画芯高度。叠加层随后照旧精确覆写其上。
   */
  function paintExternalHeight(P, img) {
    var c = mkCanvas(W, H);
    drawFullArtCover(c.getContext('2d'), img, W, H);
    var src = c.getContext('2d').getImageData(0, 0, W, H).data;
    var hImg = P.h.createImageData(W, H);
    var hd = hImg.data, n = W * H, cap = FULLART_RELIEF.hCap;
    for (var p = 0, i = 0; p < n; p++, i += 4) {
      var lum = (src[i] * 299 + src[i + 1] * 587 + src[i + 2] * 114) / 1000;
      var hv = lum * cap / 255;                            // 0–255 → 0–160
      hd[i] = hd[i + 1] = hd[i + 2] = hv; hd[i + 3] = 255;
    }
    P.h.putImageData(hImg, 0, 0);
  }

  /**
   * AI 高度融合（v5.1，externalMaps.fuseHeight）：relief 宏观分级 ×0.6
   * （保住「背景下沉 / 主体平台」的分级纪律）+ AI 全局层次 ×0.4（≤hCap 域）
   * + AI 中高频细节（自身低通差分：褶皱 / 铠甲肌理）×0.5，clamp 到画芯
   * 高度域。烫金脊随后照旧最后叠加（paintGoldLines）。
   */
  function fuseExternalHeight(P, img) {
    var c = mkCanvas(W, H);
    drawFullArtCover(c.getContext('2d'), img, W, H);
    var src = c.getContext('2d').getImageData(0, 0, W, H).data;
    var n = W * H, cap = FULLART_RELIEF.hCap, p, i;
    var ai = new Float32Array(n);
    for (p = 0, i = 0; p < n; p++, i += 4) {
      ai[p] = (src[i] * 299 + src[i + 1] * 587 + src[i + 2] * 114) / 1000;
    }
    var rM = Math.max(1, Math.round(FULLART_RELIEF.rMid * SC));
    var aiLP = lowpassField(ai, W, H, FULLART_RELIEF.dsMid, rM);
    var hImg = P.h.getImageData(0, 0, W, H);         // relief 高度基底（未跳过）
    var hd = hImg.data;
    for (p = 0, i = 0; p < n; p++, i += 4) {
      var hv = hd[i] * 0.6 + (ai[p] / 255) * cap * 0.4 + (ai[p] - aiLP[p]) * 0.5;
      hv = clamp(hv, 0, cap);
      hd[i] = hd[i + 1] = hd[i + 2] = hv;
    }
    P.h.putImageData(hImg, 0, 0);
  }

  /**
   * 外部法线合成：画芯用 AI 法线（已按统一 cover 变换对齐），叠加层区域
   * （height≥170，1px 膨胀含抗锯齿沿）改用 heightToNormal 的 Sobel 法线
   * 覆盖——边框 / 铭牌 / 宝石的棱保持既有工艺。
   */
  function compositeExternalNormal(extCanvas, hCanvas) {
    var sob = heightToNormal(hCanvas, NORMAL_STRENGTH);
    var sd = sob.getContext('2d').getImageData(0, 0, W, H).data;
    var ed = extCanvas.getContext('2d').getImageData(0, 0, W, H).data;
    var hd = hCanvas.getContext('2d').getImageData(0, 0, W, H).data;
    var n = W * H, x, y, i, p;
    var ov = new Uint8Array(n);
    for (p = 0; p < n; p++) ov[p] = hd[p * 4] >= 170 ? 1 : 0;
    var out = mkCanvas(W, H);
    var octx = out.getContext('2d');
    var img = octx.createImageData(W, H);
    var d = img.data;
    for (y = 0; y < H; y++) {
      var y0 = (y > 0 ? y - 1 : 0) * W, y1 = y * W, y2 = (y < H - 1 ? y + 1 : H - 1) * W;
      for (x = 0; x < W; x++) {
        var x0 = x > 0 ? x - 1 : 0, x2 = x < W - 1 ? x + 1 : W - 1;
        p = y1 + x; i = p * 4;
        /* 自身或 3×3 邻域触及叠加层 → 用 Sobel 法线 */
        var useSob = ov[p] | ov[y1 + x0] | ov[y1 + x2] | ov[y0 + x] | ov[y2 + x] |
                     ov[y0 + x0] | ov[y0 + x2] | ov[y2 + x0] | ov[y2 + x2];
        var s = useSob ? sd : ed;
        d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  /**
   * 全幅插画基底：cover 铺满整卡（源图底部按 FULLART_CROP_BOTTOM 多裁，
   * 水印带随之弃除；无拱窗 / 无圆形遮罩——画就是卡），随后逐像素分析派生
   * height / rough 基底。mode：
   *   'relief'（宏观浮雕，默认）——亮度多尺度大半径低通圆雕体块 +
   *                         主体轮廓抬升；rough 按低通场软分三档
   *                         （金属 42 / 主体 145 / 深背景 215）；
   *   'painting'（油画全幅）——金箔 / 亮金属 → 188–240 凸起 + 24–68 低粗糙；
   *                         其余 → 亮度浅浮雕 18–41 + 哑光 190–220；
   *   'goldline'（金线蚀刻）——放宽金域 + 1px 膨胀掩膜 → 220–250 高凸起 +
   *                         12–40 纯金箔；蓝底 → 低平 20–32 + 哑光 200–225；
   *   'auto'——按放宽金域覆盖率自动判定（≥6% → goldline，否则 painting）。
   * 返回 { mode, goldCover }（goldCover 为放宽金域占比，供调参观测）。
   * 叠加层（边框 / 铭牌 / 宝石）随后按既有语义精确覆写其上。
   */
  function paintFullArtBase(P, img, mode, externalMaps) {
    drawFullArtCover(P.d, img, LW, LH);                    // diffuse：统一 cover 变换（逻辑坐标）

    var G = FULLART_GOLD;
    var src = P.d.getImageData(0, 0, W, H).data;
    var n = W * H;
    var vA = new Uint8Array(n);        // 明度（0–255）
    var lumA = new Uint8Array(n);      // 亮度（0–255）
    var strictGold = new Uint8Array(n);// 油画版金箔域（严格）
    var wideMask = new Uint8Array(n);  // 金线版放宽金域
    var wideHits = 0, p, i, r, g, b, mx, mn, v, s, hDeg, dlt, lum;

    for (p = 0, i = 0; p < n; p++, i += 4) {
      r = src[i]; g = src[i + 1]; b = src[i + 2];
      lum = (r * 299 + g * 587 + b * 114) / 1000;        // 0–255
      mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      v = mx / 255; s = mx ? (mx - mn) / mx : 0;
      hDeg = 0;
      if (s > 0.01) {
        dlt = mx - mn;
        if (mx === r) hDeg = 60 * (((g - b) / dlt) % 6);
        else if (mx === g) hDeg = 60 * ((b - r) / dlt + 2);
        else hDeg = 60 * ((r - g) / dlt + 4);
        if (hDeg < 0) hDeg += 360;
      }
      vA[p] = mx; lumA[p] = lum;
      if ((hDeg >= 32 && hDeg <= 62 && s >= 0.32 && v >= 0.42) ||
          (r > 196 && g > 158 && b < 170 && r > b + 36 && v >= 0.72)) strictGold[p] = 1;
      if (hDeg >= G.h0 && hDeg <= G.h1 && s >= G.s0 && v >= G.v0) { wideMask[p] = 1; wideHits++; }
    }

    var goldCover = wideHits / n;
    if (mode === 'auto') {                             // 仅 auto 走旧金域分类
      mode = goldCover >= G.autoCover ? 'goldline' : 'painting';
    } else if (mode !== 'painting' && mode !== 'goldline') {
      mode = 'relief';                                 // 默认 & 未知值兜底
    }
    if (mode === 'goldline') wideMask = dilateMask(wideMask, W, H);

    var hImg = P.h.createImageData(W, H);
    var rImg = P.r.createImageData(W, H);
    var hd = hImg.data, rd = rImg.data;
    var hv, rv;
    if (mode === 'goldline') {
      for (p = 0, i = 0; p < n; p++, i += 4) {
        if (wideMask[p]) {                               // 金线：高凸起 + 纯金箔
          hv = G.goldH0 + (vA[p] / 255) * G.goldH1;
          rv = G.goldR0 + (1 - vA[p] / 255) * G.goldR1;
        } else {                                         // 蓝底：低平 + 哑光
          hv = G.baseH0 + lumA[p] * G.baseH1;
          rv = G.baseR0 + (1 - lumA[p] / 255) * G.baseR1;
        }
        hd[i] = hd[i + 1] = hd[i + 2] = hv; hd[i + 3] = 255;
        rd[i] = rd[i + 1] = rd[i + 2] = rv; rd[i + 3] = 255;
      }
    } else if (mode === 'painting') {
      for (p = 0, i = 0; p < n; p++, i += 4) {
        if (strictGold[p]) {                             // 金箔 / 亮金属：凸起 + 低粗糙
          hv = 188 + (vA[p] / 255) * 52;                 // 188–240
          rv = 24 + (1 - vA[p] / 255) * 44;              // 24–68
        } else {                                         // 画面：亮度浅浮雕 + 哑光
          hv = 18 + lumA[p] * 0.09;                      // 18–41
          rv = 190 + (1 - lumA[p] / 255) * 30;           // 190–220
        }
        hd[i] = hd[i + 1] = hd[i + 2] = hv; hd[i + 3] = 255;
        rd[i] = rd[i + 1] = rd[i + 2] = rv; rd[i + 3] = 255;
      }
    } else {
      var extH = externalMaps && externalMaps.height;
      var fuse = !!(extH && externalMaps.fuseHeight);
      deriveReliefMaps(lumA, wideMask, hd, rd, !!(extH && !fuse));  // rough 恒 relief 分区；融合模式保留 relief 高度作基底
    }
    P.h.putImageData(hImg, 0, 0);
    P.r.putImageData(rImg, 0, 0);

    /* 外部贴图（试验）：与 diffuse 同一 cover 变换，仅 relief 模式生效 */
    var extN = null;
    if (mode === 'relief' && externalMaps) {
      if (externalMaps.height) {
        if (externalMaps.fuseHeight) fuseExternalHeight(P, externalMaps.height);
        else paintExternalHeight(P, externalMaps.height);
      }
      if (externalMaps.normal) {
        extN = mkCanvas(W, H);
        drawFullArtCover(extN.getContext('2d'), externalMaps.normal, W, H);
      }
    }
    return { mode: mode, goldCover: goldCover, extNormal: extN, lumA: lumA };
  }

  /**
   * paintFaceFull(hero, artImage, opts) → { diffuse, normal, rough, height }
   * 【试验接口 · 方案A】给定一张已加载的全幅插画 Image，渲染完整卡面四贴图：
   * 插画 cover 铺满（底部裁水印），装饰管线以「铭牌压在画上」的半透明底
   * 样式叠加（塔罗卡做法），整体极轻统一暗角 + 轻量印刷噪点。
   * opts.mode：'relief'（默认，宏观浮雕圆雕管线）| 'auto'（按金域覆盖率
   * 自动判定 painting / goldline）| 'painting' | 'goldline'。
   * 返回值附带试验信息字段 artMode / goldCover（调参观测用，非契约键）。
   * 不做缓存：试验期每次调用重绘（单张约 60–160ms，含逐像素派生 + Sobel）。
   */
  function paintFaceFull(hero, artImage, opts) {
    if (!hero || typeof hero !== 'object') {
      throw new Error('[CardArt] paintFaceFull: 需要 hero 对象（契约字段见 heroes-data.js）');
    }
    if (!artImage || !((artImage.naturalWidth || artImage.width) > 0)) {
      throw new Error('[CardArt] paintFaceFull: 需要已加载完成的全幅插画 Image');
    }
    var info = normalizeHero(hero);
    var cls = classInfoOf(info.classKey);
    var rar = rarityInfoOf(info.rarity);
    var fac = FACTION_INFO[info.faction];

    var P = makePack();
    P.gold = goldGradient(P.d);

    // 绘制顺序：插画基底（含像素派生材质）→ 装饰层 → 极轻暗角 → 轻量噪点。
    // 装饰层按主题路由：guofeng＝回纹框/匾额/题款/印章；缺省＝绶带→属性印→
    // 名牌→称号→边框→底部双章（魔兽旧卡路径零改动）。
    var reqMode = (opts && opts.mode) || 'relief';       // relief 为全幅卡默认
    var extMaps = (opts && opts.externalMaps) || null;   // { normal, height, fuseHeight } 试验贴图
    var artInfo = paintFullArtBase(P, artImage, reqMode, extMaps);
    /* v5.1 烫金刻线层：relief 模式默认开启（opts.goldLines === false 可关），
       落在叠加层之前——边框 / 名牌等照旧覆写其上 */
    if (artInfo.mode === 'relief' && (!opts || opts.goldLines !== false)) {
      artInfo.goldLines = paintGoldLines(P, artInfo.lumA, opts && opts.goldLineParams);
    }
    if (info.theme === 'guofeng') {
      paintGuofengPlaque(P, info);
      paintGuofengInscription(P, info);
      paintGuofengFrame(P);
      paintGuofengCornerSeals(P, info);
    } else {
      paintRibbon(P, info, rar, cls, true);
      paintStats(P, info, true);
      paintNameplate(P, info, true);
      paintTitleLine(P, info, true);
      paintFrame(P, rar.color, info.rarity);
      paintMedallions(P, info, cls.color, fac.color, true);
    }
    paintVignette(P, 0.55);                              // 极轻统一暗角
    applyNoise(P, hashStr('fullart|' + String(hero.id != null ? hero.id : info.nameZh)), 0.45,
      artInfo.mode === 'relief' ? { h: false, r: false } : null);  // relief：颗粒只落 diffuse

    var out = artInfo.extNormal
      ? { diffuse: P.cD, normal: compositeExternalNormal(artInfo.extNormal, P.cH),
          rough: P.cR, height: P.cH }                    // 画芯 AI 法线 + 叠加层 Sobel
      : finishPack(P);
    out.artMode = artInfo.mode;                          // 试验信息：'relief' | 'painting' | 'goldline'
    out.goldCover = Math.round(artInfo.goldCover * 1000) / 1000;
    out.goldLines = artInfo.goldLines || null;           // v5.1 金线统计（调参观测）
    return out;
  }

  /* --------------------------------------------------------------------------
   * 九、卡面 / 卡背 / 缩略卡 渲染入口
   * ------------------------------------------------------------------------ */

  /** 收尾：由 height 推导 normal，按契约键序返回四张贴图。 */
  function finishPack(P) {
    return {
      diffuse: P.cD,
      normal: heightToNormal(P.cH, NORMAL_STRENGTH),
      rough: P.cR,
      height: P.cH
    };
  }

  /** 完整渲染一张英雄卡（未缓存时的实际绘制流程）。 */
  function renderFace(raw) {
    /* 数据驱动：声明了 fullArt 且插画已就绪的英雄走全幅场景管线（relief +
       v5.1 烫金刻线层默认开启）；伴生 fullArtHeight 就绪时按 AI 高度融合
       增强立体感。其余英雄保持常规肖像窗 / sigil 路径零改动。 */
    var fullImg = _fullArt.get(String(raw.id != null ? raw.id : ''));
    if (fullImg) {
      var fOpts = { mode: 'relief' };
      var fHImg = _fullArtHeight.get(String(raw.id != null ? raw.id : ''));
      if (fHImg) fOpts.externalMaps = { height: fHImg, fuseHeight: true };
      if (raw.goldLineParams) fOpts.goldLineParams = raw.goldLineParams;  // 逐卡金线配置（禁区/月环 hint）
      return paintFaceFull(raw, fullImg, fOpts);
    }

    var hero = normalizeHero(raw);
    var cls = classInfoOf(hero.classKey);
    var rar = rarityInfoOf(hero.rarity);
    var fac = FACTION_INFO[hero.faction];

    var P = makePack();
    P.gold = goldGradient(P.d);

    // 绘制顺序：底 → 中央（肖像窗 / 徽记）→ 绶带 → 属性印 → 名牌 → 称号 →
    // 边框（压住各元素边缘）→ 底部双章 → 统一暗角 → 噪点（最后，颗粒落在金箔上）
    var portraitImg = _portraits.get(String(raw.id != null ? raw.id : ''));

    paintBackground(P, cls.color);
    if (portraitImg) {
      paintPortraitZone(P, portraitImg, cls.color);      // 有肖像：拱形肖像窗
    } else {
      paintSigilZone(P, hero, cls.color);                // 无肖像：sigil 徽记（降级链完整保留）
    }
    paintRibbon(P, hero, rar, cls);
    paintStats(P, hero);
    paintNameplate(P, hero);
    paintTitleLine(P, hero);
    paintFrame(P, rar.color, hero.rarity);
    paintMedallions(P, hero, cls.color, fac.color);
    paintVignette(P);                                    // 整体统一暗角
    applyNoise(P, hashStr(String(raw.id != null ? raw.id : hero.nameZh)));

    return finishPack(P);
  }

  var _faceCache = new Map();   // LRU：hero.id → 四张贴图

  /**
   * paintFace(hero) → { diffuse, normal, rough, height }
   * 按 hero.id 做 LRU 缓存（上限 FACE_CACHE_MAX 套）。
   */
  function paintFace(hero) {
    if (!hero || typeof hero !== 'object') {
      throw new Error('[CardArt] paintFace: 需要 hero 对象（契约字段见 heroes-data.js）');
    }
    var key = String(hero.id != null ? hero.id : ((hero.name && hero.name.zh) || 'anonymous'));
    if (_faceCache.has(key)) {                           // 命中：提热为最新
      var hit = _faceCache.get(key);
      _faceCache.delete(key);
      _faceCache.set(key, hit);
      return hit;
    }
    var out = renderFace(hero);
    _faceCache.set(key, out);
    while (_faceCache.size > FACE_CACHE_MAX) {           // 淘汰最久未用
      _faceCache.delete(_faceCache.keys().next().value);
    }
    return out;
  }

  /** 卡背中央徽记：罗盘玫瑰 + 艾泽拉斯星环 + 漩涡细弧。 */
  function paintBackEmblem(P) {
    var CX = 332, CY = 470;
    strokeAll(P, {                                       // 外双环
      dStyle: P.gold, dWidth: 2.5,
      dGlow: 'rgba(240,214,140,0.35)', dGlowBlur: 8,
      hVal: 220, rVal: 28,
      path: function (ctx) {
        ctx.beginPath();
        ctx.arc(CX, CY, 240, 0, Math.PI * 2);
        ctx.moveTo(CX + 224, CY);
        ctx.arc(CX, CY, 224, 0, Math.PI * 2);
      }
    });
    fillAll(P, {                                         // 罗盘八针（四长四短）
      dStyle: 'rgba(216,182,110,0.9)', hVal: 215, rVal: 30,
      path: function (ctx) {
        ctx.beginPath();
        for (var i = 0; i < 8; i++) {
          var a = i * Math.PI / 4 - Math.PI / 2;
          var len = (i % 2 === 0) ? 200 : 130;
          var bx = Math.cos(a), by = Math.sin(a);
          var px = -by, py = bx;
          ctx.moveTo(CX + bx * 34 + px * 10, CY + by * 34 + py * 10);
          ctx.lineTo(CX + bx * len, CY + by * len);
          ctx.lineTo(CX + bx * 34 - px * 10, CY + by * 34 - py * 10);
          ctx.closePath();
        }
      }
    });
    paintRuneRing(P, CX, CY, 150, 176);                  // 符文刻环
    if (P.d) {                                           // 漩涡细弧（仅 diffuse）
      P.d.save();
      P.d.translate(CX, CY);
      P.d.strokeStyle = 'rgba(216,182,110,0.08)';
      P.d.lineWidth = 8;
      for (var i = 0; i < 6; i++) {
        P.d.beginPath();
        P.d.arc(0, 0, 110 + i * 6, i * 1.05, i * 1.05 + 1.6);
        P.d.stroke();
      }
      P.d.restore();
    }
    strokeAll(P, {                                       // 星环球体
      dStyle: P.gold, dWidth: 2.5, hVal: 220, rVal: 28,
      path: function (ctx) {
        ctx.beginPath(); ctx.arc(CX, CY, 84, 0, Math.PI * 2);
      }
    });
    strokeAll(P, {                                       // 大陆曲线
      dStyle: GOLD_DIM, dWidth: 1.5, hVal: 160, rVal: 60,
      path: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(CX - 60, CY - 10);
        ctx.bezierCurveTo(CX - 30, CY - 50, CX + 20, CY - 40, CX + 45, CY - 15);
        ctx.bezierCurveTo(CX + 60, CY + 5, CX + 30, CY + 10, CX + 15, CY + 25);
        ctx.bezierCurveTo(CX - 5, CY + 45, CX - 45, CY + 35, CX - 55, CY + 10);
        ctx.closePath();
        ctx.ellipse(CX, CY, 84, 30, 0, 0, Math.PI * 2);  // 纬线
        ctx.ellipse(CX, CY, 120, 46, -0.42, 0, Math.PI * 2); // 倾斜轨道
      }
    });
    fillAll(P, {                                         // 轨道伴星
      dStyle: '#E8D49A', hVal: 225, rVal: 20,
      path: function (ctx) {
        ctx.beginPath();
        ctx.arc(CX + 83, CY + 2.5, 5, 0, Math.PI * 2);
      }
    });
    strokeAll(P, {                                       // 中心四角星
      dStyle: P.gold, dWidth: 2,
      dGlow: 'rgba(240,214,140,0.5)', dGlowBlur: 10,
      hVal: 225, rVal: 26,
      path: function (ctx) {
        ctx.beginPath();
        pathStar4(ctx, CX, CY, 20, 6);
      }
    });
    gemDraw(P, 332, 70, 9, '#C8A55A');                   // 天地方向双珠
    gemDraw(P, 332, 954, 9, '#C8A55A');
  }

  /** 国风卡背：回纹框 + 白文朱砂「群英」大印 + 如意云头 + 泥金题字。
      装饰即掐丝：金色元素 h 215–235 / r 24–30，印章按 paintSeal 自带参数。 */
  function paintBackGuofeng(P) {
    var CX = 332, CY = 470;
    paintGuofengFrame(P);                                // 回纹边框 + 四角回纹角花
    strokeAll(P, {                                       // 印外淡金细环两圈（不喧宾夺主）
      dStyle: GOLD_DIM, dWidth: 1.2, hVal: 215, rVal: 30,
      path: function (ctx) {
        ctx.beginPath();
        ctx.arc(CX, CY, 118, 0, Math.PI * 2);
        ctx.moveTo(CX + 146, CY);
        ctx.arc(CX, CY, 146, 0, Math.PI * 2);
      }
    });
    strokeAll(P, {                                       // 印上下如意云头（上朝卡顶、下朝卡底）
      dStyle: P.gold, dWidth: 1.6,
      dGlow: 'rgba(240,214,140,0.35)', dGlowBlur: 6,
      hVal: 225, rVal: 26,
      path: function (ctx) {
        ctx.beginPath();
        pathRuyi(ctx, CX, CY - 100, 16, -Math.PI / 2);   // 上组（一大两小）
        pathRuyi(ctx, CX - 34, CY - 92, 9, -Math.PI / 2);
        pathRuyi(ctx, CX + 34, CY - 92, 9, -Math.PI / 2);
        pathRuyi(ctx, CX, CY + 100, 16, Math.PI / 2);    // 下组（一大两小）
        pathRuyi(ctx, CX - 34, CY + 92, 9, Math.PI / 2);
        pathRuyi(ctx, CX + 34, CY + 92, 9, Math.PI / 2);
      }
    });
    paintSeal(P, CX, CY, 120, '群英');                   // 白文朱砂大印（2 字竖排主视觉）
    textAll(P, '华夏人物图鉴', {                          // 底部题字（泥金小字）
      font: '22px ' + FONT_BRUSH, x: 332, y: 948, spacing: 6,
      dStyle: GUOFENG_INK, hVal: 190, rVal: 38
    });
  }

  var _backCache = {};    // 卡背按主题各画一次（key = theme || 'wow'）

  /** paintBack(theme) → { diffuse, normal, rough, height }（按主题单例缓存）。
      theme === 'guofeng' 走国风路径，其余保持魔兽卡背。 */
  function paintBack(theme) {
    var key = theme || 'wow';
    if (_backCache[key]) return _backCache[key];
    var P = makePack();
    P.gold = goldGradient(P.d);
    if (theme === 'guofeng') {
      paintBackground(P, '#2E4A6B');                     // 黛蓝氛围（掐丝珐琅夜空蓝同族）
      paintBackGuofeng(P);
    } else {
      paintBackground(P, '#C8A55A');                     // 中立金氛围
      paintBackEmblem(P);
      paintFrame(P, '#C8A55A', null);
    }
    paintVignette(P);                                    // 整体统一暗角
    applyNoise(P, 0xA57E0);
    _backCache[key] = finishPack(P);
    return _backCache[key];
  }

  /**
   * paintMini(hero, w, h) → canvas
   * 图鉴墙快速缩略卡：保留边框 / 徽记 / 稀有度色 / 英雄名，
   * 省略属性印、阵营章与噪点，文字简化为一行名 + 一行称号。
   * 省略 w/h 时默认 166×256。
   */
  function paintMini(hero, w, h) {
    if (!hero || typeof hero !== 'object') {
      throw new Error('[CardArt] paintMini: 需要 hero 对象（契约字段见 heroes-data.js）');
    }
    w = clamp(Math.round(w || 166), 24, 1024);
    h = clamp(Math.round(h || 256), 36, 1600);

    var info = normalizeHero(hero);
    var cls = classInfoOf(info.classKey);
    var rar = rarityInfoOf(info.rarity);

    var c = mkCanvas(w, h);
    var ctx = c.getContext('2d');

    /* 数据驱动：fullArt 英雄的图鉴缩略卡直接用全幅成卡 diffuse 缩绘
       （paintFace 走 LRU，与主卡面共享渲染结果，零重复开销）；
       异常时落入常规迷你卡路径。 */
    if (_fullArt.get(String(hero.id != null ? hero.id : ''))) {
      try {
        var fullSet = paintFace(hero);
        ctx.drawImage(fullSet.diffuse, 0, 0, w, h);
        return c;
      } catch (errFull) { /* 落入常规迷你卡路径 */ }
    }

    ctx.save();
    ctx.scale(w / LW, h / LH);                           // 以卡面逻辑坐标系作画

    var P = { d: ctx, h: null, r: null, gold: goldGradient(ctx) };

    paintBackground(P, cls.color);                       // 底 + 职业氛围光
    var portraitImg = _portraits.get(String(hero.id != null ? hero.id : ''));
    if (portraitImg) {
      paintPortraitZone(P, portraitImg, cls.color);      // 有肖像：拱形肖像窗
    } else {
      strokeAll(P, {                                     // 徽记双环（省略刻符保清晰）
        dStyle: GOLD_DIM, dWidth: 2,
        path: function (c2) {
          c2.beginPath();
          c2.arc(332, 440, 168, 0, Math.PI * 2);
          c2.moveTo(332 + 214, 440);
          c2.arc(332, 440, 214, 0, Math.PI * 2);
        }
      });
      drawGlyph(P, info.sigil, 332, 440, 132, cls.color); // 无肖像：中央徽记
    }

    if (info.titleZh) {                                  // 称号小字
      textAll(P, info.titleZh, {
        font: '400 22px ' + FONT_BODY, x: 332, y: 716,
        dStyle: '#CBB27A'
      });
    }

    var bandG = ctx.createLinearGradient(0, 790, 0, 862); // 底部信息带
    bandG.addColorStop(0, mixHex(rar.color, '#0A1122', 0.72));
    bandG.addColorStop(1, mixHex(rar.color, '#0A1122', 0.88));
    fillAll(P, {
      dStyle: bandG,
      path: function (c2) {
        c2.beginPath();
        pathRoundRect(c2, 90, 790, 484, 72, 10);
      }
    });
    strokeAll(P, {
      dStyle: rar.color, dWidth: 3,
      dGlow: rgba(rar.color, 0.45), dGlowBlur: 8,
      path: function (c2) {
        c2.beginPath();
        pathRoundRect(c2, 90, 790, 484, 72, 10);
      }
    });
    textAll(P, info.nameZh, {                            // 英雄名
      font: '700 40px ' + FONT_BODY, x: 332, y: 842, spacing: 2,
      dStyle: P.gold,
      dGlow: 'rgba(240,214,140,0.5)', dGlowBlur: 10
    });

    strokeAll(P, {                                       // 外框（金）
      dStyle: P.gold, dWidth: 8,
      path: function (c2) { c2.beginPath(); c2.rect(14, 14, 636, 996); }
    });
    strokeAll(P, {                                       // 内框（稀有度色）
      dStyle: rar.color, dWidth: 2.5,
      path: function (c2) { c2.beginPath(); c2.rect(30, 30, 604, 964); }
    });
    cabochonDraw(P, 332, 14, 15, rar.color);             // 顶部稀有度宝石（弧面高光）
    paintVignette(P);                                    // 整体统一暗角

    ctx.restore();
    return c;
  }

  /* --------------------------------------------------------------------------
   * 十、导出
   * ------------------------------------------------------------------------ */
  global.CardArt = {
    W: W,
    H: H,
    paintFace: paintFace,
    paintBack: paintBack,
    paintMini: paintMini,
    paintFaceFull: paintFaceFull,
    preloadPortraits: preloadPortraits,
    hasPortrait: hasPortrait
  };
})(typeof window !== 'undefined' ? window : this);
