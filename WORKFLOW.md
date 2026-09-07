# herocards · 高质量英雄卡牌生产工作流

> 2026-09-07 增量：魔兽 ImageGen 批次已新增吉安娜、萨尔、阿尔萨斯、伊利丹，
> 全幅卡现为 5/24。该批次按文末「ImageGen 原生卡面」记录执行；下文 v7 参数仍为旧卡基准。

> 本文档是给**零上下文 Agent** 看的完整作业手册。读完本文档 + 按 SOP 执行，即可产出与既有基准卡（希尔瓦娜斯 v7）同等质量的卡牌。
> 文档中的所有参数都是经过多轮迭代验收的**定稿值**，不要凭直觉改动；确需调整时，必须先在测试页对比验证并在「决策日志」中登记。

---

## 1. 项目是什么

- 项目根目录：`/Users/coolbat/herocards`（纯静态站点，零框架零构建，`npm run dev` 即 `node server.mjs`，支持 `--port` / `--host` 参数转发）。
- 当前主题：艾泽拉斯英雄志（24 位魔兽英雄的 WebGL 烫金浮雕收藏卡）。后续会扩展更多主题，所以项目名是 herocards，**不要**把魔兽主题写死进通用模块。
- 质感对标站点：https://html.non.io/tarot/ —— 塔罗牌式的「线浮雕烫金」卡牌：画面线条本身是凸起的金属脊，鼠标移动时实时光照扫过，整条金线像金属一样亮起；人物与场景有真实的前后浮雕层次。

## 2. 目录结构与关键文件

```
herocards/
├── index.html                 # 主站入口
├── server.mjs                 # 静态开发服务器
├── css/style.css              # 站点样式（卡片 aspect-ratio 664/1024）
├── js/
│   ├── app.js                 # 站点逻辑 + WebGL PBR shader（尽量不改，见 §8 红线）
│   ├── card-art.js            # ★ 卡牌渲染管线核心（四贴图派生、金线层、装饰绘制）
│   └── heroes-data.js         # ★ 英雄数据（含 fullArt / fullArtHeight 路由字段）
├── assets/portraits/
│   ├── src/*.png|webp         # 旧版油画肖像（降级路径用，勿删）
│   └── full/                  # ★ 全幅卡面资产
│       ├── <hero>-full.png            # 2:3 卡面源图（约 2160×3240 ~ 3040×4560）
│       ├── <hero>-full-v*-4k.png      # 9:16 原始生成图（留档）
│       └── <hero>-aiheight.png        # AI 灰度高度图（2:3）
├── production/
│   └── prompts.json           # ★ 量产提示词库（v7 标准，中文）
└── test/
    └── fullart-test.html      # ★ 渲染管线测试页（QC 数值、对比图、webp 导出）
```

## 3. 技术架构（一张卡是怎么画出来的）

```
卡面源图 (2:3 PNG)
      │
      ▼  js/card-art.js · paintFaceFull()（1329×2048 物理分辨率）
┌─────────────────────────────────────────────┐
│ 1. drawFullArtCover   源图 cover 绘制到画芯         │
│ 2. deriveReliefMaps   程序化宏观浮雕（背景下沉/主体    │
│    平台/天体穹顶），relief 分区 roughness            │
│ 3. fuseExternalHeight 融合 AI 高度图（0.6/0.4/0.5    │
│    三通道：宏观×AI全局+AI低通差分细节）               │
│ 4. paintGoldLines     ★ 烫金刻线层（§5，落在叠加层之下）│
│ 5. 装饰层（按 theme 路由）：                          │
│    缺省（魔兽）：绶带→属性印→名牌→称号→边框→双章      │
│    guofeng：匾额(+称号朱文印)→竖排题款→回纹边框      │
│    (+回纹角花)→底角朝代/类别双印                     │
│    （逻辑坐标 664×1024，ctx.scale(2×) 自动放大，     │
│    压在金线层之上）                                  │
│ 6. 暗角+颗粒噪声      relief 模式噪声只落 diffuse     │
│    （applyNoise 传 {h:false,r:false}，铁律 §8）      │
│ 7. finishPack         height → Sobel → normal        │
│    （法线只从最终 height 派生）                      │
└─────────────────────────────────────────────┘
      │  diffuse / height / normal / roughness 四张 canvas
      ▼  js/app.js WebGL2 shader
鼠标光照（主光+环境光）、specular 高光、视差倾斜
```

