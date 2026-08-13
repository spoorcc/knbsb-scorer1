import { describe, expect, it } from "vitest";
import { getG, loadApp, startGame } from "../helpers/loadApp.js";

/**
 * Regression tests pinned to specific matchNumbers cited in user bug reports. Each one was played
 * through with startGame({innings:3, sport:'Honkbal', matchNumber}) — the app's own defaults — and
 * every turn answered with the objectively correct code, exactly like the other integration tests.
 */
function playFullGameCorrectly(dom, { maxTurns = 600 } = {}) {
  const { document } = dom.window;
  let turns = 0;
  while (document.getElementById("endScreen").classList.contains("hidden")) {
    turns++;
    if (turns > maxTurns) throw new Error(`exceeded ${maxTurns} turns`);
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
  return turns;
}

describe("matchNumber 211304 — reported 'raar artefact' bootje at bal op het dak, inning 2, slagvolgorde 6", () => {
  it("places the pitcher-change bootje at home (bal op het dak) slot 5 (slagvolgorde 6), inning 2, in red", () => {
    // Phase-0 investigation: this exact reproduction already lands the bootje exactly where the
    // report says it's *expected* (home=Bal op het dak, slot index 5 = slagvolgorde 6, inning 2,
    // colored). No misplaced/duplicate marker was found for this specific matchNumber+combo. This
    // test locks in the correct placement so it can't silently regress, and also covers the fix in
    // buildPitcherChangeQuizEvent that closes a real (separately confirmed) race: endHalfInning()
    // and the stray mid-turn roll in generateEvent() could otherwise both build a pitcher-change
    // quiz for the same team/inning before the first was answered, producing a second, wrongly
    // placed boatMarkers entry (see the "claims the inning's guard slot" test in
    // tests/events/quiz-events.test.js).
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "211304" });
    playFullGameCorrectly(dom);
    const G = getG(dom);
    expect(G.boatMarkers.home["5"]).toEqual(
      expect.arrayContaining([expect.objectContaining({ inning: 2 })])
    );
  });

  it("draws the bootje as its own element so it doesn't collide with fieldSubMarkers' top-bar on the same cell", () => {
    // Follow-up report: the *data* was already right (previous test above), but this exact cell
    // also happens to be where an unrelated fielder position swap (fieldSubMarkers) draws its own
    // "streep boven de eerstvolgende slagman" (p.21) — a pitcher change and a position swap are
    // independent events that can legitimately both target the same opponent's next-at-bat cell.
    // Both used to render via the cell's own ::before, so whichever CSS rule came later in the
    // stylesheet silently won the whole pseudo-element (top/height/background), which is what
    // squashed the bootje against the cell's top edge instead of its own bottom edge. The bootje
    // now renders as a real child element (.sc-boat-icon) instead, so both markers coexist.
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "211304" });
    playFullGameCorrectly(dom);
    const G = getG(dom);
    expect(G.fieldSubMarkers.home["5"]).toEqual(
      expect.arrayContaining([expect.objectContaining({ inning: 2 })])
    );
    const { document } = dom.window;
    const cell = document.querySelector('#scorecard-home td[data-slot="5"][data-inn="2"][data-atbat="0"]');
    expect(cell.classList.contains("sc-subline")).toBe(true);
    expect(cell.classList.contains("sc-subline-opp")).toBe(true);
    const boatIcon = cell.querySelector(".sc-boat-icon");
    expect(boatIcon).toBeTruthy();
    expect(boatIcon.classList.contains("sc-boat-icon-b")).toBe(true);
  });
});

describe("matchNumber 988566 — reported 'onverwachte dikke streep' bij honkvast/bal op het dak, inning 2", () => {
  it("both thick-line markers trace back to real, documented substitution events, not a bug", () => {
    // Phase-0 investigation: honkvast (away) slot 3 (slagvolgorde 4) gets a subMarkers line from a
    // genuine pinch-hitter substitution in the top of inning 2 (not a pinch-runner, which is
    // deliberately excluded from this marker per index.html's own comment). Confirms the feature
    // is working as designed for this matchNumber; no code change made for this report.
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "988566" });
    playFullGameCorrectly(dom);
    const G = getG(dom);
    expect(G.subMarkers.away["3"]).toEqual(expect.arrayContaining([expect.objectContaining({ inning: 2 })]));
    const phSub = G.slotEvents.away["3"].find((e) => e.type === "sub" && e.posDisplay === "PH" && e.inning === 2);
    expect(phSub).toBeTruthy();
  });
});

