import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp, startGame } from "../helpers/loadApp.js";

describe("renderScoreboard", () => {
  it("reflects team names, scores and the current inning/half", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.score.away = 3; G.score.home = 1; G.inning = 2; G.half = 'bottom';");
    dom.window.renderScoreboard();
    const { document } = dom.window;
    expect(document.getElementById("awayScore").textContent).toBe("3");
    expect(document.getElementById("homeScore").textContent).toBe("1");
    expect(document.getElementById("inningMeta").textContent).toContain("Inning 2 (onder)");
    expect(document.getElementById("awayName").textContent).toBe(getG(dom).away.name);
  });

  it("builds an innings table with one column per max inning plus a totals column", () => {
    const dom = startGame(loadApp(), { innings: 4 });
    dom.window.renderScoreboard();
    const table = dom.window.document.getElementById("inningsTable");
    const headerCells = table.querySelectorAll("tr:first-child th");
    // Team + 4 innings + Tot = 6
    expect(headerCells).toHaveLength(6);
  });
});

describe("renderField", () => {
  it("toggles base-occupied classes and out dots to match G.bases / G.outs", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.bases = [{name:'A',history:{}}, null, {name:'C',history:{}}]; G.outs = 1;");
    dom.window.renderField();
    const { document } = dom.window;
    expect(document.getElementById("base1dot").classList.contains("occupied")).toBe(true);
    expect(document.getElementById("base2dot").classList.contains("occupied")).toBe(false);
    expect(document.getElementById("base3dot").classList.contains("occupied")).toBe(true);
    expect(document.getElementById("out0").classList.contains("filled")).toBe(true);
    expect(document.getElementById("out1").classList.contains("filled")).toBe(false);
  });

  it("lists occupied runners with their arrival code, and says 'geen' when the bases are empty", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.bases = [{name:'Runner', arrivedVia:'1B', history:{}}, null, null];");
    dom.window.renderField();
    expect(dom.window.document.getElementById("runnerList").innerHTML).toContain("Runner");
    expect(dom.window.document.getElementById("runnerList").innerHTML).toContain("1B");

    evalIn(dom, "G.bases = [null, null, null];");
    dom.window.renderField();
    expect(dom.window.document.getElementById("runnerList").innerHTML).toContain("geen");
  });
});

