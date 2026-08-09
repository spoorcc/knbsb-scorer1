import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp, stubRngConstant } from "../helpers/loadApp.js";

function setup(innings = 3, sport = "Honkbal") {
  const dom = loadApp();
  dom.window.initGame(innings, sport, "1");
  return dom;
}

// buildXEvent() only computes the narrative/code from the bases snapshot it's given; the
// resulting `ev.applyBases` closure is later invoked by `applyEventToState` against whatever
// `G.bases` holds *at that time*. So every scenario below seeds `G.bases` (and, where the
// commit target matters, `G.battingIdx`) to match what was passed to the builder.

describe("applyEventToState — batter events", () => {
  it("a single with empty bases: batter reaches first, no runs, battingIdx advances", () => {
    const dom = setup();
    const ev = dom.window.buildBatterEvent("1B", { name: "Slagman" }, [null, null, null], 0);
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.bases[0]).toMatchObject({ name: "Slagman" });
    expect(G.score.away).toBe(0);
    expect(G.battingIdx.away).toBe(1);
    expect(G.outs).toBe(0);
  });

  it("a strikeout: no base reached, one out, batter's turn still consumed", () => {
    const dom = setup();
    const ev = dom.window.buildBatterEvent("K", { name: "Slagman" }, [null, null, null], 0);
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.bases).toEqual([null, null, null]);
    expect(G.outs).toBe(1);
    expect(G.battingIdx.away).toBe(1);
    expect(G.scorecard.away[0][1]).toMatchObject({ out: "K" });
  });

  it("a home run scores a run immediately and commits 'scored' to the scorecard", () => {
    const dom = setup();
    evalIn(dom, "G.battingIdx.away = 2");
    const ev = dom.window.buildBatterEvent("HR", { name: "Slugger" }, [null, null, null], 2);
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.score.away).toBe(1);
    expect(G.currentHalfRuns).toBe(1);
    expect(G.scorecard.away[2][1]).toMatchObject({ thuis: "HR", scored: true });
  });

  it("a double-play removes two outs and queues a forced-out follow-up question for the lead runner", () => {
    const dom = setup();
    evalIn(dom, "G.bases = [{name:'First', battingSlot:4, history:{}}, null, null]");
    stubRngConstant(dom, 0); // pin the [6,4,3] combo deterministically
    const ev = dom.window.buildBatterEvent("DP", { name: "Slagman" }, getG(dom).bases, 0);
    expect(ev.outsDelta).toBe(2);
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.outs).toBe(2);
    // the forced-out runner's own line isn't committed synchronously anymore: it's a queued
    // follow-up quiz (buildForcedOutFollowUpEvent), which the UI presents as the very next turn.
    // The runner's code is only their own portion of the throw chain (64), not the batter's
    // own code (43, ev.code) — each player's cell shows just the touches leading to their out.
    expect(G.pendingEvents.length).toBeGreaterThanOrEqual(1);
    const followUp = G.pendingEvents.find((e) => e.targetQuadrant === "2e");
    expect(followUp).toBeTruthy();
    expect(followUp.code).toBe("64");
    expect(followUp.code).not.toBe(ev.code);
    expect(followUp.narrative).toContain("First");
  });

  it("queues an advance-credit follow-up event for a runner driven home by a later batter", () => {
    const dom = setup();
    evalIn(dom, "G.bases = [null, null, {name:'Loper', battingSlot:5, history:{'1e':'1B'}}]");
    const ev = dom.window.buildBatterEvent("1B", { name: "Slagman" }, getG(dom).bases, 0);
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.score.away).toBe(1);
    expect(G.pendingEvents).toHaveLength(1);
    expect(G.pendingEvents[0].targetQuadrant).toBe("thuis");
    expect(G.pendingEvents[0].code).toBe("1");
  });

  it("an extra-base error queues the batter's own PIJL follow-up ahead of other runners' credit turns", () => {
    const dom = setup();
    evalIn(dom, "G.bases = [null, null, {name:'Loper', battingSlot:5, history:{'1e':'1B'}}]");
    stubRngConstant(dom, 0); // pin EEXTRA's fielder pick
    const ev = dom.window.buildBatterEvent("EEXTRA", { name: "Slagman" }, getG(dom).bases, 0);
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    // batter's own arrow-follow-up must be queued before the other runner's advance-credit event
    expect(G.pendingEvents[0].code).toBe("PIJL");
    expect(G.pendingEvents[1].targetQuadrant).toBe("thuis");
  });
});

describe("applyEventToState — runner events", () => {
  it("a stolen base moves the runner without changing outs or score", () => {
    const dom = setup();
    evalIn(dom, "G.bases = [{name:'Loper', history:{}}, null, null]");
    const ev = dom.window.buildRunnerEvent("SB1");
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.bases[0]).toBeNull();
    expect(G.bases[1]).toMatchObject({ name: "Loper", arrivedVia: "SB" });
    expect(G.outs).toBe(0);
    expect(G.score.away).toBe(0);
  });

  it("caught stealing removes the runner, adds an out, and commits their line directly (no follow-up)", () => {
    const dom = setup();
    evalIn(dom, "G.bases = [{name:'Loper', battingSlot:3, history:{'1e':'1B'}}, null, null]");
    stubRngConstant(dom, 0); // pin the CS throw sequence deterministically
    const ev = dom.window.buildRunnerEvent("CS1");
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.bases[0]).toBeNull();
    expect(G.outs).toBe(1);
    expect(G.scorecard.away[3][1]).toMatchObject({ "1e": "1B", "2e": ev.code });
    expect(G.pendingEvents).toEqual([]);
  });

  it("a wild pitch with a runner on third scores a run and closes it out on the scorecard", () => {
    const dom = setup();
    evalIn(dom, "G.bases = [null, null, {name:'Loper', battingSlot:6, history:{'1e':'1B','2e':'SB'}}]");
    const ev = dom.window.buildRunnerEvent("WP");
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.bases[2]).toBeNull();
    expect(G.score.away).toBe(1);
    expect(G.scorecard.away[6][1]).toMatchObject({ "1e": "1B", "2e": "SB", thuis: "WP", scored: true });
  });
});
