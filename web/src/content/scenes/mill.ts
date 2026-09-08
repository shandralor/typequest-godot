// AUTHORED scene data-as-code -- floor tiles, props, primitive shapes, anchors, camera, routes,
// lights. Source of truth for this set; edited by hand or written back by the scene editor
// (/editor.html). Grid math: src/world/hexGrid.ts. Types: src/world/sceneDef.ts.
import type { SceneDef } from "../../world/sceneDef";

export const MILL: SceneDef = {
  tiles: [
  ],
  props: [
    { m: "kaykit/hexagon/building_windmill_red.gltf", x: 3.8, z: -7.859, s: 9 },
    { m: "kaykit/forest_nature/Tree_2_A_Color1.gltf", x: -6, z: -4, s: 1.6 },
    { m: "kaykit/forest_nature/Tree_1_A_Color1.gltf", x: -7.5, z: -0.5, s: 1.4 },
    { m: "kaykit/forest_nature/Tree_2_A_Color1.gltf", x: 12.169, z: -3.609, s: 1.5 },
    { m: "kaykit/forest_nature/Bush_2_D_Color1.gltf", x: 48.967, z: -7.951, y: 32.089, s: 0.3 },
    { m: "kaykit/forest_nature/Rock_1_B_Color1.gltf", x: 23.891, z: -17.377, y: -1, s: 9 },
    { m: "kaykit/forest_nature/Rock_1_K_Color1.gltf", x: -29.255, z: -17.427, y: -1, s: 2 },
  ],
  anchors: [
    { name: "center", x: 0, z: 1 },
    { name: "far_right", x: 2.6, z: -1.2 },
    { name: "far_left", x: -2.6, z: -1.2 },
    { name: "path_near", x: 0, z: 4 },
    { name: "path_far", x: 0, z: -3 },
    { name: "treasure", x: 0, z: -3 },
  ],
  routes: [
    { name: "miller_path", points: [[8.72, 0.146, -1.058], [5.593, 0.123, -1.496], [2.14, 0.023, -2.436], [-1.586, -0.008, -2.678], [-3.199, 0.038, -7.267], [-0.845, 0.063, -11.276], [5.322, 0, -13.029], [10.93, 0.146, -8.787], [10.724, 0.119, -4.955], [8.732, 0.204, -0.915]] },
  ],
};
