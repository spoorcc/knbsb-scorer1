import { describe, expect, it } from "vitest";
import { getG, loadApp, startGame } from "../helpers/loadApp.js";

/**
 * Plays a whole game through the *real* UI (same pattern as full-game-simulation.test.js),
 * always answering correctly. Unlike the rendering-suite DP tests, which hand-craft
 * G.scorecard/G.dpLinks to test drawDpLines() in isolation, this drives the double play
 * through the actual event pipeline (generateEvent -> applyEventToState, twice: the main DP
 * question and the forced-out runner's follow-up) to catch any real wiring mismatch between
 * what the game engine produces and what drawDpLines() expects to find in the DOM. Covers both
 * DP shapes: the relay 'DP' (runner forced at 2nd) and the unassisted 'DP3' (runner forced at
 * 3rd, p.20) — the latter is what dpLinks[].runnerQuadrant exists to keep working.
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

describe("dubbelspel connecting line — end-to-end through a real game", () => {
  it("matchNumber 100002 plays a real double play whose two out-circles get connected on the printed scorecard", () => {
    // Confirmed deterministic repro (found by brute-forcing matchNumbers the same way the
    // repo's own analysis/find-matching-wedstrijdnummer.mjs does): home team's DP in inning 3,
    // runner forced out at 2nd (lineup slot 5, already on base via a single) and the batter
    // (lineup slot 6) out to complete it.
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "100002" });
    playFullGameCorrectly(dom);
    const G = getG(dom);

    expect(G.gameOver).toBe(true);
    expect(G.dpLinks.home).toEqual([
      { inning: 3, runnerSlot: 5, runnerQuadrant: "2e", runnerAtBat: 0, batterSlot: 6, batterAtBat: 0 },
    ]);

    // Both halves of the play really did land in the scorecard the way drawDpLines() expects:
    // the runner's own cell circled in the 2e quadrant, the batter's own cell as a whole-cell out.
    expect(G.scorecard.home[5][3][0]).toMatchObject({ "2e": "(54)" });
    expect(G.scorecard.home[6][3][0]).toMatchObject({ out: "43" });

    // renderFullScorecard() is already called after every answer during play, but call it once
    // more explicitly (as the app does on every turn) and check the actual DOM it produced.
    dom.window.renderFullScorecard();
    const line = dom.window.document.querySelector('#scorecard-home svg.dp-links line.dp-link-line[data-dp-inning="3"]');
    expect(line).toBeTruthy();
    expect(line.getAttribute("data-dp-runner-slot")).toBe("5");
    expect(line.getAttribute("data-dp-batter-slot")).toBe("6");
  });

  it("matchNumber 100026 plays a real p.20-style unassisted double play (DP3), connected the same way", () => {
    // Confirmed deterministic repro: home team's DP3 in inning 3, runner forced out at 3rd
    // (lineup slot 7, unassisted) and the batter (lineup slot 1) out to complete it. This is
    // the case the dpLinks[].runnerQuadrant fix specifically exists for — its runner circle
    // sits in the 3e quadrant, not the 2e every 'DP' case always uses.
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "100026" });
    playFullGameCorrectly(dom);
    const G = getG(dom);

    expect(G.gameOver).toBe(true);
    expect(G.dpLinks.home).toEqual([
      { inning: 3, runnerSlot: 7, runnerQuadrant: "3e", runnerAtBat: 0, batterSlot: 1, batterAtBat: 0 },
    ]);

    expect(G.scorecard.home[7][3][0]).toMatchObject({ "3e": "(5)" });
    expect(G.scorecard.home[1][3][0]).toMatchObject({ out: "53" });

    dom.window.renderFullScorecard();
    const line = dom.window.document.querySelector('#scorecard-home svg.dp-links line.dp-link-line[data-dp-inning="3"]');
    expect(line).toBeTruthy();
    expect(line.getAttribute("data-dp-runner-slot")).toBe("7");
    expect(line.getAttribute("data-dp-batter-slot")).toBe("1");
  });
});
