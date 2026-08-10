import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp, stubRngConstant } from "../helpers/loadApp.js";

function setup(innings = 3, sport = "Honkbal") {
  const dom = loadApp();
  dom.window.initGame(innings, sport, "1");
  return dom;
}

describe("endHalfInning", () => {
  it("records the half's runs, resets outs/bases, and always queues an end-of-inning quiz", () => {
    const dom = setup();
    stubRngConstant(dom, 0.99); // above every extra-quiz gate
    evalIn(dom, "G.outs = 3; G.currentHalfRuns = 2; G.bases = [{name:'Stranded', battingSlot:1, history:{'1e':'1B'}}, null, null];");
    dom.window.endHalfInning();
    const G = getG(dom);
    expect(G.inningRuns.away).toEqual([2]);
    expect(G.currentHalfRuns).toBe(0);
    expect(G.outs).toBe(0);
    expect(G.bases).toEqual([null, null, null]);
    // the stranded runner's progress is committed before the bases are cleared
    expect(G.scorecard.away[1][1][0]).toMatchObject({ "1e": "1B" });
    expect(G.pendingEvents).toHaveLength(1);
    expect(G.pendingEvents[0].type).toBe("mc");
  });

  it("never queues an extra (pitcher/position/pinch-hitter) quiz on the very first half-inning", () => {
    const dom = setup();
    stubRngConstant(dom, 0); // below every 0.2-ish gate: would fire every extra quiz if allowed
    evalIn(dom, "G.outs = 3;");
    dom.window.endHalfInning();
    const G = getG(dom);
    // only the end-of-inning quiz, because G.inning===1 && G.half==='top' at call time
    expect(G.pendingEvents).toHaveLength(1);
    expect(G.pendingEvents[0].type).toBe("mc");
  });

  it("can queue pitcher/position/pinch-hitter quizzes once past the very first half-inning", () => {
    const dom = setup();
    evalIn(dom, "G.half = 'bottom'; G.outs = 3;"); // no longer the very first half-inning
    stubRngConstant(dom, 0); // below every extra-quiz gate
    dom.window.endHalfInning();
    const G = getG(dom);
    expect(G.pendingEvents.length).toBeGreaterThan(1);
    expect(G.pendingEvents[0].type).toBe("mc");
  });

  it("only allows one pitcher-change quiz per inning (lastPitcherChangeInning guard)", () => {
    const dom = setup();
    // battingKey() is 'home' once G.half is 'bottom' — that's the team endHalfInning quizzes about.
    evalIn(dom, "G.half = 'bottom'; G.outs = 3; G.lastPitcherChangeInning.home = G.inning;");
    stubRngConstant(dom, 0); // would fire a pitcher-change quiz if the guard didn't block it
    dom.window.endHalfInning();
    const G = getG(dom);
    const pitcherQuizzes = G.pendingEvents.filter((e) => e.pitcherChange);
    expect(pitcherQuizzes).toHaveLength(0);
  });

  it("flips top -> bottom without advancing the inning number", () => {
    const dom = setup();
    stubRngConstant(dom, 0.99);
    evalIn(dom, "G.outs = 3;");
    dom.window.endHalfInning();
    const G = getG(dom);
    expect(G.half).toBe("bottom");
    expect(G.inning).toBe(1);
    expect(G.gameOver).toBe(false);
  });

  it("flips bottom -> top and advances the inning number", () => {
    const dom = setup();
    stubRngConstant(dom, 0.99);
    evalIn(dom, "G.half = 'bottom'; G.outs = 3;");
    dom.window.endHalfInning();
    const G = getG(dom);
    expect(G.half).toBe("top");
    expect(G.inning).toBe(2);
  });

  it("marks the game over once the inning count exceeds maxInnings", () => {
    const dom = setup(1, "Honkbal");
    stubRngConstant(dom, 0.99);
    evalIn(dom, "G.half = 'bottom'; G.outs = 3;");
    dom.window.endHalfInning();
    expect(getG(dom).gameOver).toBe(true);
  });

  it("records the correct last-batter slot as the end-of-inning marker", () => {
    const dom = setup();
    stubRngConstant(dom, 0.99);
    evalIn(dom, "G.battingIdx.away = 4; G.outs = 3;");
    dom.window.endHalfInning();
    const G = getG(dom);
    expect(G.endMarker.away[1]).toMatchObject({ slot: 3 });
  });
});
