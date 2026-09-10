// AUTHORED scene data-as-code -- floor tiles, props, primitive shapes, anchors, camera, routes,
// lights. Source of truth for this set; edited by hand or written back by the scene editor
// (/editor.html). Grid math: src/world/hexGrid.ts. Types: src/world/sceneDef.ts.
import type { SceneDef } from "../../world/sceneDef";

export const FORGE: SceneDef = {
  tiles: [
  ],
  props: [
    { m: "kaykit/rpgtools_bits/grindstone.gltf", x: 0.55, z: 0.95, rot: 90, s: 0.48, tags: ["forge_blades"] },
    { m: "kaykit/dungeon/table_medium.gltf", x: 0.8, z: 1.5, rot: 90, tags: ["forge_ranged"] },
    { m: "kaykit/rpgtools_bits/anvil.gltf", x: -1.8, z: 0.6, rot: 320 },
    { m: "kaykit/forest_nature/Tree_1_A_Color1.gltf", x: 7.52, z: 4.803, rot: 225.752, s: 1.63 },
    { m: "kaykit/forest_nature/Tree_3_A_Color1.gltf", x: 11.101, z: 1.518, rot: 184.732, s: 1.791 },
    { m: "kaykit/forest_nature/Tree_1_A_Color1.gltf", x: 10.671, z: -0.86, rot: 253.233, s: 1.453 },
    { m: "kaykit/forest_nature/Tree_2_A_Color1.gltf", x: 5.711, z: -5.331, rot: 177.99, s: 1.861 },
    { m: "kaykit/forest_nature/Tree_1_A_Color1.gltf", x: 5.588, z: -8.916, rot: 189.029, s: 1.447 },
    { m: "kaykit/forest_nature/Tree_3_A_Color1.gltf", x: 6.055, z: -12.027, rot: 149.409, s: 1.331 },
    { m: "kaykit/forest_nature/Tree_1_A_Color1.gltf", x: -9.055, z: -8.159, rot: 281.757, s: 1.591 },
    { m: "kaykit/forest_nature/Tree_1_A_Color1.gltf", x: -8.462, z: -4.509, rot: 201.608, s: 1.618 },
    { m: "kaykit/forest_nature/Tree_2_A_Color1.gltf", x: -11.695, z: 0.145, rot: 334.796, s: 1.663 },
    { m: "kaykit/forest_nature/Tree_3_A_Color1.gltf", x: -9.866, z: 2.156, rot: 117.319, s: 1.653 },
    { m: "kaykit/forest_nature/Tree_1_A_Color1.gltf", x: -9.934, z: 6.493, rot: 306.349, s: 1.687 },
    { m: "kaykit/resource_bits/Copper_Bars.gltf", x: 2.244, z: -2.143 },
    { m: "kaykit/resource_bits/Iron_Bars.gltf", x: -2.253, z: -2.156, y: 0.056, rot: 309.978 },
    { m: "kaykit/dungeon/wall_shelves.gltf", x: -0.061, z: -3.459, y: 0.015, sc: [1.486, 1, 1] },
    { m: "kaykit/dungeon/wall_window_open_scaffold.gltf", x: -3.444, z: -0.419, rot: 91.681, sc: [1.849, 1, 1.022] },
    { m: "kaykit/dungeon/wall_window_open_scaffold.gltf", x: 3.281, z: -0.419, rot: 91.681, sc: [1.849, 1, 1.022] },
  ],
  shapes: [
    { kind: "plane", size: [40, 40], color: "#4c7538", x: 0, z: 0, sc: [0.574, 0.636, 0.457], name: "Ground" },
    { kind: "box", size: [6, 0.08, 6], color: "#57524c", x: 0, z: 0, y: 0.04 },
  ],
  anchors: [
    { name: "center", x: 0.8, z: 0 },
    { name: "grind_point", x: 0.8, z: 1.4 },
    { name: "path_near", x: 0, z: 3 },
    { name: "path_far", x: 0, z: -3 },
    { name: "treasure", x: 0, z: -3 },
  ],
};
