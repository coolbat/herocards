# 生平行旅图坐标方案

## 当前实现

运行时地图由三层组成：

1. `js/atlas-data.js` 是唯一地理数据源。人物路线只保存地点 ID，地点注册表保存经纬度、定位精度、置信度和来源说明。
2. `js/map-geometry.js` 使用 `web-mercator-eurasia-indian-ocean-v1` 投影，把经纬度转换为 2400×1600 的地图坐标，并按路线范围计算初始镜头。
3. `js/atlas-map.js` 只负责渲染和交互。它加载同一投影生成的 `assets/atlas/map-projected.svg`，绘制路线、点位、精度提示，并提供拖动、惯性、滚轮/双指和按钮缩放。

`heroes-data.js` 中的 `x/y` 仍供旧的长卷测试页使用；原有 `mx/my` 图片百分比坐标已删除，正式地图不会读取它们。

## 地点数据约定

每个地点至少声明：

```js
place_id: {
  label: '长安',
  modernName: '今陕西西安',
  coordinates: [108.94, 34.34], // [经度, 纬度]
  precision: 'city',            // site | city | region | unknown
  confidence: 'high',           // high | medium | low
  source: '...',
  note: '...'
}
```

- 同一历史地点必须复用同一个 ID，避免不同人物出现不同位置。
- “中原、江南、漫游、归途”等叙事范围不得标成遗址级或城市级精度。
- 存疑地点可以落一个用于叙事展示的代表点，但必须使用 `region`/`unknown` 和相应置信度，界面会以虚线印章和文字提示表达不确定性。
- 路线虚线表达叙事先后，不代表历史道路、航道或测绘轨迹。

## 地图资产

正式底图由 Natural Earth 的陆地、湖泊、河流和国界 GeoJSON 构建，源文件放在 `assets/atlas/sources/`，许可和来源见 `assets/atlas/ATTRIBUTION.md`。

底图上另有 `assets/atlas/map-skin-qianli-v1.png` 青绿山水皮肤。它只负责山峦、色彩和 2.5D 层次：构建时会被陆地矢量轮廓裁切，海岸线、国界、中国轮廓、湖泊和河流随后以同一投影重新叠加。换言之，AI 图片不会参与地点定位，也不会决定大陆形状；中国大陆轮廓来自 Natural Earth Admin 0 矢量数据。

为便于静态页面稳定加载，生成脚本会把 PNG 皮肤嵌入 SVG。更换皮肤后必须重新运行构建命令，不能只覆盖 SVG 或 PNG 中的一个。

重新生成底图：

```bash
npm run build:atlas
```

生成脚本和运行时共用 `MapGeometry.project`，因此底图与点位不会因两套投影公式发生漂移。修改投影边界、画布尺寸或 ID 时，必须同步更新 `ATLAS_MODEL.projection`，重新构建 SVG，并运行测试。

## 旧 2.5D 图片校准

`test/atlas-calibration.html` 是旧 `map.webp` 的控制点校准工具。校准数据位于 `ATLAS_MODEL.legacyCalibration`，通过分片仿射三角网把已知经纬度映射到图片像素。

它只用于比较和复用旧美术，不是正式地图的坐标来源。三角网之外的地点会返回“未定位”，不会外推伪精确坐标；例如旧图不能可靠覆盖忽鲁谟斯和麻林。

## 验证

```bash
npm run check
```

自动检查覆盖：24 位人物的全部生平站点、地点字段完整性、重复地点复用、郑和跨洲方向关系、旧图控制点、投影资产一致性、局部/跨洲路线镜头范围，以及人物数据不再携带 `mx/my`。

新增或修改地点后，还应在 390×844 真视口检查：点位故事卡、放大缩小、四向拖动、区域/存疑标识和密集标签。
