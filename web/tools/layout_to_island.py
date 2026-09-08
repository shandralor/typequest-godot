#!/usr/bin/env python3
"""One-off converter: overworld-layout.json (raw Godot transforms) -> island data-as-code.

Reverses every placed node into the compact authorable form used by src/world/hexGrid.ts:
  - hex floor tiles  -> axial (q, r) + tile code + rotation in 60deg steps
  - everything else  -> a prop; placed on a cell (q, r) when it sits on a hex centre, else
                        at explicit world (x, z); yaw in degrees, scale, height.

Pointy-top hex grid, KayKit hexes at scale 3: across-flats 6, row pitch 3*sqrt(3).
  world.x = 6*q + 3*r      world.z = 3*sqrt(3) * r
The .tscn basis is ROW-major (Godot stores Basis as rows), so row0 = (cos, 0, sin)*scale.
"""
import json, math, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "public", "overworld-layout.json")
OUT = os.path.join(HERE, "..", "src", "content", "island", "overworld.ts")

ROW = 3 * math.sqrt(3)


def rev(t):
    a, b, c, d, e, f, g, h, i, ox, oy, oz = t
    s = math.sqrt(a * a + b * b + c * c)
    yaw = math.degrees(math.atan2(c, a))
    r = oz / ROW
    q = (ox - 3 * r) / 6
    return q, r, yaw, s, ox, oy, oz


def near_int(v, tol=0.02):
    return abs(v - round(v)) < tol


def fmt(v):
    """Compact number: 3 -> 3, 2.5 -> 2.5, -0.0 -> 0."""
    v = round(v + 0.0, 3)
    if v == 0:
        return "0"
    if v == int(v):
        return str(int(v))
    return repr(v)


def main():
    L = json.load(open(SRC))
    tiles, props = [], []
    for n in L["nodes"]:
        m = n["model"]
        short = os.path.basename(m).replace(".gltf", "")
        q, r, yaw, s, ox, oy, oz = rev(n["t"])
        on_cell = near_int(q) and near_int(r)
        yaw = (yaw + 360) % 360
        if short.startswith("hex_") and on_cell and abs(s - 3) < 0.01 and near_int(yaw / 60):
            code = short[4:]  # hex_water -> water, hex_road_B -> road_B
            rot = round(yaw / 60) % 6
            tiles.append((round(r), round(q), code, rot))
        else:
            p = {"m": m}
            if on_cell:
                p["q"], p["r"] = round(q), round(r)
            else:
                p["x"], p["z"] = ox, oz
            if abs(yaw - round(yaw)) < 0.01:
                yaw = float(round(yaw))  # snap float noise (329.999 -> 330)
            if abs(yaw) > 0.05 and abs(yaw - 360) > 0.05:
                p["rot"] = yaw
            p["s"] = s
            if abs(oy) > 0.005:
                p["y"] = oy
            props.append(p)

    tiles.sort()  # by row, then column: reads like a map
    lines = []
    # header identical to src/editor/island_doc.ts serializeIslandTs, so an editor save of an
    # untouched island is byte-identical to this converter's output
    lines.append("// AUTHORED island data-as-code -- floor tiles + props. Source of truth for this island;")
    lines.append("// edited by hand or written back by the island editor (/editor.html). Grid math lives in")
    lines.append("// src/world/hexGrid.ts. tiles: axial (q, r), t = KayKit hex code (hex_<t>.gltf), rot = yaw in")
    lines.append("// 60-degree steps (0-5); tiles may stack. props: on a cell (q, r) or at world (x, z); rot = yaw")
    lines.append("// in degrees; s = scale; y = height.")
    lines.append('import type { IslandDef } from "../../world/hexGrid";')
    lines.append("")
    lines.append("export const OVERWORLD: IslandDef = {")
    lines.append("  tiles: [")
    cur = None
    for r, q, code, rot in tiles:
        if r != cur:
            lines.append(f"    // row r={r}")
            cur = r
        rs = f", rot: {rot}" if rot else ""
        lines.append(f'    {{ q: {q}, r: {r}, t: "{code}"{rs} }},')
    lines.append("  ],")
    lines.append("  props: [")
    for p in props:
        parts = [f'm: "{p["m"]}"']
        if "q" in p:
            parts.append(f"q: {p['q']}, r: {p['r']}")
        else:
            parts.append(f"x: {fmt(p['x'])}, z: {fmt(p['z'])}")
        if "rot" in p:
            parts.append(f"rot: {fmt(p['rot'])}")
        if abs(p["s"] - 1) > 0.0005:
            parts.append(f"s: {fmt(p['s'])}")
        if "y" in p:
            parts.append(f"y: {fmt(p['y'])}")
        lines.append("    { " + ", ".join(parts) + " },")
    lines.append("  ],")
    lines.append("};")
    lines.append("")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w").write("\n".join(lines))
    print(f"wrote {os.path.relpath(OUT, HERE)}: {len(tiles)} tiles, {len(props)} props")


if __name__ == "__main__":
    main()
