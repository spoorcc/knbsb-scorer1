import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp, randomForPickIndex, stubRngConstant, stubRngSequence } from "../helpers/loadApp.js";

function setup(innings = 3, sport = "Honkbal") {
  const dom = loadApp();
  dom.window.initGame(innings, sport, "1");
  return dom;
}

function commonMcShape(ev) {
  expect(ev.type).toBe("mc");
  expect(ev.forBatter).toBe(false);
  expect(Array.isArray(ev.options)).toBe(true);
  expect(ev.options.length).toBeGreaterThan(1);
  expect(ev.correctIndex).toBeGreaterThanOrEqual(0);
  expect(ev.correctIndex).toBeLessThan(ev.options.length);
  expect(typeof ev.explain).toBe("string");
}

describe("buildForcedOutFollowUpEvent", () => {
  it("phrases it as 'also out' when alsoOut is true (double play)", () => {
    const dom = setup();
    const ev = dom.window.buildForcedOutFollowUpEvent("Loper", "2e", "643", { "1e": "1B" }, 3, "away", null, true);
    expect(ev.forBatter).toBe(false);
    expect(ev.targetQuadrant).toBe("2e");
    expect(ev.code).toBe("643");
    expect(ev.narrative).toContain("Loper");
    expect(ev.narrative).toContain("Ook");
    const result = ev.applyBases([null, null, null]);
    expect(result.runs).toBe(0);
    const G = getG(dom);
    expect(G.scorecard.away[3][1][0]).toMatchObject({ "1e": "1B", "2e": "643" });
  });

  it("phrases it as 'the only one out' when alsoOut is false (fielder's choice)", () => {
    const dom = setup();
    const ev = dom.window.buildForcedOutFollowUpEvent("Loper", "3e", "FC65", {}, 2, "home", null, false);
    expect(ev.narrative).not.toContain("Ook");
    expect(ev.narrative).toContain("veilig");
  });
});

describe("buildSchuinStreepQuiz / buildEndOfInningQuizEvent", () => {
  it("buildSchuinStreepQuiz always has the diagonal-line phrasing as the correct answer", () => {
    const dom = setup();
    stubRngConstant(dom, 0);
    const ev = dom.window.buildSchuinStreepQuiz();
    commonMcShape(ev);
    expect(ev.options[ev.correctIndex]).toContain("schuine");
  });

  it("buildEndOfInningQuizEvent picks buildSchuinStreepQuiz below the 0.55 threshold", () => {
    const dom = setup();
    stubRngConstant(dom, 0.1);
    const ev = dom.window.buildEndOfInningQuizEvent();
    commonMcShape(ev);
    expect(ev.narrative).toContain("drie spelers uitgemaakt");
  });

  it("buildEndOfInningQuizEvent picks from the general rules pool at/above the 0.55 threshold", () => {
    const dom = setup();
    stubRngConstant(dom, 0.9);
    const ev = dom.window.buildEndOfInningQuizEvent();
    commonMcShape(ev);
  });

  it("never throws across a spread of rng draws", () => {
    const dom = setup();
    for (let i = 0; i < 20; i++) {
      stubRngConstant(dom, i / 20);
      const ev = dom.window.buildEndOfInningQuizEvent();
      commonMcShape(ev);
    }
  });

  it("includes a 2-outs distractor for the SH (sacrifice hit) question, alongside the 'batter also safe' one", () => {
    // Regression: none of the original distractors referenced the 2-outs rule — a bunt with 2 outs
    // already reached can never be SH, no matter how cleanly it's executed, but that rule wasn't
    // covered anywhere in the quiz.
    const dom = setup();
    stubRngSequence(dom, [0.9, randomForPickIndex(4, 8)]);
    const ev = dom.window.buildEndOfInningQuizEvent();
    commonMcShape(ev);
    expect(ev.narrative).toContain("twee uit");
    expect(ev.options[ev.correctIndex]).toContain("nog geen twee uit");
  });
});

