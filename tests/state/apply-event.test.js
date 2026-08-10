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

  it("a double play with runners on 1st and 2nd queues the forced-out runner's follow-up before the other runner's advance-credit", () => {
    const dom = setup();
    // With 2nd occupied too, the DP also forces that runner to 3rd — its own applyBases returns
    // both `outRunner` (the runner forced out from 1st) and `advanced` (the runner forced from 2nd
    // to 3rd) from the very same play. The forced-out follow-up's narrative only ever says "ook
    // <naam> is uit door dezelfde actie" without re-describing the play, so it must be asked
    // immediately after the main DP question — before the unrelated runner's advance-credit turn.
    evalIn(dom, "G.bases = [{name:'First', battingSlot:4, history:{}}, {name:'Second', battingSlot:5, history:{}}, null]");
    stubRngConstant(dom, 0); // pin the [6,4,3] combo deterministically
    const ev = dom.window.buildBatterEvent("DP", { name: "Slagman" }, getG(dom).bases, 0);
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.pendingEvents.length).toBeGreaterThanOrEqual(2);
    expect(G.pendingEvents[0].targetQuadrant).toBe("2e");
    expect(G.pendingEvents[0].code).toBe("64");
    expect(G.pendingEvents[0].narrative).toContain("First");
    expect(G.pendingEvents[1].targetQuadrant).toBe("3e");
    expect(G.pendingEvents[1].narrative).toContain("Second");
  });

  it("a double-play records a dpLinks entry connecting the runner's and the batter's cells, for the connecting line on the printed scorecard", () => {
    const dom = setup();
    evalIn(dom, "G.battingIdx.away = 0");
    evalIn(dom, "G.bases = [{name:'First', battingSlot:4, history:{}}, null, null]");
    stubRngConstant(dom, 0); // pin the [6,4,3] combo deterministically
    const ev = dom.window.buildBatterEvent("DP", { name: "Slagman" }, getG(dom).bases, 0);
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.dpLinks.away).toEqual([{ inning: 1, runnerSlot: 4, runnerQuadrant: "2e", batterSlot: 0 }]);
  });

  it("a double-play that itself ends the half-inning still commits the forced-out follow-up to the inning the play happened in", () => {
    const dom = setup();
    // Bottom of inning 1, home batting, already 1 out: this DP's outsDelta of 2 pushes the
    // total to 3 and ends the half-inning (bottom -> top, inning 1 -> 2) *inside*
    // applyEventToState, before the queued follow-up question has even been shown to the user.
    evalIn(dom, "G.half = 'bottom'; G.outs = 1; G.battingIdx.home = 0");
    evalIn(dom, "G.bases = [{name:'First', battingSlot:4, history:{}}, null, null]");
    stubRngConstant(dom, 0); // pin the [6,4,3] combo deterministically
    const ev = dom.window.buildBatterEvent("DP", { name: "Slagman" }, getG(dom).bases, 0);
    dom.window.applyEventToState(ev);
    let G = getG(dom);
    expect(G.outs).toBe(0); // endHalfInning() already reset outs for the new half-inning
    expect(G.inning).toBe(2);
    expect(G.half).toBe("top");

    // The user now answers the queued follow-up question — one turn later, already in inning 2.
    const followUp = G.pendingEvents.find((e) => e.targetQuadrant === "2e");
    expect(followUp).toBeTruthy();
    dom.window.applyEventToState(followUp);
    G = getG(dom);

    // The forced-out runner's line belongs to the play that happened in inning 1, not inning 2.
    expect(G.scorecard.home[4][1]).toMatchObject({ _outQ: "2e" });
    expect(G.scorecard.home[4][2]).toBeUndefined();
  });

  it("a sacrifice fly that itself ends the half-inning still commits the scoring runner's advance-credit to the inning the play happened in", () => {
    const dom = setup();
    // Bottom of inning 1, home batting, already 2 outs: the SF's own out (outsDelta 1) ends the
    // half-inning (bottom -> top, inning 1 -> 2) inside applyEventToState, but it also queues an
    // advance-credit follow-up for the runner it just sent home from third — that follow-up is
    // answered one turn later, already in inning 2.
    evalIn(dom, "G.half = 'bottom'; G.outs = 2; G.battingIdx.home = 0");
    evalIn(dom, "G.bases = [null, null, {name:'Derde', battingSlot:6, history:{'1e':'1B'}}]");
    stubRngConstant(dom, 0); // pin SF's fielder pick
    const ev = dom.window.buildBatterEvent("SF", { name: "Slagman" }, getG(dom).bases, 0);
    dom.window.applyEventToState(ev);
    let G = getG(dom);
    expect(G.outs).toBe(0); // endHalfInning() already reset outs for the new half-inning
    expect(G.inning).toBe(2);
    expect(G.half).toBe("top");

    // The user now answers the queued advance-credit question — one turn later, already inning 2.
    const followUp = G.pendingEvents.find((e) => e.targetQuadrant === "thuis");
    expect(followUp).toBeTruthy();
    dom.window.applyEventToState(followUp);
    G = getG(dom);

    // The scoring runner's credit belongs to the play that happened in inning 1, not inning 2.
    expect(G.scorecard.home[6][1]).toMatchObject({ thuis: followUp.code, scored: true });
    expect(G.scorecard.home[6][2]).toBeUndefined();
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

  it("a pinch runner substitution marks the streepje on the outgoing runner's own scorecard cell", () => {
    const dom = setup();
    evalIn(dom, "G.bases = [null, {name:'Loper', battingSlot:6, history:{'1e':'1B','2e':'SB'}}, null]");
    const runner = getG(dom).bases[1];
    const ev = dom.window.buildPinchRunnerQuizEvent(runner, "away", "2e");
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    // the incoming sub takes over the physical base occupant, keeping the same battingSlot/history
    expect(G.bases[1].name).not.toBe("Loper");
    expect(G.bases[1].battingSlot).toBe(6);
    // the streepje lands in the quadrant the runner was standing on (2e), on their own cell
    expect(G.scorecard.away[6][1]).toMatchObject({ "1e": "1B", "2e": "SB", _prQ: "2e" });
    // the generic "dikke streep" (p.20) is for a batting substitution (PH) marking where the new
    // batter's own turns begin — it doesn't apply to a pinch runner, who only gets the honk-vakje
    // streepje above, not a substitution line across their row's cells.
    expect(G.subMarkers.away[6]).toBeUndefined();
  });
});