describe("matchNumber 253121 — 'is deze voor positiewissel of pinch-hitter?' bij honkvast, inning 2", () => {
  it("honkvast's inning-2 line is the opponent's position-swap marker (fieldSubMarkers), landing on the correct slot", () => {
    // Phase-0 investigation: Bal op het dak (home) swaps two existing fielders' positions in the
    // top of inning 2 (buildPositionChangeQuizEvent) — per the cited rule (p.20-21) that marker is
    // drawn on the *opponent's* card (honkvast/away), at their current batting slot, not on the
    // swapping team's own card. Honkvast also separately has its own real PH substitution at slot 0
    // the same inning. Both are legitimate, independently documented features; the two marker
    // *reasons* used to render identically (both just `.sc-subline`), which is exactly why the user
    // couldn't tell them apart. The scorer course document (p.20-21) already distinguishes them: a
    // lineup substitution (own card) gets a vertical divider (`.sc-subline-own`) splitting the two
    // batters' stats within the row, while a fielder position swap (opponent's card) is marked only
    // by the shared horizontal top-bar (`.sc-subline-opp`, no extra styling of its own) drawn above
    // the next batter's cell. No logic bug found for this report; the marker placement itself was
    // already correct.
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "253121" });
    playFullGameCorrectly(dom);
    const G = getG(dom);
    expect(G.fieldSubMarkers.away["4"]).toEqual(expect.arrayContaining([expect.objectContaining({ inning: 2 })]));
    const posSwap = G.slotEvents.home["4"].find((e) => e.type === "pos" && e.inning === 2);
    expect(posSwap).toBeTruthy();
    expect(G.subMarkers.away["0"]).toEqual(expect.arrayContaining([expect.objectContaining({ inning: 2 })]));
    const { document } = dom.window;
    const ownLineCell = document.querySelector('#scorecard-away td[data-slot="0"][data-inn="2"].sc-subline-own');
    const oppLineCell = document.querySelector('#scorecard-away td[data-slot="4"][data-inn="2"].sc-subline-opp');
    expect(ownLineCell).toBeTruthy();
    expect(oppLineCell).toBeTruthy();
  });
});

describe("matchNumber 505308 — reported 'maar 1 bootje' bij een werper/midvelder-positiewissel plus een echte werperwissel", () => {
  it("buildPositionChangeQuizEvent never hands the pitcher's own slot to a plain position swap", () => {
    // Phase-0 investigation: before the fix, this matchNumber's random pool at Bal op het dak
    // (home) picked the pitcher's slot (Ian van Iersel, pos 1) and the center fielder's slot (Bas
    // van Boxtel, pos 8) for buildPositionChangeQuizEvent's ordinary position swap. That silently
    // made Bas van Boxtel the new pitcher with no bootje/stint-color bookkeeping at all (only
    // buildPitcherChangeQuizEvent does that) — a real change of who's pitching that the scorecard
    // never marked. A later, genuine substitution (IJsbrand van IJzendoorn subbing in for the
    // pitcher slot) then produced the game's only bootje, even though the pitcher had actually
    // changed identity twice. The fix excludes the pitcher's slot from buildPositionChangeQuizEvent's
    // candidate pool entirely, so any change of who pitches can only ever happen through
    // buildPitcherChangeQuizEvent, which always records the bootje.
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "505308" });
    playFullGameCorrectly(dom);
    const G = getG(dom);
    ["away", "home"].forEach((teamKey) => {
      for (let slot = 0; slot < 9; slot++) {
        const posEvents = G.slotEvents[teamKey][slot].filter((e) => e.type === "pos");
        expect(posEvents.every((e) => e.pos !== 1)).toBe(true);
      }
    });
  });

  it("also draws the dikke streep divider on Bal op het dak's own card for the real pitcher substitution at slot 8", () => {
    // Follow-up report on the same matchNumber: the real werperwissel (IJsbrand van IJzendoorn
    // taking over pitching at slot 8, top of inning 2) got the bootje on honkvast's card and a new
    // name row on its own card, but no sc-subline-own divider — even though a relief pitcher is,
    // like a pinch hitter, a brand new player occupying that slagvolgordevakje from now on.
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "505308" });
    playFullGameCorrectly(dom);
    const G = getG(dom);
    expect(G.subMarkers.home["8"]).toEqual(expect.arrayContaining([expect.objectContaining({ inning: 2 })]));
    const { document } = dom.window;
    const ownLineCell = document.querySelector('#scorecard-home td[data-slot="8"][data-inn="2"].sc-subline-own');
    expect(ownLineCell).toBeTruthy();
  });
});
