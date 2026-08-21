#!/usr/bin/env python3
"""从 3040×4560 母版生成小工具运行图（单次 Lanczos + 轻锐化，避免二次压缩）。

产出（直接覆盖到仓库目录，旧 .jpg 运行图由调用方清理）：
  assets/portraits/runtime/<id>-falang-full.webp      1024×1536 q75（卡面源图）
  assets/portraits/runtime/<id>-falang-aiheight.webp   512×768 灰度 q75（高度图）
  assets/portraits/thumbs/<id>-falang-full.webp         320×480 q75（图鉴缩略图）
"""
import os
import sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, 'assets/portraits/full')
RUNTIME = os.path.join(ROOT, 'assets/portraits/runtime')
THUMBS = os.path.join(ROOT, 'assets/portraits/thumbs')

IDS = ('qinshihuang hanwudi tangtaizong wuzetian chengjisihan kangxi zhugeliang '
       'yuefei hanxin huamulan qijiguang wentianxiang dufu sushi liqingzhao '
       'wangxizhi caoxueqin zhangqian xuanzang zhenghe xuxiake huatuo zuchongzhi '
       'libai').split()


def kb(p):
    return round(os.path.getsize(p) / 1024)


def main():
    total = {'full': 0, 'height': 0, 'thumb': 0}
    for hid in IDS:
        src_path = os.path.join(FULL, f'{hid}-falang-full.png')
        hgt_path = os.path.join(FULL, f'{hid}-falang-aiheight.png')
        if not (os.path.isfile(src_path) and os.path.isfile(hgt_path)):
            sys.exit(f'缺母版：{hid}')

        # 卡面源图：母版一次缩到 896×1344 + 轻锐化
        # （屏幕渲染目标 ≤ 320CSSpx × DPR2.5 = 800px 宽，896 仍保持过采样无损失；
        #   1024/960 版全包实测超 10MB 平台上限，故定 896）
        src = Image.open(src_path).convert('RGB')
        art = src.resize((896, 1344), Image.LANCZOS)
        art = art.filter(ImageFilter.UnsharpMask(radius=1, percent=40, threshold=2))
        p = os.path.join(RUNTIME, f'{hid}-falang-full.webp')
        art.save(p, 'WEBP', quality=75)
        total['full'] += kb(p)

        # 高度图：灰度 512×768（只参与法线推导，不决定清晰度）
        h = Image.open(hgt_path).convert('L').resize((512, 768), Image.LANCZOS)
        p = os.path.join(RUNTIME, f'{hid}-falang-aiheight.webp')
        h.save(p, 'WEBP', quality=75)
        total['height'] += kb(p)

        # 图鉴缩略图：320×480
        t = art.resize((320, 480), Image.LANCZOS)
        p = os.path.join(THUMBS, f'{hid}-falang-full.webp')
        t.save(p, 'WEBP', quality=68)
        total['thumb'] += kb(p)

        print(f'{hid}: full={kb(os.path.join(RUNTIME, hid + "-falang-full.webp"))}KB '
              f'height={kb(os.path.join(RUNTIME, hid + "-falang-aiheight.webp"))}KB '
              f'thumb={kb(os.path.join(THUMBS, hid + "-falang-full.webp"))}KB')

    print('---')
    print(f"卡面合计 {total['full']/1024:.1f}MB  高度合计 {total['height']/1024:.2f}MB  "
          f"缩略合计 {total['thumb']/1024:.2f}MB")


if __name__ == '__main__':
    main()
