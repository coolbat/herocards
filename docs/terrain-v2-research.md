# Terrain v2：真实地形与青绿山水皮肤研究

研究日期：2026-08-21  
范围：Herocards 当前 `32°E–145°E、12°S–58°N`、2400×1600 的静态 Web Mercator 亚洲地图。

## 结论

> 实施状态（2026-08-21）：Phase 0 已落地。当前运行资产为
> `assets/atlas/map-terrain-natural-earth-v2.jpg`，来源、校验和、投影画布范围与输出哈希见
> `assets/atlas/terrain-manifest.json`；中国局部 Copernicus GLO-30 仍保留为未来深度缩放阶段。

当前产品建议直接使用 **Natural Earth 1:10m Shaded Relief 作为真实山势底层**，重新投影后进行青绿设色；其源分辨率与本项目最大显示尺度接近，地形又和现有 Natural Earth 矢量专门配准。若需要从原始高程重新计算光照、坡度和海拔分层，正式母版优先使用 **GMTED2010 7.5 或 15 arc-second**。Copernicus DEM GLO-30 只保留给未来的中国局部深度缩放，不作为当前整幅亚洲地图的首选。

Natural Earth Shaded Relief 已经是适合小比例尺地图的静态阴影，但不是可计算高程的 DEM；它可以成为当前运行版的地形视觉真值，不能用于查询高度或重新计算坡度。若未来新增中国局部深度缩放，可用 Copernicus GLO-30，受阻时回退 NASADEM。

核心原则：

- DEM 决定山体位置、走向、坡度和阴影；AI 不得创造或移动山脉。
- 当前经纬度、路线点位、海岸和其他矢量仍由统一投影决定；地形栅格只是确定性的物理地理底层。
- DEM 不用于推断或裁定任何政治边界。行政边界继续作为独立矢量层处理。

## 先区分“分辨率”和“精度”

`AtlasModel.projection.bounds` 声明的地理内容范围在 EPSG:3857 中约为：

- `xmin=3562223.705`、`ymin=-1345708.408`
- `xmax=16141326.165`、`ymax=7967317.535`

但当前 projector 会在四周保留 padding，并按统一比例居中：地理内容在 2400×1600 画布中实际为约 1988×1472 px，左右各留约 206 px，上下各留 64 px。栅格若直接用上述地理内容范围填满整张画布，会和矢量点位发生明显横向漂移。

由同一 projector 反算出的**完整画布**范围约为 `20.298640°E–156.701360°E、15.532295°S–59.876223°N`；对应 EPSG:3857 为：

- `xmin=2259634.220`、`ymin=-1750622.580`
- `xmax=17443915.650`、`ymax=8372231.706`

因此完整画布约为 **6.33 km/px**，当前相机最大约放大 2.4 倍后仍只表达约 2.64 km/px。30 米 DEM 是离线母版的采样密度，不意味着最终网页还能显示 30 米细节。

按当前地理内容范围粗略估算，1 arc-second DEM 接近 4.1×10^5 × 2.5×10^5 个样本，Float32 未压缩就约 410 GB；为了最后不足 6000 px 宽的显示纹理下载整幅 30 m 亚洲母版并不划算。Natural Earth 1:10m 大图在本项目经度范围内约有 6780 px，已覆盖当前最大显示需求；需要原始高程时，250–500 m 的 GMTED2010 仍有充分余量。

这也意味着选型优先级应是：山系位置和连续性正确、空洞与异常少、许可清晰、投影和构建可复现；不能只比较“30 m”这个数字。

## 官方数据源比较

