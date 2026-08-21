/* ============================================================================
 * 生平行旅图（js/story-map.js）
 * ----------------------------------------------------------------------------
 * 移动端国风人物图鉴站的「生平行旅图」渲染器：把历史人物生平画成竖向宣纸
 * 长卷，虚线路径串起若干站点，点印章站点展开/收起该段故事。
 * 以普通 <script> 在 js/heroes-data.js、js/card-art.js 之后、js/app.js
 * 之前引入，不使用 module，不发起网络请求，不读写 localStorage。
 *
 * 【对外契约】
 *   window.StoryMap = {
 *     render(container, hero) → 渲染生平行旅图到 container（先清空内容）
 *   };
 *   hero 字段（均可缺失，逐项防御）：
 *     name:  { zh: '李白' }
 *     stops: [{ place: '碎叶', text: '生平段落…', x: 68, y: 8 }, …]
 *            // x/y 为长卷百分比 0–100，按 y 升序即路线顺序；
 *            // 可能为 undefined / 空数组
 *     lore:  '人物简介…'   // stops 缺失时的兜底文案
 *
 * 【注入的 class 清单】（首次 render 时向 document.head 注入一次 <style>）
 *   sm-scroll          长卷外框（宣纸底、相对定位容器）
 *   sm-svg             底层路径 SVG（虚线路径 / 起讫印 / 山水点缀）
 *   sm-layer           站点定位层（与 SVG 同纵横比，padding-top 撑起）
 *   sm-stop            站点容器（绝对定位覆盖在 SVG 上）
 *   sm-stop-flip       站点靠右时地名标签翻到印章左侧，防止溢出
 *   sm-seal            圆形朱砂印章按钮（白文，place 首字）
 *   sm-place           地名小标签（place 全称）
 *   sm-card            展开的故事卡（米色、细金边、墨色文字）
 *   sm-open            站点展开态（挂在 sm-stop 上）
 *   sm-fallback        无 stops 时的兜底卷轴卡片
 *   sm-fallback-title  兜底卡片标题「生平」
 *   sm-fallback-body   兜底卡片正文（hero.lore）
 * ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
   * 一、样式自包含：首次 render 注入一次 <style>，class 前缀 sm-
   * --------------------------------------------------------------------- */
  var STYLE_ID = 'sm-story-map-style';
  var STYLE_TEXT = [
    '.sm-scroll{position:relative;width:100%;max-width:420px;margin:0 auto;',
      'background:#F7F0DE;border:1px solid #D8C79A;box-sizing:border-box;',
      'overflow:hidden;border-radius:6px;}',
    '.sm-svg{display:block;width:100%;height:auto;}',
    // 站点层：用 padding-top 百分比撑起与 SVG 一致的纵横比，
    // 使站点 % 定位只相对本层，不受长卷 padding-bottom 变化影响
    '.sm-layer{position:absolute;top:0;left:0;width:100%;height:0;z-index:2;}',
    '.sm-stop{position:absolute;width:212px;transform:translate(-50%,-19px);',
      'text-align:center;}',
    '.sm-seal{display:inline-block;width:34px;height:34px;padding:0;',
      'border:none;border-radius:50%;cursor:pointer;',
      'background:#B03A2E;color:#FDFBF3;line-height:34px;font-size:16px;',
      "font-family:'Chong Xi Small Seal','Ma Shan Zheng',serif;",
      'box-shadow:0 1px 3px rgba(43,35,20,.35);vertical-align:middle;}',
    '.sm-seal:focus-visible{outline:2px solid #B08D3E;outline-offset:2px;}',
    '.sm-place{display:inline-block;margin-left:6px;vertical-align:middle;',
      'font-size:13px;color:#4A4033;letter-spacing:1px;',
      "font-family:'Ma Shan Zheng',serif;}",
    '.sm-stop-flip .sm-place{margin-left:0;margin-right:6px;}',
    '.sm-stop-flip .sm-place{order:-1;}',
    '.sm-stop .sm-head{white-space:nowrap;}',
    '.sm-card{display:none;margin:8px auto 0;padding:10px 12px;',
      'width:188px;box-sizing:border-box;text-align:left;',
      'background:#FBF5E4;border:1px solid #C9B37A;border-radius:4px;',
      'color:#2B2B26;font-size:12.5px;line-height:1.75;',
      'box-shadow:0 2px 6px rgba(43,35,20,.18);}',
    '.sm-open{z-index:5;}',
    '.sm-open .sm-card{display:block;}',
    '.sm-fallback{max-width:420px;margin:0 auto;padding:20px 18px;',
      'box-sizing:border-box;background:#FBF5E4;',
      'border-left:2px solid #C9B37A;border-right:2px solid #C9B37A;',
      'border-top:1px solid #E0D2A8;border-bottom:1px solid #E0D2A8;',
      'border-radius:4px;color:#2B2B26;}',
    '.sm-fallback-title{margin:0 0 10px;font-size:16px;letter-spacing:4px;',
      'color:#8A6D2F;text-align:center;',
      "font-family:'Ma Shan Zheng',serif;}",
    '.sm-fallback-body{margin:0;font-size:13px;line-height:1.85;}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) { return; }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(STYLE_TEXT));
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
   * 二、小工具
   * --------------------------------------------------------------------- */

  // 建 SVG 元素并批量设属性
  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) {
      if (attrs.hasOwnProperty(k)) { el.setAttribute(k, attrs[k]); }
    }
    return el;
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  // 清洗 stops：补齐缺省坐标、按 y 升序排定路线顺序
  function normalizeStops(stops) {
    var list = [];
    if (!stops || typeof stops.length !== 'number') { return list; }
    for (var i = 0; i < stops.length; i++) {
      var s = stops[i];
      if (!s || typeof s !== 'object') { continue; }
      list.push({
        place: String(s.place != null ? s.place : '行旅'),
        text:  String(s.text  != null ? s.text  : ''),
        x: Math.max(0, Math.min(100, toNum(s.x, 50))),
        y: Math.max(0, Math.min(100, toNum(s.y, 0)))
      });
    }
    list.sort(function (a, b) { return a.y - b.y; });
    return list;
  }

  /* ------------------------------------------------------------------------
   * 三、SVG：平滑虚线路径（catmull-rom → bezier）、起讫小印、山水点缀
   * --------------------------------------------------------------------- */

  // catmull-rom 样条转三次贝塞尔路径串
  function smoothPath(pts) {
    if (pts.length === 1) {
      return 'M' + pts[0][0] + ',' + pts[0][1];
    }
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[Math.min(pts.length - 1, i + 2)];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' +
                  c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' +
                  p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }

  // 起 / 讫小圆印（朱砂底白文）
  function endSeal(svg, cx, cy, ch) {
    svg.appendChild(svgEl('circle', {
      cx: cx, cy: cy, r: 9,
      fill: '#B03A2E', stroke: '#8E2B22', 'stroke-width': 1
    }));
    var t = svgEl('text', {
      x: cx, y: cy + 3.5, 'text-anchor': 'middle',
      'font-size': 9, fill: '#FDFBF3',
      'font-family': "'Chong Xi Small Seal','Ma Shan Zheng',serif"
    });
    t.textContent = ch;
    svg.appendChild(t);
  }

  // 极简山水点缀：远山三角 + 云纹弧线，墨色低透明度，不喧宾夺主
  function addScenery(svg, w, h) {
    var g = svgEl('g', { fill: 'none', stroke: '#3B3B33', 'stroke-opacity': 0.14 });
    // 远山（两处，错开行旅路径）
    g.appendChild(svgEl('path', {
      d: 'M18,' + (h * 0.36).toFixed(0) + ' L52,' + (h * 0.30).toFixed(0) +
         ' L86,' + (h * 0.36).toFixed(0) + ' Z',
      fill: '#3B3B33', 'fill-opacity': 0.08, stroke: 'none'
    }));
    g.appendChild(svgEl('path', {
      d: 'M' + (w - 96) + ',' + (h * 0.66).toFixed(0) +
         ' L' + (w - 60) + ',' + (h * 0.595).toFixed(0) +
         ' L' + (w - 24) + ',' + (h * 0.66).toFixed(0) + ' Z',
      fill: '#3B3B33', 'fill-opacity': 0.08, stroke: 'none'
    }));
    // 云纹（两道弧线）
    g.appendChild(svgEl('path', {
      d: 'M' + (w - 90) + ',' + (h * 0.12).toFixed(0) +
         ' a14,7 0 1 1 28,0 a11,5.5 0 1 1 22,0',
      'stroke-width': 1.4, 'stroke-linecap': 'round'
    }));
    svg.appendChild(g);
  }

  /* ------------------------------------------------------------------------
   * 四、站点 DOM：印章按钮 + 地名标签 + 故事卡（同一时间只展开一个）
   * --------------------------------------------------------------------- */
  var cardSeq = 0; // 生成 aria-controls 用的唯一 id

  function buildStop(scroll, layer, stop) {
    var wrap = document.createElement('div');
    wrap.className = 'sm-stop' + (stop.x > 55 ? ' sm-stop-flip' : '');
    wrap.style.left = stop.x + '%';
    wrap.style.top  = stop.y + '%';

    var head = document.createElement('div');
    head.className = 'sm-head';

    var seal = document.createElement('button');
    seal.type = 'button';
    seal.className = 'sm-seal';
    seal.textContent = stop.place.charAt(0) || '行';
    seal.setAttribute('aria-expanded', 'false');
    var cardId = 'sm-card-' + (++cardSeq);
    seal.setAttribute('aria-controls', cardId);
    seal.setAttribute('aria-label', stop.place + ' 生平段落');

    var label = document.createElement('span');
    label.className = 'sm-place';
    label.textContent = stop.place;

    // 靠右站点把标签放到印章左边，避免溢出长卷右缘
    if (stop.x > 55) {
      head.appendChild(label);
      head.appendChild(seal);
    } else {
      head.appendChild(seal);
      head.appendChild(label);
    }
    wrap.appendChild(head);

    var card = document.createElement('div');
    card.className = 'sm-card';
    card.id = cardId;
    card.setAttribute('role', 'region');
    var p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = stop.text;
    card.appendChild(p);
    wrap.appendChild(card);

    seal.addEventListener('click', function () {
      var willOpen = wrap.className.indexOf('sm-open') < 0;
      // 收起当前已展开的其他站点
      var opened = scroll.querySelectorAll('.sm-stop.sm-open');
      for (var i = 0; i < opened.length; i++) {
        opened[i].className = opened[i].className.replace(/\s*sm-open/g, '');
        var btn = opened[i].querySelector('.sm-seal');
        if (btn) { btn.setAttribute('aria-expanded', 'false'); }
      }
      scroll.style.paddingBottom = '';
      if (willOpen) {
        wrap.className += ' sm-open';
        seal.setAttribute('aria-expanded', 'true');
        // 末站展开时故事卡可能探出 SVG 底缘，长卷补 padding 防裁切
        // （站点挂在 sm-layer 内，其高度与 SVG 纵横比绑定，
        //   不随 padding-bottom 变化，故补 padding 是收敛的）
        var over = wrap.offsetTop + wrap.offsetHeight +
                   layer.offsetTop - scroll.offsetHeight;
        if (over > 0) { scroll.style.paddingBottom = (over + 12) + 'px'; }
      }
    });

    layer.appendChild(wrap);
  }

  /* ------------------------------------------------------------------------
   * 五、render：有 stops 画长卷，无 stops 出兜底卷轴
   * --------------------------------------------------------------------- */
  function renderFallback(container, hero) {
    var box = document.createElement('div');
    box.className = 'sm-fallback';
    var title = document.createElement('h3');
    title.className = 'sm-fallback-title';
    title.textContent = '生平';
    var body = document.createElement('p');
    body.className = 'sm-fallback-body';
    var lore = hero && hero.lore ? String(hero.lore) : '生平暂无记载。';
    body.textContent = lore;
    box.appendChild(title);
    box.appendChild(body);
    container.appendChild(box);
  }

  function render(container, hero) {
    if (!container) { return; }
    ensureStyle();
    while (container.firstChild) { container.removeChild(container.firstChild); }

    var stops = normalizeStops(hero && hero.stops);
    if (!stops.length) {
      renderFallback(container, hero);
      return;
    }

    // 长卷：viewBox 宽 360，高按站点数自适应
    var W = 360;
    var H = stops.length * 130 + 120;

    var scroll = document.createElement('div');
    scroll.className = 'sm-scroll';

    var svg = svgEl('svg', {
      'class': 'sm-svg', viewBox: '0 0 ' + W + ' ' + H,
      'aria-hidden': 'true', focusable: 'false'
    });

    // 百分比换算到 viewBox 坐标
    var pts = [];
    for (var i = 0; i < stops.length; i++) {
      pts.push([stops[i].x / 100 * W, stops[i].y / 100 * H]);
    }

    addScenery(svg, W, H);

    // 平滑虚线路径（泥金色）
    svg.appendChild(svgEl('path', {
      d: smoothPath(pts), fill: 'none',
      stroke: '#B08D3E', 'stroke-width': 2,
      'stroke-dasharray': '7 6', 'stroke-linecap': 'round'
    }));

    // 起讫小印
    endSeal(svg, pts[0][0], pts[0][1] - 24, '起');
    endSeal(svg, pts[pts.length - 1][0], pts[pts.length - 1][1] + 26, '讫');

    scroll.appendChild(svg);

    // 站点层：与 SVG 同纵横比（padding-top 百分比技巧），站点 % 定位相对本层
    var layer = document.createElement('div');
    layer.className = 'sm-layer';
    layer.style.paddingTop = (H / W * 100) + '%';
    scroll.appendChild(layer);

    // 站点 DOM 覆盖在 SVG 上
    for (var j = 0; j < stops.length; j++) {
      buildStop(scroll, layer, stops[j]);
    }

    container.appendChild(scroll);
  }

  window.StoryMap = { render: render };
})();
