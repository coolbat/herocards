继续上次的量产任务（你中断了，现在恢复）。

## 当前磁盘实况（我已盘点）

**定稿源图已完成 13 人**（`<id>-falang-full.png` 存在）：qinshihuang、hanwudi、wuzetian、tangtaizong、chengjisihan、kangxi、zhugeliang、yuefei、hanxin、huamulan、qijiguang、wentianxiang、dufu（加上此前的 libai 共 14）。

**源图还缺 10 人**：caoxueqin（注意：`caoxueqin-falang-4k-v1.png` 和 `caoxueqin-falang-full-v1.png` 已下载但未定稿，先目检 v1，合格就改名转正，不合格重抽）、liqingzhao、sushi、wangxizhi、caoxueqin、zhangqian、xuanzang、zhenghe、xuxiake、huatuo、zuchongzhi。

**高度图 0/23**：23 人的 `<id>-falang-aiheight.png` 一张都没做，全部待办。

## 继续执行（规则不变，见原 brief production/grok-msg-mass-production.md）

1. 先补完剩余 10 人源图（掐丝珐琅模板 + 分镜表构图；铁律：单光晕锚点、全身 50-60%、无文字印章水印、旗帜书卷无字；每张≤3 次）
2. 然后统一做 23 人高度图（i2i 2:3/2k，参考图=定稿源图，深浮雕灰度提示词；纯灰度、人物圆雕、纹理压平；每张≤2 次）
3. 更新 `production/prompts-guofeng.json`（全部提示词存档）和 `production/mass-production-report.json`（每人的 fullArt、heightMap、ok、tries、**halo{x,y,r}（3040×4560 物理像素目估，管线要用）**）
4. 每批并行不超过 4 个生图任务；final generation failed 退避 10-60s 重试
5. 不要改任何 js/css/html/md 文件（production/*.json 除外）

完成后汇总：成功 N/23 源图 + N/23 高度图、失败清单、各试了几轮。
