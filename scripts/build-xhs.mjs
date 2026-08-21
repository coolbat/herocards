import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertCompliantCss,
  assertCompliantHtml,
  assertCompliantJavaScript,
  assertCompliantMarkup
} from './xhs-policy.mjs';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputDir = path.join(repoDir, 'dist/xhs');
const outputFlag = process.argv.indexOf('--output');
const outputDir = path.resolve(outputFlag >= 0 && process.argv[outputFlag + 1]
  ? process.argv[outputFlag + 1]
  : defaultOutputDir);

if (outputDir === repoDir || outputDir === path.parse(outputDir).root) {
  throw new Error(`拒绝清理不安全的输出目录：${outputDir}`);
}
const isDefaultOutput = outputDir === defaultOutputDir;
if (!isDefaultOutput && fs.existsSync(outputDir)) {
  throw new Error(`自定义输出目录已存在，拒绝覆盖：${outputDir}`);
}
if (isDefaultOutput && fs.existsSync(outputDir) && fs.lstatSync(outputDir).isSymbolicLink()) {
  throw new Error(`默认输出目录不能是符号链接：${outputDir}`);
}

const files = [
  'index.html',
  'assets/icon.svg',
  'css/style.css',
  'js/heroes-data.js',
  'js/card-art.js',
  'js/atlas-data.js',
  'js/map-geometry.js',
  'js/atlas-map.js',
  'js/xhs-bridge.js',
  'js/app.js',
  'assets/fonts/MaShanZheng-subset.woff2',
  'assets/atlas/map-projected.svg',
  'assets/atlas/map-terrain-natural-earth-v2.jpg',
  'assets/atlas/terrain-manifest.json'
];

const runtimeDir = path.join(repoDir, 'assets/portraits/runtime');
const runtimeFiles = fs.readdirSync(runtimeDir)
  .filter((name) => name.endsWith('.jpg'))
  .sort()
  .map((name) => path.posix.join('assets/portraits/runtime', name));

if (runtimeFiles.length !== 48) {
  throw new Error(`运行插画应为 48 张，实际为 ${runtimeFiles.length} 张`);
}

const thumbnailDir = path.join(repoDir, 'assets/portraits/thumbs');
const thumbnailFiles = fs.readdirSync(thumbnailDir)
  .filter((name) => name.endsWith('-full.jpg'))
  .sort()
  .map((name) => path.posix.join('assets/portraits/thumbs', name));
if (thumbnailFiles.length !== 24) {
  throw new Error(`图鉴缩略图应为 24 张，实际为 ${thumbnailFiles.length} 张`);
}

const manifest = files.concat(runtimeFiles, thumbnailFiles);
const packageSet = new Set(manifest);
const heroSource = fs.readFileSync(path.join(repoDir, 'js/heroes-data.js'), 'utf8');
const artReferences = [...heroSource.matchAll(/\bfullArt(?:Height)?\s*:\s*["'](assets\/portraits\/runtime\/[^"']+)["']/g)]
  .map((match) => match[1])
  .filter((relative) => !relative.endsWith('/xxx.jpg'));
if (artReferences.length !== 48 || artReferences.some((relative) => !packageSet.has(relative))) {
  throw new Error('人物运行图引用与小工具包 manifest 不一致');
}
const thumbnailReferences = artReferences.filter((relative) => relative.endsWith('-full.jpg'))
  .map((relative) => relative.replace('assets/portraits/runtime/', 'assets/portraits/thumbs/'));
if (thumbnailReferences.length !== 24 || thumbnailReferences.some((relative) => !packageSet.has(relative))) {
  throw new Error('图鉴缩略图引用与小工具包 manifest 不一致');
}
fs.rmSync(outputDir, { recursive: true, force: true });

for (const relative of manifest) {
  const source = path.join(repoDir, relative);
  const target = path.join(outputDir, relative);
  if (!fs.statSync(source).isFile()) throw new Error(`资源不是文件：${relative}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const allowedExtensions = new Set([
  '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json'
]);
const htmlFiles = manifest.filter((file) => path.extname(file) === '.html');
if (htmlFiles.length !== 1 || htmlFiles[0] !== 'index.html') {
  throw new Error('小工具包必须且只能包含 index.html 一个入口');
}
for (const relative of manifest) {
  if (!allowedExtensions.has(path.extname(relative).toLowerCase())) {
    throw new Error(`不受支持的文件类型：${relative}`);
  }
}

const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
assertCompliantHtml(html);

for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
  const relative = match[1].split(/[?#]/)[0];
  if (relative && !packageSet.has(relative)) throw new Error(`入口引用缺失：${relative}`);
}
for (const match of html.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) {
  const relative = match[1].split(/[?#]/)[0];
  if (relative && !packageSet.has(relative)) throw new Error(`入口字体引用缺失：${relative}`);
}

const jsSource = manifest.filter((file) => file.endsWith('.js'))
  .map((file) => fs.readFileSync(path.join(outputDir, file), 'utf8')).join('\n');
assertCompliantJavaScript(jsSource);

const css = fs.readFileSync(path.join(outputDir, 'css/style.css'), 'utf8');
assertCompliantCss(css);
for (const relative of manifest.filter((file) => file.endsWith('.svg'))) {
  assertCompliantMarkup(fs.readFileSync(path.join(outputDir, relative), 'utf8'), relative);
}

const totalBytes = manifest.reduce((sum, relative) => {
  return sum + fs.statSync(path.join(outputDir, relative)).size;
}, 0);
const projectBudget = 40 * 1024 * 1024;
if (totalBytes > projectBudget) {
  throw new Error(`小工具包 ${(totalBytes / 1024 / 1024).toFixed(1)} MiB，超过项目 40 MiB 预算`);
}

console.log(`XHS package: ${manifest.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);
console.log(outputDir);