- **双分辨率约定**：逻辑坐标 `LW=664, LH=1024`（所有装饰布局、字号、线宽在此坐标系书写）；物理像素 `W=1329, H=2048`（对齐参考站塔罗牌）。换算系数 `SCX/SCY/SC≈2.0`，写新装饰代码时只用逻辑坐标。
- **数据驱动路由**：`heroes-data.js` 中英雄对象带 `fullArt`（源图路径）就自动走全幅管线；带 `fullArtHeight` 就融合 AI 高度图；带 `goldLineParams`（skipZones/moonHint/decoInnerFrame）就逐卡定制金线；带 `theme:'guofeng'`（+ `quote`/`quotePos`/`dynasty`/`category`）就走国风装饰层。未配置或加载失败自动回退旧版肖像窗路径。新英雄只需加数据，不改渲染代码。
- **国风字体**：题款/匾额用本地子集 `assets/fonts/MaShanZheng-subset.woff2`（马善政毛笔行书，SIL OFL，106KB；源 ttf 留档同目录）。@font-face 已接入 index.html 与测试页。量产定稿 24 人文案后需重新子集化（命令见 §4.4）。
- **贴图缓存**：`FACE_CACHE_MAX=4`（单套四贴图约 43.5MB 内存），不要调大。

## 4. 美术资产生产（生图）

### 4.1 生图工具：即梦 CLI（首选）

```bash
export PATH="$HOME/.local/bin:$PATH"
dreamina text2image --model_version=4.7 --ratio=9:16 --resolution_type=4k \
  --generate_num=1 --poll=180 --prompt="<中文提示词>"
# 成功后用返回的 submit_id 下载：
dreamina query_result --submit_id=<id> --download_dir=<目录>
```

- **模型用 4.7**。5.0 / 5.0Pro 在当前账号下报 `ret=1046 InvalidNode`，不可用（已验证，勿重试浪费额度）。
- 登录态：OAuth 设备流，`dreamina user_credit` 可验证；过期则 `dreamina login`（需要用户扫码，agent 不可自行完成，要向用户要授权）。
- 即梦 4K 9:16 出图约 3040×5404，居中裁 2:3 后约 3040×4560，**大于**卡面物理分辨率 1329×2048，余量充足。
- **中文提示词通过率远高于英文**；涉及幽灵/骸骨/恶魔等元素时用软义词（幽灵虚影、远古兽骨残片、石像残骸），避免直白的骷髅/血/尸体。
- 偶发 `final generation failed`：退避 10–60s 原样重试，连续失败再软化措辞。
- 备用工具：Kimi image_generation 插件（脚本路径见 §10），曾出现长时间 424 故障，仅作兜底。

### 4.2 卡面源图提示词模板（v7 标准）

结构（全部中文），以 `production/prompts.json` 为实例库：

```
高级油画质感塔罗牌插画，边缘清晰，焦点锐利，高解析度。
{英雄名+称号}：全身像，站姿{气质}，占画面50-60%，{外貌/发色/眼睛}，
{服装铠甲细节}，{标志性武器}。{头后上方一轮巨大 XX 形成光环}。← 单一大光源锚点，必须有
场景为细节丰富具体的{场景名}，纵深层次清晰。
中景：{2-4 个具体可辨元素，与英雄人设相关}。
前景：{框景元素 1-2 个}。
天空：{氛围}。色调：{4-5 色}。
人物为最锐利、细节最丰富的主体；中景元素具体可辨、中等油画细节；
远景带空气雾感更柔和；纵深分层明确。头顶与脚下留白充裕。
无文字、无边框、无水印、无签名、无满屏金线描边、无密集碎线、无整片星空。
```

设计纪律（都是踩过的坑）：

1. **一个且仅一个大光晕锚点**（月亮/夕阳/光柱/魔法环），位于人物头后——烫金骨架的视觉核心。
2. 场景丰富度走「**具体物件**」（教堂玫瑰窗、铁栅栏、墓碑群），不走氛围剪影；但细节预算永远人物优先。
3. 半透明元素（幽灵/魂火）必须写明「半透明虚影无五官细节」，否则会被描金。
4. 「头顶与脚下留白充裕」不能删——9:16 裁 2:3 需要余量。
5. 生成后必检：构图（全身像完整、人物占 50–65%）、**底边有无水印**（即梦水印在左下/底部，居中裁 2:3 通常能去掉，残留则改裁剪窗口或重生成）。

### 4.3 AI 高度图（每张卡必备）

