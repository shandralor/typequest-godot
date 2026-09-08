import { describe, expect, it } from "vitest";
import { SiteTyper } from "../game/siteTyper";

const words = ["bos", "smidse", "oefenplein", "thuis", "molen", "boog"].map((w) => ({ word: w, site: w }));

describe("site typer (prefix matching across sites)", () => {
  it("shared prefixes stay reachable: b -> bo -> bos completes, boog still typeable", () => {
    const t = new SiteTyper(words);
    expect(t.typeChar("b")).toBeNull();
    expect(t.matches().map((m) => m.word).sort()).toEqual(["boog", "bos"]);
    expect(t.nextKey()).toBe(""); // ambiguous: no key guidance yet
    expect(t.typeChar("o")).toBeNull();
    expect(t.typeChar("s")?.word).toBe("bos");
    const t2 = new SiteTyper(words);
    "boo".split("").forEach((c) => t2.typeChar(c));
    expect(t2.nextKey()).toBe("g");
    expect(t2.typeChar("g")?.word).toBe("boog");
  });
  it("ignores keys that are not a prefix of any site word", () => {
    const t = new SiteTyper(words);
    expect(t.typeChar("x")).toBeNull();
    expect(t.buffer).toBe("");
    t.typeChar("m");
    t.typeChar("z");
    expect(t.buffer).toBe("m");
    expect(t.nextKey()).toBe("o");
  });
});
