import { describe, expect, it } from "vitest";
import { getG, loadApp, mulberry32, startGame } from "../helpers/loadApp.js";

const QUADRANTS = ["1e", "2e", "3e", "thuis", "any"];

/**
 * Drives a whole game to completion through the real UI, but answers with a mix of
 * correct and deliberately wrong codes/quadrants (driven by an independent seeded PRNG,
 * so the *test's* choices don't consume the app's own rng() sequence). This is a crash/
 * invariant fuzz — it does not assert the score, only that the app never throws and its
 * internal bookkeeping stays self-consistent no matter what the "player" answers.
 */
function playFullGameFuzzed(dom, testSeed, { maxTurns = 600 } = {}) {
  const { document } = dom.window;
  const testRng = mulberry32(testSeed);
  let turns = 0;
  while (document.getElementById("endScreen").classList.contains("hidden")) {
    turns++;
    if (turns > maxTurns) throw new Error(`playFullGameFuzzed: exceeded ${maxTurns} turns — likely stuck`);
    const ev = getG(dom).currentEvent;
    const answerCorrectly = testRng() < 0.6;
    if (ev.type === "mc") {
      const buttons = document.getElementById("mcOptions").querySelectorAll(".mc-btn");
      const idx = answerCorrectly ? ev.correctIndex : (ev.correctIndex + 1) % buttons.length;
      buttons[idx].click();
    } else {
      const input = document.getElementById("systemInput");
      input.value = answerCorrectly ? ev.code : "XX" + Math.floor(testRng() * 999);
      input.dispatchEvent(new dom.window.Event("input"));
      const slot = answerCorrectly ? ev.targetQuadrant : QUADRANTS[Math.floor(testRng() * QUADRANTS.length)];
      dom.window.selectSlot(slot);
    }
    document.getElementById("submitBtn").click();
    document.getElementById("submitBtn").click();
  }
  return turns;
}

function countScoredDots(G) {
  let n = 0;
  for (const teamKey of ["away", "home"]) {
    for (const slotCols of G.scorecard[teamKey]) {
      for (const cell of Object.values(slotCols)) {
        if (cell && cell.scored) n++;
      }
    }
  }
  return n;
}

describe.each([1, 2, 3])("fuzzed game with mixed right/wrong answers (test-seed %i)", (testSeed) => {
  it("never throws, and the scorecard stays internally consistent regardless of answer correctness", () => {
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: String(100000 + testSeed) });
    const turns = playFullGameFuzzed(dom, testSeed);
    const G = getG(dom);

    expect(turns).toBeGreaterThan(0);
    expect(G.gameOver).toBe(true);
    // Wrong answers never change what actually happened in the (simulated) game, so the
    // scored-dot count can never *exceed* the real score. It can legitimately fall short of
    // it, though: see tests/integration/known-issues.test.js for a confirmed scorecard bug
    // (a lineup slot batting twice in one big inning can collide onto the same cell), so we
    // only assert the direction that's actually guaranteed here rather than exact equality.
    expect(countScoredDots(G)).toBeLessThanOrEqual(G.score.away + G.score.home);
    expect(G.inningRuns.away.reduce((a, b) => a + b, 0)).toBe(G.score.away);
    expect(G.inningRuns.home.reduce((a, b) => a + b, 0)).toBe(G.score.home);
    expect(G.totalCount).toBeGreaterThan(0);
    expect(G.correctCount).toBeGreaterThanOrEqual(0);
    expect(G.correctCount).toBeLessThanOrEqual(G.totalCount);
  });
});
