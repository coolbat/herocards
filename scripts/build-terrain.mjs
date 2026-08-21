import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import AtlasModel from '../js/atlas-data.js';
import MapGeometry from '../js/map-geometry.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const sourceUrl = 'https://naturalearth.s3.amazonaws.com/10m_raster/SR_HR.zip';
const sourceSha256 = 'b2619fff2fc73c17152983c066adfaa25c4b626916b822bad2fae8bcd9be41a5';
const cacheDir = path.join(rootDir, '.cache/terrain');

function fileFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return path.resolve(fallback);
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a file path`);
  return path.resolve(value);
}

const sourcePath = fileFlag('--source', path.join(cacheDir, 'SR_HR.zip'));
const outputPath = fileFlag('--output', path.join(rootDir, AtlasModel.asset.skinSrc));
const manifestPath = fileFlag('--manifest', path.join(rootDir, AtlasModel.asset.terrainManifest));

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function downloadSource() {
  if (fs.existsSync(sourcePath)) return;
  await fsp.mkdir(path.dirname(sourcePath), { recursive: true });
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Natural Earth 下载失败：HTTP ${response.status}`);
  const temporaryPath = `${sourcePath}.partial`;
  await fsp.writeFile(temporaryPath, Buffer.from(await response.arrayBuffer()));
  await fsp.rename(temporaryPath, sourcePath);
}

await downloadSource();
const actualSourceHash = sha256(sourcePath);
if (actualSourceHash !== sourceSha256) {
  throw new Error(`Natural Earth 源文件校验失败：${actualSourceHash}`);
}

const bounds = MapGeometry.fullCanvasBounds(AtlasModel);
await fsp.mkdir(path.dirname(outputPath), { recursive: true });
const render = spawnSync('python3', [
  path.join(scriptDir, 'render-terrain.py'),
  '--source', sourcePath,
  '--output', outputPath,
  '--width', String(AtlasModel.projection.width),
  '--height', String(AtlasModel.projection.height),
  '--west', String(bounds.west),
  '--south', String(bounds.south),
  '--east', String(bounds.east),
  '--north', String(bounds.north)
], { cwd: rootDir, encoding: 'utf8' });
if (render.status !== 0) {
  throw new Error(render.stderr || render.stdout || '真实地形渲染失败');
}
const renderMetadata = JSON.parse(render.stdout.trim());

const outputStats = await fsp.stat(outputPath);
const manifest = {
  schemaVersion: 1,
  provider: 'Natural Earth',
  product: '1:10m Shaded Relief Basic',
  pageRelease: '3.2.0',
  embeddedVersion: '2.0.0',
  terrainBasis: 'Downsampled SRTM Plus elevation-derived shaded relief',
  source: {
    url: sourceUrl,
    archive: 'SR_HR.zip',
    raster: 'SR_HR.tif',
    sha256: sourceSha256,
    crs: 'EPSG:4326',
    dimensions: [21600, 10800]
  },
  license: {
    id: 'public-domain',
    url: 'https://www.naturalearthdata.com/about/terms-of-use/'
  },
  projectionId: AtlasModel.projection.id,
  canvas: {
    width: AtlasModel.projection.width,
    height: AtlasModel.projection.height,
    bounds: Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Number(value.toFixed(9))]))
  },
  renderer: {
    id: 'natural-earth-qinglu-pillow-v1',
    script: 'scripts/render-terrain.py',
    requirements: 'scripts/requirements-terrain.txt',
    dependencies: renderMetadata.dependencies,
    palette: 'azurite-malachite-ochre-programmatic',
    aiGeometry: false
  },
  output: {
    file: path.relative(rootDir, outputPath).split(path.sep).join('/'),
    format: 'jpeg',
    bytes: outputStats.size,
    sha256: sha256(outputPath),
    spatialAnalysis: renderMetadata.spatialAnalysis
  }
};
await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`terrain ${path.relative(rootDir, outputPath)} (${(outputStats.size / 1024).toFixed(1)} KiB)`);
console.log(`manifest ${path.relative(rootDir, manifestPath)}`);
