import { describe, expect, it } from "vitest";
import {
  loadApp,
  randomForPickIndex,
  stubRngConstant,
  stubRngSequence,
} from "../helpers/loadApp.js";

function batter(name = "Slagman") {
  return { name };
}

function emptyBases() {
  return [null, null, null];
}

function commonShape(ev) {
  expect(ev.forBatter === true || ev.forBatter === false).toBe(true);
  expect(typeof ev.narrative).toBe("string");
  expect(ev.narrative.length).toBeGreaterThan(0);
  expect(typeof ev.code).toBe("string");
  expect(ev.code.length).toBeGreaterThan(0);
  expect(typeof ev.applyBases).toBe("function");
  expect(Array.isArray(ev.refs)).toBe(true);
  expect(ev.refs.length).toBeGreaterThan(0);
  expect(typeof ev.explain).toBe("string");
}

// Deterministic, non-random batter events: code, quadrant and outsDelta are fixed.
describe.each([
  ["1B", "1B", "1e", 0],
  ["2B", "2B", "2e", 0],
  ["3B", "3B", "3e", 0],
  ["HR", "HR", "thuis", 0],
  ["BB", "BB", "1e", 0],
  ["IBB", "IBB", "1e", 0],
  ["HP", "HP", "1e", 0],
  ["K", "K", "any", 1],
  ["KWP", "KWP", "1e", 0],
  ["KPB", "KPB", "1e", 0],
])("buildBatterEvent(%s)", (key, expectedCode, expectedQuadrant, expectedOutsDelta) => {
  it(`produces code ${expectedCode}, quadrant ${expectedQuadrant}, outsDelta ${expectedOutsDelta}`, () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const ev = dom.window.buildBatterEvent(key, batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toBe(expectedCode);
    expect(ev.targetQuadrant).toBe(expectedQuadrant);
    expect(ev.outsDelta).toBe(expectedOutsDelta);
  });
});

describe("buildBatterEvent(KTHROW)", () => {
  it("is a strikeout thrown out at first: code K23, one out, no base reached", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const ev = dom.window.buildBatterEvent("KTHROW", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toBe("K23");
    expect(ev.outsDelta).toBe(1);
    const result = ev.applyBases(emptyBases());
    expect(result.bases).toEqual([null, null, null]);
  });
});

describe("buildBatterEvent(INT) — sport-dependent code", () => {
  it("is INT for honkbal", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const ev = dom.window.buildBatterEvent("INT", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toBe("INT");
    expect(ev.targetQuadrant).toBe("1e");
  });

  it("is OB for softbal", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Softbal", "1");
    const ev = dom.window.buildBatterEvent("INT", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toBe("OB");
  });
});

describe("buildBatterEvent — fielded outs with a chosen position", () => {
  it("GO: assist + putout combo, second digit is always the first baseman (3)", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngConstant(dom, randomForPickIndex(0, 5)); // combos has 5 entries
    const ev = dom.window.buildBatterEvent("GO", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^[1-6]3$/);
    expect(ev.targetQuadrant).toBe("any");
    expect(ev.outsDelta).toBe(1);
  });

  it("GOU: unassisted groundout, single-digit position code", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngConstant(dom, randomForPickIndex(0, 2));
    const ev = dom.window.buildBatterEvent("GOU", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^[13]$/);
    expect(ev.outsDelta).toBe(1);
  });

  it("F: fly-out code Fx", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngConstant(dom, randomForPickIndex(0, 10));
    const ev = dom.window.buildBatterEvent("F", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^F[3-9]$/);
    expect(ev.outsDelta).toBe(1);
  });

  it("L: line-drive code Lx", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngConstant(dom, randomForPickIndex(0, 5));
    const ev = dom.window.buildBatterEvent("L", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^L[1-6]$/);
    expect(ev.outsDelta).toBe(1);
  });

  it("FF: foul-fly code FFx", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngConstant(dom, randomForPickIndex(0, 3));
    const ev = dom.window.buildBatterEvent("FF", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^FF[235]$/);
    expect(ev.outsDelta).toBe(1);
  });
});

