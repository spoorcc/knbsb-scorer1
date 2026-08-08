import { describe, expect, it } from "vitest";
import { getG, loadApp, startGame } from "../helpers/loadApp.js";

/**
 * KNOWN ISSUE (tracked, not fixed in this PR — see PR discussion):
 *
 * G.scorecard[teamKey][battingSlot][inning] is keyed only by (team, lineup slot, inning).
 * That assumes a player bats at most once per inning. In a big inning (batting around the
 * order), the same lineup slot can come up to bat twice; the second at-bat's commitToScorecard
 * call merges into the *same* cell as the first (Object.assign over the existing cell), silently
 * conflating two distinct at-bats. When both at-bats happen to score, the merge can leave only
 * one visible `scored: true` flag for two actual runs, breaking the KNBSB scorecard invariant
 * that the total count of scored-dots must equal the final combined score.
 *
 * Confirmed, deterministic repro: matchNumber "100165", 3 innings, Honkbal, always-correct
 * answers. Inning 3 is a 10-run inning (home team) in which several lineup slots bat twice;
 * e.g. lineup slot 3 both makes an out and later hits a scoring homer, and both at-bats' data
 * land in G.scorecard.home[3][3]. Any pair of same-slot, same-inning at-bats that both score
 * collides on the same `scored: true` write, which is a no-op after the first — so the dot
 * count under-reports by one dot per such collision (here: 2 collisions relative to naive
 * scorecard).
 *
 * (This matchNumber was re-pinned when new scoring events were added to the weighted event
 * pools in generateBatterEvent/generateRunnerEvent — that changes the RNG draw sequence for
 * every seeded match, so a previously-confirmed repro seed can stop reproducing the bug. If
 * this test ever fails because a future pool change shifts the sequence again, look for a new
 * matchNumber that still reproduces dots < totalScore with a genuine same-slot-same-inning
 * double at-bat, the same way this one was found, rather than loosening the assertions.)
 *
 * This test pins down today's actual (imperfect) behavior so a future fix has a concrete
 * regression to flip green, and so nobody mistakes the gap for test flakiness.
 */
describe("KNOWN ISSUE — scorecard dot-count can under-report when a lineup slot bats twice in one inning", () => {
  it("matchNumber 100165 reproduces a scored-dot undercount despite every answer being correct", () => {
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "100165" });
    const { document } = dom.window;
    let turns = 0;
    while (document.getElementById("endScreen").classList.contains("hidden")) {
      turns++;
      if (turns > 600) throw new Error("exceeded 600 turns");
      const ev = getG(dom).currentEvent;
      if (ev.type === "mc") {
        document.getElementById("mcOptions").querySelectorAll(".mc-btn")[ev.correctIndex].click();
      } else {
        const input = document.getElementById("systemInput");
        input.value = ev.code;
        input.dispatchEvent(new dom.window.Event("input"));
        dom.window.selectSlot(ev.targetQuadrant);
      }
      document.getElementById("submitBtn").click();
      document.getElementById("submitBtn").click();
    }
    const G = getG(dom);

    let dots = 0;
    for (const teamKey of ["away", "home"]) {
      for (const slotCols of G.scorecard[teamKey]) {
        for (const cell of Object.values(slotCols)) {
          if (cell && cell.scored) dots++;
        }
      }
    }

    const totalScore = G.score.away + G.score.home;
    // Today's reality: dots undercounts the true score for this seed. If this ever starts
    // failing because dots === totalScore, the underlying bug has been fixed — update/remove
    // this regression test (and restore the strict equality check in the other integration
    // tests) rather than "fixing" the assertion back to inequality.
    expect(totalScore).toBe(17);
    expect(dots).toBe(15);
    expect(dots).toBeLessThan(totalScore);

    // Sanity: the same lineup slot really did bat twice in the same inning — that's the actual
    // mechanism, not a red herring. Home lineup slot 3's inning-3 cell shows both an "out" and a
    // "thuis" (scoring) entry, which is only possible if that slot came to bat twice that inning.
    expect(G.scorecard.home[3][3]).toMatchObject({ out: expect.any(String), thuis: expect.any(String) });
    expect(G.inningRuns.home[2]).toBeGreaterThan(9); // inning 3 (index 2) is the big inning
  });
});
