/* Focused visual QC and baked-thumbnail export; no remote writes. */
(async function () {
  'use strict';
  function mapStats(set, tag) {
    var w = window.CardArt.W, h = window.CardArt.H, x, y, p, i;
    /* 内圈边距随分辨率等比：664 口径 48px → 1329 口径 96px */
    var mg = Math.round(48 * (w / 664));
    var hd = set.height.getContext('2d').getImageData(0, 0, w, h).data;
    var rd = set.rough.getContext('2d').getImageData(0, 0, w, h).data;
    var nd = set.normal.getContext('2d').getImageData(0, 0, w, h).data;

    function pct(hist, tot, q) {
      var t = q * tot, acc = 0;
      for (var k = 0; k < hist.length; k++) { acc += hist[k]; if (acc >= t) return k; }
      return hist.length - 1;
    }

    /* height 梯度：Sobel 幅值（与 heightToNormal 同核）。
       统计内圈（664 口径外缩 48px，随分辨率等比放大）——外框 / 角饰等叠加层是设计好的锐边，
       参考站 p50/p99 基准为纯画芯口径，内圈才可对照。
       直方图 ¼ 精度：2× 分辨率下梯度约为 664 口径的一半，整数舍入会丢失 p50 分辨力。 */
    var gh = new Int32Array(8192), gn = 0;
    for (y = mg + 1; y < h - mg - 1; y += 2) {
      for (x = mg + 1; x < w - mg - 1; x += 2) {
        i = (y * w + x) * 4;
        var tl = hd[i - w * 4 - 4], t = hd[i - w * 4], tr = hd[i - w * 4 + 4];
        var l = hd[i - 4], r = hd[i + 4];
        var bl = hd[i + w * 4 - 4], b = hd[i + w * 4], br = hd[i + w * 4 + 4];
        var gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
        var gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
        var m = Math.round(Math.sqrt(gx * gx + gy * gy) * 4);
        gh[m > 8191 ? 8191 : m]++; gn++;
      }
    }
    var hP50 = pct(gh, gn, 0.5) / 4, hP99 = pct(gh, gn, 0.99) / 4;

    /* rough 中间档占比 */
    var mid = 0, n = w * h;
    for (p = 0; p < n; p++) {
      var rv = rd[p * 4];
      if (rv >= 80 && rv <= 170) mid++;
    }
    var midPct = mid / n * 100;

    /* normal 偏离：dev = |r-128| + |g-128|。只统计画芯像素——
       叠加层（height≥170）做 1px 膨胀后剔除（Sobel 核影响半径恰为 1px，
       连抗锯齿过渡沿一并排除），剩下的才是画芯自己的棱。 */
    var ov = new Uint8Array(w * h);
    for (p = 0; p < w * h; p++) ov[p] = hd[p * 4] >= 170 ? 1 : 0;
    var ovD = new Uint8Array(w * h);
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        i = y * w + x;
        if (ov[i] | ov[i - 1] | ov[i + 1] | ov[i - w] | ov[i + w] |
            ov[i - w - 1] | ov[i - w + 1] | ov[i + w - 1] | ov[i + w + 1]) ovD[i] = 1;
      }
    }
    var dHist = new Int32Array(512), dSum = 0, dAct = 0, dActSum = 0, dn = 0;
    var b1 = 0, b2 = 0, b3 = 0, b4 = 0;              // dev 分布桶：6–20 / 20–40 / 40–80 / 80+
    for (y = mg; y < h - mg; y += 2) {
      for (x = mg; x < w - mg; x += 2) {
        i = (y * w + x) * 4;
        if (ovD[y * w + x]) continue;
        var dev = Math.abs(nd[i] - 128) + Math.abs(nd[i + 1] - 128);
        dHist[dev > 511 ? 511 : dev]++; dn++;
        dSum += dev;
        if (dev >= 6) {
          dAct++; dActSum += dev;
          if (dev < 20) b1++; else if (dev < 40) b2++; else if (dev < 80) b3++; else b4++;
        }
      }
    }
    var dMean = dSum / dn, dActMean = dAct ? dActSum / dAct : 0, dP99 = pct(dHist, dn, 0.99);

    return { heightGradientP50: hP50, heightGradientP99: hP99,
      roughMidPercent: +midPct.toFixed(2), normalActiveMean: +dActMean.toFixed(2),
      normalP99: dP99, roughPass: midPct >= 45, normalPass: dActMean >= 22 && dActMean <= 40 };
  }

  const id = new URLSearchParams(location.search).get('hero') || 'jaina-proudmoore';
  const hero = WOW_HEROES.find(h => h.id === id);
  const log = document.getElementById('log');
  function download(name, data) {
    const a = document.createElement('a'); a.href = data; a.download = name; a.click();
  }
  try {
    if (!hero || !hero.fullArt) throw new Error('Expected a full-art hero');
    await Promise.all([document.fonts.load('700 34px "Noto Serif SC"'),
      document.fonts.load('500 12px Cinzel'), document.fonts.load('500 17px Jost'),
      CardArt.preloadPortraits([hero])]);
    await document.fonts.ready;
    document.getElementById('title').textContent = hero.name.zh + ' · 原生卡面 QC';
    const started = performance.now();
    const set = CardArt.paintFace(hero);
    if (set.artMode !== 'relief') throw new Error('Full-art routing fell back unexpectedly');
    const elapsed = performance.now() - started;
    const img = await new Promise((resolve, reject) => {
      const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = hero.fullArt;
    });
    const depth = await new Promise((resolve, reject) => {
      const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = hero.fullArtHeight;
    });
    const old = CardArt.paintFaceFull({...hero, fullArtCropBottom: undefined, fullArtHeightSmoothing: undefined,
      goldLineParams: undefined, fullArtNonMetalZones: undefined}, img, {externalMaps: {height: depth, fuseHeight: true}});
    const configs = [[old,null],[set,null],[set,[.12,.82]],[set,[.85,.20]]];
    const buffers = [];
    for (let i=0; i<configs.length; i++) {
      const canvas = document.getElementById('card'+i);
      const lighting = CardLighting.create(canvas);
      if (!lighting) throw new Error('WebGL2 unavailable');
      lighting.setMaps(configs[i][0]); lighting.draw(configs[i][1]);
      const gl = canvas.getContext('webgl2');
      if (gl.getError()) throw new Error('WebGL error');
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      buffers.push(pixels);
    }
    let sum=0;
    for(let i=0;i<buffers[1].length;i+=4) sum += Math.abs(buffers[1][i]-buffers[2][i]);
    const delta = sum/(buffers[1].length/4);
    const dims = [img.naturalWidth,img.naturalHeight];
    const zoom=document.getElementById('zoom');
    const head=hero.goldLineParams && hero.goldLineParams.skipZones[0] || {x:335,y:250};
    zoom.getContext('2d').drawImage(set.diffuse, Math.round(head.x*CardArt.W/664-180),
      Math.round(head.y*2-150),360,300,0,0,360,300);
    for (const key of ['diffuse','height','normal','rough']) {
      const c=document.getElementById(key);c.getContext('2d').drawImage(set[key],0,0,c.width,c.height);
    }
    const thumb=document.createElement('canvas');thumb.width=CardArt.W;thumb.height=CardArt.H;
    const ctx=thumb.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(set.diffuse,0,0,CardArt.W,CardArt.H);
    window.qc = {id, nativeDimensions:dims, textureDimensions:[CardArt.W,CardArt.H],
      layout:'warcraft-default', styleReference:'sylvanas-windrunner',
      cropBottom:hero.fullArtCropBottom ?? .08, renderMs:Math.round(elapsed),
      goldLines:set.goldLines, legacy:mapStats(old), optimized:mapStats(set),
      lightPixelDelta:+delta.toFixed(3), thumbBytes:Math.round(thumb.toDataURL('image/webp',.9).length*.75),
      noUpscalingAtEncoding:true};
    log.textContent=JSON.stringify(window.qc,null,2);
    document.getElementById('export-thumb').onclick=()=>download(id+'-imagegen-v1-thumb.webp',thumb.toDataURL('image/webp',.9));
    document.getElementById('export-report').onclick=()=>download(id+'-qc.json','data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(window.qc,null,2)));
    document.getElementById('export-thumb').disabled=false;
    document.getElementById('export-report').disabled=false;
    document.body.dataset.ready='true';
  } catch(e) { log.textContent=String(e.stack||e);document.body.dataset.error='true'; }
})();
