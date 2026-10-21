#!/usr/bin/env python3
"""A Meshy hero, end to end: text -> textured mesh -> humanoid rig -> library animations.

    meshy.py balance
    meshy.py library <search>                        # free: action ids for a clip name
    meshy.py preview <name> "<prompt>"               # shape only, A-pose, remeshed low
    meshy.py refine  <name> <preview_id> ["<texture prompt>"]
    meshy.py rig     <name> <refine_id> [height_m]
    meshy.py animate <name> <rig_id> <id,id,...>     # up to 10 actions merged into one GLB

Every result (GLB + task JSON + thumbnails) lands in --out (default ./meshy_out/<name>/), never
in the game's assets: a generated model is a candidate until someone has looked at it. The key
comes from $MESHY_API_KEY or ~/.config/meshy/api_key and is never printed or written. Ask before
running anything but balance/library -- every other call spends credits.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.meshy.ai/openapi"
OUT = os.environ.get("MESHY_OUT", os.path.join(os.getcwd(), "meshy_out"))


def key():
    k = os.environ.get("MESHY_API_KEY")
    if not k:
        with open(os.path.expanduser("~/.config/meshy/api_key")) as f:
            k = f.read().strip()
    return k


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Meshy {e.code} on {method} {path}: {e.read().decode(errors='replace')}")


def fetch(url, dest):
    with urllib.request.urlopen(url, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def run(name, kind, path, body):
    tid = call("POST", path, body)["result"]
    print(f"{kind} task {tid}", flush=True)
    last = None
    while True:
        t = call("GET", f"{path}/{tid}")
        if t["status"] in ("SUCCEEDED", "FAILED", "CANCELED"):
            break
        if t.get("progress") != last:
            last = t.get("progress")
            print(f"  {t['status']} {last}%", flush=True)
        time.sleep(8)
    out = os.path.join(OUT, name)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, f"{kind}_{tid}.json"), "w") as f:
        json.dump(t, f, indent=2)
    if t["status"] != "SUCCEEDED":
        sys.exit(f"{kind} {tid} {t['status']}: {t.get('task_error')}")
    urls = {}
    if t.get("model_urls", {}).get("glb"):
        urls["glb"] = t["model_urls"]["glb"]
    if t.get("thumbnail_url"):
        urls["png"] = t["thumbnail_url"]
    for k, v in (t.get("result") or {}).items():
        if isinstance(v, str) and v.startswith("http") and k.endswith("glb_url"):
            urls[k.removesuffix("_url")] = v
        if isinstance(v, dict):
            for k2, v2 in v.items():
                if isinstance(v2, str) and k2.endswith("glb_url") and "armature" not in k2:
                    urls[k2.removesuffix("_url")] = v2
    for label, url in urls.items():
        ext = "png" if label == "png" else "glb"
        print("  ->", fetch(url, os.path.join(out, f"{kind}_{label}.{ext}" if label != ext else f"{kind}.{ext}")))
    print(f"{kind} done, {t.get('consumed_credits', '?')} credits, id {tid}")
    return tid


def main(a):
    cmd = a[0] if a else "help"
    if cmd == "balance":
        print(call("GET", "/v1/balance"))
    elif cmd == "library":
        q = urllib.parse.urlencode({"search": a[1], "page_size": 50})
        res = call("GET", f"/v1/animations/library?{q}")
        for e in res if isinstance(res, list) else res.get("result", res.get("data", [])):
            print(e["action_id"], e["name"], "|", e.get("category"), "/", e.get("sub_category"))
    elif cmd == "preview":
        run(a[1], "preview", "/v2/text-to-3d", {
            "mode": "preview", "prompt": a[2], "ai_model": "meshy-6", "pose_mode": "a-pose",
            "should_remesh": True, "target_polycount": 12000, "target_formats": ["glb"]})
    elif cmd == "refine":
        body = {"mode": "refine", "preview_task_id": a[2], "target_formats": ["glb"], "remove_lighting": True}
        if len(a) > 3:
            body["texture_prompt"] = a[3]
        run(a[1], "refine", "/v2/text-to-3d", body)
    elif cmd == "rig":
        run(a[1], "rig", "/v1/rigging", {"input_task_id": a[2], "height_meters": float(a[3]) if len(a) > 3 else 1.7})
    elif cmd == "animate":
        ids = [int(x) for x in a[3].split(",")]
        run(a[1], "animate", "/v1/animations", {"rig_task_id": a[2], "action_ids": ids})
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