```bash
dreamina image2image --model_version=4.7 --ratio=2:3 --resolution_type=2k \
  --images <卡面源图> --poll=180 \
  --prompt="灰度深度图/heightmap：纯白最近（最高）、纯黑最远..."   # 见下
```

高度图要求（目检标准）：

- 人物是光滑圆雕，为**全场最高**（最亮）；武器/铠甲随体。
- 天体（月亮/太阳）是浅平穹顶，微凸于天空；夜空/远景最暗。
- 布料（披风）中档起伏；中景建筑按真实前后关系分层。
- **半透明元素（幽灵/魂火/光尘）必须贴近背景灰**，不能有错误强凸起——提示词里显式压制。
- 即梦高度图也带水印（左下「AI生成」，约 96% 高度处），管线 cover 底裁 8% 自动弃除；如果某张水印位置异常需在渲染前处理。
- 首次失败退避 10s 重试通常能过。
- **深浮雕版提示词**（立体感增强，国风线定稿用）：在标准高度图提示词基础上加「深浮雕感、明暗对比强：面部鼻梁颧骨凸起、衣褶有明显隆起与深陷、飘带翻卷立体，人物与背景的深度差拉大」——掐丝珐琅版实测人物已近瓷塑圆雕。

### 4.4 书法字体子集化（国风装饰层用字变更后必做）

```bash
# charset.txt 收集全部 名字+称号+题款+朝代+类别 用字后：
.venv-fonts/bin/pyftsubset assets/fonts/MaShanZheng-Regular.ttf \
  --text-file=<charset.txt> --output-file=assets/fonts/MaShanZheng-subset.woff2 \
  --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize
```

## 5. 烫金刻线层（paintGoldLines）——质感核心

参考站的烫金感 = 线条是**凸起的金属脊**（height 高 + roughness 低），光扫过整条亮。我们的实现：

1. **DoG 大尺度带通**提取源图主轮廓：三轮盒式模糊近似 σ≈2.45 / σ≈7.48（物理 px，盒半径 2/7）。这个尺度是定稿——更小会引入发丝/布料碎纹理（「碎玻璃感」事故的根源）。
2. **滞回阈值 tHigh=30 / tLow=15**（DoG 响应域）+ 8 连通域过滤：只保留「含强核且 ≥450px」的长曲线，宁可线少，不可线碎。
3. **头部禁区**：人物头脸椭圆区内不取线（v5.1 兜帽/双耳碎线事故的修复；实现上就是 skipZones 数组首项，不再另有机制）。
4. **skipZones 弱线禁区数组**：半透明幽灵、教堂、栅栏、墓碑、灯笼等**场景元素所在的椭圆区**，区内 DoG 线置零。v7 希尔瓦娜斯共 17 个区（含头部禁区）。**每张新卡必须按画面内容定制**——这是量产中唯一无法全自动的环节（见 §6 SOP）。
5. **闭运算 r=3** 合并 ≤6px 的平行双线 → **Zhang-Suen 骨架化**出 1px 种子 → 按 DoG 响应分级（主线/细节线/装饰线）。
6. **月环**：RANSAC 圆拟合（600 轮三点定圆 + Kasa 精化），只画有真实月缘证据的弧段（最大缺口补集 ±7°），人物遮挡处让位；拟合失败（r∉[60,420]、内点弧长不足、RMS>8px）则放弃月环，由 DoG 月缘线兜底。**不要**用亮盘质心估圆（v5.1 错位事故）。**工笔/晕染风格的柔光月缘** DoG 骨架几乎无点（李白实测月缘响应 p50=2.8），RANSAC 必然失效——此时用逐卡配置 `moonHint: {x,y,r}`（逻辑坐标，与 skipZones 同级目检配置，经 `opts.goldLineParams` 传入）：hint 即环几何，σ7.48 低通场径向梯度只做证据弧门控（`moonHintGradMin` 默认 12），证据不足回退 RANSAC。环缘贴月与否由 100% 放大 QC 验收。
7. **落脊**：Chamfer 距离场把种子扩散成高斯截面平滑脊（中心高、缘渐隐）。主线脊峰 h=225/半径 2.6px，细节线 h=192/半径 1.4px，装饰线 h=205。高度 **max 叠加**，在 relief 平滑之后落脊（脊线不被模糊）。
8. **配色**：diffuse 錾刻金 `goldDark #6B4C1A → goldLite #D9B968`（脊缘→脊心），alphaMax 0.9，与边框描金同色系（v5.1 荧光黄绿事故的修复，验收指标 G/R≈0.85，即 #D9B968 的 185/217）。rough 脊心 26（对齐边框金 24）。
9. 程序化装饰线只加塔罗式内框双线（inset 46/54 逻辑圆角矩形），克制。