describe("getAvailableBenchPlayer", () => {
  it("returns the first bench player nobody has used yet", () => {
    const dom = setup();
    const first = dom.window.getAvailableBenchPlayer("away");
    expect(first).toBeTruthy();
    expect(getG(dom).away.bench.map((b) => b.name)).toContain(first.name);
  });

  it("skips players already recorded as a sub/pitcher in slotEvents", () => {
    const dom = setup();
    const bench = getG(dom).away.bench;
    evalIn(dom, `G.slotEvents.away[0].push({type:'sub', name:${JSON.stringify(bench[0].name)}})`);
    const next = dom.window.getAvailableBenchPlayer("away");
    expect(next.name).not.toBe(bench[0].name);
  });

  it("returns null once every bench player has been used", () => {
    const dom = setup();
    const bench = getG(dom).away.bench;
    bench.forEach((b, i) => {
      evalIn(dom, `G.slotEvents.away[${i}].push({type:'sub', name:${JSON.stringify(b.name)}})`);
    });
    expect(dom.window.getAvailableBenchPlayer("away")).toBeNull();
  });

  it("supports an explicit pool (used for pitcher call-ups from team.pitchers)", () => {
    const dom = setup();
    const pitchers = getG(dom).away.pitchers;
    const first = dom.window.getAvailableBenchPlayer("away", pitchers);
    expect(pitchers.map((p) => p.name)).toContain(first.name);
  });
});

describe("halfInningLabel", () => {
  it("labels the top half as 1/<inning> and bottom half as 2/<inning>", () => {
    const dom = setup();
    evalIn(dom, "G.half = 'top'; G.inning = 3;");
    expect(dom.window.halfInningLabel()).toBe("1/3");
    evalIn(dom, "G.half = 'bottom';");
    expect(dom.window.halfInningLabel()).toBe("2/3");
  });
});

describe("buildPinchRunnerQuizEvent", () => {
  it("returns null when the team's bench is exhausted", () => {
    const dom = setup();
    const bench = getG(dom).away.bench;
    bench.forEach((b, i) => {
      evalIn(dom, `G.slotEvents.away[${i}].push({type:'sub', name:${JSON.stringify(b.name)}})`);
    });
    expect(dom.window.buildPinchRunnerQuizEvent({ name: "Loper", battingSlot: 0 }, "away", "2e")).toBeNull();
  });

  it("otherwise builds a valid MC event naming the runner and the substitute, and marks the swap quadrant", () => {
    const dom = setup();
    const ev = dom.window.buildPinchRunnerQuizEvent({ name: "Loper", battingSlot: 0 }, "away", "2e");
    commonMcShape(ev);
    expect(ev.narrative).toContain("Loper");
    expect(ev.explain).toContain("2e honk");
    expect(ev.lineupChange).toMatchObject({ teamKey: "away", slot: 0, subType: "PR" });
    // the streepje (p.21) belongs in the outgoing runner's own cell, at the honk-vakje quadrant
    // they were standing on when the swap happened — not the incoming PR's own (blank) row.
    expect(ev.pinchRunnerMarker).toEqual({ teamKey: "away", battingSlot: 0, quadrant: "2e" });
  });
});

