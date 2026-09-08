// Minimal typing for the `n8ao` package (ships no declarations). Only what main.ts uses.
declare module "n8ao" {
  import type { Scene, Camera, Color } from "three";
  import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";
  export class N8AOPass extends Pass {
    constructor(scene: Scene, camera: Camera, width: number, height: number);
    configuration: {
      aoRadius: number;
      distanceFalloff: number;
      intensity: number;
      color: Color;
    };
    setQualityMode?(mode: "Performance" | "Low" | "Medium" | "High" | "Ultra"): void;
  }
}
