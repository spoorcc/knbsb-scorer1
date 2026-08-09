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

  it("draws the pinch-runner streepje (sc-pr-swap) on the honk-vakje quadrant the runner was replaced on", () => {
    const dom = startGame(loadApp());
    evalIn(dom, "G.scorecard.away[0][1] = {'1e':'1B','2e':'SB', _prQ:'2e'};");
    dom.window.renderFullScorecard();
    const html = dom.window.document.getElementById("scorecard-away").innerHTML;
    expect(html).toContain('class="hist-text q-2e sc-pr-swap"');
    expect(html).not.toContain('class="hist-text q-1e sc-pr-swap"');
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
