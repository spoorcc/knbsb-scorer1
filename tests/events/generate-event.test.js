import { describe, expect, it } from "vitest";
import { evalIn, loadApp, stubRngConstant } from "../helpers/loadApp.js";

const VALID_QUADRANTS = ["1e", "2e", "3e", "thuis", "any"];

function assertValidEvent(ev) {
  expect(ev).toBeTruthy();
  expect(typeof ev.narrative).toBe("string");
  expect(ev.narrative.length).toBeGreaterThan(0);
  if (ev.type === "mc") {
    expect(Array.isArray(ev.options)).toBe(true);
  } else {
    expect(typeof ev.code).toBe("string");
    expect(VALID_QUADRANTS).toContain(ev.targetQuadrant || "any");
  }
  expect(typeof ev.applyBases).toBe("function");
}

describe("generateBatterEvent", () => {
  it("never throws across a spread of outs/base states and rng draws", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const baseStates = [
      [null, null, null],
      [{ name: "R1", battingSlot: 0, history: {} }, null, null],
      [{ name: "R1", battingSlot: 0, history: {} }, { name: "R2", battingSlot: 1, history: {} }, null],
      [
        { name: "R1", battingSlot: 0, history: {} },
        { name: "R2", battingSlot: 1, history: {} },
        { name: "R3", battingSlot: 2, history: {} },
      ],
    ];
    for (const bases of baseStates) {
      for (const outs of [0, 1, 2]) {
        evalIn(dom, `G.bases = ${JSON.stringify(bases)}; G.outs = ${outs};`);
        for (let i = 0; i < 10; i++) {
          stubRngConstant(dom, i / 10);
          const ev = dom.window.generateBatterEvent();
          assertValidEvent(ev);
        }
      }
    }
  });
});

describe("generateBatterEvent — FCFAIL precondition", () => {
  it("never offers FCFAIL while 2nd base is occupied", () => {
    // buildBatterEvent's FCFAIL case only ever moves bases[0] up to 2nd and leaves bases[2] alone —
    // it never looks at bases[1], so a runner already standing on 2nd would silently vanish (not
    // moved, not scored, just dropped from the returned bases array) instead of erroring loudly.
    // The only thing preventing that today is this pool guard (`if(!b1) pool.push({key:'FCFAIL'})`
    // in generateBatterEvent) — pin it here so a future edit that loosens it fails a test instead of
    // silently corrupting a live game's base state.
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    const bases = [
      { name: "R1", battingSlot: 0, history: {} },
      { name: "R2", battingSlot: 1, history: {} },
      null,
    ];
    evalIn(dom, `G.bases = ${JSON.stringify(bases)};`);
    for (const outs of [0, 1]) {
      evalIn(dom, `G.outs = ${outs};`);
      for (let i = 0; i < 100; i++) {
        stubRngConstant(dom, i / 100);
        const ev = dom.window.generateBatterEvent();
        // FCFAIL is the only forBatter, FC-coded key that isn't an out (outsDelta 0) — FC and
        // FCINT (the other FC-shaped keys offered with 1st occupied) are always outsDelta 1.
        const looksLikeFcfail = typeof ev.code === "string" && ev.code.startsWith("FC") && ev.outsDelta === 0;
        expect(looksLikeFcfail).toBe(false);
      }
    }
  });
});

describe("generateEvent", () => {
  it("never throws, and only routes to a runner/quiz event when a runner is actually on base", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    evalIn(dom, "G.bases = [null, null, null]; G.outs = 0;");
    for (let i = 0; i < 20; i++) {
      stubRngConstant(dom, i / 20);
      const ev = dom.window.generateEvent();
      assertValidEvent(ev);
      // with empty bases, only a fresh batter event (or a pitcher-change quiz) is possible
      if (ev.type !== "mc") {
        expect(ev.forBatter).toBe(true);
      }
    }
  });

  it("never throws with runners on base across many rng draws", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    evalIn(dom, "G.bases = [{name:'R1', battingSlot:0, history:{}}, null, {name:'R3', battingSlot:2, history:{}}]; G.outs = 1;");
    for (let i = 0; i < 30; i++) {
      stubRngConstant(dom, i / 30);
      const ev = dom.window.generateEvent();
      assertValidEvent(ev);
    }
  });

  it("is fully reproducible for a fixed matchNumber across a long simulated sequence", () => {
    function runSequence(seed) {
      const dom = loadApp();
      dom.window.initGame(3, "Honkbal", seed);
      const codes = [];
      for (let i = 0; i < 30; i++) {
        const ev = dom.window.generateEvent();
        codes.push(ev.type === "mc" ? "MC" : ev.code);
      }
      return codes;
    }
    expect(runSequence("314159")).toEqual(runSequence("314159"));
  });
});