describe("buildPositionChangeQuizEvent", () => {
  it("swaps two different-position players on the given team and never throws", () => {
    const dom = setup();
    stubRngConstant(dom, 0);
    const ev = dom.window.buildPositionChangeQuizEvent("away");
    commonMcShape(ev);
    expect(ev.posChange.teamKey).toBe("away");
    expect(ev.posChange.swaps).toHaveLength(2);
    expect(ev.posChange.swaps[0].slot).not.toBe(ev.posChange.swaps[1].slot);
    expect(ev.posChange.swaps[0].newPos).not.toBe(ev.posChange.swaps[1].newPos);
    expect(ev.posChange.halfLabel).toBe(dom.window.halfInningLabel());
  });

  it("also explains the dikke streep it puts on the opposing team's current-batter cell (p.21)", () => {
    const dom = setup();
    stubRngConstant(dom, 0);
    const ev = dom.window.buildPositionChangeQuizEvent("away");
    const G = getG(dom);
    const oppBatterName = dom.window.currentBatterName("home", G.battingIdx.home % 9);
    expect(ev.explain).toContain("dikke streep");
    expect(ev.explain).toContain(oppBatterName);
  });

  it("never puts the pitcher's own slot into the swap, even at the rng roll that used to pick it", () => {
    const dom = setup();
    // away's default pitcher is lineup slot 8 (Rutger van Rucphen, pos 1). This is the rng value
    // the old, unfiltered `Math.floor(rng()*9)` pick would have resolved to slot 8 with — a change
    // of who's pitching that this quiz never gives a bootje for (only buildPitcherChangeQuizEvent
    // does), which is exactly the matchNumber 505308 bug in reported-matchnumbers.test.js.
    stubRngConstant(dom, randomForPickIndex(8, 9));
    const ev = dom.window.buildPositionChangeQuizEvent("away");
    expect(ev.posChange.swaps.some((s) => s.slot === 8)).toBe(false);
  });
});

describe("buildPinchHitterQuizEvent", () => {
  it("returns null once the bench is exhausted, otherwise names the substitute", () => {
    const dom = setup();
    const ev = dom.window.buildPinchHitterQuizEvent("home");
    commonMcShape(ev);
    expect(ev.lineupChange.teamKey).toBe("home");

    const bench = getG(dom).home.bench;
    bench.forEach((b, i) => {
      evalIn(dom, `G.slotEvents.home[${i}].push({type:'sub', name:${JSON.stringify(b.name)}})`);
    });
    expect(dom.window.buildPinchHitterQuizEvent("home")).toBeNull();
  });

  it("explains the dikke streep marking where the sub's own turns begin (p.20)", () => {
    const dom = setup();
    const ev = dom.window.buildPinchHitterQuizEvent("home");
    expect(ev.explain).toContain("dikke streep");
  });
});