## 6. 量产 SOP（每张新卡）

前置：提示词已在 `production/prompts.json`（23 张英雄卡已备好，含 `_meta.suffix` 固定收尾）。

```
① 生图     即梦 4.7 / 9:16 / 4k → 下载 → 存 assets/portraits/full/<id>-4k.png
② 裁剪     PIL 居中裁 2:3 → <id>-full.png；目检：构图、全身、底边水印
③ 高度图   即梦 4.7 i2i（2:3 / 2k）→ <id>-aiheight.png；目检 §4.3 分层标准
④ 首渲     test/fullart-test.html 加载新卡（页内图片清单 Promise.all 末尾
            追加两条 loadImage，F 组 imgs 下标指向新源图/高度图），
            跑 relief+金线+AI 融合全管线
⑤ 禁区治理  截图目检金线层：场景元素是否被描金？→ 在 card-art.js 的
            skipZones（或该英雄专属配置）加椭圆禁区，复检直至：
            烫金骨架只属于 人物+光晕锚点+主装备；场景元素零金线或稀疏点缀
⑥ QC      记录数值（§7 门槛）；截图三光位 + 100% 放大
⑦ 接入     heroes-data.js 该英雄加 fullArt / fullArtHeight 字段
⑧ 回归     主站临时起服 + agent-browser：舞台卡/图鉴格/鼠标实光/控制台零报错
```

并行建议：①–③ 可按英雄批量并发（提交时不加 `--poll` 先收 submit_id，再统一 query 下载，服务端并行）；⑤ 是唯一需要逐卡人工（agent）判断的环节，建议 4–6 张为一组并行派发，**每组 agent 必须先读本文档 §5**。

## 7. QC 数值门槛（测试页 mapStats，1329 物理分辨率口径）

| 指标 | 目标 | 说明 |
|---|---|---|
| rough 中间档(80–170)占比 | **≥45%** | 低于此说明材质分区失效 |
| normal 活跃均值偏离 | **22–40** | 过高=碎闪，过低=浮雕感不足 |
| height 梯度 p50（¼ 精度） | 1.5–4 | 场景丰富的卡会超到 6–7，**内容驱动可接受**，不是回归 |
| 月环 | r∈[60,420]，单环贴缘，人物处让位 | 双环/横穿头部=不合格 |
| 金线种子/连通域 | 连通域 ≤30 个左右 | 数百个=碎线事故 |
| 控制台 | **零报错** | — |
| 渲染耗时 | <800ms/张 | 参考值 679ms（金线约 340ms） |

目检三件套（缺一不可）：**默认光位整卡**、**光扫左上整卡**（金线应整条金属亮起）、**100% 原生像素放大**（金脊边缘平滑无锯齿、场景区无碎金）。

## 8. 质量红线与决策日志（勿重蹈）

| # | 决策 | 原因 |
|---|---|---|
| 1 | **颗粒噪声禁止写入 height**（relief 全幅管线实际只落 diffuse：`applyNoise` 传 `{h:false,r:false}`；「极弱 rough」是旧版肖像窗路径的行为） | 噪声进 height → Sobel 后碎闪 |
| 2 | **normal 只从最终合成 height 做 Sobel 派生**，禁用 AI 直接生成法线图 | AI 法线是 matcap 风格，nz 为负，光照全反 |
| 3 | 禁用「颜色阈值二值→直接当 height」 | 二值 height 的 Sobel 是破碎感的根源（v4 事故） |
| 4 | 生图**不挂风格参考图** | 会把全幅金线/碎细节拉回来 |
| 5 | 即梦模型只用 4.7 | 5.0 系 InvalidNode |
| 6 | 金线宁少勿碎：场景元素进 skipZones，骨架只属于人物+光锚 | v5.1/v6 两轮验收结论 |
| 7 | `app.js` shader 参数不动：specStr=0.34 / normalStr=1.35 / lightZ=0.5 / parallax=0.0034 | 与参考站同值，已验收 |
| 8 | 全身像构图；亮度「随人设走」 | 用户在半身/全身对比后定稿 |
| 9 | `FACE_CACHE_MAX=4` 不可调大 | 内存约束（单套四贴图 ~43.5MB） |
| 10 | 改动范围纪律：管线迭代只动 `js/card-art.js`、`js/heroes-data.js`、`test/fullart-test.html`；动 `app.js` 必须单独说明理由 | 保护主站稳定性 |

