#!/usr/bin/env node
/* 组装 GitHub Pages 发布目录（dist/pages/）：
 *
 *   index.html   双主题落地页（site/index.html）
 *   app.html     国风主站（= 仓库 index.html，原样复制）
 *   wow.html     魔兽英雄展示页
 *   css/ js/     两个应用共享的样式与脚本（置于站点根，相对路径不变）
 *   assets/      运行期资产子集（与国风小工具包同口径 + 魔兽肖像/希瓦全幅）
 *
 * 只复制、不改写；末尾校验 HTML 引用的相对路径全部存在。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(repoDir, 'dist/pages');

const copies = [
  // [源（仓库相对）, 目标（发布目录相对）]
  ['site/index.html', 'index.html'],
  ['guofeng.html', 'app.html'],
  ['wow.html', 'wow.html'],
  ['css/guofeng.css', 'css/guofeng.css'],
  ['css/wow.css', 'css/wow.css'],
  ['js/heroes-data.js', 'js/heroes-data.js'],
  ['js/card-art.js', 'js/card-art.js'],
  ['js/atlas-data.js', 'js/atlas-data.js'],
  ['js/map-geometry.js', 'js/map-geometry.js'],
  ['js/atlas-map.js', 'js/atlas-map.js'],
  ['js/showcase.js', 'js/showcase.js'],
  ['js/heroes-data-wow.js', 'js/heroes-data-wow.js'],
  ['assets/icon.svg', 'assets/icon.svg'],
  ['assets/fonts/MaShanZheng-subset.woff2', 'assets/fonts/MaShanZheng-subset.woff2'],
  ['assets/atlas/map-projected.svg', 'assets/atlas/map-projected.svg'],
  ['assets/atlas/map-terrain-natural-earth-v2.webp', 'assets/atlas/map-terrain-natural-earth-v2.webp'],
  ['assets/atlas/terrain-manifest.json', 'assets/atlas/terrain-manifest.json']
];

function collectDir(relative, predicate) {
  const dir = path.join(repoDir, relative);
  return fs.readdirSync(dir)
    .filter((name) => predicate(name) && fs.statSync(path.join(dir, name)).isFile())
    .sort()
    .map((name) => [path.posix.join(relative, name), path.posix.join(relative, name)]);
}

copies.push(
  ...collectDir('assets/portraits/runtime', (n) => n.endsWith('.webp')),
  ...collectDir('assets/portraits/thumbs', (n) => n.endsWith('-full.webp')),
  ...collectDir('assets/portraits/wow-runtime', (n) => n.endsWith('.webp')),
  ...collectDir('assets/portraits', (n) => n.endsWith('.webp')),   // 24 张魔兽旧版油画肖像
  ...collectDir('assets/seals', (n) => n.endsWith('.png'))
);

fs.rmSync(outputDir, { recursive: true, force: true });

let totalBytes = 0;
for (const [source, target] of copies) {
  const src = path.join(repoDir, source);
  const dst = path.join(outputDir, target);
  if (!fs.statSync(src).isFile()) throw new Error(`资源不是文件：${source}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  totalBytes += fs.statSync(src).size;
}
// GitHub Pages 无需 Jekyll 处理
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');

// 引用完整性：三个 HTML 的 src/href 与 url() 相对引用必须全部存在
const fileSet = new Set(copies.map(([, target]) => target));
for (const page of ['index.html', 'app.html', 'wow.html']) {
  const html = fs.readFileSync(path.join(outputDir, page), 'utf8');
  const refs = [
    ...[...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...html.matchAll(/url\(["']?([^"')]+)["']?\)/gi)].map((m) => m[1])
  ];
  for (const raw of refs) {
    const relative = raw.split(/[?#]/)[0];
    if (!relative || /^(https?:)?\/\//.test(relative) || relative.startsWith('data:')) continue;
    if (!fileSet.has(relative)) throw new Error(`${page} 引用了未打包的资源：${relative}`);
  }
}

console.log(`Pages site: ${copies.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);
console.log(outputDir);
