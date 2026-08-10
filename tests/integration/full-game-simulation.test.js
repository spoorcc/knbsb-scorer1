import { describe, expect, it } from "vitest";
import { getG, loadApp, startGame } from "../helpers/loadApp.js";

/**
 * Drives a whole game to completion through the *real* UI (button clicks, text input,
 * slot selection) — never calling internal game functions directly — always answering
 * with the objectively correct code + quadrant taken straight from G.currentEvent.
 * Returns the number of turns played.
 */
function playFullGameCorrectly(dom, { maxTurns = 600 } = {}) {
  const { document } = dom.window;
  let turns = 0;
  while (document.getElementById("endScreen").classList.contains("hidden")) {
    turns++;
    if (turns > maxTurns) throw new Error(`playFullGameCorrectly: exceeded ${maxTurns} turns — likely stuck`);
    const ev = getG(dom).currentEvent;
    if (ev.type === "mc") {
      const buttons = document.getElementById("mcOptions").querySelectorAll(".mc-btn");
      buttons[ev.correctIndex].click();
    } else {
      const input = document.getElementById("systemInput");
      input.value = ev.code;
      input.dispatchEvent(new dom.window.Event("input"));
      dom.window.selectSlot(ev.targetQuadrant);
    }
    document.getElementById("submitBtn").click(); // submitAnswer()
    document.getElementById("submitBtn").click(); // nextTurn() (or reveals the end screen)
  }
  return turns;
}

/** Sum of every `scored: true` flag across both teams' scorecards. */
function countScoredDots(G) {
  let n = 0;
  for (const teamKey of ["away", "home"]) {
    for (const slotCols of G.scorecard[teamKey]) {
      for (const atBats of Object.values(slotCols)) {
        for (const cell of atBats) {
          if (cell && cell.scored) n++;
        }
      }
    }
  }
  return n;
}

const SEEDS = ["100000", "234567", "555555", "999999"];

describe.each(SEEDS)("full game simulation (seed %s, 3 innings, Honkbal)", (seed) => {
  it("plays to completion with only correct answers and stays internally consistent", () => {
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: seed });
    const turns = playFullGameCorrectly(dom);
    const G = getG(dom);

    expect(turns).toBeGreaterThan(0);
    expect(G.gameOver).toBe(true);
    expect(dom.window.document.getElementById("endScreen").classList.contains("hidden")).toBe(false);

    // every answer given was objectively correct
    expect(G.correctCount).toBe(G.totalCount);
    expect(G.totalCount).toBeGreaterThan(0);

    // The KNBSB scorecard invariant: total scored-dots == final combined score. Each at-bat gets
    // its own array slot in G.scorecard (see G.atBatIndex), so a lineup slot batting twice in one
    // big inning no longer merges its two at-bats' data together — see
    // tests/integration/known-issues.test.js for the regression test on the specific seed that
    // used to violate this.
    expect(countScoredDots(G)).toBe(G.score.away + G.score.home);

    // per-inning run totals must sum to the final score for each team
    expect(G.inningRuns.away.reduce((a, b) => a + b, 0)).toBe(G.score.away);
    expect(G.inningRuns.home.reduce((a, b) => a + b, 0)).toBe(G.score.home);

    // scores never go negative, and the game actually completed all innings
    expect(G.score.away).toBeGreaterThanOrEqual(0);
    expect(G.score.home).toBeGreaterThanOrEqual(0);
    expect(G.inningRuns.away).toHaveLength(G.maxInnings);
    // home only bats the bottom half it needs; batting-out ends the game after the away team's
    // last at-bat if home is already ahead going into the bottom of the final inning, but with
    // 3 fixed innings and no walk-off short-circuit in this engine, home also completes all 3.
    expect(G.inningRuns.home).toHaveLength(G.maxInnings);
  });
});

describe("full game simulation — Softbal, 1 inning (fast smoke run)", () => {
  it("completes cleanly", () => {
    const dom = startGame(loadApp(), { innings: 1, sport: "Softbal", matchNumber: "42" });
    playFullGameCorrectly(dom);
    const G = getG(dom);
    expect(G.gameOver).toBe(true);
    expect(countScoredDots(G)).toBe(G.score.away + G.score.home);
  });
});

describe("full game simulation — longer game (9 innings) stays consistent under more turns", () => {
  it("completes cleanly with a much longer sequence of turns", () => {
    const dom = startGame(loadApp(), { innings: 9, sport: "Honkbal", matchNumber: "777001" });
    const turns = playFullGameCorrectly(dom, { maxTurns: 1200 });
    const G = getG(dom);
    expect(turns).toBeGreaterThan(50);
    expect(G.gameOver).toBe(true);
    expect(countScoredDots(G)).toBe(G.score.away + G.score.home);
    expect(G.inningRuns.away).toHaveLength(9);
    expect(G.inningRuns.home).toHaveLength(9);
  });
});

describe("full game simulation — deterministic replay", () => {
  it("the same matchNumber produces the exact same final score and turn count", () => {
    const domA = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "864213" });
    const turnsA = playFullGameCorrectly(domA);
    const GA = getG(domA);

    const domB = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "864213" });
    const turnsB = playFullGameCorrectly(domB);
    const GB = getG(domB);

    expect(turnsA).toBe(turnsB);
    expect(GA.score).toEqual(GB.score);
    expect(GA.inningRuns).toEqual(GB.inningRuns);
  });
});
