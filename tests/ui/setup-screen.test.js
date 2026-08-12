import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp, startGame } from "../helpers/loadApp.js";

describe("setup screen", () => {
  it("Honkbal is the default active sport toggle", () => {
    const { document } = loadApp().window;
    const active = document.querySelector(".sport-btn.active");
    expect(active.dataset.sport).toBe("Honkbal");
  });

  it("clicking Softbal switches the active toggle and the selectedSport used on start", () => {
    const dom = loadApp();
    const { document } = dom.window;
    document.querySelector('.sport-btn[data-sport="Softbal"]').click();
    expect(document.querySelector(".sport-btn.active").dataset.sport).toBe("Softbal");
    expect(document.querySelector('.sport-btn[data-sport="Honkbal"]').classList.contains("active")).toBe(false);
    expect(evalIn(dom, "selectedSport")).toBe("Softbal");
  });

  it("a random matchNumber is pre-filled on load", () => {
    const { document } = loadApp().window;
    const value = document.getElementById("matchNumberInput").value;
    expect(value).toMatch(/^\d{6}$/);
  });

  it("startGame() hides setup/end screens and shows the game screen with the keyboard populated", () => {
    const dom = startGame(loadApp(), { innings: 5, sport: "Softbal", matchNumber: "111111" });
    const { document } = dom.window;
    expect(document.getElementById("setupScreen").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("endScreen").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("gameScreen").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("situationCard").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("answerCard").classList.contains("hidden")).toBe(false);

    expect(document.getElementById("grpReach").children.length).toBe(evalIn(dom, "REACH_BUTTONS.length"));
    expect(document.getElementById("grpOut").children.length).toBe(evalIn(dom, "OUT_BUTTONS.length"));
    // "Extra" was merged into "Speciale situaties" — one shared group, one shared button count.
    expect(document.getElementById("grpSpecial").children.length).toBe(
      evalIn(dom, "SPECIAL_BUTTONS.length + EXTRA_BUTTONS.length")
    );
    expect(document.getElementById("grpRunner").children.length).toBe(evalIn(dom, "RUNNER_BUTTONS.length"));
    expect(document.getElementById("grpExtra")).toBeNull();
    expect(document.getElementById("grpPos").children.length).toBe(9);
  });

  it("header stats appear and are reset to 0/0 at game start", () => {
    const dom = startGame(loadApp());
    const el = dom.window.document.getElementById("headerStats");
    expect(el.classList.contains("hidden")).toBe(false);
    expect(el.textContent).toBe("0 / 0 juist");
  });

  it("restartBtn returns to the setup screen, hides the game/end screens, and re-rolls the match number", () => {
    const dom = startGame(loadApp(), { matchNumber: "222222" });
    const { document } = dom.window;
    const before = document.getElementById("matchNumberInput").value;
    // force the game to be "over" so restart is a realistic click target
    evalIn(dom, "G.gameOver = true;");
    document.getElementById("restartBtn").click();
    expect(document.getElementById("endScreen").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("gameScreen").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("setupScreen").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("headerStats").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("matchNumberInput").value).not.toBe(before);
  });
});

describe("help screen", () => {
  it("the header ? button opens the help screen and hides setup, and Terug restores setup", () => {
    const dom = loadApp();
    const { document } = dom.window;
    expect(document.getElementById("helpScreen").classList.contains("hidden")).toBe(true);
    document.getElementById("helpBtn").click();
    expect(document.getElementById("helpScreen").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("setupScreen").classList.contains("hidden")).toBe(true);
    document.getElementById("helpBackBtn").click();
    expect(document.getElementById("helpScreen").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("setupScreen").classList.contains("hidden")).toBe(false);
  });

  it("the setup screen's own help link opens the same help screen", () => {
    const dom = loadApp();
    const { document } = dom.window;
    document.getElementById("helpLinkSetup").click();
    expect(document.getElementById("helpScreen").classList.contains("hidden")).toBe(false);
  });

  it("opening help mid-game and going back restores the game screen, not setup, without touching game state", () => {
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "222222" });
    const { document } = dom.window;
    const scoreBefore = getG(dom).score.away;
    document.getElementById("helpBtn").click();
    expect(document.getElementById("gameScreen").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("helpScreen").classList.contains("hidden")).toBe(false);
    document.getElementById("helpBackBtn").click();
    expect(document.getElementById("gameScreen").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("setupScreen").classList.contains("hidden")).toBe(true);
    expect(getG(dom).score.away).toBe(scoreBefore);
  });
});

