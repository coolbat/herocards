import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import AtlasModel from '../js/atlas-data.js';
import MapGeometry from '../js/map-geometry.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const sourceDir = path.join(rootDir, 'assets/atlas/sources');
const outputFlagIndex = process.argv.indexOf('--output');
if (outputFlagIndex >= 0 && !process.argv[outputFlagIndex + 1]) {
  throw new Error('--output requires a file path');
}
const outputPath = outputFlagIndex >= 0
  ? path.resolve(process.cwd(), process.argv[outputFlagIndex + 1])
  : path.join(rootDir, 'assets/atlas/map-projected.svg');
const skinPath = path.join(rootDir, AtlasModel.asset.skinSrc);
const { width, height } = AtlasModel.projection;

function n(value) {
  return Number(value.toFixed(1));
}

function project(coordinates) {
  return MapGeometry.project(coordinates, AtlasModel);
}

function clipEdge(points, inside, intersect) {
  const output = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[(i + points.length - 1) % points.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside) {
      if (!previousInside) output.push(intersect(previous, current));
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
  }
  return output;
}

function clipPolygon(points) {
  let clipped = points;
  clipped = clipEdge(clipped, (p) => p.x >= 0, (a, b) => ({ x: 0, y: a.y + (b.y - a.y) * (0 - a.x) / (b.x - a.x) }));
  clipped = clipEdge(clipped, (p) => p.x <= width, (a, b) => ({ x: width, y: a.y + (b.y - a.y) * (width - a.x) / (b.x - a.x) }));
  clipped = clipEdge(clipped, (p) => p.y >= 0, (a, b) => ({ x: a.x + (b.x - a.x) * (0 - a.y) / (b.y - a.y), y: 0 }));
  clipped = clipEdge(clipped, (p) => p.y <= height, (a, b) => ({ x: a.x + (b.x - a.x) * (height - a.y) / (b.y - a.y), y: height }));
  return clipped;
}

function ringPath(ring) {
  const points = clipPolygon(ring.map(project));
  if (points.length < 3) return '';
  return `M${points.map((point) => `${n(point.x)},${n(point.y)}`).join('L')}Z`;
}

function polygonPath(coordinates) {
  return coordinates.map(ringPath).filter(Boolean).join('');
}

function geometryPath(geometry) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') return polygonPath(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(polygonPath).join('');
  return '';
}

function linePath(coordinates) {
  const points = coordinates.map(project);
  if (points.length < 2) return '';
  return `M${points.map((point) => `${n(point.x)},${n(point.y)}`).join('L')}`;
}

function lineGeometryPath(geometry) {
  if (!geometry) return '';
  if (geometry.type === 'LineString') return linePath(geometry.coordinates);
  if (geometry.type === 'MultiLineString') return geometry.coordinates.map(linePath).join('');
  return '';
}

function featurePaths(collection, converter) {
  return collection.features.map((feature) => converter(feature.geometry)).filter(Boolean).join('');
}

function graticulePath() {
  const paths = [];
  for (let lon = 40; lon <= 140; lon += 10) {
    const line = [];
    for (let lat = -10; lat <= 58; lat += 1) line.push([lon, lat]);
    paths.push(linePath(line));
  }
  for (let lat = -10; lat <= 50; lat += 10) {
    const line = [];
    for (let lon = 32; lon <= 145; lon += 1) line.push([lon, lat]);
    paths.push(linePath(line));
  }
  return paths.join('');
}

const [land, rivers, lakes, countries, skinBuffer] = await Promise.all([
  fs.readFile(path.join(sourceDir, 'ne_110m_land.geojson'), 'utf8').then(JSON.parse),
  fs.readFile(path.join(sourceDir, 'ne_110m_rivers_lake_centerlines.geojson'), 'utf8').then(JSON.parse),
  fs.readFile(path.join(sourceDir, 'ne_110m_lakes.geojson'), 'utf8').then(JSON.parse),
  fs.readFile(path.join(sourceDir, 'ne_110m_admin_0_countries.geojson'), 'utf8').then(JSON.parse),
  fs.readFile(skinPath)
]);

