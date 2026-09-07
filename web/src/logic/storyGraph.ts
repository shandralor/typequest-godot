// The story graph data model (brief A3/A7/A9). Faithful port of logic/story_graph.gd.
// The graph carries KEYS (never words) and IDS (never models). Choice words resolve
// against a locale; scenes name assets by id from a vocabulary.

import type { SceneDescriptor } from "./sceneDescriptor";

export type GetFlag = (flag: string) => boolean;

function splitFlags(s: string): string[] {
  return s.split(" ").filter((f) => f.length > 0);
}

// A fork option: type the resolved wordKey to go to target (with a direction hint).
export class Choice {
  wordKey: string;
  target: string;
  hint: string; // forward|left|right
  requiresFlag = ""; // space-separated -- ALL must be set to show
  hiddenFlag = ""; // space-separated -- once ALL set the option is HIDDEN
  altTarget = ""; // if altFlag set, this choice leads here instead of target
  altFlag = "";

  constructor(wordKey: string, target: string, hint: string) {
    this.wordKey = wordKey;
    this.target = target;
    this.hint = hint;
  }

  // Available when every requiresFlag is set AND the hiddenFlag set is not fully met.
  isAvailable(getFlag: GetFlag): boolean {
    for (const f of splitFlags(this.requiresFlag)) {
      if (!getFlag(f)) return false;
    }
    if (this.hiddenFlag !== "" && this.allSet(this.hiddenFlag, getFlag)) return false;
    return true;
  }

  private allSet(flags: string, getFlag: GetFlag): boolean {
    for (const f of splitFlags(flags)) {
      if (!getFlag(f)) return false;
    }
    return true;
  }

  // Where this choice leads: the alt target when EVERY altFlag is set, else default.
  resolvedTarget(getFlag: GetFlag): string {
    if (this.altFlag === "" || this.altTarget === "") return this.target;
    for (const f of splitFlags(this.altFlag)) {
      if (!getFlag(f)) return this.target;
    }
    return this.altTarget;
  }
}

export interface SafetyRecord {
  hash: string;
  date: string;
  criteria_version: string;
}

// One story beat.
export class StoryNode {
  id: string;
  band = "band-1";
  proseKey = "";
  narrationKey = "";
  choices: Choice[] = [];
  ending = ""; // "" | "neutral" | "win"
  winKey = "";
  returnTo = ""; // A9 setback target
  prerevealed = false; // A9
  setsFlag = "";
  celebrate = true;
  exitWalk = false;
  safety: Record<string, SafetyRecord> = {}; // locale -> record
  scene: SceneDescriptor | null = null;

  constructor(id: string) {
    this.id = id;
  }

  isEnding(): boolean {
    return this.ending !== "";
  }
}

export class StoryGraph {
  graphId = "";
  startId = "";
  vocabularyId = "";
  nodes: Map<string, StoryNode> = new Map();

  addNode(node: StoryNode): void {
    this.nodes.set(node.id, node);
  }

  getNodeById(id: string): StoryNode | null {
    return this.nodes.get(id) ?? null;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }
}