describe("buildBatterEvent(E) — error variants", () => {
  it("fielding error (no suffix): Ex, batter reaches first", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngSequence(dom, [randomForPickIndex(0, 5), randomForPickIndex(0, 6)]);
    const ev = dom.window.buildBatterEvent("E", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^E[1-6]$/);
    expect(ev.targetQuadrant).toBe("1e");
    const result = ev.applyBases(emptyBases());
    expect(result.bases[0]).toMatchObject({ name: "Slagman", arrivedVia: ev.code });
  });

  it("throwing error (T suffix): ExT", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngSequence(dom, [randomForPickIndex(2, 5), randomForPickIndex(0, 5)]);
    const ev = dom.window.buildBatterEvent("E", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^E[12456]T$/);
  });

  it("dropped-fly error (F suffix): ExF", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngSequence(dom, [randomForPickIndex(4, 5), randomForPickIndex(0, 7)]);
    const ev = dom.window.buildBatterEvent("E", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^E[3-9]F$/);
  });
});

describe("buildBatterEvent(EEXTRA)", () => {
  it("advances the batter two bases on the same error code and flags extraBaseErrorCode", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    stubRngConstant(dom, randomForPickIndex(0, 5));
    const ev = dom.window.buildBatterEvent("EEXTRA", batter(), emptyBases(), 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^E[12456]$/);
    expect(ev.extraBaseErrorCode).toBe(ev.code);
    expect(ev.targetQuadrant).toBe("1e");
    const result = ev.applyBases(emptyBases());
    expect(result.bases[1]).toMatchObject({ name: "Slagman", history: { "1e": ev.code } });
  });
});

describe("buildBatterEvent(FC) — force-out branch selection by base state", () => {
  it("classic case (runner on first only): forces the lead runner at second", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [{ name: "Loper1", battingSlot: 0, history: {} }, null, null];
    stubRngSequence(dom, [randomForPickIndex(0, 4), randomForPickIndex(0, 2)]);
    const ev = dom.window.buildBatterEvent("FC", batter(), bases, 1);
    commonShape(ev);
    expect(ev.code).toMatch(/^FC\d\d$/);
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("1e");
    const result = ev.applyBases(bases);
    expect(result.outRunner).toMatchObject({ name: "Loper1", battingSlot: 0, quadrant: "2e", code: ev.code });
    expect(result.bases[0]).toMatchObject({ name: "Slagman" });
  });

  it("1st and 2nd occupied: forces the lead runner at third", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [
      { name: "Loper1", battingSlot: 0, history: {} },
      { name: "Loper2", battingSlot: 1, history: {} },
      null,
    ];
    stubRngConstant(dom, randomForPickIndex(0, 4));
    const ev = dom.window.buildBatterEvent("FC", batter(), bases, 2);
    commonShape(ev);
    expect(ev.code).toMatch(/^FC\d5?$/);
    const result = ev.applyBases(bases);
    expect(result.outRunner).toMatchObject({ name: "Loper2", battingSlot: 1, quadrant: "3e", code: ev.code });
    expect(result.bases[1]).toMatchObject({ name: "Loper1" });
  });

  it("bases loaded: forces the lead runner at home instead of first", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [
      { name: "Loper1", battingSlot: 0, history: {} },
      { name: "Loper2", battingSlot: 1, history: {} },
      { name: "Loper3", battingSlot: 2, history: {} },
    ];
    stubRngConstant(dom, randomForPickIndex(0, 5));
    const ev = dom.window.buildBatterEvent("FC", batter(), bases, 3);
    commonShape(ev);
    expect(ev.code).toMatch(/^FC\d2$/);
    const result = ev.applyBases(bases);
    expect(result.outRunner).toMatchObject({ name: "Loper3", battingSlot: 2, quadrant: "thuis", code: ev.code });
    expect(result.bases[1]).toMatchObject({ name: "Loper1" });
    expect(result.bases[2]).toMatchObject({ name: "Loper2" });
  });
});