## 9. 验证与交付规范

- **临时服务**：起在**项目根目录**；用完必须 `kill`，确认端口释放，不留后台进程。注意 `node server.mjs --port 8127` 与 `python3 -m http.server 8123` 都是**纯 GET 静态服务**，测试页的 webp 导出（POST `/save/<名>`）会失败——需要导出落盘时用带 /save 的最小服务（项目根起，写入 qa/）：
  ```python
  python3 - <<'EOF'
  import os; os.makedirs('qa', exist_ok=True)
  from http.server import SimpleHTTPRequestHandler, HTTPServer
  class H(SimpleHTTPRequestHandler):
      def do_POST(self):
          n = int(self.headers['Content-Length'])
          open('qa/' + self.path.rsplit('/', 1)[-1] + '.webp', 'wb').write(self.rfile.read(n))
          self.send_response(200); self.end_headers()
  HTTPServer(('127.0.0.1', 8123), H).serve_forever()
  EOF
  ```
- **浏览器验证**：本机无 agent-browser CLI，用 headless Chrome 替代：`"$CHROME" --headless=new --disable-gpu-sandbox --window-size=<宽>,<高> --virtual-time-budget=120000 --screenshot=<绝对路径>.png <url>`（`--dump-dom` 读页内 #log）。注意：①窗口高度上限 16384，超高会静默卡死——整页太长时用专用小页（如 `test/libai-qc.html`）；② fragment 锚点滚动在 virtual-time 下不可靠；③GL 预览固定光位用 canvas `data-light="x,y"`（y 向上，光扫左上＝0.12,0.82）；④webp 导出必须用 `toDataURL` 同步编码（toBlob 异步回调会被 rAF 耗尽 virtual-time 预算，永远等不到）；⑤**headless Chrome 最小窗口宽约 500px**——要截 390px 真手机视口用 `test/qa-frame.html?to=<url编码路径>`（iframe 390×844 套娃），配合 `test/qa-seed.html?drawn=<id>&to=<路径>` 预置每日请卡/收藏 localStorage 状态。
- **CSS 陷阱**：任何带 `hidden` 属性的元素若同时有 CSS `display` 规则，hidden 会失效——style.css 已加 `[hidden]{display:none!important}` 全局守卫，新加组件时遵守。
- **测试页读数**：打开后自动跑全管线；QC 数值与报错在页内 `#log`，可用 `--dump-dom` 抓取并过滤 `F1· / G1· / G2· / !!` 行；渲染完成后自动 POST 导出 webp。
- **webp 导出**：测试页 `toBlob(q92)`（G 组为 toDataURL 同步路径），禁止 512 缩档；依赖上方带 /save 的服务才落盘。
- **预览交付格式**（面向用户的最终回复）：
  ```
  `/Users/coolbat/herocards`
  [华夏人物图鉴](http://localhost:7100/)
  ```
- 所有中间产物（截图、对比图）留在 qa 目录并在汇报中给出绝对路径链接。

## 10. 工具速查

| 工具 | 用途 | 备注 |
|---|---|---|
| `dreamina text2image` | 卡面源图 | 4.7 / 9:16 / 4k / 中文 prompt |
| `dreamina image2image` | AI 高度图 | 4.7 / 2:3 / 2k / 参考图传卡面 |
| `dreamina query_result --submit_id=<id> --download_dir=<dir>` | 下载结果 | submit 与下载分离 |
| `dreamina user_credit` | 登录态+额度 | 失效则找用户扫码 login |
| image_generation 插件（备用） | 生图兜底 | `/Users/coolbat/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/kimi-code/home/plugins/managed/image_generation/scripts/image_generation_tool.py generate --ratio 9:16 --resolution 4K --output <path> --description "<prompt>"`；可能 424 故障 |
| `test/fullart-test.html` | 管线测试页 | QC 数值、A/B 对比、webp 导出 |

## 11. 当前状态（2026-08-18 快照）