describe("buildPitcherChangeQuizEvent", () => {
  it("returns null when this team already had a pitcher change this inning", () => {
    const dom = setup();
    evalIn(dom, "G.lastPitcherChangeInning.away = G.inning;");
    expect(dom.window.buildPitcherChangeQuizEvent("away")).toBeNull();
  });

  it("otherwise builds a valid MC event and carries the pitcherChange payload", () => {
    const dom = setup();
    const ev = dom.window.buildPitcherChangeQuizEvent("away");
    commonMcShape(ev);
    expect(ev.pitcherChange.teamKey).toBe("away");
    expect(ev.pitcherChange.newName).toBeTruthy();
  });

  it("explains the bootje, the new lineup row, and the optional stint color (p.20-21)", () => {
    const dom = setup();
    const ev = dom.window.buildPitcherChangeQuizEvent("away");
    expect(ev.explain).toContain("bootje");
    expect(ev.explain).toContain("kleur");
  });

  it("returns null once every relief pitcher has been used", () => {
    const dom = setup();
    const pitchers = getG(dom).away.pitchers;
    pitchers.forEach((p, i) => {
      evalIn(dom, `G.slotEvents.away[${i}].push({type:'sub', name:${JSON.stringify(p.name)}})`);
    });
    expect(dom.window.buildPitcherChangeQuizEvent("away")).toBeNull();
  });

  it("targets the bootje at the opponent's actual last-faced at-bat, not just G.inning right now", () => {
    // away's pitcher change is decided at the top-of-2-ending boundary (away is switching from
    // batting to fielding), so the outgoing pitcher's last real outing was during home's *previous*
    // batting half — bottom of inning 1 — a whole inning behind the decision point (G.inning=2).
    const dom = setup();
    evalIn(dom, "G.inning = 2;");
    evalIn(dom, "G.battingIdx.home = 9;"); // last completed home batter: slot (9-1+9)%9 = 8
    evalIn(dom, "G.atBatIndex.home[8] = {inning: 1, idx: 0};"); // that at-bat really happened in inning 1
    const ev = dom.window.buildPitcherChangeQuizEvent("away");
    expect(ev.pitcherChange.oppTeam).toBe("home");
    expect(ev.pitcherChange.oppSlot).toBe(8);
    expect(ev.pitcherChange.boatInning).toBe(1); // the bootje's column: inning 1, not 2
  });

  it("commits the bootje into G.boatMarkers at boatInning, but the guard bookkeeping stays tied to G.inning at answer time", () => {
    // The guard (G.lastPitcherChangeInning) governs *whether a future pitcher change fires at
    // all* — a game-generation decision — unlike boatInning, which is purely where a mark gets
    // drawn. Backdating the guard the same way as boatInning would change which matches get
    // offered a 2nd pitcher change, silently shifting the RNG sequence for every already-seeded
    // matchNumber; it must stay G.inning right now, not the captured/earlier boatInning.
    const dom = setup();
    evalIn(dom, "G.inning = 2;");
    evalIn(dom, "G.battingIdx.home = 9;");
    evalIn(dom, "G.atBatIndex.home[8] = {inning: 1, idx: 0};");
    const ev = dom.window.buildPitcherChangeQuizEvent("away");
    dom.window.applyEventToState(ev);
    const G = getG(dom);
    expect(G.boatMarkers.home[8]).toEqual([{ inning: 1, color: expect.any(Number), atBat: 0 }]);
    expect(G.lastPitcherChangeInning.away).toBe(2);
  });

  it("claims the inning's guard slot as soon as it decides to build, so a second call in the same inning can't sneak in before the first is answered", () => {
    // Regression for a reported "raar artefact" bootje: endHalfInning() and the stray mid-turn
    // roll in generateEvent() both call this function. If the first call's quiz is still sitting
    // unanswered (in G.pendingEvents, or as the current turn) when the second call happens in the
    // same inning, both used to pass the G.lastPitcherChangeInning guard (only set on answer/apply)
    // and each built its own conflicting boatMarkers entry for the same team/inning.
    const dom = setup();
    const first = dom.window.buildPitcherChangeQuizEvent("away");
    expect(first).not.toBeNull();
    // Still G.inning further along, still unanswered — a second build attempt must now be blocked.
    const second = dom.window.buildPitcherChangeQuizEvent("away");
    expect(second).toBeNull();
  });
});

describe("buildExtraBaseArrowEvent", () => {
  it("describes the situation without naming the required PIJL code in the pre-answer narrative", () => {
    // Regression: the narrative (shown before the scorer answers) used to literally say
    // "typ hier PIJL", giving the answer away instead of letting the scorer work it out — the
    // instructional wording belongs in the post-answer explain text instead.
    const dom = setup();
    const ev = dom.window.buildExtraBaseArrowEvent("Loper", "E6", "1e", "2e");
    expect(ev.narrative).not.toContain("PIJL");
    expect(ev.narrative).not.toContain("typ hier");
    expect(ev.narrative).toContain("Loper");
    expect(ev.explain).toContain("PIJL");
  });

  it("scores a run when the arrow reaches thuis", () => {
    const dom = setup();
    const ev = dom.window.buildExtraBaseArrowEvent("Loper", "E2T", "3e", "thuis");
    expect(ev.scoresRun).toBe(true);
    expect(ev.targetQuadrant).toBe("thuis");
    const result = ev.applyBases([null, null, { name: "Loper", battingSlot: 4, history: { "3e": "SB E2T" } }]);
    expect(result.runs).toBe(1);
    expect(result.bases[2]).toBeNull();
  });

  it("does not score a run when the arrow reaches a base short of thuis", () => {
    const dom = setup();
    const ev = dom.window.buildExtraBaseArrowEvent("Loper", "E2T", "2e", "3e");
    expect(ev.scoresRun).toBe(false);
    const result = ev.applyBases([null, null, { name: "Loper", battingSlot: 4, history: { "2e": "SB E2T" } }]);
    expect(result.runs).toBe(0);
  });
});
