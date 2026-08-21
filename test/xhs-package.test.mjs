import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { assertCompliantHtml, assertCompliantJavaScript } from '../scripts/xhs-policy.mjs';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedExtensions = new Set([
  '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json'
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test('build:xhs creates one self-contained compliant package', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'herocards-xhs-'));
  const outputDir = path.join(tempDir, 'xhs');
  try {
    const result = spawnSync(process.execPath, ['scripts/build-xhs.mjs', '--output', outputDir], {
      cwd: repoDir,
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const files = walk(outputDir);
    const relFiles = files.map((file) => path.relative(outputDir, file));
    assert.deepEqual(relFiles.filter((file) => path.extname(file) === '.html'), ['index.html']);
    assert.ok(relFiles.every((file) => allowedExtensions.has(path.extname(file).toLowerCase())));
    assert.equal(relFiles.some((file) => /\.otf$|assets\/portraits\/full\//i.test(file)), false);
    assert.equal(relFiles.filter((file) => /^assets\/portraits\/runtime\/.*\.jpg$/.test(file)).length, 48);
    assert.equal(relFiles.filter((file) => /^assets\/portraits\/thumbs\/.*\.jpg$/.test(file)).length, 24);

    const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
    assert.ok(totalBytes <= 40 * 1024 * 1024, `package is ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);

    const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
    assert.doesNotThrow(() => assertCompliantHtml(html));
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.ok(scripts.length > 0);
    assert.ok(scripts.every((match) => /\bsrc=["'][^"']+["']/i.test(match[1]) && match[2].trim() === ''));
    assert.doesNotMatch(html, /\son\w+\s*=|javascript:|<\s*(?:iframe|object)\b|\bdownload\b/i);
    assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);

    const appSource = fs.readFileSync(path.join(outputDir, 'js/app.js'), 'utf8');
    assert.doesNotMatch(appSource, /preloadPortraits\(HEROES\)/);

    const atlasSvg = fs.readFileSync(path.join(outputDir, 'assets/atlas/map-projected.svg'), 'utf8');
    assert.doesNotMatch(atlasSvg, /data:image\//);
    assert.doesNotMatch(atlasSvg, /<image\b/);

    const jsSource = relFiles.filter((file) => file.endsWith('.js'))
      .map((file) => fs.readFileSync(path.join(outputDir, file), 'utf8')).join('\n');
    assert.doesNotThrow(() => assertCompliantJavaScript(jsSource));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('XHS policy rejects inline script bodies and disabled APIs', () => {
  assert.throws(
    () => assertCompliantHtml('<script src="app.js">window.prompt("x")</script>'),
    /标签体必须为空/
  );
  for (const source of [
    'window.prompt("x")',
    'navigator.serviceWorker.register("sw.js")',
    'document.execCommand("copy")',
    'navigator.bluetooth.requestDevice({})',
    'new DeviceMotionEvent("x")',
    'navigator.mediaDevices.enumerateDevices()',
    'navigator.storage.persist()',
    'new PaymentRequest([], {})',
    'document.createElement("iframe")',
    'link.download = "x.png"'
  ]) {
    assert.throws(() => assertCompliantJavaScript(source), /禁用能力/);
  }
});

test('build:xhs refuses to erase an existing custom output directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'herocards-xhs-safety-'));
  const outputDir = path.join(tempDir, 'existing');
  const sentinel = path.join(outputDir, 'keep.txt');
  try {
    fs.mkdirSync(outputDir);
    fs.writeFileSync(sentinel, 'user data');
    const result = spawnSync(process.execPath, ['scripts/build-xhs.mjs', '--output', outputDir], {
      cwd: repoDir,
      encoding: 'utf8'
    });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'user data');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