- ✅ 希尔瓦娜斯 v7 = 量产基准（主站已接入）：即梦 4.7 源图 3040×4560、17 区金线治理、AI 高度图融合、QC 全过
- ✅ 23 张英雄提示词已备：`production/prompts.json`
- ⏳ 待办：23 张批量生图 → 裁剪 QC → 高度图 → 逐卡禁区治理+渲染 → 主站全量接入
- 已知小瑕疵（可接受，勿重复修）：v7 弓右臂一小段金线被禁区吃掉（源图该区域为素黑）、底部草丛 2–3 个针尖级金点（观感如草露）
- 生图服务历史故障：内置插件 424 长故障（2026-07-20 下午，持续 15 分钟+）；即梦 i2i 首次「final generation failed」退避重试可过

### 国风方向（小红书「国风vibecoding」比赛 · 新主题线）

- 定位：中国古代人物图鉴（24 人 roster：帝王/将相/文人/奇士各 6），风格定稿**掐丝珐琅**（五风对比实测连通域最干净 24、视觉最华丽、非遗题材文化分高）
- ✅ 李白「举杯邀月」掐丝珐琅定稿卡：源图 `libai-falang-full.png` + 高度图 `libai-falang-aiheight.png`（深浮雕提示词版）+ 国风装饰层全件（回纹框/匾额/竖排题款/三枚印章），QC 全过，主站 `#hero=libai` 可看
- ✅ 国风装饰层（card-art.js 八·c 节）：`theme:'guofeng'` 数据驱动路由；题款用 Ma Shan Zheng 本地子集（§3/§4.4）；`decoInnerFrame:false` 关塔罗内框双线
- ✅ 装饰层 v2（用户改稿，2026-08-19）：① 称号印移出匾额 → 右侧题款列末**镂空朱文大印**（无底透空见画，双线边框，62 逻辑 px），印文繁体小篆（hero.seal 字段，如「詩仙」）；② 题款按断句拆**双列错落**（先句外列、后句内列下沉 1.6 字距）；③ 底角朝代/类别印放大 20→34 + 印泥质感（积墨/虫蚀/磨泐，seeded 稳定不闪）；印章一律**崇羲篆体**（小篆，CC-BY-ND——禁止子集化/改作字体文件，21MB 整字体仅开发期 @font-face，量产打包时改离线预渲染印面 PNG；简体覆盖不全，印文一律用繁体）；质感走离屏印面合成（blitSealFace），不蚀穿画芯
- ✅ 管线新增：`moonHint` 引导式月环（见 §5.6）；`test/libai-qc.html` 三光位+100% 放大 QC 小页；headless Chrome 验证法（§9）
- 备选风格源图留档：工笔重彩/水墨淡彩/敦煌壁画/青绿金碧（`libai-{gongbi,shuimo,dunhuang,qinglü}-*.png`，grok 协作产出，brief 在 `production/grok-brief-guofeng.md`）
- ⏳ 下一步：① 23 人量产（**已派给本仓库 grok 执行中**，brief `production/grok-msg-mass-production.md`：掐丝珐琅模板+深浮雕高度图+23 人分镜表，产出 `prompts-guofeng.json` + `mass-production-report.json`（含 halo 几何供月环引导））；② 量产后数据接入 heroes-data（全量替换魔兽 roster 恢复 24 人契约、补 23 人 stops/group/quote/seal、按新文案重子集化 Ma Shan Zheng）；③ 小工具封装（资产瘦身 webp、postNote/存相册签名对官方文档核对、触摸手感终调）

### 站点 v2（2026-08-19，移动端国风重构 · 方案经用户三轮拍板）

- **玩法**：每日请卡（1 次/日，`guofeng-daily` streak）→ 签筒摇签仪式 → 揭卡（优先未收集）→ 解锁**生平行旅图**（AtlasMap：24 人全量经纬度路线、点位精度标识、拖动缩放）→ 发笔记/存相册（XhsBridge 判空降级，签名待 Phase C 核对）。收藏 key 改 `guofeng-collection`（旧 wow key 自动迁移）
- **架构**：底部 Tab 双页（请卡 #/ / 图鉴 #/dex）+ 列传弹层；`#hero=<id>` 深链直达列传（未收集提示）；桌面端居中 480 app-shell
- **视觉**：宣纸浅底（`--paper:#F5EFE2`）+ 朱砂/泥金/黛蓝；匾额 brand、白文进度印、朱砂印形按钮、回纹/云纹 SVG、竖排点缀；**Google Fonts 已全删**（小工具离线要求），正文系统宋体栈
- **新文件**：`js/story-map.js`（生平长卷渲染器，自注入 sm-* 样式）、`js/xhs-bridge.js`、`test/qa-frame.html` + `test/qa-seed.html`（移动端 QA 套娃，见 §9⑤）、`css/style.wow-legacy.css`（旧皮备份不引用）
- **工程**：`mousemove`→`pointermove`（触摸拖动驱动光照+倾斜）；`FACE_CACHE_MAX` 移动端 8→3；图鉴缩略卡 IntersectionObserver 懒渲染；卡背 `paintBack('guofeng')`（回纹框+朱砂「群英」小篆大印）；门类 chips（hero.group: emperor/general/literati/savant）替代阵营/职业筛选；Ma Shan Zheng 子集扩充到界面+生平用字（529KB，24 人文案定稿后需重打）
- **已验收**：390 真视口四态截图（qa/f1-tube 请卡 / f2-dex 图鉴 / f3-drawn 已抽 / f4-story 列传）、全 js `node --check`、隐藏层 [hidden] 守卫修复
- 过渡期现象（Phase B 消除）：进度显示 x/25（24 魔兽+李白并列）、图鉴里魔兽旧卡仍在

