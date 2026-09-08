#!/usr/bin/env python3
"""Godot .tscn set -> SceneDef data-as-code (TypeScript). One-off migration + reporting.

Parses a Godot 4 text scene directly: ext_resources (model paths), sub_resources (primitive
meshes, materials, curves), and the node tree with COMPOSED parent transforms. Emits:
  tiles    hex_* KayKit tiles snapped to axial cells (scale 3, 60deg yaw)   -> {q, r, t, rot}
  props    every other instanced glTF/glb                                  -> {m, x/z|q/r, y, rot, s|sc, tags, hidden}
  shapes   MeshInstance3D with BoxMesh/PlaneMesh + StandardMaterial3D      -> {kind, size, color, x, y, z, rot, sc, name}
  anchors  Marker3D                                                         -> {name, x, z, y, rot}
  camera   camera_pos / camera_look markers                                 -> {pos, look}
  routes   Path3D curves (point positions, handles dropped)                 -> {name, points}
  lights   OmniLight3D                                                      -> {kind, x, y, z, color, energy, range}
Anything else (CSG, tilted rotations, unknown resources) is REPORTED, never silently dropped.

The .tscn basis is ROW-major (Godot stores Basis as rows): world.xform(v) = rows . v + origin.
Pointy-top hex lattice (scale 3): x = 6q + 3r, z = 3*sqrt(3)*r.

Usage: tscn_to_scene.py <set.tscn> [--out src/content/scenes/name.ts] [--export NAME] [--report]
"""
import json, math, os, re, sys

ROW = 3 * math.sqrt(3)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))


# ---------------------------------------------------------------- parsing
SECTION = re.compile(r'^\[(\w+)(.*)\]\s*$')
ATTR = re.compile(r'(\w+)=("(?:[^"\\]|\\.)*"|[^\s\]]+)')


def parse_attrs(s):
    out = {}
    for k, v in ATTR.findall(s):
        out[k] = v[1:-1] if v.startswith('"') else v
    return out


def parse_tscn(path):
    """-> (ext: id->path, subs: id->{type, props}, nodes: [{name,type,parent,instance,groups,props}])"""
    ext, subs, nodes = {}, {}, []
    cur = None
    lines = open(path, encoding="utf8").read().split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        m = SECTION.match(line)
        if m:
            kind, rest = m.group(1), m.group(2)
            a = parse_attrs(rest)
            if kind == "ext_resource":
                ext[a.get("id")] = a.get("path", "")
                cur = None
            elif kind == "sub_resource":
                cur = {"type": a.get("type"), "props": {}}
                subs[a.get("id")] = cur
            elif kind == "node":
                inst = re.search(r'instance=ExtResource\("([^"]+)"\)', rest)
                grp = re.search(r'groups=\[([^\]]*)\]', rest)
                cur = {
                    "name": a.get("name"), "type": a.get("type"), "parent": a.get("parent"),
                    "instance": inst.group(1) if inst else None,
                    "groups": [g.strip().strip('"') for g in grp.group(1).split(",")] if grp else [],
                    "props": {},
                }
                nodes.append(cur)
            else:
                cur = None
            i += 1
            continue
        if cur is not None and "=" in line and not line.startswith(" "):
            key, _, val = line.partition("=")
            key = key.strip(); val = val.strip()
            # continuation: unbalanced brackets/braces/parens span lines
            while (val.count("(") > val.count(")")) or (val.count("{") > val.count("}")) or (val.count("[") > val.count("]")):
                i += 1
                if i >= len(lines):
                    break
                val += "\n" + lines[i].strip()
            cur["props"][key] = val
        i += 1
    return ext, subs, nodes


def floats(s):
    """Numbers inside a typed literal like Transform3D(...) / Vector3(...) -- the type name's own
    digits (the 3 in Transform3D) must NOT be read as a value."""
    m = re.match(r'\s*[A-Za-z_][A-Za-z0-9_]*\s*\((.*)\)\s*$', s, re.S)
    inner = m.group(1) if m else s
    return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:e-?\d+)?', inner)]