describe("renderFullScorecard", () => {
  it("renders one row per lineup slot for both teams, with the right number of inning columns", () => {
    const dom = startGame(loadApp(), { innings: 3 });
    dom.window.renderFullScorecard();
    const { document } = dom.window;
    const awayTable = document.querySelector("#scorecard-away table");
    // header + 9 lineup rows + 2 total rows = 12 (no explicit tbody, all <tr> direct children)
    expect(awayTable.querySelectorAll("tr").length).toBe(12);
    const headerCells = awayTable.querySelector("tr").querySelectorAll("th");
    // Pos + name + volgnr + 3 innings = 6
    expect(headerCells).toHaveLength(6);
  });

  it("shows the seeded matchNumber in the match-info block", () => {
    const dom = startGame(loadApp(), { matchNumber: "654321" });
    dom.window.renderFullScorecard();
    expect(dom.window.document.getElementById("scMatchInfo").innerHTML).toContain("654321");
  });

  it("marks the end-of-inning slot with the sc-endmark class once a half-inning has ended", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.endMarker.away[1] = 2;"); // slot index 2 was the last batter of inning 1
    dom.window.renderFullScorecard();
    const cell = dom.window.document.querySelectorAll("#scorecard-away td.sc-endmark");
    expect(cell.length).toBeGreaterThan(0);
  });

  it("draws the pinch-runner streepje only on the grid segment toward the next base, not the whole divider", () => {
    const dom = startGame(loadApp());
    // replaced on 1st: only the 1e/2e boundary should get a mark, not the unrelated 3e/thuis one
    evalIn(dom, "G.scorecard.away[0][1] = {'1e':'1B', _prQ:'1e'};");
    evalIn(dom, "G.scorecard.away[1][1] = {'1e':'1B','2e':'SB'};"); // no swap: no mark at all
    dom.window.renderFullScorecard();
    const html = dom.window.document.getElementById("scorecard-away").innerHTML;
    expect((html.match(/sc-pr-mark/g) || []).length).toBe(1);
    expect(html).toContain('class="sc-pr-mark sc-pr-1e"');
    expect(html).not.toContain("sc-pr-2e");
    expect(html).not.toContain("sc-pr-3e");
  });

  it("draws a dubbelspel connecting line once both out-circles are committed to the scorecard", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.scorecard.away[4][1] = {'2e':'64', _outQ:'2e'};"); // forced-out runner's own cell
    evalIn(dom, "G.scorecard.away[0][1] = {out:'43'};"); // batter's own cell
    evalIn(dom, "G.dpLinks.away = [{inning:1, runnerSlot:4, runnerQuadrant:'2e', batterSlot:0}];");
    dom.window.renderFullScorecard();
    const line = dom.window.document.querySelector("#scorecard-away svg.dp-links line.dp-link-line");
    expect(line).toBeTruthy();
    expect(line.getAttribute("data-dp-inning")).toBe("1");
    expect(line.getAttribute("data-dp-runner-slot")).toBe("4");
    expect(line.getAttribute("data-dp-batter-slot")).toBe("0");
  });

  it("doesn't draw a dubbelspel connecting line before the forced-out runner's follow-up question is answered", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.scorecard.away[0][1] = {out:'43'};"); // only the batter's half is committed so far
    evalIn(dom, "G.dpLinks.away = [{inning:1, runnerSlot:4, runnerQuadrant:'2e', batterSlot:0}];");
    dom.window.renderFullScorecard();
    expect(dom.window.document.querySelector("#scorecard-away svg.dp-links")).toBeNull();
  });

  it("draws one line per dpLinks entry when several double plays are on the card at once", () => {
    const dom = startGame(loadApp(), { innings: 6 });
    evalIn(dom, "G.scorecard.away[4][1] = {'2e':'64', _outQ:'2e'}; G.scorecard.away[0][1] = {out:'43'};");
    evalIn(dom, "G.scorecard.away[7][4] = {'2e':'54', _outQ:'2e'}; G.scorecard.away[2][4] = {out:'43'};");
    evalIn(dom, `G.dpLinks.away = [
      {inning:1, runnerSlot:4, runnerQuadrant:'2e', batterSlot:0},
      {inning:4, runnerSlot:7, runnerQuadrant:'2e', batterSlot:2}
    ];`);
    dom.window.renderFullScorecard();
    const lines = dom.window.document.querySelectorAll("#scorecard-away svg.dp-links line.dp-link-line");
    expect(lines).toHaveLength(2);
    const innings = Array.from(lines).map((l) => l.getAttribute("data-dp-inning")).sort();
    expect(innings).toEqual(["1", "4"]);
  });

  it("doesn't accumulate stale lines across re-renders", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.scorecard.away[4][1] = {'2e':'64', _outQ:'2e'}; G.scorecard.away[0][1] = {out:'43'};");
    evalIn(dom, "G.dpLinks.away = [{inning:1, runnerSlot:4, runnerQuadrant:'2e', batterSlot:0}];");
    dom.window.renderFullScorecard();
    dom.window.renderFullScorecard();
    dom.window.renderFullScorecard();
    const container = dom.window.document.getElementById("scorecard-away");
    expect(container.querySelectorAll("svg.dp-links")).toHaveLength(1);
    expect(container.querySelectorAll("line.dp-link-line")).toHaveLength(1);
  });

  it("finds the runner's out-circle by its recorded quadrant, not a hardcoded '2e'", () => {
    // Today's actual DP combos always force the runner at 2nd (quadrant '2e'), but the line
    // renderer takes the quadrant from the dpLinks entry itself (see index.html's applyEventToState
    // comment on why) — this proves that path actually works, using a hypothetical '3e' force
    // (e.g. the source material's own p.20 unassisted-5 example, forced at 3rd) that the app
    // doesn't generate yet. If this ever regresses to a hardcoded 'q-2e' lookup, this is the only
    // test that would catch it, since every real DP today only ever produces '2e'.
    const dom = startGame(loadApp());
    evalIn(dom, "G.scorecard.away[4][1] = {'3e':'5', _outQ:'3e'}; G.scorecard.away[0][1] = {out:'53'};");
    evalIn(dom, "G.dpLinks.away = [{inning:1, runnerSlot:4, runnerQuadrant:'3e', batterSlot:0}];");
    dom.window.renderFullScorecard();
    const line = dom.window.document.querySelector("#scorecard-away svg.dp-links line.dp-link-line");
    expect(line).toBeTruthy();
  });
});

describe("renderHeaderStats", () => {
  it("shows correctCount / totalCount and unhides the stat pill", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.correctCount = 4; G.totalCount = 7;");
    dom.window.renderHeaderStats();
    const el = dom.window.document.getElementById("headerStats");
    expect(el.textContent).toBe("4 / 7 juist");
    expect(el.classList.contains("hidden")).toBe(false);
  });
});
