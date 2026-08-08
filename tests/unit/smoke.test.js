import { describe, expect, it } from "vitest";
import { getG, loadApp, startGame } from "../helpers/loadApp.js";

describe("app harness smoke test", () => {
  it("loads index.html and exposes top-level functions on window", () => {
    const dom = loadApp();
    expect(typeof dom.window.initGame).toBe("function");
    expect(typeof dom.window.hitAdvance).toBe("function");
    expect(typeof dom.window.checkAnswer).toBe("function");
  });

  it("can start a game through the real startGame() entry point, seeded for reproducibility", () => {
    const dom = startGame(loadApp(), { innings: 5, sport: "Softbal", matchNumber: "424242" });
    const G = getG(dom);
    expect(G.maxInnings).toBe(5);
    expect(G.sport).toBe("Softbal");
    expect(G.matchNumber).toBe(424242);
    expect(dom.window.document.getElementById("gameScreen").classList.contains("hidden")).toBe(false);
  });
});
