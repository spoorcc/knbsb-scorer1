import { describe, expect, it } from "vitest";
import { evalIn, loadApp } from "../helpers/loadApp.js";

describe("battingKey / fieldingKey / battingTeam", () => {
  it("away bats in the top half, home fields", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal");
    evalIn(dom, "G.half = 'top'");
    expect(dom.window.battingKey()).toBe("away");
    expect(dom.window.fieldingKey()).toBe("home");
    expect(dom.window.battingTeam().name).toBe(evalIn(dom, "G.away.name"));
  });

  it("home bats in the bottom half, away fields", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal");
    evalIn(dom, "G.half = 'bottom'");
    expect(dom.window.battingKey()).toBe("home");
    expect(dom.window.fieldingKey()).toBe("away");
    expect(dom.window.battingTeam().name).toBe(evalIn(dom, "G.home.name"));
  });
});

describe("currentPos / currentBatterName", () => {
  it("falls back to the original lineup when there is no slotEvents history", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal");
    const originalPos = evalIn(dom, "G.away.lineup[0].pos");
    const originalName = evalIn(dom, "G.away.lineup[0].name");
    expect(dom.window.currentPos("away", 0)).toBe(originalPos);
    expect(dom.window.currentBatterName("away", 0)).toBe(originalName);
  });

  it("reflects the most recent position-change event for that slot", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal");
    evalIn(dom, "G.slotEvents.away[0].push({type:'pos', pos:9, inning:1, half:'top'})");
    evalIn(dom, "G.slotEvents.away[0].push({type:'pos', pos:2, inning:2, half:'top'})");
    expect(dom.window.currentPos("away", 0)).toBe(2);
  });

  it("reflects the most recent substitution for that slot", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal");
    evalIn(dom, "G.slotEvents.home[3].push({type:'sub', name:'Invaller Een', label:'PH'})");
    evalIn(dom, "G.slotEvents.home[3].push({type:'sub', name:'Invaller Twee', label:'PH'})");
    expect(dom.window.currentBatterName("home", 3)).toBe("Invaller Twee");
  });
});

describe("findCurrentPitcherSlot", () => {
  it("finds the lineup slot currently playing position 1", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal");
    const awayLineup = evalIn(dom, "G.away.lineup");
    const pitcherSlot = awayLineup.findIndex((p) => p.pos === 1);
    expect(dom.window.findCurrentPitcherSlot("away")).toBe(pitcherSlot);
  });

  it("follows a pitching change to the new slot", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal");
    const originalSlot = dom.window.findCurrentPitcherSlot("away");
    const newSlot = (originalSlot + 1) % 9;
    evalIn(dom, `G.slotEvents.away[${originalSlot}].push({type:'pos', pos:9})`);
    evalIn(dom, `G.slotEvents.away[${newSlot}].push({type:'pos', pos:1})`);
    expect(dom.window.findCurrentPitcherSlot("away")).toBe(newSlot);
  });

  it("returns null when nobody currently plays position 1", () => {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal");
    const originalSlot = dom.window.findCurrentPitcherSlot("away");
    evalIn(dom, `G.slotEvents.away[${originalSlot}].push({type:'pos', pos:9})`);
    expect(dom.window.findCurrentPitcherSlot("away")).toBeNull();
  });
});
