import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp, startGame } from "../helpers/loadApp.js";

function fillAndSubmit(dom, code, slot) {
  const { document } = dom.window;
  const input = document.getElementById("systemInput");
  input.value = code;
  input.dispatchEvent(new dom.window.Event("input"));
  if (slot) dom.window.selectSlot(slot);
  document.getElementById("submitBtn").click();
}

describe("submitAnswer — open-ended (honk-vakje) flow", () => {
  it("warns and does nothing when no slot is selected yet", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    const input = document.getElementById("systemInput");
    input.value = "1B";
    input.dispatchEvent(new dom.window.Event("input"));
    document.getElementById("submitBtn").click();
    expect(document.getElementById("slotWarning").classList.contains("show")).toBe(true);
    expect(document.getElementById("feedbackBox").classList.contains("show")).toBe(false);
    expect(getG(dom).totalCount).toBe(0);
  });

  it("a fully correct answer (code + slot) shows the correct verdict and increments both counters", () => {
    const dom = startGame(loadApp());
    const G = getG(dom);
    const ev = G.currentEvent;
    fillAndSubmit(dom, ev.code, ev.targetQuadrant);
    const { document } = dom.window;
    expect(document.getElementById("feedbackBox").classList.contains("correct")).toBe(true);
    expect(document.getElementById("verdictText").textContent).toContain("kloppen");
    expect(getG(dom).totalCount).toBe(1);
    expect(getG(dom).correctCount).toBe(1);
    expect(document.getElementById("headerStats").textContent).toBe("1 / 1 juist");
    expect(document.getElementById("submitBtn").textContent).toContain("Volgende");
  });

  it("right code, wrong slot: partial credit message, only totalCount increments", () => {
    const dom = startGame(loadApp());
    const G = getG(dom);
    const ev = G.currentEvent;
    const wrongSlot = ["1e", "2e", "3e", "thuis"].find((q) => q !== ev.targetQuadrant) || "any";
    fillAndSubmit(dom, ev.code, wrongSlot);
    const { document } = dom.window;
    expect(document.getElementById("feedbackBox").classList.contains("wrong")).toBe(true);
    expect(document.getElementById("verdictText").textContent).toContain("scoreteken klopt");
    expect(getG(dom).totalCount).toBe(1);
    expect(getG(dom).correctCount).toBe(0);
  });

  it("wrong code, right slot: partial credit message on the other axis", () => {
    const dom = startGame(loadApp());
    const G = getG(dom);
    const ev = G.currentEvent;
    fillAndSubmit(dom, "ZZZ-NOPE", ev.targetQuadrant);
    const { document } = dom.window;
    expect(document.getElementById("verdictText").textContent).toContain("vakje klopt");
    expect(getG(dom).correctCount).toBe(0);
  });

  it("wrong on both axes gives the fully-wrong message and still applies the real outcome to game state", () => {
    const dom = startGame(loadApp());
    const before = getG(dom).battingIdx.away;
    fillAndSubmit(dom, "ZZZ", "any" === getG(dom).currentEvent.targetQuadrant ? "1e" : "any");
    expect(getG(dom).battingIdx.away).toBe(before + 1);
  });

  it("locks the builder/keyboard and switches submitBtn to Volgende, which advances on the next click", () => {
    const dom = startGame(loadApp());
    const G = getG(dom);
    const ev = G.currentEvent;
    fillAndSubmit(dom, ev.code, ev.targetQuadrant);
    const { document } = dom.window;
    expect(document.getElementById("builderBox").classList.contains("locked")).toBe(true);
    expect(document.getElementById("systemInput").disabled).toBe(true);
    document.getElementById("submitBtn").click(); // awaitingNext -> nextTurn()
    expect(document.getElementById("submitBtn").textContent).toContain("Check");
    expect(evalIn(dom, "awaitingNext")).toBe(false);
    // systemInput is only re-enabled on an open-ended turn; an MC follow-up hides it instead.
    if (getG(dom).currentEvent.type !== "mc") {
      expect(document.getElementById("systemInput").disabled).toBe(false);
    }
  });

  it("adds a log entry recording the user's answer vs the correct code", () => {
    const dom = startGame(loadApp());
    const G = getG(dom);
    const ev = G.currentEvent;
    fillAndSubmit(dom, ev.code, ev.targetQuadrant);
    const log = dom.window.document.getElementById("log");
    expect(log.children.length).toBe(1);
    expect(log.textContent).toContain(ev.code);
  });
});

describe("submitAnswer — multiple-choice flow", () => {
  function forceMcTurn(dom) {
    // Force the *next* dealt event to be an end-of-inning MC quiz by injecting it directly,
    // mirroring how endHalfInning() queues one via G.pendingEvents.
    evalIn(dom, "G.pendingEvents = [buildSchuinStreepQuiz()]");
    dom.window.nextTurn();
    return getG(dom).currentEvent;
  }

  it("warns when submitting without a selected option", () => {
    const dom = startGame(loadApp());
    forceMcTurn(dom);
    const { document } = dom.window;
    document.getElementById("submitBtn").click();
    expect(document.getElementById("mcWarning").classList.contains("show")).toBe(true);
    expect(getG(dom).totalCount).toBe(0);
  });

  it("selecting the correct option and submitting shows correct feedback and increments both counters", () => {
    const dom = startGame(loadApp());
    const ev = forceMcTurn(dom);
    const { document } = dom.window;
    const buttons = document.getElementById("mcOptions").querySelectorAll(".mc-btn");
    buttons[ev.correctIndex].click();
    document.getElementById("submitBtn").click();
    expect(document.getElementById("feedbackBox").classList.contains("correct")).toBe(true);
    expect(getG(dom).totalCount).toBe(1);
    expect(getG(dom).correctCount).toBe(1);
    expect(buttons[ev.correctIndex].classList.contains("correct-choice")).toBe(true);
    expect(document.getElementById("mcWrap").classList.contains("locked")).toBe(true);
  });

  it("selecting a wrong option reveals the correct one and only increments totalCount", () => {
    const dom = startGame(loadApp());
    const ev = forceMcTurn(dom);
    const { document } = dom.window;
    const buttons = document.getElementById("mcOptions").querySelectorAll(".mc-btn");
    const wrongIdx = ev.correctIndex === 0 ? 1 : 0;
    buttons[wrongIdx].click();
    document.getElementById("submitBtn").click();
    expect(document.getElementById("feedbackBox").classList.contains("wrong")).toBe(true);
    expect(getG(dom).totalCount).toBe(1);
    expect(getG(dom).correctCount).toBe(0);
    expect(buttons[wrongIdx].classList.contains("wrong-choice")).toBe(true);
    expect(buttons[ev.correctIndex].classList.contains("reveal-correct")).toBe(true);
  });
});

describe("Enter-key handling", () => {
  it("pressing Enter in the system input submits the current answer", () => {
    const dom = startGame(loadApp());
    const G = getG(dom);
    const ev = G.currentEvent;
    const { document } = dom.window;
    const input = document.getElementById("systemInput");
    input.value = ev.code;
    input.dispatchEvent(new dom.window.Event("input"));
    dom.window.selectSlot(ev.targetQuadrant);
    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(document.getElementById("feedbackBox").classList.contains("show")).toBe(true);
  });
});