| 数据源 | 水平采样、覆盖与数据性质 | 垂直/水平精度 | 许可与获取 | 对本项目的判断 |
| --- | --- | --- | --- | --- |
| **Copernicus DEM GLO-30** | 全球 DSM；纬向 1 arc-second，约 30.9 m；1°×1° GeoTIFF/DTED；水平 CRS 为 WGS84，垂直基准为 EGM2008。DSM 包含植被、建筑和设施表面，但在本项目公里级输出中影响很小。[官方产品页](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) [产品手册](https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf) | 官方规格：绝对垂直 `<4 m` LE90；坡度不超过 20% 时相对垂直 `<2 m`，更陡时 `<4 m`；绝对水平 `<6 m` CE90。手册同时说明这些是全球算术平均，局部可以偏离。 | GLO-30/GLO-90 为免费许可，但不是 public domain；注册 CDSE/CCM 后可由 Browser、OData/API 或 S3 批量获取。发布修改产品必须使用官方指定来源声明。[访问说明](https://documentation.dataspace.copernicus.eu/Data/Others/CCM.html) [许可证](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf) | **局部深度缩放首选。** 精度、覆盖、质量层和版本说明最完整，但当前整幅亚洲范围会产生数百 GB 原始样本，明显过度。只能使用服务端降采样接口或限制到更小范围。 |
| **NASADEM HGT v001** | 1 arc-second/30 m；60°N–56°S，覆盖本项目完整纬度范围；1°×1° HGT。它重新处理原 SRTM 雷达回波，并使用 ICESat GLAS、ASTER GDEM、AW3D30 等辅助数据改善定位、空洞和系统误差。[产品页与 DOI](https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001) [用户指南](https://lpdaac.usgs.gov/documents/592/NASADEM_User_Guide_V1.pdf) | NASA 没有为合并后的 HGT 给出一个新的单值全球 LE90。用户指南列出的原 SRTM 任务要求是绝对垂直 16 m、绝对水平 20 m（90% 误差），并说明 NASADEM 的目标是进一步改善精度与覆盖；不能把辅助 precision 层误当绝对精度保证。 | NASA Earthdata 标注为 openly shared without restriction；一般需要免费 Earthdata Login 下载，并应引用 DOI。[数据使用指引](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy) [下载说明](https://urs.earthdata.nasa.gov/documentation/for_users/data_access) | **首选回退。** 获取和再分发规则简单，范围刚好覆盖当前 58°N 上界。EGM96 与 Copernicus 的 EGM2008 不同，不能未经基准处理就混合高程后计算坡度。 |
| **SRTMGL1 v003** | 1 arc-second/30 m；60°N–56°S；1°×1° HGT。v3 用 ASTER GDEM2、GMTED2010 或 NED 填补旧版空洞。[官方产品页](https://www.earthdata.nasa.gov/data/catalog/lpcloud-srtmgl1-003) [用户指南](https://lpdaac.usgs.gov/documents/179/SRTM_User_Guide_V3.pdf) | 任务要求为绝对垂直 16 m、绝对水平 20 m（90% 误差）；1 arc-second 是采样间距，不是垂直精度。 | NASA/LP DAAC 开放获取，通常通过 Earthdata Login；应引用数据集 DOI。 | **兼容性回退。** NASADEM 是更新的 SRTM 重处理结果，新增项目没有理由优先选旧 SRTM。 |
| **Natural Earth 1:10m Shaded Relief** | 不是“10 米 DEM”；`1:10m` 是制图比例尺。大图 21,600×10,800，中图 16,200×8,100；灰度阴影来自降采样 SRTM Plus，并按 Natural Earth 海岸裁切。[栅格总览](https://www.naturalearthdata.com/downloads/10m-raster-data/) [Shaded Relief](https://www.naturalearthdata.com/downloads/10m-raster-data/10m-shaded-relief/) | 已烘焙成图像，没有可查询高程，因此不存在可用于计算的垂直精度指标；小岛还包含制图增强。 | Natural Earth 的栅格和矢量均为 public domain，可修改、商用和再分发，无需许可。[使用条款](https://www.naturalearthdata.com/about/terms-of-use/) | **最快 PoC。** 适合验证“真实山势 + 青绿配色”的视觉关系，也可作低频阴影备份；不适合需要重新计算光照、坡度或高程分层的正式母版。 |
| **GMTED2010 7.5 arc-second** | 约 250 m；多数产品覆盖 84°N–56°S；面向全球和大陆尺度，提供 mean、median、maximum、breakline emphasis 等聚合产品。[USGS 产品页](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-global-multi-resolution-terrain-elevation) | USGS 给出的全球 RMSE：7.5″ 为 26–30 m，15″ 为 29–32 m，30″ 为 25–42 m；不同聚合产品范围不同。 | USGS 标注 public domain；通过 EarthExplorer 下载。 | **轻量正式备选。** 对最终 2–6 km/px 的静态地图仍明显过采样，数据量远小于 30 m DEM；但绝对精度和局部细节不及 Copernicus。 |
| **JAXA AW3D30 v4.x** | 全球 DSM；基本 1 arc-second/约 30 m，1°×1° GeoTIFF，带 MSK/QAI；高纬采用不同经向间隔。v4.1 的异常/空洞处理中也使用了 Copernicus GLO-30 等辅助 DEM。[产品页](https://www.eorc.jaxa.jp/ALOS/en/dataset/aw3d30/aw3d30_e) [v4.1 说明](https://www.eorc.jaxa.jp/ALOS/en/dataset/aw3d30/data/aw3d30v4.1_product_e_1.0.pdf) | v4 文档没有给出一个可当作全球保证的“AW3D30 5 m 精度”；QAI 按 `<5 m`、`<7 m`、`≥7 m` 分类，应逐 tile 查看，而不是把源 AW3D 的目标值套到 AW3D30。 | 商用和非商用均可按条款免费使用；下载需要注册，许可、署名和再分发要求应随版本留档。[下载与注册](https://www.eorc.jaxa.jp/ALOS/en/aw3d30/data/index.htm) [使用条款](https://earth.jaxa.jp/policy/en.html) | **可用但不优先。** 有质量与来源掩膜，但下载和合规管理更繁琐，而且部分区域已使用 Copernicus 填补，不能当完全独立的验证真值。 |

若以后要表现海底地貌，可另外评估 NOAA 的 [ETOPO 2022](https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ngdc.mgg.dem%3Aetopo_2022)。它是 15 arc-second 的全球陆海一体模型，但当前需求是陆地山势，不应为了海底数据替代质量更高的陆地 DEM。

## 推荐架构

### 1. 地理真值层

继续以 `AtlasModel.projection` 和同一套 Web Mercator 公式为唯一投影。DEM、陆地 mask、湖泊、河流、海岸、人物点位和路线必须使用同一裁剪范围；禁止在设计软件中再次自由缩放或拉伸地形图。

运行时叠放顺序建议为：

1. 海面和水纹；
2. DEM 派生的高程设色；
3. DEM 派生的多方向 hillshade 与坡度增强；
4. 低透明度的 AI/程序矿物颜料、绢本和云气纹理；
5. 确定性的陆地裁切、海岸、湖泊、河流和边界矢量；
6. 路线、点位、标签与故事卡。

这样即使完全移除 AI 纹理，山脉仍位于真实位置；替换画风也不会改变路线与地形的对应关系。

### 2. 离线地形管线

建议新增可重复构建脚本，而不是把巨量原始 DEM 提交到 Git：

1. 记录 `provider/product/version/DOI/acquired_at/tile list/checksum/license snapshot`。
2. 当前全图优先使用 Natural Earth 1:10m Shaded Relief；需要原始高程时获取 GMTED2010 7.5/15 arc-second。只有局部深度缩放才使用 Copernicus DGED GeoTIFF 和质量层。
3. 用 `gdalbuildvrt` 建立虚拟拼接，不先生成整幅未压缩亚洲 GeoTIFF。[GDAL VRT 文档](https://gdal.org/en/stable/programs/gdalbuildvrt.html)
4. 先由 `MapGeometry` 的同一 scale/offset 反算完整画布边界，再用 `gdalwarp` 一次性裁剪、重投影到 EPSG:3857，并显式设置该 `-te` 和输出尺寸；大比例降采样使用 `average`，避免 nearest 产生锯齿。[GDAL warp 文档](https://gdal.org/en/stable/programs/gdalwarp.html)
5. 先生成约 9600×6400 的离线处理母版，再计算 hillshade；这比最终画布高 4 倍，又不会承担原生 30 m 亚洲拼图的成本。
6. 用 `gdaldem hillshade -multidirectional` 生成均衡山体阴影，再以一层较弱的 315° 单向光增强 2.5D 方向感。[GDAL hillshade 文档](https://gdal.org/en/stable/programs/gdaldem.html)
7. 由真实 elevation/slope/aspect 生成青绿分层色，不让 AI 看见或重画海岸与山脊。
8. 下采样为交付纹理，优先测试 WebP/JPEG；嵌入现有 SVG 后继续满足 `<1.5 MB` 运行资产预算。

示意命令中的目标范围必须由项目投影代码生成，不手抄为另一套常量：

```bash
gdalbuildvrt -srcnodata -32767 -vrtnodata -32767 terrain.vrt tiles/*.tif

gdalwarp terrain.vrt terrain-3857.tif \
  -t_srs EPSG:3857 \
  -te 2259634.220 -1750622.580 17443915.650 8372231.706 \
  -ts 9600 6400 -r average -dstnodata -32767

gdaldem hillshade terrain-3857.tif hillshade-multi.tif \
  -multidirectional -compute_edges
```

示例数字只用于说明，正式脚本必须从 `AtlasModel.projection` 自动计算，不能复制为另一套手工常量。Web Mercator 是 EPSG:3857 的球面 Mercator 变体，适用于 Web 可视化，但存在比例尺失真；这里的目的不是测量面积或距离，而是和现有路线投影逐像素对齐。[PROJ Web Mercator 文档](https://proj.org/en/stable/operations/projections/webmerc.html) [EPSG 3857](https://epsg.org/crs_3857/WGS-84-Pseudo-Mercator.html)

### 3. 青绿美术规则

故宫博物院对《千里江山图》的说明明确提到石青、石绿矿物色为主，青绿有厚重与轻盈变化，并以赭色衬托层次。[故宫博物院藏品页](https://www.dpm.org.cn/collection/paint/228354.html)

据此可以程序化定义 palette，而不是要求 AI 生成“像地图的画”：

- 低地：低饱和石绿、淡赭和绢本暖色；
- 中高地：石绿向石青过渡，坡度越高轮廓越清晰；
- 高山：深石青/墨青承接真实 hillshade，向光面只做有限矿物亮色；
- 河谷和平原：降低阴影对比，给路线与标签留出可读空间；
- 纹理：AI 只生成无方向、可平铺、无文字的绢本颗粒、矿物结晶和薄雾 mask，建议低于 10–15% opacity。

AI 纹理提示词应明确禁止：山峰、山脊、河流、海岸、岛屿、建筑、文字、印章、路线、标记和任何可识别地理形状。所有“山峦起伏”来自 DEM 阴影，不来自生成图。

## 实施顺序

### Phase 0：一轮视觉验证

- 下载 Natural Earth Shaded Relief 大图；
- 重投影并裁到当前范围；
- 以程序化石青、石绿、赭色梯度给灰度阴影设色，直接替换现有 AI 山脉皮肤；当前 AI 图只保留为颜色参考，不再进入结构层；
- 检查喜马拉雅、天山、昆仑、横断、秦岭等大尺度山系是否与路线视图协调。

这一步可以成为当前运行版的正式视觉底层，但只宣称山势来自 SRTM Plus 派生的制图阴影，不提供可查询高程。

### Phase 1：可计算地形母版（按需）

- 获取 GMTED2010 7.5/15 arc-second；若地图改为中国局部深度缩放，再评估 Copernicus GLO-30；
- 固化下载 manifest、许可声明和离线构建脚本；
- 生成 4× Web Mercator 高程母版、multi-scale hillshade、坡度与青绿设色；
- 以现有陆地 mask 和矢量海岸再次裁切覆盖；
- 输出压缩交付纹理并重建 `map-projected.svg`。

### Phase 2：局部 QA 与回退

- 如果未来引入 Copernicus 局部深度缩放，对明显异常、空洞或高山区域查看其 HEM/填补/水体质量层；
- 用 NASADEM 或 GMTED2010 做视觉对照，但不要把不同垂直基准的高程直接拼接后计算坡度；
- 若必须混合，先统一垂直基准、像元定义和 NoData，再记录每个像元的来源 mask。

## 验收标准

- **投影一致**：DEM 输出的 bounds、CRS、宽高与 `AtlasModel.projection` 一致；地形、海岸和点位无二次校准。
- **地形可追溯**：移除 AI 纹理后，所有山势仍由 DEM hillshade 清晰呈现。
- **构建可复现**：同一 manifest 与脚本产生逐字节一致的交付资产，并记录数据版本和 checksum。
- **视觉可读**：390×844 下路线、点位、密集标签、故事卡、缩放和四向拖动不受山体纹理干扰。
- **性能守门**：生成 SVG 继续满足现有 1.5 MB 预算；必要时保留离线高分母版，运行时只提交压缩结果。
- **来源合规**：Copernicus 修改产品使用其要求的 notice；NASA/JAXA/USGS/Natural Earth 按各自官方条款记录引用。
- **边界分离**：地形研究和 DEM 选择不输出任何政治边界结论，边界与领土表达不由 DEM 或 AI 决定。

## 最终建议

采用“两阶段”最稳妥：先以 Natural Earth Shaded Relief 直接替换现有 AI 山脉，这是当前分辨率下最轻且足够准确的方案；确认需要更强的海拔分层或重算光照后，再以 GMTED2010 建可计算母版。只有未来出现中国局部深度缩放，才值得引入 Copernicus GLO-30。最终成图应是 **真实高程/阴影几何 × 程序化青绿设色 × 低强度 AI 材质**，而不是把一张 AI 山水图再对齐地图。