def transform_of(props):
    """Godot Transform3D as (rows[3][3], origin[3]); identity when absent."""
    t = props.get("transform")
    if not t:
        return ([[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.0, 0.0, 0.0])
    f = floats(t)
    return ([f[0:3], f[3:6], f[6:9]], f[9:12])


def compose(parent, local):
    """world = parent o local for row-stored bases: rows_w = rows_p . rows_l, o_w = rows_p . o_l + o_p."""
    rp, op = parent
    rl, ol = local
    rows = [[sum(rp[i][k] * rl[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    org = [sum(rp[i][k] * ol[k] for k in range(3)) + op[i] for i in range(3)]
    return (rows, org)


def decompose(tf):
    """-> dict(x,y,z, sx,sy,sz, yaw_deg, tilt=[rx,rz] deg, tilted). Columns of the row-stored basis are the axes."""
    rows, o = tf
    ax = [rows[0][0], rows[1][0], rows[2][0]]
    ay = [rows[0][1], rows[1][1], rows[2][1]]
    az = [rows[0][2], rows[1][2], rows[2][2]]
    sx, sy, sz = (math.sqrt(sum(c * c for c in a)) for a in (ax, ay, az))
    # pure rotation R (three.js row-major layout) = rows with each COLUMN divided by its scale
    R = [[rows[i][0] / (sx or 1), rows[i][1] / (sy or 1), rows[i][2] / (sz or 1)] for i in range(3)]
    # three.js Euler order YXZ from a rotation matrix (yaw about y first)
    m13, m23, m33, m21, m22, m11, m12 = R[0][2], R[1][2], R[2][2], R[1][0], R[1][1], R[0][0], R[0][1]
    rx = math.asin(-max(-1.0, min(1.0, m23)))
    if abs(m23) < 0.9999999:
        ry = math.atan2(m13, m33)
        rz = math.atan2(m21, m22)
    else:
        ry = math.atan2(-R[2][0], m11)
        rz = 0.0
    yaw = (math.degrees(ry) + 360) % 360
    tilt = [math.degrees(rx), math.degrees(rz)]
    tilted = abs(tilt[0]) > 0.05 or abs(tilt[1]) > 0.05
    return {"x": o[0], "y": o[1], "z": o[2], "sx": sx, "sy": sy, "sz": sz, "yaw": yaw, "tilt": tilt, "tilted": tilted}


# ---------------------------------------------------------------- emit helpers
def r3(v):
    v = round(v + 0.0, 3)
    return 0 if v == 0 else v


def fmt(v):
    v = r3(v)
    return str(int(v)) if float(v).is_integer() else repr(v)


def near_int(v, tol=0.02):
    return abs(v - round(v)) < tol


def color_hex(s):
    f = floats(s)
    r, g, b = (max(0, min(1, c)) for c in f[:3])
    # Godot colours are linear; the web material takes sRGB hex, so encode
    def enc(c):
        return 1.055 * c ** (1 / 2.4) - 0.055 if c > 0.0031308 else 12.92 * c
    h = "#%02x%02x%02x" % tuple(int(round(enc(c) * 255)) for c in (r, g, b))
    a = f[3] if len(f) > 3 else 1.0
    return h, a


def kv(parts):
    return "{ " + ", ".join(parts) + " }"


# ---------------------------------------------------------------- conversion
def convert(path, report):
    ext, subs, nodes = parse_tscn(path)
    world = {}  # node path -> world transform
    out = {"tiles": [], "props": [], "shapes": [], "anchors": [], "routes": [], "lights": []}
    camera = {}
    skipped = []
    for n in nodes:
        parent = n["parent"]
        if parent is None:  # scene root
            world["."] = transform_of(n["props"])
            continue
        me = n["name"] if parent == "." else parent + "/" + n["name"]
        ptf = world.get(parent, world["."])
        tf = compose(ptf, transform_of(n["props"]))
        world[me] = tf
        d = decompose(tf)
        hidden = n["props"].get("visible", "true") == "false"
        tags = [g for g in n["groups"] if g]
        if n["instance"]:
            model = ext.get(n["instance"], "")
            if not model.startswith("res://assets/"):
                skipped.append(f"instance with unexpected path {model} ({me})")
                continue
            m = model[len("res://assets/"):]
            short = os.path.basename(m).rsplit(".", 1)[0]
            uniform = abs(d["sx"] - d["sy"]) < 0.01 and abs(d["sx"] - d["sz"]) < 0.01
            r = d["z"] / ROW
            q = (d["x"] - 3 * r) / 6
            on_cell = near_int(q) and near_int(r)
            if (short.startswith("hex_") and on_cell and uniform and abs(d["sx"] - 3) < 0.01
                    and near_int(d["yaw"] / 60) and not d["tilted"] and abs(d["y"]) < 0.005 and not hidden):
                out["tiles"].append({"q": round(q), "r": round(r), "t": short[4:], "rot": round(d["yaw"] / 60) % 6})
                continue
            p = {"m": m}
            if on_cell and abs(d["y"]) < 0.005:
                p["q"], p["r"] = round(q), round(r)
            else:
                p["x"], p["z"] = d["x"], d["z"]
            if abs(d["y"]) > 0.005:
                p["y"] = d["y"]
            if abs(d["yaw"]) > 0.05 and abs(d["yaw"] - 360) > 0.05:
                p["rot"] = d["yaw"]
            if uniform:
                if abs(d["sx"] - 1) > 0.0005:
                    p["s"] = d["sx"]
            else:
                p["sc"] = [d["sx"], d["sy"], d["sz"]]
            if d["tilted"]:
                p["tilt"] = d["tilt"]
            if tags:
                p["tags"] = tags
            if hidden:
                p["hidden"] = True
            out["props"].append(p)
        elif n["type"] == "MeshInstance3D":
            mesh = subs.get((re.search(r'SubResource\("([^"]+)"\)', n["props"].get("mesh", "")) or [None, None])[1])
            mat_id = re.search(r'SubResource\("([^"]+)"\)', n["props"].get("material_override", "") or "")
            if mesh and mat_id is None and mesh["props"].get("material"):
                mat_id = re.search(r'SubResource\("([^"]+)"\)', mesh["props"]["material"])
            mat = subs.get(mat_id.group(1)) if mat_id else None
            if not mesh or mesh["type"] not in ("BoxMesh", "PlaneMesh"):
                skipped.append(f"MeshInstance3D {me}: mesh {mesh['type'] if mesh else 'none'} unsupported")
                continue
            if mesh["type"] == "BoxMesh":
                size = floats(mesh["props"].get("size", "Vector3(1, 1, 1)"))
                kind = "box"
            else:
                size = floats(mesh["props"].get("size", "Vector2(2, 2)"))
                kind = "plane"
            color, alpha = color_hex(mat["props"].get("albedo_color", "Color(1,1,1,1)")) if mat else ("#ffffff", 1.0)
            sh = {"kind": kind, "size": size, "color": color, "x": d["x"], "y": d["y"], "z": d["z"]}
            if alpha < 0.999:
                sh["alpha"] = alpha
            if mat and mat["props"].get("emission_enabled") == "true":
                sh["emissive"] = color_hex(mat["props"].get("emission", "Color(0,0,0,1)"))[0]
            if abs(d["yaw"]) > 0.05 and abs(d["yaw"] - 360) > 0.05:
                sh["rot"] = d["yaw"]
            if any(abs(v - 1) > 0.0005 for v in (d["sx"], d["sy"], d["sz"])):
                sh["sc"] = [d["sx"], d["sy"], d["sz"]]
            if d["tilted"]:
                sh["tilt"] = d["tilt"]
            if not n["name"].startswith("@"):
                sh["name"] = n["name"]
            if hidden:
                sh["hidden"] = True
            out["shapes"].append(sh)
        elif n["type"] == "Marker3D":
            if n["name"] in ("camera_pos", "camera_look"):
                camera[n["name"]] = [d["x"], d["y"], d["z"]]
                continue
            a = {"name": n["name"], "x": d["x"], "z": d["z"]}
            if abs(d["y"]) > 0.005:
                a["y"] = d["y"]
            if abs(d["yaw"]) > 0.05 and abs(d["yaw"] - 360) > 0.05:
                a["rot"] = d["yaw"]
            out["anchors"].append(a)
        elif n["type"] == "Path3D":
            cid = re.search(r'SubResource\("([^"]+)"\)', n["props"].get("curve", ""))
            curve = subs.get(cid.group(1)) if cid else None
            data = curve["props"].get("_data", "") if curve else ""
            pv = re.search(r'PackedVector3Array\(([^)]*)\)', data)
            pts = floats(pv.group(1)) if pv else []
            # 9 floats per point: in-handle, out-handle, position
            positions = [pts[i + 6:i + 9] for i in range(0, len(pts) - 8, 9)]
            rows, _ = tf
            wp = []
            for p3 in positions:
                w = compose(tf, ([[1, 0, 0], [0, 1, 0], [0, 0, 1]], p3))[1]
                wp.append([w[0], w[1], w[2]])
            out["routes"].append({"name": n["name"], "points": wp})
        elif n["type"] == "OmniLight3D":
            color, _ = color_hex(n["props"].get("light_color", "Color(1,1,1,1)"))
            out["lights"].append({
                "kind": "omni", "x": d["x"], "y": d["y"], "z": d["z"], "color": color,
                "energy": float(n["props"].get("light_energy", "1")), "range": float(n["props"].get("omni_range", "5")),
            })
        elif n["type"] == "CSGPolygon3D":
            pv = re.search(r'PackedVector2Array\(([^)]*)\)', n["props"].get("polygon", ""))
            if not pv:
                skipped.append(f"CSGPolygon3D {me}: no polygon")
                continue
            nums = floats("(" + pv.group(1) + ")")
            MAXC = 10000.0  # island_doc MAX_COORD: a stray huge vertex is clamped at authoring time
            pts = [[max(-MAXC, min(MAXC, nums[i])), max(-MAXC, min(MAXC, nums[i + 1]))] for i in range(0, len(nums) - 1, 2)]
            mid = re.search(r'SubResource\("([^"]+)"\)', n["props"].get("material", "") or "")
            mat = subs.get(mid.group(1)) if mid else None
            color, alpha = color_hex(mat["props"].get("albedo_color", "Color(1,1,1,1)")) if mat else ("#ffffff", 1.0)
            sh = {"kind": "polygon", "points": pts, "depth": float(n["props"].get("depth", "1")),
                  "color": color, "x": d["x"], "y": d["y"], "z": d["z"], "size": []}
            if alpha < 0.999:
                sh["alpha"] = alpha
            if abs(d["yaw"]) > 0.05 and abs(d["yaw"] - 360) > 0.05:
                sh["rot"] = d["yaw"]
            if d["tilted"]:
                sh["tilt"] = d["tilt"]
            if not n["name"].startswith("@"):
                sh["name"] = n["name"]
            if hidden:
                sh["hidden"] = True
            out["shapes"].append(sh)
        elif n["type"] in ("Node3D",):
            continue  # container
        else:
            skipped.append(f"{n['type']} {me} unsupported")
    # Coplanar CSG polygons (the mill's land sitting exactly on its water) would z-fight, and
    # Godot's CSG siblings are not combined either. Keep the authored order meaningful: each
    # later polygon at the same height drops a hair, so the first one authored stays on top.
    seen_y = {}
    for sh in out["shapes"]:
        if sh["kind"] != "polygon":
            continue
        key = round(sh["y"], 3)
        n = seen_y.get(key, 0)
        seen_y[key] = n + 1
        if n:
            sh["y"] -= 0.02 * n

    cam = None
    if "camera_pos" in camera and "camera_look" in camera:
        cam = {"pos": camera["camera_pos"], "look": camera["camera_look"]}
    return out, cam, skipped


HEADER = [
    "// AUTHORED scene data-as-code -- floor tiles, props, primitive shapes, anchors, camera, routes,",
    "// lights. Source of truth for this set; edited by hand or written back by the scene editor",
    "// (/editor.html). Grid math: src/world/hexGrid.ts. Types: src/world/sceneDef.ts.",
]


def emit_ts(out, cam, export_name):
    L = list(HEADER)
    L.append('import type { SceneDef } from "../../world/sceneDef";')
    L.append("")
    L.append(f"export const {export_name}: SceneDef = {{")
    L.append("  tiles: [")
    cur = None
    for t in sorted(out["tiles"], key=lambda t: (t["r"], t["q"])):
        if t["r"] != cur:
            L.append(f"    // row r={t['r']}")
            cur = t["r"]
        rs = f", rot: {t['rot']}" if t["rot"] else ""
        L.append(f'    {{ q: {t["q"]}, r: {t["r"]}, t: "{t["t"]}"{rs} }},')
    L.append("  ],")
    L.append("  props: [")
    for p in out["props"]:
        parts = [f'm: "{p["m"]}"']
        if "q" in p:
            parts.append(f"q: {p['q']}, r: {p['r']}")
        else:
            parts.append(f"x: {fmt(p['x'])}, z: {fmt(p['z'])}")
        if "y" in p: parts.append(f"y: {fmt(p['y'])}")
        if "rot" in p: parts.append(f"rot: {fmt(p['rot'])}")
        if "tilt" in p: parts.append("tilt: [" + ", ".join(fmt(v) for v in p["tilt"]) + "]")
        if "s" in p: parts.append(f"s: {fmt(p['s'])}")
        if "sc" in p: parts.append("sc: [" + ", ".join(fmt(v) for v in p["sc"]) + "]")
        if "tags" in p: parts.append("tags: [" + ", ".join(f'"{t}"' for t in p["tags"]) + "]")
        if p.get("hidden"): parts.append("hidden: true")
        L.append("    " + kv(parts) + ",")
    L.append("  ],")
    if out["shapes"]:
        L.append("  shapes: [")
        for s in out["shapes"]:
            parts = [f'kind: "{s["kind"]}"']
            if s["kind"] == "polygon":
                pass
            if s["kind"] == "polygon":
                pts = ", ".join("[" + ", ".join(fmt(v) for v in p) + "]" for p in s["points"])
                parts.append(f"points: [{pts}]")
                parts.append(f"depth: {fmt(s['depth'])}")
            else:
                parts.append("size: [" + ", ".join(fmt(v) for v in s["size"]) + "]")
            parts += [f'color: "{s["color"]}"', f"x: {fmt(s['x'])}, z: {fmt(s['z'])}"]
            if abs(s["y"]) > 0.0005: parts.append(f"y: {fmt(s['y'])}")
            if "rot" in s: parts.append(f"rot: {fmt(s['rot'])}")
            if "tilt" in s: parts.append("tilt: [" + ", ".join(fmt(v) for v in s["tilt"]) + "]")
            if "sc" in s: parts.append("sc: [" + ", ".join(fmt(v) for v in s["sc"]) + "]")
            if "alpha" in s: parts.append(f"alpha: {fmt(s['alpha'])}")
            if "emissive" in s: parts.append(f'emissive: "{s["emissive"]}"')
            if "name" in s: parts.append(f'name: "{s["name"]}"')
            if s.get("hidden"): parts.append("hidden: true")
            L.append("    " + kv(parts) + ",")
        L.append("  ],")
    if out["anchors"]:
        L.append("  anchors: [")
        for a in out["anchors"]:
            parts = [f'name: "{a["name"]}"', f"x: {fmt(a['x'])}, z: {fmt(a['z'])}"]
            if "y" in a: parts.append(f"y: {fmt(a['y'])}")
            if "rot" in a: parts.append(f"rot: {fmt(a['rot'])}")
            L.append("    " + kv(parts) + ",")
        L.append("  ],")
    if cam:
        L.append("  camera: { pos: [" + ", ".join(fmt(v) for v in cam["pos"]) + "], look: [" + ", ".join(fmt(v) for v in cam["look"]) + "] },")
    if out["routes"]:
        L.append("  routes: [")
        for r in out["routes"]:
            pts = ", ".join("[" + ", ".join(fmt(v) for v in p) + "]" for p in r["points"])
            L.append(f'    {{ name: "{r["name"]}", points: [{pts}] }},')
        L.append("  ],")
    if out["lights"]:
        L.append("  lights: [")
        for l in out["lights"]:
            L.append(f'    {{ kind: "omni", x: {fmt(l["x"])}, y: {fmt(l["y"])}, z: {fmt(l["z"])}, color: "{l["color"]}", energy: {fmt(l["energy"])}, range: {fmt(l["range"])} }},')
        L.append("  ],")
    L.append("};")
    L.append("")
    return "\n".join(L)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(1)
    src = args[0]
    out_path = args[args.index("--out") + 1] if "--out" in args else None
    export = args[args.index("--export") + 1] if "--export" in args else os.path.basename(src).rsplit(".", 1)[0].upper()
    out, cam, skipped = convert(src, "--report" in args)
    n = {k: len(v) for k, v in out.items()}
    print(f"{os.path.basename(src)}: {n}, camera={'yes' if cam else 'no'}, skipped={len(skipped)}")
    for s in skipped:
        print("   !", s)
    if out_path:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        open(out_path, "w").write(emit_ts(out, cam, export))
        print("   ->", out_path)


if __name__ == "__main__":
    main()
