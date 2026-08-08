import { describe, expect, it } from "vitest";
import { loadApp, randomForPickIndex, stubRngConstant } from "../helpers/loadApp.js";

function runner(name) {
  return { name, history: {} };
}

function commonShape(ev) {
  expect(ev.forBatter).toBe(false);
  expect(typeof ev.narrative).toBe("string");
  expect(ev.narrative.length).toBeGreaterThan(0);
  expect(typeof ev.code).toBe("string");
  expect(ev.code.length).toBeGreaterThan(0);
  expect(typeof ev.applyBases).toBe("function");
  expect(Array.isArray(ev.refs)).toBe(true);
  expect(typeof ev.explain).toBe("string");
}

function setupWithBases(bases) {
  const dom = loadApp();
  dom.window.initGame(3, "Honkbal", "1");
  dom.window.eval(`G.bases = ${JSON.stringify(bases)}`);
  return dom;
}

describe("buildRunnerEvent(SB1)", () => {
  it("steals second: code SB, quadrant 2e", () => {
    const dom = setupWithBases([runner("Loper"), null, null]);
    const ev = dom.window.buildRunnerEvent("SB1");
    commonShape(ev);
    expect(ev.code).toBe("SB");
    expect(ev.targetQuadrant).toBe("2e");
    const result = ev.applyBases([{ name: "Loper", history: {} }, null, null]);
    expect(result.bases[1]).toMatchObject({ name: "Loper", arrivedVia: "SB" });
    expect(result.bases[0]).toBeNull();
  });
});

describe("buildRunnerEvent(SB1E)", () => {
  it("steals second but an overthrow sends the runner all the way to third", () => {
    const dom = setupWithBases([runner("Loper"), null, null]);
    const ev = dom.window.buildRunnerEvent("SB1E");
    commonShape(ev);
    expect(ev.code).toBe("SB");
    expect(ev.targetQuadrant).toBe("2e");
    expect(ev.runnerExtraBaseErrorCode).toBe("E2T");
    expect(ev.runnerExtraBaseErrorName).toBe("Loper");
    expect(ev.runnerExtraBaseFromQ).toBe("2e");
    expect(ev.runnerExtraBaseToQ).toBe("3e");
    const result = ev.applyBases([{ name: "Loper", history: {} }, null, null]);
    // the runner ends up on THIRD, not second, because of the overthrow
    expect(result.bases[0]).toBeNull();
    expect(result.bases[1]).toBeNull();
    expect(result.bases[2]).toMatchObject({ name: "Loper" });
    expect(result.bases[2].history["2e"]).toContain("SB");
  });
});

describe("buildRunnerEvent(SB2)", () => {
  it("steals third: code SB, quadrant 3e", () => {
    const dom = setupWithBases([null, runner("Loper"), null]);
    const ev = dom.window.buildRunnerEvent("SB2");
    commonShape(ev);
    expect(ev.code).toBe("SB");
    expect(ev.targetQuadrant).toBe("3e");
  });
});

