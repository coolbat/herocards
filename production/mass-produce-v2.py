#!/usr/bin/env python3
"""光源矩阵 v2 量产驱动：14 张源图顺序生成（即梦 dreamina CLI）。
每张：提交 -> 轮询 -> 下载 -> 居中裁 2:3 (3040x4560) -> 存候选 + QC 预览。
产物：
  production/guofeng-work/v2/<id>-raw.png          原始 9:16
  production/guofeng-work/v2/<id>-candidate.png    裁剪后 2:3（QC 通过才转正到 assets/）
  qa/light-matrix/v2/<id>.jpg                      QC 预览
  production/guofeng-work/v2/log.jsonl             逐张日志
"""
import json, os, re, subprocess, sys, time
from PIL import Image

ROOT = "/Users/coolbat/herocards"
PROMPTS = json.load(open(f"{ROOT}/production/prompts-v2.json"))
RAW = f"{ROOT}/production/guofeng-work/v2"
PREV = f"{ROOT}/qa/light-matrix/v2"
LOG = f"{RAW}/log.jsonl"
os.makedirs(RAW, exist_ok=True)
os.makedirs(PREV, exist_ok=True)
ENV = dict(os.environ, PATH=os.path.expanduser("~/.local/bin") + ":" + os.environ["PATH"])

def log(rec):
    with open(LOG, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(json.dumps(rec, ensure_ascii=False), flush=True)

def run(cmd, timeout=120):
    return subprocess.run(cmd, capture_output=True, text=True, env=ENV, timeout=timeout)

def gen_one(hid, prompt):
    out = run(["dreamina", "text2image", "--model_version=4.7", "--ratio=9:16",
               "--resolution_type=4k", "--generate_num=1", f"--prompt={prompt}"], timeout=180)
    m = re.search(r'"submit_id"\s*:\s*"([^"]+)"', out.stdout + out.stderr)
    if not m:
        return None, f"submit failed: {(out.stdout+out.stderr)[:200]}"
    sid = m.group(1)
    dl = os.path.join(RAW, f"{hid}-dl")
    for _ in range(16):  # 最长 4 分钟
        time.sleep(15)
        r = run(["dreamina", "query_result", f"--submit_id={sid}", f"--download_dir={dl}"], timeout=120)
        txt = r.stdout + r.stderr
        if '"queue_status": "Finish"' in txt:
            break
        if '"gen_status": "fail"' in txt or "fail_reason" in txt and '"fail_reason": ""' not in txt:
            pass  # 继续等，fail 会在最后一次判断
    files = [f for f in os.listdir(dl)] if os.path.isdir(dl) else []
    if not files:
        return None, f"no image after polling (sid={sid})"
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
    for hid, prompt in PROMPTS.items():
        if hid in done:
            print(f"skip {hid} (done)", flush=True)
            continue
        t0 = time.time()
        try:
            src, info = gen_one(hid, prompt)
        except Exception as e:
            log({"id": hid, "ok": False, "err": str(e)[:300]})
            continue
        if not src:
            log({"id": hid, "ok": False, "err": info})
            time.sleep(20)
            continue
        try:
            raw_dst = os.path.join(RAW, f"{hid}-raw.png")
            os.replace(src, raw_dst)
            im = Image.open(raw_dst)
            W, H = im.size
            tw, th = 3040, 4560
            left, top = max(0, (W - tw) // 2), max(0, (H - th) // 2)
            cand = im.crop((left, top, left + tw, top + th))
            cand_dst = os.path.join(RAW, f"{hid}-candidate.png")
            cand.save(cand_dst)
            cand.resize((512, 768)).save(os.path.join(PREV, f"{hid}.jpg"), quality=82)
            log({"id": hid, "ok": True, "sid": info, "sec": round(time.time() - t0)})
        except Exception as e:
            log({"id": hid, "ok": False, "err": f"crop: {e}"})
        time.sleep(5)  # 温柔一点，避免限流
    print("ALL DONE", flush=True)

if __name__ == "__main__":
    main()