describe("buildBatterEvent(FCFAIL)", () => {
  it("stays a fielder's-choice code for the batter, but is not an out (forBatter still true, no outsDelta)", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [{ name: "Loper1", battingSlot: 0, history: {} }, null, null];
    stubRngSequence(dom, [randomForPickIndex(0, 4), randomForPickIndex(0, 2)]);
    const ev = dom.window.buildBatterEvent("FCFAIL", batter(), bases, 1);
    commonShape(ev);
    expect(ev.code).toMatch(/^FC\d\d$/);
    expect(ev.outsDelta).toBe(0);
    expect(ev.forBatter).toBe(true);
    const result = ev.applyBases(bases);
    expect(result.bases[0]).toMatchObject({ name: "Slagman" });
    expect(result.bases[1]).toMatchObject({ name: "Loper1" });
    expect(result.outRunner).toBeUndefined();
  });
});

describe("buildBatterEvent — sacrifice and double plays", () => {
  it("SH: sacrifice hit advances the lead runner one base and is an out", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [null, { name: "Loper", history: {} }, null];
    stubRngConstant(dom, randomForPickIndex(0, 4));
    const ev = dom.window.buildBatterEvent("SH", batter(), bases, 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^SH\d3$/);
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("any");
    const result = ev.applyBases(bases);
    expect(result.bases[2]).toMatchObject({ name: "Loper" });
    expect(result.runs).toBe(0);
  });

  it("SHE: sacrifice hit with a throwing error keeps the batter safe too", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [null, { name: "Loper", history: {} }, null];
    stubRngConstant(dom, randomForPickIndex(0, 4));
    const ev = dom.window.buildBatterEvent("SHE", batter(), bases, 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^SH\d3 E\d$/);
    expect(ev.outsDelta).toBe(0);
    expect(ev.forBatter).toBe(true);
    const result = ev.applyBases(bases);
    expect(result.bases[0]).toMatchObject({ name: "Slagman" });
    expect(result.bases[2]).toMatchObject({ name: "Loper" });
  });

  it("SF: sacrifice fly scores the runner from third and is an out", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [null, null, { name: "Loper", history: {} }];
    stubRngConstant(dom, randomForPickIndex(0, 3));
    const ev = dom.window.buildBatterEvent("SF", batter(), bases, 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^SF[789]$/);
    expect(ev.outsDelta).toBe(1);
    const result = ev.applyBases(bases);
    expect(result.runs).toBe(1);
    expect(result.bases[2]).toBeNull();
  });

  it("SFE: sacrifice fly dropped on an error still scores the run and reaches the batter safely", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [null, null, { name: "Loper", history: {} }];
    stubRngConstant(dom, randomForPickIndex(0, 3));
    const ev = dom.window.buildBatterEvent("SFE", batter(), bases, 0);
    commonShape(ev);
    expect(ev.code).toMatch(/^SF[789] E[789]$/);
    expect(ev.outsDelta).toBe(0);
    expect(ev.forBatter).toBe(true);
    const result = ev.applyBases(bases);
    expect(result.runs).toBe(1);
    expect(result.bases[0]).toMatchObject({ name: "Slagman" });
  });

  it("DP: removes two outs and forces the lead runner", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [{ name: "Loper", battingSlot: 0, history: {} }, null, null];
    stubRngConstant(dom, randomForPickIndex(0, 3));
    const ev = dom.window.buildBatterEvent("DP", batter(), bases, 1);
    commonShape(ev);
    expect(ev.outsDelta).toBe(2);
    expect(ev.targetQuadrant).toBe("any");
    const result = ev.applyBases(bases);
    expect(result.outRunner).toMatchObject({ name: "Loper", battingSlot: 0, quadrant: "2e", code: ev.code });
    expect(result.bases).toEqual([null, null, null]);
  });
});

