import { describe, expect, it } from "vitest";
import { getG, loadApp, startGame } from "../helpers/loadApp.js";

/**
 * FORMERLY a known issue, now fixed (regression test):
 *
 * G.scorecard[teamKey][battingSlot][inning] used to be keyed only by (team, lineup slot,
 * inning), which assumed a player bats at most once per inning. In a big inning (batting around
 * the order), the same lineup slot can come up to bat twice; the second at-bat's
 * commitToScorecard call used to merge into the *same* cell as the first (Object.assign over the
 * existing cell), silently conflating two distinct at-bats. When both at-bats happened to score,
 * the merge could leave only one visible `scored: true` flag for two actual runs, breaking the
 * KNBSB scorecard invariant that the total count of scored-dots must equal the final combined
 * score.
 *
 * Fixed by giving each cell an at-bat index (G.atBatIndex / currentAtBatIdx in index.html):
 * G.scorecard[team][slot][inning] is now an *array* of at-bat cells, one entry per trip through
 * the lineup that slot took in that inning, and renderFullScorecard() gives the 2nd+ entry its
 * own extra "inning N" column on the printed card (see rendering.test.js) instead of hiding it.
 *
 * This test pins down the same deterministic repro the original bug report used — matchNumber
 * "100165", 3 innings, Honkbal, always-correct answers, where inning 3 is a 10-run inning (home
 * team) in which several lineup slots bat twice — and confirms the invariant now holds instead of
 * documenting the undercount.
 *
 * (This matchNumber was re-pinned when new scoring events were added to the weighted event pools
 * in generateBatterEvent/generateRunnerEvent — that changes the RNG draw sequence for every
 * seeded match, so a previously-confirmed repro seed can stop reproducing the *scenario* (a
 * same-slot-same-inning double at-bat) even though the fix itself doesn't depend on which seed is
 * used. If this test ever fails because matchNumber 100165 no longer produces a double at-bat,
 * find a new one that does, the same way this one was originally found, rather than weakening the
 * assertions.)
 */
describe("scorecard dot-count invariant — including the batting-around case that used to break it", () => {
  it("matchNumber 100165: a lineup slot batting twice in one inning no longer undercounts the scored-dot total", () => {
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
        for (const atBats of Object.values(slotCols)) {
          for (const cell of atBats) {
            if (cell && cell.scored) dots++;
          }
        }
      }
    }

    const totalScore = G.score.away + G.score.home;
    expect(totalScore).toBe(17);
    expect(dots).toBe(17); // used to be 15 (undercounted by 2) before the at-bat-index fix
    expect(dots).toBe(totalScore);

    // Sanity: the same lineup slot really did bat twice in the same inning — that's the actual
    // mechanism, not a red herring — and both at-bats' data now live in their own array entry
    // instead of colliding into one merged cell.
    expect(G.scorecard.home[3][3]).toHaveLength(2);
    expect(G.scorecard.home[3][3][0]).toMatchObject({ scored: true });
    expect(G.scorecard.home[3][3][1]).toMatchObject({ out: expect.any(String) });
    expect(G.inningRuns.home[2]).toBeGreaterThan(9); // inning 3 (index 2) is the big inning
  });
});
