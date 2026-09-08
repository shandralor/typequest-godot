import { describe, expect, it } from "vitest";
import { LIST, build } from "../content/scenarios";
import { resolve, fillTokens, heroProseVariants } from "../axis/locale/nlBe";
import { hashProse } from "../logic/fnv1a";
import { HOUSE_ITEMS } from "../content/home/homeArc";
import { AUTHORED } from "../editor/content_index";

const LOCATION_SETS: Record<string, string> = { forest_path: "forest_straight", dungeon: "dungeon", house: "house", forge: "forge", archery_range: "archery", mill: "mill" };

describe("scenarios", () => {
  it("every listed scenario builds a graph whose start node exists", () => {
    for (const s of LIST) {
      const g = build(s.id);
      expect(g.startId, s.id).not.toBe("");
      expect(g.getNodeById(g.startId), s.id).not.toBeNull();
    }
  });

  it("every node's prose matches its frozen A4 safety hash", () => {
    for (const s of LIST) {
      for (const node of build(s.id).nodes.values()) {
        const rec = node.safety["nl-BE"];
        if (!rec || node.proseKey === "") continue;
        expect(hashProse(resolve(node.proseKey)), `${s.id}/${node.id}`).toBe(rec.hash);
      }
    }
  });

  it("every scene names a set that exists, with the anchors its actors use", () => {
    const sets = new Map(AUTHORED.map((a) => [a.name, a.def]));
    for (const s of LIST) {
      for (const node of build(s.id).nodes.values()) {
        const d = node.scene;
        if (!d) continue;
        const setName = d.setName || LOCATION_SETS[d.location] || d.location;
        const def = sets.get(setName);
        expect(def, `${s.id}/${node.id} -> ${setName}`).toBeDefined();
        const anchors = new Set(def!.anchors?.map((a) => a.name));
        for (const a of d.actors) expect(anchors.has(a.anchor), `${setName} needs anchor ${a.anchor}`).toBe(true);
        for (const p of d.props) expect(anchors.has(p.anchor) || p.anchor === "hand", `${setName} needs anchor ${p.anchor}`).toBe(true);
        if (d.path === "straight") for (const a of [d.travelFrom, d.travelTo]) expect(anchors.has(a), `${setName} needs anchor ${a}`).toBe(true);
      }
    }
  });

  it("prose is typeable for every hero variant (band-1 layout safety)", () => {
    for (const s of LIST) {
      for (const node of build(s.id).nodes.values()) {
        if (node.proseKey === "") continue;
        for (const v of heroProseVariants(resolve(node.proseKey))) expect(v).toMatch(/^[a-z .,!?'-]+$/);
      }
    }
  });

  it("house items map to real take-nodes and anchors", () => {
    const g = build("home");
    const house = AUTHORED.find((a) => a.name === "house")!.def;
    const anchors = new Set(house.anchors?.map((a) => a.name));
    for (const it of HOUSE_ITEMS) {
      expect(g.hasNode(it.takeNode), it.takeNode).toBe(true);
      expect(anchors.has(it.anchor), it.anchor).toBe(true);
    }
  });

  it("token filling leaves no unresolved placeholder", () => {
    for (const s of LIST) {
      for (const node of build(s.id).nodes.values()) {
        if (node.proseKey === "") continue;
        expect(fillTokens(resolve(node.proseKey), "witch")).not.toContain("{");
      }
    }
  });
});
