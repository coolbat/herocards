#!/usr/bin/env python3
"""23 张深浮雕高度图量产（即梦 i2i，参考图=定稿源图）。
产物：production/guofeng-work/v2-heights/<id>-height-raw.png -> 缩放至 3040x4560 存
      assets/portraits/full/<id>-falang-aiheight.png（QC 通过后由转正脚本拷贝）
      qa/light-matrix/v2-heights/<id>.jpg QC 预览
"""
import json, os, re, subprocess, time
from PIL import Image

ROOT = "/Users/coolbat/herocards"
OUT = f"{ROOT}/production/guofeng-work/v2-heights"
PREV = f"{ROOT}/qa/light-matrix/v2-heights"
LOG = f"{OUT}/log.jsonl"
os.makedirs(OUT, exist_ok=True)
os.makedirs(PREV, exist_ok=True)
ENV = dict(os.environ, PATH=os.path.expanduser("~/.local/bin") + ":" + os.environ["PATH"])

IDS = ["qinshihuang","hanwudi","tangtaizong","wuzetian","chengjisihan","kangxi",
       "zhugeliang","yuefei","hanxin","huamulan","qijiguang","wentianxiang",
       "dufu","sushi","liqingzhao","wangxizhi","caoxueqin","zhangqian",
       "xuanzang","zhenghe","xuxiake","huatuo","zuchongzhi"]

PROMPT = ("纯灰度黑白深度图（heightmap），整个画面只有黑白灰，绝对没有任何彩色。"
          "纯白最近纯黑最远。深浮雕感、明暗对比强：人物是有立体感的光滑圆雕，"
          "面部鼻梁颧骨凸起、衣褶有明显隆起与深陷、飘带翻卷立体，人物全场最高最亮、"
          "与背景深度差拉大，但不是平涂纯白；手持道具随人物凸起。"
          "画面中的发光体（烛火、灯笼、篝火、火光等）是浅平微凸。"
          "夜空与远景最暗最远，墙面、水面、织物纹理不要产生凸起、压平。"
          "中景按前后分层渐暗。水面云气贴背景灰。灰度过渡平滑，无硬边、无噪点、无纹理、无文字。")

def log(rec):
    with open(LOG, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(json.dumps(rec, ensure_ascii=False), flush=True)

def run(cmd, timeout=180):
    return subprocess.run(cmd, capture_output=True, text=True, env=ENV, timeout=timeout)

def gen_one(hid, ref):
    out = run(["dreamina", "image2image", "--model_version=4.7", "--ratio=2:3",
               "--resolution_type=2k", "--generate_num=1", f"--images={ref}", f"--prompt={PROMPT}"])
    m = re.search(r'"submit_id"\s*:\s*"([^"]+)"', out.stdout + out.stderr)
    if not m:
        return None, f"submit failed: {(out.stdout+out.stderr)[:200]}"
    sid = m.group(1)
    dl = os.path.join(OUT, f"{hid}-dl")
    for _ in range(16):
        time.sleep(15)
        r = run(["dreamina", "query_result", f"--submit_id={sid}", f"--download_dir={dl}"], timeout=120)
        if '"queue_status": "Finish"' in (r.stdout + r.stderr):
            break
    files = [f for f in os.listdir(dl)] if os.path.isdir(dl) else []
    if not files:
        return None, f"no image (sid={sid})"
    return os.path.join(dl, files[0]), sid

def main():
    done = set()
    if os.path.exists(LOG):
        for line in open(LOG):
            try:
                rec = json.loads(line)
                if rec.get("ok"):
                    done.add(rec["id"])
            except Exception:
                pass
    for hid in IDS:
        if hid in done:
            print(f"skip {hid}", flush=True)
            continue
        ref = f"{ROOT}/assets/portraits/full/{hid}-falang-full.png"
        if not os.path.exists(ref):
            log({"id": hid, "ok": False, "err": "missing source"})
            continue
        t0 = time.time()
        try:
            src, info = gen_one(hid, ref)
        except Exception as e:
            log({"id": hid, "ok": False, "err": str(e)[:300]})
            continue
        if not src:
            log({"id": hid, "ok": False, "err": info})
            time.sleep(20)
            continue
        try:
            raw_dst = os.path.join(OUT, f"{hid}-height-raw.png")
            os.replace(src, raw_dst)
            im = Image.open(raw_dst).convert("L")
            im = im.resize((3040, 4560), Image.LANCZOS)
            dst = os.path.join(OUT, f"{hid}-height-candidate.png")
            im.save(dst)
            im.resize((512, 768)).save(os.path.join(PREV, f"{hid}.jpg"), quality=82)
            log({"id": hid, "ok": True, "sid": info, "sec": round(time.time() - t0)})
        except Exception as e:
            log({"id": hid, "ok": False, "err": f"post: {e}"})
        time.sleep(5)
    print("ALL DONE", flush=True)

if __name__ == "__main__":
    main()
