// The content build-gate (brief A4 / Section 9 guards). Pure. Faithful port of
// logic/content_validator.gd. Validates a story graph against a locale, the band spec,
// the keyboard layout and the asset vocabulary. Returns human-readable problems (empty == valid).

import { StoryGraph, StoryNode } from "./storyGraph";
import { matches, hashProse } from "./fnv1a";
import { supportsText } from "../axis/layout/beAzerty";
import { resolve as vocabResolve } from "../axis/vocabulary/fantasyPoc";

export interface ValidatorLocale {
  LOCALE_ID: string;
  resolve(key: string): string;
  hasKey(key: string): boolean;
  heroProseVariants(text: string): string[];
}

const LOCATION_IDS = ["forest_path", "dungeon", "forge", "archery_range", "house", "mill"];
// The band must not encode per-key/per-finger gating (A2/A3). `charSet` legitimately names
// a coarse class (e.g. "lower-no-altgr"), so flag only "finger".
const FORBIDDEN_BAND_TERMS = ["finger"];

export function validate(graph: StoryGraph, locale: ValidatorLocale, bandSpec: Record<string, unknown>): string[] {
  const problems: string[] = [];
  checkBandTerms(problems, bandSpec);
  for (const node of graph.nodes.values()) {
    checkNode(problems, graph, locale, bandSpec, node);
  }
  return problems;
}

function checkBandTerms(problems: string[], bandSpec: Record<string, unknown>): void {
  for (const k of Object.keys(bandSpec)) {
    const blob = `${k}=${bandSpec[k]}`.toLowerCase();
    for (const term of FORBIDDEN_BAND_TERMS) {
      if (blob.includes(term)) {
        problems.push(`band spec field '${k}' carries forbidden key/finger term '${term}'`);
      }
    }
  }
}

function checkNode(
  problems: string[],
  graph: StoryGraph,
  locale: ValidatorLocale,
  bandSpec: Record<string, unknown>,
  node: StoryNode
): void {
  const id = node.id;
  checkKey(problems, locale, node.proseKey, id, "prose_key");
  checkKey(problems, locale, node.narrationKey, id, "narration_key");
  for (const ch of node.choices) {
    checkKey(problems, locale, ch.wordKey, id, "choice word_key");
    if (!graph.hasNode(ch.target)) {
      problems.push(`node '${id}' choice target '${ch.target}' does not exist`);
    }
  }
  if (node.returnTo !== "" && !graph.hasNode(node.returnTo)) {
    problems.push(`node '${id}' return_to '${node.returnTo}' does not exist`);
  }

  const prose = locale.resolve(node.proseKey);
  const localeId = locale.LOCALE_ID;
  if (localeId in node.safety) {
    const approved = node.safety[localeId].hash;
    if (!matches(prose, approved)) {
      problems.push(
        `node '${id}' safety hash mismatch: prose hashes ${hashProse(prose)}, approved ${approved} -- FIX THE PROSE, not the hash`
      );
    }
  } else {
    problems.push(`node '${id}' has no safety record for locale ${localeId}`);
  }

  // band limits + typeability, checked over EVERY hero-noun substitution (never the raw template).
  for (const variant of locale.heroProseVariants(prose)) {
    checkLimits(problems, id, variant, bandSpec);
    if (!supportsText(variant)) {
      problems.push(`node '${id}' prose has characters not typeable on the layout`);
    }
  }

  if (node.scene !== null) checkScene(problems, id, node.scene);
}

function checkKey(problems: string[], locale: ValidatorLocale, key: string, id: string, role: string): void {
  if (key === "" || !locale.hasKey(key)) {
    problems.push(`node '${id}' ${role} '${key}' does not resolve in the locale`);
  }
}

function checkLimits(problems: string[], id: string, prose: string, bandSpec: Record<string, unknown>): void {
  const maxWord = bandSpec.maxWordLen as number;
  const maxSentence = bandSpec.maxSentenceLen as number;
  for (const sentence of prose.split(".").filter((s) => s.length > 0)) {
    const words = sentence.trim().split(" ").filter((w) => w.length > 0);
    if (words.length > maxSentence) {
      problems.push(`node '${id}' sentence exceeds maxSentenceLen ${maxSentence} (${words.length} words)`);
    }
    for (const w of words) {
      const clean = w.replace(/^[,.]+/, "").replace(/[,.]+$/, "");
      if ([...clean].length > maxWord) {
        problems.push(`node '${id}' word '${clean}' exceeds maxWordLen ${maxWord}`);
      }
    }
  }
}

function checkScene(problems: string[], id: string, scene: NonNullable<StoryNode["scene"]>): void {
  if (!LOCATION_IDS.includes(scene.location)) {
    problems.push(`node '${id}' scene location '${scene.location}' is not a known location`);
  }
  for (const a of scene.actors) {
    if (vocabResolve(a.asset) === "") {
      problems.push(`node '${id}' actor asset '${a.asset}' does not resolve in the vocabulary`);
    }
  }
  for (const p of scene.props) {
    if (vocabResolve(p.asset) === "") {
      problems.push(`node '${id}' prop asset '${p.asset}' does not resolve in the vocabulary`);
    }
  }
}
