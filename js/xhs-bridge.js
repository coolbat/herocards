/* ============================================================================
 * js/xhs-bridge.js — 小红书小工具端能力桥（判空降级）
 * ----------------------------------------------------------------------------
 * 暴露 window.XhsBridge：
 *   available()            → boolean  是否在小红书小工具环境
 *   postNote(hero, dataUrl)→ Promise<boolean>  调起笔记发布页（浏览器里隐藏入口，不会调到）
 *   saveImage(hero, dataUrl) → Promise<boolean>  存相册；浏览器降级为 <a download> 导出 PNG
 *
 * ⚠️ postNote / saveImageToPhotosAlbum 的调用签名目前只有二手转述，
 *    Phase C 封装打包前必须对照官方能力文档原文核对并修正此处实现。
 *    所有端能力调用都包 try/catch，任何异常静默降级，绝不抛出。
 * ========================================================================== */
(function () {
  'use strict';

  function api() {
    return (typeof window !== 'undefined' && window.xhs && window.xhs.miniTool) || null;
  }

  function available() {
    return !!api();
  }

  /** 笔记文案：标题 + 正文（话题标签按比赛要求带上）。 */
  function notePayload(hero) {
    var name = (hero && hero.name && hero.name.zh) || '先贤';
    var title = (hero && hero.title && hero.title.zh) || '';
    return {
      title: '我在「华夏人物图鉴」请到了' + name,
      content: '每日一签，今日遇见' + name + (title ? ' · ' + title : '') + '。\n' +
        ((hero && hero.quote) || '') + '\n' +
        '#小红书vibecoding大赛 #国风vibecoding'
    };
  }

  /**
   * 调起小红书笔记发布页。返回 Promise<boolean>（是否成功调起）。
   * 非小工具环境直接 resolve(false)——调用方据此隐藏入口。
   */
  function postNote(hero, dataUrl) {
    return new Promise(function (resolve) {
      var x = api();
      if (!x || typeof x.postNote !== 'function') { resolve(false); return; }
      try {
        var p = notePayload(hero);
        var ret = x.postNote({
          title: p.title,
          content: p.content,
          images: dataUrl ? [dataUrl] : []
        });
        Promise.resolve(ret).then(function () { resolve(true); }, function () { resolve(false); });
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * 保存卡面到相册。小工具里走 saveImageToPhotosAlbum；
   * 浏览器里降级为 <a download> 导出 PNG。返回 Promise<boolean>。
   */
  function saveImage(hero, dataUrl) {
    return new Promise(function (resolve) {
      if (!dataUrl) { resolve(false); return; }
      var x = api();
      if (x && typeof x.saveImageToPhotosAlbum === 'function') {
        try {
          var ret = x.saveImageToPhotosAlbum({ image: dataUrl });
          Promise.resolve(ret).then(function () { resolve(true); }, function () { resolve(false); });
          return;
        } catch (e) {
          /* 落入浏览器降级 */
        }
      }
      try {                                    // 浏览器降级：下载 PNG
        var name = (hero && hero.id) ? String(hero.id) : 'card';
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'guofeng-' + name + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        resolve(true);
      } catch (e2) {
        resolve(false);
      }
    });
  }

  window.XhsBridge = {
    available: available,
    postNote: postNote,
    saveImage: saveImage
  };
})();
