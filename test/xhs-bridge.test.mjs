import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadBridge(miniTool) {
  const window = { xhs: miniTool ? { miniTool } : undefined };
  const context = { window, Promise };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../js/xhs-bridge.js', import.meta.url), 'utf8'), context);
  return window.XhsBridge;
}

const hero = {
  id: 'libai',
  name: { zh: '李白' },
  title: { zh: '诗仙' },
  quote: '举杯邀明月，对影成三人。'
};

test('postNote sends the documented mediaInfo image schema', async () => {
  let received;
  const bridge = loadBridge({
    postNote(options) {
      received = options;
      return Promise.resolve({ errMsg: 'postNote:ok' });
    }
  });

  assert.equal(await bridge.postNote(hero, 'data:image/png;base64,abc'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(received)), {
    title: '我在「华夏人物图鉴」请到了李白',
    content: '每日一签，今日遇见李白 · 诗仙。\n举杯邀明月，对影成三人。\n#小红书vibecoding大赛 #国风vibecoding',
    mediaInfo: {
      image_resources: [{ url: 'data:image/png;base64,abc' }]
    }
  });
});

test('saveImage writes a temporary file before saving to the album', async () => {
  const calls = [];
  const bridge = loadBridge({
    writeTempFile(options) {
      calls.push(['writeTempFile', options]);
      return Promise.resolve({ errMsg: 'writeTempFile:ok', filePath: '/tmp/card.png' });
    },
    saveImageToPhotosAlbum(options) {
      calls.push(['saveImageToPhotosAlbum', options]);
      return Promise.resolve({ errMsg: 'saveImageToPhotosAlbum:ok' });
    }
  });

  assert.equal(await bridge.saveImage(hero, 'data:image/png;base64,abc'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['writeTempFile', { data: 'data:image/png;base64,abc' }],
    ['saveImageToPhotosAlbum', { filePath: '/tmp/card.png' }]
  ]);
});

test('saveImage fails cleanly outside the container without using downloads', async () => {
  const bridge = loadBridge(null);
  assert.equal(await bridge.saveImage(hero, 'data:image/png;base64,abc'), false);
});