### 生平行旅图 v3（2026-08-20）

- 正式地图改为 `atlas-data.js` 地点注册表 → `map-geometry.js` 统一投影 → `atlas-map.js` 渲染；人物路线只引用地点 ID，`heroes-data.js` 已移除旧图片百分比坐标 `mx/my`
- 底图 `assets/atlas/map-projected.svg` 由 Natural Earth 数据可复现生成，构建命令 `npm run build:atlas`
- 旧 2.5D 图片保留为校准对照；`test/atlas-calibration.html` 可编辑控制点，三角网外拒绝外推
- 点位展示 `site/city/region/unknown` 精度和 `high/medium/low` 置信度；路线虚线仅表示生平叙事次序
- 完整数据约定、校准边界与验证方式见 `docs/atlas.md`，统一检查命令为 `npm run check`

### GitHub Pages 双主题展示站（2026-09-07）

- 落地页 `site/index.html` → 发布为 `index.html`；`guofeng.html` 发布为 `app.html`，`wow.html` 为魔兽页（仓库 `index.html` + `app.js` 保持不动，XHS 小工具链路——含每日请卡——零影响）
- 两页共享驱动 `js/showcase.js`（卡墙 + 筛选 chips + 整页详情视图 + 可选行旅图），各页以 `window.SHOWCASE` 内联配置注入（chip 字段/徽章/属性标签/字体/缩略模式/hasMap）；详情为整页视图非弹层，大卡 `min(84vh,900px)`
- 国风展示页（2026-09-07 改版）：移除每日请卡/收藏/签筒，卡墙 24 人全亮（缩略用 thumbs/<id>-falang-full.webp <img>），详情页含「探索生平行旅」→ AtlasMap
- 魔兽数据 `js/heroes-data-wow.js`：24 位英雄；希瓦 v7 加四张 ImageGen 全幅卡，其余 19 人走肖像窗降级路径（`assets/portraits/<id>.webp`）；全幅运行图位于 `assets/portraits/wow-runtime/`，新卡使用逐卡禁区与希瓦同款装饰。
- 构建：`npm run build:pages` → `dist/pages/`（约 14.6 MiB，含引用完整性校验）；发布：`gh-pages` 分支根目录 + repo 公开
- showcase.js 环境兜底：IntersectionObserver 不派发时 1.2s 全量补渲卡墙；rAF 缺显示链路时 80ms setTimeout 画详情卡

## 2026-09-07 · ImageGen 原生卡面与显示层

本批用户指定内置 ImageGen，实际输出 1024×1536 原画和同尺寸 v2 语义深度图。
提示词、拒绝样本说明及英雄列表保存在 `production/wow-imagegen-v1.json`。
不将灰色泥塑/浮雕照片当作深度图；深度贴图必须去除原画光照，保留主体与背景的几何层级。

新四卡使用以下显式字段，希尔瓦娜斯和国风卡继续保持既有默认值：

