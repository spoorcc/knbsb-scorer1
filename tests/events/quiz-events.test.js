import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp, stubRngConstant } from "../helpers/loadApp.js";

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
    expect(G.scorecard.away[3][1]).toMatchObject({ "1e": "1B", "2e": "643", _outQ: "2e" });
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
});
