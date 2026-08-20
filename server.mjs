#!/usr/bin/env node
/* ============================================================================
   艾泽拉斯英雄志 · 本地预览静态服务器（零依赖）
   ----------------------------------------------------------------------------
   兼容 Kimi Work 预览生命周期：npm run dev 时可能追加 --port / --host 参数，
   也支持 PORT / HOST 环境变量；默认 0.0.0.0:7100。
   ========================================================================== */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));

/* ---------------------------------------------------------- 参数解析 */
function parseArgs(argv) {
  const args = { port: Number(process.env.PORT) || 7100, host: process.env.HOST || '0.0.0.0' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    const take = (v) => (v !== undefined && !v.startsWith('--') ? v : undefined);
    if (a === '--port' || a === '-p' || a === '--listen' || a === '-l') {
      const v = take(next);
      if (v !== undefined) { args.port = Number(v) || args.port; i++; }
    } else if (a.startsWith('--port=')) {
      args.port = Number(a.slice(7)) || args.port;
    } else if (a === '--host' || a === '--bind' || a === '-a' || a === '--address') {
      const v = take(next);
      if (v !== undefined) { args.host = v; i++; }
    } else if (a.startsWith('--host=')) {
      args.host = a.slice(7);
    } else if (/^\d{2,5}$/.test(a)) {
      args.port = Number(a); // 兼容裸端口参数
    }
  }
  return args;
}

/* ---------------------------------------------------------- MIME 表 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
};

/* ---------------------------------------------------------- 服务器 */
const { port, host } = parseArgs(process.argv.slice(2));

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    // 防目录穿越：解析后的绝对路径必须仍在项目根内
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let target = filePath;
    const st = await stat(target).catch(() => null);
    if (st && st.isDirectory()) target = join(target, 'index.html');
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(port, host, () => {
  console.log(`艾泽拉斯英雄志 · 预览服务已启动  http://localhost:${port}/`);
});