describe("buildBatterEvent — sanity across every key with fuzzed base states", () => {
  // Keys whose applyBases is safe for ANY base state — matches the real caller (generateBatterEvent),
  // which only adds FC/FCFAIL to the weighted pool when 1st is occupied, and SF/SFE when 3rd is
  // occupied; buildBatterEvent itself trusts that precondition and doesn't re-check it.
  const GENERAL_KEYS = [
    "1B", "2B", "3B", "HR", "BB", "IBB", "HP", "INT", "K", "KWP", "KPB", "KTHROW",
    "GO", "GOU", "F", "L", "FF", "IF", "E", "EEXTRA", "SH", "SHE", "DP",
  ];
  const BASE_STATES = [
    [null, null, null],
    [{ name: "R1", battingSlot: 0, history: {} }, null, null],
    [null, { name: "R2", battingSlot: 1, history: {} }, null],
    [{ name: "R1", battingSlot: 0, history: {} }, { name: "R2", battingSlot: 1, history: {} }, null],
    [
      { name: "R1", battingSlot: 0, history: {} },
      { name: "R2", battingSlot: 1, history: {} },
      { name: "R3", battingSlot: 2, history: {} },
    ],
  ];
  const BASE_STATES_WITH_FIRST = BASE_STATES.filter((b) => b[0]);
  const BASE_STATES_WITH_THIRD = BASE_STATES.filter((b) => b[2]);

  it("never throws and always returns a well-formed event, for every general key x base-state x rng draw", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    for (const key of GENERAL_KEYS) {
      for (const bases of BASE_STATES) {
        for (let i = 0; i < 8; i++) {
          stubRngConstant(dom, i / 8);
          const ev = dom.window.buildBatterEvent(key, batter(), bases, 0);
          commonShape(ev);
          expect(["1e", "2e", "3e", "thuis", "any"]).toContain(ev.targetQuadrant);
          expect(() => ev.applyBases(dom.window.cloneBases(bases))).not.toThrow();
        }
      }
    }
  });

  it("FC / FCFAIL never throw, for every base state where 1st is occupied", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    for (const key of ["FC", "FCFAIL"]) {
      for (const bases of BASE_STATES_WITH_FIRST) {
        for (let i = 0; i < 8; i++) {
          stubRngConstant(dom, i / 8);
          const ev = dom.window.buildBatterEvent(key, batter(), bases, 0);
          commonShape(ev);
          expect(() => ev.applyBases(dom.window.cloneBases(bases))).not.toThrow();
        }
      }
    }
  });

  it("SF / SFE never throw, for every base state where 3rd is occupied", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    for (const key of ["SF", "SFE"]) {
      for (const bases of BASE_STATES_WITH_THIRD) {
        for (let i = 0; i < 8; i++) {
          stubRngConstant(dom, i / 8);
          const ev = dom.window.buildBatterEvent(key, batter(), bases, 0);
          commonShape(ev);
          expect(() => ev.applyBases(dom.window.cloneBases(bases))).not.toThrow();
        }
      }
    }
  });

  it("IF is only fuzzed with 1st+2nd occupied, matching how the pool restricts it", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [
      { name: "R1", battingSlot: 0, history: {} },
      { name: "R2", battingSlot: 1, history: {} },
      null,
    ];
    for (let i = 0; i < 8; i++) {
      stubRngConstant(dom, i / 8);
      const ev = dom.window.buildBatterEvent("IF", batter(), bases, 0);
      commonShape(ev);
      expect(ev.code).toMatch(/^IF[3-6]$/);
      expect(ev.outsDelta).toBe(1);
      expect(() => ev.applyBases(dom.window.cloneBases(bases))).not.toThrow();
    }
  });
});
