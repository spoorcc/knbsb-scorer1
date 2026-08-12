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

describe("buildRunnerEvent(SB2E)", () => {
  it("steals third but an overthrow sends the runner all the way home, following the same pattern as SB1E", () => {
    const dom = setupWithBases([null, runner("Loper"), null]);
    const ev = dom.window.buildRunnerEvent("SB2E");
    commonShape(ev);
    expect(ev.code).toBe("SB");
    expect(ev.targetQuadrant).toBe("3e");
    expect(ev.runnerExtraBaseErrorCode).toBe("E2T");
    expect(ev.runnerExtraBaseErrorName).toBe("Loper");
    expect(ev.runnerExtraBaseFromQ).toBe("3e");
    expect(ev.runnerExtraBaseToQ).toBe("thuis");
    const result = ev.applyBases([null, { name: "Loper", history: {} }, null]);
    // the runner ends up on THIRD (not yet scored) — the follow-up PIJL question sends them home
    expect(result.bases[1]).toBeNull();
    expect(result.bases[2]).toMatchObject({ name: "Loper" });
    expect(result.bases[2].history["3e"]).toContain("SB");
  });
});

describe("buildRunnerEvent(CS1) / (CS2) / (PO1) — caught stealing / pick off", () => {
  it("CS1: out at second, commits the runner's line directly (no outRunner on the result)", () => {
    const dom = setupWithBases([{ name: "Loper", battingSlot: 2, history: {} }, null, null]);
    stubRngConstant(dom, randomForPickIndex(0, 2));
    const ev = dom.window.buildRunnerEvent("CS1");
    commonShape(ev);
    expect(ev.code).toMatch(/^\(CS2[46]\)$/);
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("2e");
    const result = ev.applyBases([{ name: "Loper", battingSlot: 2, history: {} }, null, null]);
    expect(result.bases[0]).toBeNull();
    expect(result.outRunner).toBeUndefined();
    // the commit happens as a side effect inside applyBases via commitToScorecard
    expect(dom.window.eval("G.scorecard.away[2][1][0]")).toMatchObject({ "2e": ev.code });
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
    expect(ev.code).toBe("(CS25)");
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("3e");
  });

  it("CS2E: caught stealing third but the achtervanger's own wild throw keeps the runner safe — error charged to the thrower (E2), not the derde honkman who received it", () => {
    // Regression: this used to charge the error to seq[1] (the derde honkman receiving the throw,
    // "E5"), even though the narrative describes a wild throw by the achtervanger ("de aangooi is
    // onzuiver") — a throwing error, which the app's own convention elsewhere (case 'E' variant 'T',
    // and SB1E's "E2T") charges to whoever threw wildly, not whoever merely received it.
    const dom = setupWithBases([null, { name: "Loper", history: {} }, null]);
    const ev = dom.window.buildRunnerEvent("CS2E");
    commonShape(ev);
    expect(ev.code).toBe("CS25 E2");
    expect(ev.outsDelta).toBe(0);
    expect(ev.explain).toContain("E2");
    const result = ev.applyBases([null, { name: "Loper", history: {} }, null]);
    expect(result.bases[2]).toMatchObject({ name: "Loper", arrivedVia: "CS25 E2" });
  });

  it("checkAnswer accepts CS25E2 (the correct code) and rejects CS25E5 (the old, wrong code) for CS2E", () => {
    const dom = setupWithBases([null, { name: "Loper", history: {} }, null]);
    const ev = dom.window.buildRunnerEvent("CS2E");
    expect(dom.window.checkAnswer("CS25E2", ev)).toBe(true);
    expect(dom.window.checkAnswer("CS25E5", ev)).toBe(false);
  });

  it("PO1: picked off first, out, commits directly", () => {
    const dom = setupWithBases([{ name: "Loper", battingSlot: 1, history: {} }, null, null]);
    const ev = dom.window.buildRunnerEvent("PO1");
    commonShape(ev);
    expect(ev.code).toBe("(PO13)");
    expect(ev.outsDelta).toBe(1);
    const result = ev.applyBases([{ name: "Loper", battingSlot: 1, history: {} }, null, null]);
    expect(result.bases[0]).toBeNull();
    expect(dom.window.eval("G.scorecard.away[1][1][0]")).toMatchObject({ "2e": "(PO13)" });
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

describe("buildRunnerEvent(SB3) / (CS3) — stealing home", () => {
  it("SB3: steals home, code SB, quadrant thuis, scores a run", () => {
    const dom = setupWithBases([null, null, { name: "Loper", battingSlot: 5, history: {} }]);
    const ev = dom.window.buildRunnerEvent("SB3");
    commonShape(ev);
    expect(ev.code).toBe("SB");
    expect(ev.targetQuadrant).toBe("thuis");
    expect(ev.leadRunnerName).toBe("Loper");
    const result = ev.applyBases([null, null, { name: "Loper", battingSlot: 5, history: {} }]);
    expect(result.runs).toBe(1);
    expect(result.bases[2]).toBeNull();
  });

  it("CS3: caught stealing home, unassisted by the catcher, code CS2, one out", () => {
    const dom = setupWithBases([null, null, { name: "Loper", battingSlot: 5, history: {} }]);
    const ev = dom.window.buildRunnerEvent("CS3");
    commonShape(ev);
    expect(ev.code).toBe("(CS2)");
    expect(ev.targetQuadrant).toBe("thuis");
    expect(ev.outsDelta).toBe(1);
    const result = ev.applyBases([null, null, { name: "Loper", battingSlot: 5, history: {} }]);
    expect(result.bases[2]).toBeNull();
    expect(dom.window.eval("G.scorecard.away[5][1][0]")).toMatchObject({ thuis: "(CS2)" });
  });
});

describe("buildRunnerEvent(PO2) / (PO3) — pickoff at second and third", () => {
  it("PO2: picked off second, out, commits directly", () => {
    const dom = setupWithBases([null, { name: "Loper", battingSlot: 3, history: {} }, null]);
    stubRngConstant(dom, randomForPickIndex(0, 2));
    const ev = dom.window.buildRunnerEvent("PO2");
    commonShape(ev);
    expect(ev.code).toMatch(/^\(PO1[46]\)$/);
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("3e");
    const result = ev.applyBases([null, { name: "Loper", battingSlot: 3, history: {} }, null]);
    expect(result.bases[1]).toBeNull();
    expect(dom.window.eval("G.scorecard.away[3][1][0]")).toMatchObject({ "3e": ev.code });
  });

  it("PO3: picked off third, out, commits directly", () => {
    const dom = setupWithBases([null, null, { name: "Loper", battingSlot: 4, history: {} }]);
    const ev = dom.window.buildRunnerEvent("PO3");
    commonShape(ev);
    expect(ev.code).toBe("(PO15)");
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("thuis");
    const result = ev.applyBases([null, null, { name: "Loper", battingSlot: 4, history: {} }]);
    expect(result.bases[2]).toBeNull();
  });
});

describe("buildRunnerEvent(EVADE1) / (EVADE2) — automatic out for evading a tag", () => {
  it("EVADE1: out between first and second, bare fielder code, no assist chain", () => {
    const dom = setupWithBases([{ name: "Loper", battingSlot: 0, history: {} }, null, null]);
    stubRngConstant(dom, randomForPickIndex(0, 3));
    const ev = dom.window.buildRunnerEvent("EVADE1");
    commonShape(ev);
    expect(ev.code).toMatch(/^\([346]\)$/);
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("2e");
    const result = ev.applyBases([{ name: "Loper", battingSlot: 0, history: {} }, null, null]);
    expect(result.bases[0]).toBeNull();
  });

  it("EVADE2: out between second and third", () => {
    const dom = setupWithBases([null, { name: "Loper", battingSlot: 1, history: {} }, null]);
    stubRngConstant(dom, randomForPickIndex(0, 3));
    const ev = dom.window.buildRunnerEvent("EVADE2");
    commonShape(ev);
    expect(ev.code).toMatch(/^\([456]\)$/);
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("3e");
  });
});

describe("buildRunnerEvent(PASS1) — passing the preceding runner is an automatic out", () => {
  it("outs the trailing runner from first, the lead runner on second stays put", () => {
    const dom = setupWithBases([
      { name: "Trailing", battingSlot: 0, history: {} },
      { name: "Lead", battingSlot: 1, history: {} },
      null,
    ]);
    stubRngConstant(dom, randomForPickIndex(0, 2));
    const ev = dom.window.buildRunnerEvent("PASS1");
    commonShape(ev);
    expect(ev.code).toMatch(/^\([46]\)$/);
    expect(ev.outsDelta).toBe(1);
    expect(ev.targetQuadrant).toBe("2e");
    const result = ev.applyBases([
      { name: "Trailing", battingSlot: 0, history: {} },
      { name: "Lead", battingSlot: 1, history: {} },
      null,
    ]);
    expect(result.bases[0]).toBeNull();
    expect(result.bases[1]).toMatchObject({ name: "Lead" });
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