- `fullArtCropBottom`：萨尔、阿尔萨斯、伊利丹为 0；吉安娜为 0.20，放大取景以使脸部落到固定称号暗底下方。色彩图、深度图共用同一裁剪；金线禁区坐标随取景调整。
- `fullArtHeightSmoothing: 2`：AI 深度融合前做 2 逻辑像素半径的三轮盒式平滑，抑制硬轮廓法线跳变。
- 装饰布局统一沿用希尔瓦娜斯 v7 默认：顶部铭牌／称号、中下部绶带、三枚属性圆章、底部双徽章。用户在网页预览后指定以希尔瓦娜斯实施；此前 compact 试验已撤回，不再设置 `fullArtLayout`，后续英雄也沿用同一模板。
- `goldLineParams`：独立脸部/场景禁区；本批不用程序拟合月环；阿尔萨斯 `minComp: 900`，其余沿用 450。
- `fullArtThumb`：由已验收成卡导出的 1329×2048（卡面原生分辨率）WebP q90，卡墙无需现场构建大贴图。历史：初版 400×616 在 DPR≥2 屏上放大发虚（2026-09-07 改为 640×986）；640 宽仍需绘制时二次重采样，小字与发丝比希瓦 paintFace 直出路径略软，2026-09-08 起统一提到原生分辨率，绘制时只做一次缩绘，与希瓦路径对齐。

原画和深度母版在 `assets/portraits/wow-masters/`。运行图由
`python3 production/build-wow-runtime.py [hero-id ...]` 从母版一次编码：
原画 WebP q94，深度灰度无损，不扩大原生尺寸。
该脚本仅负责编码；金线、布局、字体或原画变更后仍须重新执行成卡 QC 与缩略图导出。

在项目根起本地服务，使用 `test/wow-qc.html?hero=<id>` 做同源 A/B、三光位和原生像素检查；
`playwright-cli run-code --filename=production/bake-wow-thumbs.cjs` 导出四卡缩略图和数值。
主材质门槛已通过，但高度梯度仍有已记录偏差，见
`docs/card-generation-audit-2026-09-07.md`，不能宣称所有历史 QC 指标全部达标。

魔兽详情新增 `js/card-lighting.js`，上传 diffuse/normal/rough/height，沿用 `js/app.js`
既定 shader 和参数，按指针/尺寸事件绘制，关闭即释放 GPU 资源；支持失去/恢复上下文、
WebGL 不可用时的 2D 降级和 reduced-motion。此模块未接入国风主站。
合并 main 时保留整页详情与大卡尺寸（手机宽 min(88vw,420px)），DPR 上限 2.5。
`showcase.js` 通过可选的 `#cardLighting` 接入魔兽光照；国风继续使用原有 2D 详情与行旅图。

验证：`npm run check`（26 项）、`npm run build:pages`，以及
`playwright-cli run-code --filename=test/verify-wow-browser.cjs`。
逐卡证据在 `production/wow-imagegen/`，截图在 `output/playwright/`。
本次仅本地实现与验证，不代表已部署。

2026-09-07 后续决定：清晰度修正与样式统一分别处理。保留 diffuse 完整纹理采样、
详情最少 2 倍／最多 2.5 倍采样、未倾斜布局尺寸作为缓冲依据、卡墙按屏幕 DPR 绘制。
原画无水印的裁剪和逐卡金线禁区继续按具体画面配置，装饰层直接复用希尔瓦娜斯默认路径。
版式变更后必须重新导出四卡缩略图、刷新清单中的缩略图与渲染器哈希，并在网页检查五卡并排效果。

### 2026-09-08：剩余 19 位全幅量产完成

名册现为 **24/24 全幅卡**：希尔瓦娜斯基准 + 23 套 ImageGen 原画/语义深度。
本轮 19 套均为原生 1024×1536；23 张 ImageGen 成卡缩略图统一 1329×2048（卡面原生分辨率，2026-09-08 由 640×986 再升级，见上文 `fullArtThumb`）。
全部沿用希尔瓦娜斯默认装饰模板，逐卡禁区见 `js/heroes-data-wow.js`。
新增 `fullArtNonMetalZones` 仅排除暖天空、皮毛、木石等非金属区域，改变底图粗糙度，
不改变原画、深度、法线或后续装饰金脊。泰兰德/玛维裁底分别为 0.12/0.16，其余新卡为 0。

烘焙脚本现在默认处理全部 23 张，入口 URL 的 `?ids=id1,id2` 可限定批次；
烘焙后执行 `python3 production/finalize-wow-manifest.py` 核对尺寸/哈希/主材质 QC 并记录最终资产。
新增 `test/verify-wow-materials.cjs` 检查非金属区域只影响粗糙度；
`test/verify-wow-browser.cjs` 扩展至全 24 张详情与多张新卡手机回归。
主材质门槛通过，高度梯度参考偏差仍如实保留，不能宣称全部历史指标达标。
完整名单、逐卡数值、原生分辨率限制及复现步骤见
[`docs/wow-remaining-heroes-2026-09-08.md`](docs/wow-remaining-heroes-2026-09-08.md)。
