// The playable scenarios. Started from the OVERWORLD (content/overworld.ts maps a typed site
// word to a scenario id here). Port of content/scenarios.gd.

import type { StoryGraph } from "../logic/storyGraph";
import * as Band1 from "./band1/band1Arc";
import * as Grind from "./grind/grindArc";
import * as Archery from "./archery/archeryArc";
import * as Home from "./home/homeArc";
import * as Mill from "./mill/millArc";

export const LIST = [
  { id: "band1", title: "De ridder en de schat" },
  { id: "grind", title: "Slijp je zwaard" },
  { id: "archery", title: "Boogschieten" },
  { id: "home", title: "Thuis" },
  { id: "mill", title: "De molenaar" },
];

export function build(id: string): StoryGraph {
  switch (id) {
    case "grind": return Grind.build();
    case "archery": return Archery.build();
    case "home": return Home.build();
    case "mill": return Mill.build();
    default: return Band1.build();
  }
}
