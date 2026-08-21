import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputFlag = process.argv.indexOf('--output');
const outputDir = path.resolve(outputFlag >= 0 && process.argv[outputFlag + 1]
  ? process.argv[outputFlag + 1]
  : path.join(repoDir, 'dist/xhs'));

if (outputDir === repoDir || outputDir === path.parse(outputDir).root) {
  throw new Error(`拒绝清理不安全的输出目录：${outputDir}`);
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
  'assets/atlas/map.webp',
  'assets/atlas/map-projected.svg',
  'assets/atlas/map-skin-qianli-v1.jpg'
];

const runtimeDir = path.join(repoDir, 'assets/portraits/runtime');
const runtimeFiles = fs.readdirSync(runtimeDir)
  .filter((name) => name.endsWith('.jpg'))
  .sort()
  .map((name) => path.posix.join('assets/portraits/runtime', name));

if (runtimeFiles.length !== 48) {
  throw new Error(`运行插画应为 48 张，实际为 ${runtimeFiles.length} 张`);
}

const manifest = files.concat(runtimeFiles);
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
const scriptTags = [...html.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script>/gi)];
if (!scriptTags.length || scriptTags.some((match) => !/\bsrc=["'][^"']+["']/i.test(match[1]))) {
  throw new Error('所有脚本必须通过包内 src 外置引用');
}
if (/\son\w+\s*=|javascript:|<\s*(?:iframe|object)\b|\bdownload\b/i.test(html)) {
  throw new Error('入口包含小工具容器禁用的 HTML 行为');
}
if (/(?:src|href)=["']https?:\/\//i.test(html)) {
  throw new Error('入口包含外部资源引用');
}

const packageSet = new Set(manifest);
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
const bannedJs = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|Worker|SharedWorker|WebAssembly)\b|\beval\s*\(|\bnew\s+Function\b|navigator\.(?:clipboard|geolocation)|requestFullscreen|window\.open\s*\(/;
if (bannedJs.test(jsSource)) throw new Error(`脚本包含禁用能力：${bannedJs.exec(jsSource)[0]}`);

const css = fs.readFileSync(path.join(outputDir, 'css/style.css'), 'utf8');
if (/url\(["']?https?:\/\//i.test(css) || /@import\b/i.test(css)) {
  throw new Error('样式包含外部资源');
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
