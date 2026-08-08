import { describe, expect, it } from "vitest";
import { loadApp, stubRngConstant } from "../helpers/loadApp.js";

function runner(name) {
  return { name, history: {} };
}

describe("cloneBases", () => {
  it("deep-clones occupied slots and preserves nulls", () => {
    const { window } = loadApp();
    const bases = [runner("A"), null, runner("C")];
    const clone = window.cloneBases(bases);
    expect(clone).toEqual(bases);
    expect(clone[0]).not.toBe(bases[0]);
    expect(clone[1]).toBeNull();
  });
});

describe("hitAdvance", () => {
  it("places the batter on first for a single with empty bases", () => {
    const dom = loadApp();
    const result = dom.window.hitAdvance([null, null, null], "Batter", 1, "1B", 0);
    expect(result.runs).toBe(0);
    expect(result.bases[0]).toMatchObject({ name: "Batter", arrivedVia: "1B", battingSlot: 0 });
    expect(result.bases[0].history).toEqual({ "1e": "1B" });
    expect(result.bases[1]).toBeNull();
    expect(result.bases[2]).toBeNull();
    expect(result.advanced).toEqual([]);
  });

  it("advances existing runners by n and scores those pushed past third", () => {
    const dom = loadApp();
    const bases = [runner("First"), runner("Second"), runner("Third")];
    // a double: runner on 1st -> 3rd, 2nd -> home, 3rd -> home, batter -> 2nd
    const result = dom.window.hitAdvance(bases, "Batter", 2, "2B", 4);
    expect(result.runs).toBe(2);
    expect(result.bases[1]).toMatchObject({ name: "Batter", battingSlot: 4 });
    expect(result.bases[2]).toMatchObject({ name: "First" });
    expect(result.bases[0]).toBeNull();
    const homeAdvances = result.advanced.filter((a) => a.toIdx === "home").map((a) => a.name);
    expect(homeAdvances.sort()).toEqual(["Second", "Third"]);
  });

  it("scores the batter directly on a home run (n=4) without occupying a base", () => {
    const dom = loadApp();
    const result = dom.window.hitAdvance([null, null, null], "Slugger", 4, "HR", 2);
    expect(result.runs).toBe(1);
    expect(result.bases).toEqual([null, null, null]);
  });

  it("scores a loaded-bases grand slam correctly", () => {
    const dom = loadApp();
    const bases = [runner("R1"), runner("R2"), runner("R3")];
    const result = dom.window.hitAdvance(bases, "Slugger", 4, "HR", 5);
    expect(result.runs).toBe(4);
    expect(result.bases).toEqual([null, null, null]);
    expect(result.advanced).toHaveLength(3);
    expect(result.advanced.every((a) => a.toIdx === "home")).toBe(true);
  });

  it("a forced runner on 2nd (1st also occupied) always advances exactly one base on a single", () => {
    const dom = loadApp();
    // 1st occupied => the runner on 2nd is forced, so the rng()<0.5 "extra base" judgment call never applies.
    stubRngConstant(dom, 0.999);
    const bases = [runner("First"), runner("Second"), null];
    const result = dom.window.hitAdvance(bases, "Batter", 1, "1B", 0);
    expect(result.bases[2]).toMatchObject({ name: "Second" });
    expect(result.runs).toBe(0);
  });

  it("an unforced runner on 2nd (1st empty) can go the extra base on a single, judged by rng()<0.5", () => {
    const dom = loadApp();
    const bases = [null, runner("Second"), null];

    stubRngConstant(dom, 0.1); // < 0.5: takes the extra base and scores
    const scoredResult = dom.window.hitAdvance(bases, "Batter", 1, "1B", 0);
    expect(scoredResult.runs).toBe(1);
    expect(scoredResult.advanced).toEqual([{ name: "Second", toIdx: "home" }]);

    stubRngConstant(dom, 0.9); // >= 0.5: stops at third as usual
    const stoppedResult = dom.window.hitAdvance(bases, "Batter", 1, "1B", 0);
    expect(stoppedResult.runs).toBe(0);
    expect(stoppedResult.bases[2]).toMatchObject({ name: "Second" });
  });
});

describe("forcedWalk", () => {
  it("puts the batter on first with empty bases and leaves others untouched", () => {
    const dom = loadApp();
    const result = dom.window.forcedWalk([null, null, null], "Batter", "BB", 1);
    expect(result.runs).toBe(0);
    expect(result.bases[0]).toMatchObject({ name: "Batter", arrivedVia: "BB" });
    expect(result.bases[1]).toBeNull();
    expect(result.bases[2]).toBeNull();
  });

  it("force-advances only the runners in the forced chain (1st occupied, 2nd empty)", () => {
    const dom = loadApp();
    const bases = [runner("First"), null, runner("Third")];
    const result = dom.window.forcedWalk(bases, "Batter", "BB", 1);
    expect(result.runs).toBe(0);
    expect(result.bases[0].name).toBe("Batter");
    expect(result.bases[1].name).toBe("First");
    // Third was NOT forced (2nd was empty), so it stays put rather than scoring.
    expect(result.bases[2].name).toBe("Third");
  });

  it("walks in a run with the bases loaded", () => {
    const dom = loadApp();
    const bases = [runner("First"), runner("Second"), runner("Third")];
    const result = dom.window.forcedWalk(bases, "Batter", "IBB", 3);
    expect(result.runs).toBe(1);
    expect(result.bases[0].name).toBe("Batter");
    expect(result.bases[1].name).toBe("First");
    expect(result.bases[2].name).toBe("Second");
    expect(result.advanced.find((a) => a.toIdx === "home").name).toBe("Third");
  });
});

describe("advanceAllByOne", () => {
  it("advances every occupied base by exactly one and scores runners pushed off third", () => {
    const dom = loadApp();
    const bases = [runner("First"), null, runner("Third")];
    const result = dom.window.advanceAllByOne(bases, "WP");
    expect(result.runs).toBe(1);
    expect(result.bases[1]).toMatchObject({ name: "First", arrivedVia: "WP" });
    expect(result.bases[1].history).toEqual({ "2e": "WP" });
    expect(result.bases[2]).toBeNull();
    expect(result.advanced.find((a) => a.name === "Third").toIdx).toBe("home");
  });

  it("with no label, advances without stamping arrivedVia/history", () => {
    const dom = loadApp();
    const bases = [runner("First"), null, null];
    const result = dom.window.advanceAllByOne(bases, null);
    expect(result.bases[1]).toBe(bases[0]);
  });

  it("is a no-op run-wise when bases are empty", () => {
    const dom = loadApp();
    const result = dom.window.advanceAllByOne([null, null, null], "PB");
    expect(result.runs).toBe(0);
    expect(result.bases).toEqual([null, null, null]);
    expect(result.advanced).toEqual([]);
  });
});