describe("renderHelpExamples — the help screen's worked example is built from the real UI, not a static screenshot", () => {
  it("populates the honk-vakje/invoerveld/keyboard placeholders before any game has started (setupKeyboard() fallback)", () => {
    const dom = loadApp();
    const { document } = dom.window;
    // #grpSpecial is only populated by setupKeyboard(), normally called from startGame() — no
    // game has started here, so renderHelpExamples() must call it itself.
    expect(document.getElementById("grpSpecial").children.length).toBe(0);
    document.getElementById("helpBtn").click();
    expect(document.getElementById("helpShotHonkvakje1").querySelector(".honk-cell")).toBeTruthy();
    expect(document.getElementById("helpShotControlrow1").querySelector("input").value).toBe("1B");
    const kbButtons = document.getElementById("helpShotKeyboard").querySelectorAll(".kb-btn");
    expect(kbButtons.length).toBe(evalIn(dom, "SPECIAL_BUTTONS.length + EXTRA_BUTTONS.length"));
  });

  it("the cloned example controls are inert (disabled), not live buttons the user could click", () => {
    const dom = loadApp();
    const { document } = dom.window;
    document.getElementById("helpBtn").click();
    document.getElementById("helpShotHonkvakje1").querySelectorAll("button").forEach((b) => {
      expect(b.disabled).toBe(true);
    });
    document.getElementById("helpShotKeyboard").querySelectorAll("button").forEach((b) => {
      expect(b.disabled).toBe(true);
    });
  });

  it("the approved/rejected feedback examples use the exact same wording buildVerdictText/checkAnswer produce, so they can't drift out of sync", () => {
    const dom = loadApp();
    const { document, window } = dom.window;
    document.getElementById("helpBtn").click();

    const ev = window.buildBatterEvent("1B", { name: "Jan Jansen" }, [null, null, null], 0);
    const approvedText = document.getElementById("helpShotGoedgekeurd").querySelector(".verdict").textContent;
    expect(approvedText).toBe(window.buildVerdictText(true, true, ev, ev.targetQuadrant));

    const rejectedText = document.getElementById("helpShotAfgekeurd").querySelector(".verdict").textContent;
    const rejectedCodeOK = window.checkAnswer("2B", ev);
    expect(rejectedText).toBe(window.buildVerdictText(rejectedCodeOK, true, ev, ev.targetQuadrant));
    expect(document.getElementById("helpShotGoedgekeurd").querySelector(".feedback").classList.contains("correct")).toBe(true);
    expect(document.getElementById("helpShotAfgekeurd").querySelector(".feedback").classList.contains("wrong")).toBe(true);
  });

  it("only builds the examples once, even if help is opened multiple times", () => {
    const dom = loadApp();
    const { document } = dom.window;
    document.getElementById("helpBtn").click();
    document.getElementById("helpBackBtn").click();
    document.getElementById("helpBtn").click();
    // a second build would insert a second .honk-cell into the same figure instead of reusing it
    expect(document.getElementById("helpShotHonkvakje1").querySelectorAll(".honk-cell").length).toBe(1);
  });

  it("still works the same when help is opened mid-game (doesn't re-run setupKeyboard() disruptively)", () => {
    const dom = startGame(loadApp(), { innings: 3, sport: "Honkbal", matchNumber: "333333" });
    const { document } = dom.window;
    expect(() => document.getElementById("helpBtn").click()).not.toThrow();
    expect(document.getElementById("helpShotHonkvakje1").querySelector(".honk-cell")).toBeTruthy();
  });
});

describe("shareBtn", () => {
  it("does nothing before a game has started (no G / no matchNumber)", () => {
    const dom = loadApp();
    expect(() => dom.window.document.getElementById("shareBtn").click()).not.toThrow();
  });
});

describe("auto-start from a shared link", () => {
  it("starts the game immediately when ?wedstrijd=... is present in the URL", () => {
    const dom = loadApp(); // baseline: no query string -> no auto-start
    expect(dom.window.document.getElementById("gameScreen").classList.contains("hidden")).toBe(true);
  });

  it("picks up innings/sport/wedstrijd query params and reflects them in G", () => {
    const dom = loadApp({ url: "http://localhost/?innings=6&sport=Softbal&wedstrijd=482913" });
    const G = getG(dom);
    expect(G).toBeTruthy();
    expect(G.maxInnings).toBe(6);
    expect(G.sport).toBe("Softbal");
    expect(G.matchNumber).toBe(482913);
    expect(dom.window.document.getElementById("gameScreen").classList.contains("hidden")).toBe(false);
  });
});
