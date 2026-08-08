import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp } from "../helpers/loadApp.js";

describe("initGame", () => {
  it("builds the expected initial state shape", () => {
    const dom = loadApp();
    dom.window.initGame(7, "Honkbal", "555555");
    const G = getG(dom);

    expect(G.maxInnings).toBe(7);
    expect(G.sport).toBe("Honkbal");
    expect(G.matchNumber).toBe(555555);
    expect(G.inning).toBe(1);
    expect(G.half).toBe("top");
    expect(G.outs).toBe(0);
    expect(G.bases).toEqual([null, null, null]);
    expect(G.score).toEqual({ away: 0, home: 0 });
    expect(G.battingIdx).toEqual({ away: 0, home: 0 });
    expect(G.currentHalfRuns).toBe(0);
    expect(G.correctCount).toBe(0);
    expect(G.totalCount).toBe(0);
    expect(G.currentEvent).toBeNull();
    expect(G.gameOver).toBe(false);
    expect(G.pendingEvents).toEqual([]);
    expect(G.stintColor).toEqual({ away: 0, home: 0 });
    expect(G.lastPitcherChangeInning).toEqual({ away: null, home: null });
    expect(G.away.name).toBe("Honkvast");
    expect(G.home.name).toBe("Bal op het dak");
    expect(G.away.lineup).toHaveLength(9);
    expect(G.home.lineup).toHaveLength(9);
    expect(G.away.pitchers.length).toBeGreaterThan(0);
  });

  it("uses the given matchNumber verbatim as the seed, without consulting Math.random", () => {
    const dom = loadApp();
    let mathRandomCalled = false;
    dom.window.Math.random = () => {
      mathRandomCalled = true;
      return 0.5;
    };
    dom.window.initGame(3, "Honkbal", "42");
    expect(getG(dom).matchNumber).toBe(42);
    expect(mathRandomCalled).toBe(false);
  });

  it("falls back to a random seed (via Math.random) when no matchNumber is given", () => {
    const dom = loadApp();
    dom.window.Math.random = () => 0.123456;
    dom.window.initGame(3, "Honkbal");
    // Math.floor(0.123456*900000)+100000
    expect(getG(dom).matchNumber).toBe(Math.floor(0.123456 * 900000) + 100000);
  });

  it("defaults to Honkbal when no sport is given", () => {
    const dom = loadApp();
    dom.window.initGame(3, undefined, "1");
    expect(getG(dom).sport).toBe("Honkbal");
  });

  it("supports Softbal", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Softbal", "1");
    expect(getG(dom).sport).toBe("Softbal");
  });

  it("gives every lineup slot its own independent scorecard/slotEvents entry", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    evalIn(dom, "G.scorecard.away[0][1] = {'1e':'1B'}");
    evalIn(dom, "G.slotEvents.away[0].push({type:'pos', pos:9})");
    const G = getG(dom);
    expect(G.scorecard.away[1]).toEqual({});
    expect(G.slotEvents.away[1]).toEqual([]);
    expect(G.scorecard.home[0]).toEqual({});
    expect(G.slotEvents.home[0]).toEqual([]);
  });

  it("re-initializing produces a completely fresh state", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    evalIn(dom, "G.outs = 2; G.score.away = 5;");
    dom.window.initGame(9, "Softbal", "2");
    const G = getG(dom);
    expect(G.outs).toBe(0);
    expect(G.score.away).toBe(0);
    expect(G.maxInnings).toBe(9);
    expect(G.sport).toBe("Softbal");
    expect(G.matchNumber).toBe(2);
  });

  it("the same matchNumber reproduces the exact same sequence of generated events (deterministic replay)", () => {
    const domA = loadApp();
    domA.window.initGame(3, "Honkbal", "777777");
    const codesA = Array.from({ length: 20 }, () => domA.window.generateEvent().code);

    const domB = loadApp();
    domB.window.initGame(3, "Honkbal", "777777");
    const codesB = Array.from({ length: 20 }, () => domB.window.generateEvent().code);

    expect(codesA).toEqual(codesB);
  });
});