const landPath = featurePaths(land, geometryPath);
const riverPath = featurePaths(rivers, lineGeometryPath);
const lakePath = featurePaths(lakes, geometryPath);
const countryBoundaryPath = featurePaths(countries, geometryPath);
const china = countries.features.find((feature) => feature.properties.ISO_A3 === 'CHN');
if (!china) throw new Error('China boundary is missing from Natural Earth admin-0 data');
const chinaPath = geometryPath(china.geometry);
const skinMime = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
]).get(path.extname(skinPath).toLowerCase());
if (!skinMime) throw new Error(`Unsupported atlas skin format: ${path.extname(skinPath)}`);
const skinDataUri = `data:${skinMime};base64,${skinBuffer.toString('base64')}`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img"
  aria-labelledby="atlas-title atlas-desc" data-projection="${AtlasModel.projection.id}"
  data-skin="${AtlasModel.asset.skinStyle}" data-boundary-source="natural-earth-admin-0-110m">
  <title id="atlas-title">华夏人物行旅地理底图</title>
  <desc id="atlas-desc">Natural Earth 地理轮廓经 Web Mercator 投影生成，叠加青绿山水地貌皮肤与中国大陆轮廓。</desc>
  <metadata>Geographic source: Natural Earth public domain; terrain skin: qianli-qinglu-v1; generated by scripts/build-atlas.mjs.</metadata>
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#173f4a"/><stop offset="1" stop-color="#0d303b"/></linearGradient>
    <linearGradient id="land" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#c8ba72"/><stop offset=".52" stop-color="#789d70"/><stop offset="1" stop-color="#346f66"/></linearGradient>
    <pattern id="paper" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M0 18 Q20 7 40 18 T80 18 M-20 58 Q0 47 20 58 T60 58 T100 58" fill="none" stroke="#f3ddb0" stroke-opacity=".08" stroke-width="2"/></pattern>
    <filter id="land-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="12" stdDeviation="8" flood-color="#071d22" flood-opacity=".75"/></filter>
    <filter id="china-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="frame"><rect width="${width}" height="${height}" rx="24"/></clipPath>
    <clipPath id="land-clip"><path d="${landPath}" fill-rule="evenodd"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${width}" height="${height}" fill="url(#sea)"/>
    <path d="${graticulePath()}" fill="none" stroke="#ecd990" stroke-opacity=".10" stroke-width="1.5"/>
    <path d="${landPath}" transform="translate(0 13)" fill="#594b2d" fill-rule="evenodd" opacity=".72"/>
    <path d="${landPath}" fill="url(#land)" fill-rule="evenodd" filter="url(#land-shadow)"/>
    <image data-source-href="${path.basename(skinPath)}" href="${skinDataUri}" x="0" y="0" width="${width}" height="${height}"
      preserveAspectRatio="none" clip-path="url(#land-clip)" opacity=".96"/>
    <path d="${landPath}" fill="none" fill-rule="evenodd" stroke="#d6b65f" stroke-width="4" stroke-linejoin="round"/>
    <path d="${countryBoundaryPath}" fill="none" fill-rule="evenodd" stroke="#5b573c" stroke-opacity=".46" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="${chinaPath}" fill="#2d826f" fill-opacity=".10" stroke="#143f42" stroke-opacity=".74" stroke-width="11" stroke-linejoin="round"/>
    <path id="china-mainland-outline" d="${chinaPath}" fill="none" stroke="#f2d487" stroke-width="5" stroke-linejoin="round" filter="url(#china-glow)"/>
    <path d="${lakePath}" fill="#1d5961" stroke="#c7ad67" stroke-width="2" fill-rule="evenodd"/>
    <path d="${riverPath}" fill="none" stroke="#74c9c5" stroke-opacity=".72" stroke-width="3" stroke-linecap="round"/>
    <rect width="${width}" height="${height}" fill="url(#paper)"/>
    <path d="M0 75 Q320 12 640 70 T1280 65 T1920 80 T2560 62" fill="none" stroke="#f8e9bf" stroke-opacity=".12" stroke-width="28"/>
  </g>
</svg>
`;

await fs.writeFile(outputPath, svg);
console.log(`generated ${path.relative(rootDir, outputPath)} (${Buffer.byteLength(svg)} bytes)`);
