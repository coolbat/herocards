/* ============================================================================
 * js/xhs-bridge.js — 小红书小工具端能力桥（判空降级）
 * ----------------------------------------------------------------------------
 * 暴露 window.XhsBridge：
 *   available()            → boolean  是否在小红书小工具环境
 *   postNote(hero, dataUrl)→ Promise<boolean>  调起笔记发布页（浏览器里隐藏入口，不会调到）
 *   saveImage(hero, dataUrl) → Promise<boolean>  写临时文件后保存到相册
 *
 * 端能力参数按 2026-08-11《小工具容器 · 能力清单》封装。
 * 所有端能力调用都包 try/catch，任何异常返回 false，不触发容器禁用的下载降级。
 * ========================================================================== */
(function () {
  'use strict';

  function api() {
    return (typeof window !== 'undefined' && window.xhs && window.xhs.miniTool) || null;
  }

  function available() {
    return !!api();
  }

  function mediaPath(x, dataUrl) {
    if (!dataUrl) return Promise.reject(new Error('图片数据为空'));
    if (!x || typeof x.writeTempFile !== 'function') return Promise.resolve(dataUrl);
    return Promise.resolve(x.writeTempFile({ data: dataUrl })).then(function (result) {
      if (!result || !result.filePath) throw new Error('writeTempFile 未返回 filePath');
      return result.filePath;
    });
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
    var x = api();
    if (!x || typeof x.postNote !== 'function' || !dataUrl) return Promise.resolve(false);
    var p = notePayload(hero);
    return mediaPath(x, dataUrl).then(function (filePath) {
      return x.postNote({
        title: p.title,
        content: p.content,
        mediaInfo: {
          image_resources: [{ url: filePath }]
        }
      });
    }).then(function () { return true; }, function () { return false; });
  }

  /**
   * 保存卡面到相册。优先把 base64 写成临时文件，避免桥接超长字符串；
   * 非小工具环境或任一端能力失败都返回 false。临时路径即用即弃。
   */
  function saveImage(hero, dataUrl) {
    var x = api();
    if (!x || typeof x.saveImageToPhotosAlbum !== 'function' || !dataUrl) {
      return Promise.resolve(false);
    }
    return mediaPath(x, dataUrl).then(function (filePath) {
      return x.saveImageToPhotosAlbum({ filePath: filePath });
    }).then(function () { return true; }, function () { return false; });
  }

  window.XhsBridge = {
    available: available,
    postNote: postNote,
    saveImage: saveImage
  };
})();
