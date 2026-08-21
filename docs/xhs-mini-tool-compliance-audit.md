# Herocards 小红书小工具技术合规审计

审计日期：2026-08-21  
规范来源：[小工具容器 · 能力清单](https://fe-video-qc.xhscdn.com/fe-platform-file/104101b8323q4m0uaga06277180ac7t8006ptl0e12ek1g#s1)，页面标注最后更新 2026-08-11，适用 iOS / Android。  
审计范围：`index.html` 主运行链、`js/`、`css/`、实际引用的字体/肖像/地图资源、当前 `package.json` 构建与测试入口。

## 整改结果（2026-08-21）

**当前结论：代码、离线包和移动 Web 运行验证均已通过；提交前仍需在小红书 iOS / Android 真机容器完成最终验收。**

- 新增 `npm run build:xhs`：白名单生成 `dist/xhs/`，产物为 86 个受支持文件、唯一 `index.html`、28.9 MiB；40 MiB 是项目自设回归预算，不冒充平台包体上限。自定义输出目录若已存在会拒绝覆盖，避免递归误删。
- 新增桥接契约与包合规测试：`postNote` 使用 `mediaInfo.image_resources`，大图先经 `writeTempFile`，相册接口只传 `filePath`；自动拦截含协议相对 URL 在内的外链、非空内联脚本体、禁用 API、禁用 HTML、不支持扩展名和多 HTML。
- 24 张正图与 24 张高度图从 548.9 MiB 的 4K 母版改为约 25 MiB 的运行图；首屏不再全量预载，抽中和详情才加载对应人物。图鉴另用 24 张合计 1.8 MiB 的 320×480 缩略图，390×844 全收集首屏实测只加载 12 张、约 0.9 MiB，且不再同步生成完整卡面。
- 移除 `<a download>` 降级和 21 MiB OTF，引入包内 WOFF2；修复全幅人物无意义的 `.webp/.png` 探测，并把地图和详情操作目标扩大到 44×44 px。
- 投影 SVG 不再内嵌 `data:` JPEG；地图皮肤和矢量覆盖层均作为包内本地图片分层加载，取消 `<img data:>` 的 9.37+ 版本前提，同时保留 Natural Earth 陆地裁切与中国轮廓。
- 详情切换时立即显示目标人物的静态占位并隐藏旧 WebGL 卡面，资源就绪前分享按钮保持 disabled / `aria-busy=true`，避免保存或发布上一人物卡面。
- 390×844 的独立产物实测：首屏和详情均为 0 控制台报错/警告；请卡后只新增该人物的正图与高度图，地图打开后按需加载本地皮肤与投影 SVG。请卡、全收集图鉴、详情慢载保护、地图点位故事均可操作。
- `npm run check` 当前为地图 10 项 + 小红书 7 项，共 17 项通过；模拟 `window.xhs.miniTool` 的浏览器运行验证确认 `writeTempFile → postNote/saveImageToPhotosAlbum` 的实际调用顺序和参数。

以下 Findings 保留为整改前基线，便于追踪问题来源；其中全部实现问题均已关闭，双端真机容器验证仍是发布门禁。

## Anti-Patterns Verdict

**视觉反 AI 模板检查：通过。** 当前国风题款、抽签仪式、卡面和行旅地图有明确的项目语言，并非通用渐变卡片或玻璃拟态模板。需要整改的是容器合规和启动资源策略，不是把界面重新做成标准化小程序模板。

## 整改前 Executive Summary（已归档）

**整改前结论：不具备提交条件。**

- Critical：3
- High：4
- Medium：3
- Low：1
- 已确认通过：8 项

最优先的阻塞项：

1. `postNote`、`saveImageToPhotosAlbum` 参数结构不符合最新官方文档，端能力会被 Schema 校验拒绝。
2. 没有独立的小工具打包目录/白名单构建；直接提交仓库会包含 60 个 HTML、内联测试脚本、外链字体、服务端脚本和不支持文件类型。
3. 首屏并发预载 48 张 3040×4560 图片，共 548.9 MiB，并在全部完成前禁用“今日请卡”；移动 WebView 存在长时间不可用或内存崩溃风险。

规范页面没有给出明确包体上限，因此本报告不虚构一个审核阈值；548.9 MiB 是经当前代码实际引用计算出的性能阻塞，不表述为文档中的包体条款。

## Detailed Findings

### Critical

#### C1. 小红书端能力参数 Schema 错误

- **位置**：`js/xhs-bridge.js:40-50`、`js/xhs-bridge.js:62-69`
- **类别**：容器 API / 核心功能
- **现状**：`postNote` 传入 `images`；规范要求必填 `mediaInfo`，图文结构为 `mediaInfo.image_resources: [{ url }]`。`saveImageToPhotosAlbum` 传入 `image`；规范要求 `filePath`。
- **影响**：SDK 在上行前和 Native 侧都会按同一 JSON Schema 校验，未声明字段会失败；“发笔记”和“存相册”均不是可用状态。
- **建议**：按 2026-08-11 文档重写唯一桥接层，严格只传已声明字段；加入 Promise 成功/失败契约测试。
- **建议技能**：`/implement` + `/harden`

#### C2. 缺少可提交的小工具包构建

- **位置**：`package.json:6-10`；仓库根目录
- **类别**：打包 / CSP / 文件白名单
- **现状**：仅有开发、地图构建和地图测试脚本，没有 `build:xhs`。仓库包含约 60 个 HTML 及 `.mjs/.md/.py/.sh/.otf/.ttf` 等文件；多个 `test/*.html` 含内联脚本、外部 Google Fonts、`fetch`、`iframe` 或剪贴板调用。
- **规范**：包内必须有且只有一个 HTML 入口；脚本只能是包内外置 `.js`；支持文件类型仅为 `.html/.css/.js/.png/.jpg/.jpeg/.gif/.webp/.svg/.woff/.woff2/.json`。
- **影响**：不能把仓库直接当小工具包提交；测试页还会触发 CSP/禁用能力。
- **建议**：生成独立 `dist/xhs/`，从明确 manifest 复制唯一入口和实际运行资源；构建后自动检查扩展名、HTML 数量、内联脚本、行内事件、外链、网络 API、WASM/Worker/iframe/download。
- **建议技能**：`/ci-cd-and-automation` + `/harden`

#### C3. 首屏预载策略会阻塞核心交互并造成极高内存压力

- **位置**：`js/app.js:168-187`、`js/card-art.js:2204-2243`、`js/heroes-data.js` 的 48 个 `fullArt/fullArtHeight` 引用
- **类别**：性能 / 移动端稳定性
- **现状**：24 张全幅图和 24 张高度图全部并发加载，合计 575,521,882 B（548.9 MiB）；图片均为 3040×4560。`summonBtn` 在全部 Promise 完成前保持 disabled。
- **影响**：48 张 RGBA 解码理论峰值约 2.5 GiB，尚未计 Canvas/WebGL 纹理和页面；iOS/Android WebView 可能被系统终止。即使未崩溃，用户也可能长时间无法开始核心玩法。
- **建议**：生成接近卡面实际 664×1024 的 WebP 运行资产；只预载当天人物和首屏缩略图，其余按需加载并限制并发；核心按钮不能等待全图集。
- **建议技能**：`/optimize`

### High

#### H1. 存相册失败后会落入被禁止的文件下载

- **位置**：`js/xhs-bridge.js:58-86`
- **类别**：禁用行为
- **现状**：API 不存在或抛错后创建 `<a download>` 并点击。
- **规范**：`a[download]` 和 blob 下载被禁用；保存图片必须走 `saveImageToPhotosAlbum`。
- **影响**：容器中保存失败时会继续执行明确禁止的行为，且 UI 可能误报成功。
- **建议**：小红书包中只返回结构化失败；普通浏览器预览降级必须在构建层隔离，不能进入提交包。

#### H2. 大图分享没有使用临时文件流程

- **位置**：`js/app.js:1313-1339`、`js/xhs-bridge.js:40-69`
- **类别**：端能力 / 内存
- **现状**：Canvas PNG data URL 直接传给发布和相册 API，没有调用 `writeTempFile`。
- **规范**：base64/本地路径均可，但大图建议先 `writeTempFile`，再把返回的 `filePath` 传给 `postNote` 或 `saveImageToPhotosAlbum`；临时路径即用即弃。
- **影响**：超长 base64 增加桥接序列化和内存峰值，失败时无法区分写文件与端能力错误。
- **建议**：在用户点击链路中统一 `toDataURL → writeTempFile → post/save`，不持久化临时路径。

#### H3. 入口引用了文件白名单之外的 OTF 字体

- **位置**：`index.html:10-11`
- **类别**：资源类型 / 许可
- **现状**：入口加载 `assets/fonts/chongxi_seal.otf`，文件约 21 MiB；规范只列出 `.woff/.woff2` 字体。代码注释也已注明该字体许可禁止改作和子集化，应在量产包改为预渲染 PNG。
- **影响**：打包器可能拒绝 OTF，或运行时字体加载失败；体积也显著增加。
- **建议**：按现有许可决定预渲染印面 PNG，或改用许可允许且已转换为 WOFF2 的替代字体；不要转换这份 ND 字体。

#### H4. 缺少端能力与小工具包合规测试

- **位置**：`package.json:6-10`、`test/`
- **类别**：质量门禁
- **现状**：`npm run check` 只覆盖语法和地图的 10 项测试，没有 mock `window.xhs.miniTool`，也没有包文件/CSP/禁用 API 扫描。
- **影响**：分享参数或不允许文件可在现有测试全绿时进入提交包。
- **建议**：增加桥接契约测试、包 manifest 测试、禁止模式扫描和“唯一 HTML + 支持扩展名 + 全部引用存在”的完整性测试。

### Medium

#### M1. 预载器会主动请求 48 个不存在的肖像路径

- **位置**：`js/card-art.js:2196-2221`
- **类别**：性能 / 可观测性
- **现状**：每个人物先探测 `assets/portraits/<id>.webp`，失败后再探测 `.png`，而人物已全部声明 `fullArt`。当前浏览器验证可稳定看到约 48 个缺失资源错误。
- **影响**：增加启动 I/O 和错误噪音，掩盖真正的包内缺失资源。
- **建议**：数据声明哪种资源就只加载哪种；构建时验证路径，运行时不要靠 404 探测能力。

#### M2. data/blob 图片存在客户端版本前提

- **位置**：`assets/atlas/map-projected.svg` 内嵌 JPEG；`js/app.js:1318` Canvas data URL
- **类别**：兼容性
- **规范**：`<img>` 的 `data:` / `blob:` 加载要求客户端 9.37 及以上。
- **影响**：如果平台允许更低客户端打开，小工具可能出现地图皮肤或分享图兼容问题。
- **建议**：明确最低客户端为 9.37+ 并做双端实机测试；更稳妥时让地图 SVG 引用包内 JPEG，而不是 data URI。

#### M3. 部分移动端触控目标小于 44×44 px

- **位置**：`js/atlas-map.js:41-45`（34 px 点位）、`js/atlas-map.js:75-79`（38 px 缩放）、`css/style.css:684-687`（详情页分享按钮）
- **类别**：响应式 / 可访问性
- **影响**：地图密集区域和单手操作容易误触；不属于容器拒审条款，但会降低小工具完成率。
- **建议**：视觉尺寸可保持，使用伪元素或透明 padding 扩大到至少 44×44 px。
- **建议技能**：`/adapt` + `/accessibility`

### Low

#### L1. 包内 CSS 使用查询字符串版本号

- **位置**：`index.html:12`
- **类别**：资源解析
- **现状**：`css/style.css?v=2`。
- **影响**：规范允许包内同源样式，但没有保证打包器如何处理查询字符串；对纯离线包没有缓存刷新价值。
- **建议**：提交包使用 `css/style.css`，版本由包本身管理。

## Positive Findings

1. 主入口只有包内外置脚本，没有内联 `<script>` 或行内事件处理器。
2. 主运行链没有 `fetch/XMLHttpRequest/WebSocket/SSE/WebRTC`，也没有加载外部图片、字体或脚本。
3. 主运行链没有 `eval/new Function/WebAssembly/Worker/Service Worker/iframe/object`。
4. 页面使用标准 HTML/CSS/JS、Canvas 2D 和本地 WebGL 纹理，属于容器允许范围。
5. `window.xhs.miniTool` 已做判空，不会在普通浏览器直接调用未注入 SDK。
6. `localStorage` 调用已用 try/catch 降级，不假设持久化一定成功。
7. 分享标题最长 17 字、正文最长 71 字，分别低于文档的 20/1000 字限制；图片数量当前为 1 张，低于 18 张。
8. 已实现安全区、390×844 布局、焦点样式和 `prefers-reduced-motion`；地图资产已有 1.5 MiB 预算和确定性构建测试。

## Patterns & Systemic Issues

- 项目已有“小红书桥”的正确边界意识，但当时依据的是二手接口转述，尚未回填正式 Schema。
- 源码仓库、QA 页面、生成源文件和交付包尚未分层；离线容器必须采用白名单产物，而不是黑名单排除。
- 资产管线以桌面高分母版为中心，缺少移动 WebView 的运行规格和按需加载策略。
- 当前测试证明地图坐标与构建稳定，但没有证明小红书容器兼容。

## Recommendations by Priority

1. **Immediate**：修复三项端能力的严格 Schema，移除下载降级，添加 bridge mock 测试。
2. **Immediate**：新增 `build:xhs` 和 `check:xhs`，产出唯一 HTML、允许扩展名、纯本地引用的独立目录。
3. **Immediate**：生成移动端 WebP 肖像，改为按需/限并发加载，解除首屏按钮对 48 张图片的依赖。
4. **Short-term**：移除 OTF 运行依赖，清除不存在路径探测，处理 9.37 版本门槛。
5. **Short-term**：在真实小红书 iOS/Android 容器验证首次打开、发笔记、相册拒绝/允许、离线重开和低内存回收。
6. **Medium-term**：扩大地图与详情分享按钮触控区，并建立性能预算。

## Required Proof Before Declaring Compliant

- `dist/xhs/` 中恰好 1 个 HTML，所有文件扩展名在官方白名单内。
- 静态扫描无内联脚本、行内事件、外链、网络 API、动态代码、WASM、Worker、iframe、download。
- 所有 HTML/CSS/JS 引用文件存在；无启动期 404。
- mock SDK 断言 `postNote.mediaInfo.image_resources`、`saveImageToPhotosAlbum.filePath`、`writeTempFile.data` 完全匹配文档 Schema。
- 冷启动只加载首屏必要资源，核心按钮无需等待全图集；记录包体、首屏加载量和峰值内存。
- 小红书客户端 9.37+ 的 iOS/Android 实机完成发布页拉起和相册保存；成功仅解释为端能力成功，不解释为笔记审核通过。

在以上证据齐全前，状态应保持为 **Not compliant / Not ready to submit**。