describe("buildRunnerEvent(CS1) / (CS2) / (PO1) — caught stealing / pick off", () => {
  it("CS1: out at second, commits the runner's line directly (no outRunner on the result)", () => {
    const dom = setupWithBases([{ name: "Loper", battingSlot: 2, history: {} }, null, null]);
    stubRngConstant(dom, randomForPickIndex(0, 2));
    const ev = dom.window.buildRunnerEvent("CS1");
    commonShape(ev);
    expect(ev.code).toMatch(/^CS2[46]$/);
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("2e");
    const result = ev.applyBases([{ name: "Loper", battingSlot: 2, history: {} }, null, null]);
    expect(result.bases[0]).toBeNull();
    expect(result.outRunner).toBeUndefined();
    // the commit happens as a side effect inside applyBases via commitToScorecard
    expect(dom.window.eval("G.scorecard.away[2][1]")).toMatchObject({ "2e": ev.code });
  });

  it("CS1E: caught stealing but an error keeps the runner safe on second", () => {
    const dom = setupWithBases([runner("Loper"), null, null]);
    stubRngConstant(dom, randomForPickIndex(0, 2));
    const ev = dom.window.buildRunnerEvent("CS1E");
    commonShape(ev);
    expect(ev.code).toMatch(/^CS2[46] E[46]$/);
    expect(ev.outsDelta).toBe(0);
    const result = ev.applyBases([{ name: "Loper", history: {} }, null, null]);
    expect(result.bases[1]).toMatchObject({ name: "Loper", arrivedVia: ev.code });
  });

  it("CS2: out at third", () => {
    const dom = setupWithBases([null, { name: "Loper", battingSlot: 4, history: {} }, null]);
    const ev = dom.window.buildRunnerEvent("CS2");
    commonShape(ev);
    expect(ev.code).toBe("CS25");
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("3e");
  });

  it("PO1: picked off first, out, commits directly", () => {
    const dom = setupWithBases([{ name: "Loper", battingSlot: 1, history: {} }, null, null]);
    const ev = dom.window.buildRunnerEvent("PO1");
    commonShape(ev);
    expect(ev.code).toBe("PO13");
    expect(ev.outsDelta).toBe(1);
    const result = ev.applyBases([{ name: "Loper", battingSlot: 1, history: {} }, null, null]);
    expect(result.bases[0]).toBeNull();
    expect(dom.window.eval("G.scorecard.away[1][1]")).toMatchObject({ "2e": "PO13" });
  });
});

describe("buildRunnerEvent — WP / PB / BK advance every runner by one", () => {
  it("WP with a single runner on first advances them to second", () => {
    const dom = setupWithBases([runner("Loper"), null, null]);
    const ev = dom.window.buildRunnerEvent("WP");
    commonShape(ev);
    expect(ev.code).toBe("WP");
    expect(ev.targetQuadrant).toBe("2e");
    expect(ev.leadRunnerName).toBe("Loper");
  });

  it("PB with a runner on third scores them (targetQuadrant thuis)", () => {
    const dom = setupWithBases([null, null, runner("Loper")]);
    const ev = dom.window.buildRunnerEvent("PB");
    commonShape(ev);
    expect(ev.code).toBe("PB");
    expect(ev.targetQuadrant).toBe("thuis");
  });

  it("BK is honkbal's balk, IP is softbal's illegal pitch — same mechanics, different code", () => {
    const domHonkbal = setupWithBases([runner("Loper"), null, null]);
    const evHonkbal = domHonkbal.window.buildRunnerEvent("BK");
    expect(evHonkbal.code).toBe("BK");

    const domSoftbal = loadApp();
    domSoftbal.window.initGame(3, "Softbal", "1");
    domSoftbal.window.eval("G.bases = [{name:'Loper', history:{}}, null, null]");
    const evSoftbal = domSoftbal.window.buildRunnerEvent("BK");
    expect(evSoftbal.code).toBe("IP");
  });
});

describe("buildRunnerEvent(OB1)", () => {
  it("obstruction advances the runner to second with code OB6", () => {
    const dom = setupWithBases([runner("Loper"), null, null]);
    const ev = dom.window.buildRunnerEvent("OB1");
    commonShape(ev);
    expect(ev.code).toBe("OB6");
    expect(ev.targetQuadrant).toBe("2e");
  });
});

describe("generateRunnerEvent — pool gating matches the actual base state", () => {
  it("returns null when no runner is on base", () => {
    const dom = setupWithBases([null, null, null]);
    expect(dom.window.generateRunnerEvent()).toBeNull();
  });

  it("never throws across a spread of base states and rng draws", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const states = [
      [{ name: "R1", history: {} }, null, null],
      [null, { name: "R2", history: {} }, null],
      [null, null, { name: "R3", history: {} }],
      [{ name: "R1", history: {} }, { name: "R2", history: {} }, null],
      [{ name: "R1", history: {} }, { name: "R2", history: {} }, { name: "R3", history: {} }],
    ];
    for (const bases of states) {
      dom.window.eval(`G.bases = ${JSON.stringify(bases)}`);
      for (let i = 0; i < 10; i++) {
        stubRngConstant(dom, i / 10);
        expect(() => dom.window.generateRunnerEvent()).not.toThrow();
      }
    }
  });
});
