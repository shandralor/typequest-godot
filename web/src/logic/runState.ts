// Traversal + per-run accumulation over a StoryGraph (brief A6/A7/A9). Pure.
// Faithful port of logic/run_state.gd. A locale is injected to resolve choice words.

import { StoryGraph, StoryNode, GetFlag } from "./storyGraph";
import { score as scoreUnit } from "./scoring";

export interface Locale {
  resolve(key: string): string;
}

export interface ChooseResult {
  ok: boolean;
  target: string;
  hint: string;
}

export interface ScoreResult {
  xp: number;
  stars: number;
  status: "no_node" | "prerevealed" | "already_scored" | "scored";
}

export interface ProgressSnapshot {
  xp: number;
  starsByNode: Record<string, number>;
  completedNodeIds: string[];
  band: string;
}

export class RunState {
  graph: StoryGraph;
  locale: Locale;
  currentId: string;

  xp = 0;
  starsByNode: Map<string, number> = new Map();
  completedIds: Set<string> = new Set();
  private scoredThisRun: Set<string> = new Set();

  constructor(graph: StoryGraph, locale: Locale) {
    this.graph = graph;
    this.locale = locale;
    this.currentId = graph.startId;
  }

  current(): StoryNode | null {
    return this.graph.getNodeById(this.currentId);
  }

  currentProse(): string {
    const node = this.current();
    if (node === null || node.proseKey === "") return "";
    return this.locale.resolve(node.proseKey);
  }

  // Pick a fork by the typed (resolved) choice word. getFlag optional: when omitted,
  // gating + alt resolution are bypassed (mirrors the Godot Callable-invalid path).
  choose(typedWord: string, getFlag?: GetFlag): ChooseResult {
    const node = this.current();
    if (node !== null) {
      for (const ch of node.choices) {
        if (this.locale.resolve(ch.wordKey) !== typedWord) continue;
        if (getFlag && !ch.isAvailable(getFlag)) continue;
        const tgt = getFlag ? ch.resolvedTarget(getFlag) : ch.target;
        this.currentId = tgt;
        return { ok: true, target: tgt, hint: ch.hint };
      }
    }
    return { ok: false, target: "", hint: "" };
  }

  resolveEnding(): { type: "none" | "setback" | "win" | "neutral"; to?: string } {
    const node = this.current();
    if (node === null || !node.isEnding()) return { type: "none" };
    if (node.returnTo !== "") {
      this.currentId = node.returnTo;
      return { type: "setback", to: node.returnTo };
    }
    return { type: node.ending as "win" | "neutral" };
  }

  // Score the current beat, folding into accumulated progress. Honors prerevealed
  // (never scored) and score-once-per-run (a revisit has no effect).
  scoreCurrent(correctChars: number, accuracy: number, completed: boolean): ScoreResult {
    const node = this.current();
    if (node === null) return { xp: 0, stars: 0, status: "no_node" };
    if (node.prerevealed) return { xp: 0, stars: 0, status: "prerevealed" };
    if (this.scoredThisRun.has(node.id)) return { xp: 0, stars: 0, status: "already_scored" };
    this.scoredThisRun.add(node.id);
    const result = scoreUnit(completed, correctChars, accuracy);
    this.xp += result.xp;
    const best = this.starsByNode.get(node.id) ?? 0;
    if (result.stars > best) this.starsByNode.set(node.id, result.stars);
    if (result.stars >= 1) this.completedIds.add(node.id);
    return { xp: result.xp, stars: result.stars, status: "scored" };
  }

  progressSnapshot(): ProgressSnapshot {
    return {
      xp: this.xp,
      starsByNode: Object.fromEntries(this.starsByNode),
      completedNodeIds: [...this.completedIds],
      band: "band-1",
    };
  }
}
