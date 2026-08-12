import { describe, expect, it } from "vitest";
import { loadApp } from "../helpers/loadApp.js";

describe("normalize", () => {
  it("uppercases and strips whitespace/hyphen/exclamation formatting characters", () => {
    const { window } = loadApp();
    expect(window.normalize("1b")).toBe("1B");
    expect(window.normalize(" 6-4-3 ")).toBe("643");
    expect(window.normalize("f-9!")).toBe("F9");
    expect(window.normalize("")).toBe("");
    expect(window.normalize(null)).toBe("");
    expect(window.normalize(undefined)).toBe("");
  });

  it("keeps parentheses (meaningful out-circle notation)", () => {
    const { window } = loadApp();
    expect(window.normalize("(f8)")).toBe("(F8)");
  });

  it("no longer silently drops other stray punctuation like commas", () => {
    // Regression: normalize() used to strip *any* non-alphanumeric character, so a stray comma
    // (or semicolon, slash, ...) the scorer typed by mistake would silently vanish and the answer
    // would be marked correct anyway. Only whitespace and the "-"/"!" formatting characters are
    // still silently ignored; anything else stays in and causes a mismatch.
    const { window } = loadApp();
    expect(window.normalize(",F8")).toBe(",F8");
    expect(window.normalize("F8,")).toBe("F8,");
    expect(window.normalize("F,8")).toBe("F,8");
  });
});

describe("checkAnswer", () => {
  it("matches regardless of case and punctuation", () => {
    const { window } = loadApp();
    const ev = { code: "6-4-3" };
    expect(window.checkAnswer("643", ev)).toBe(true);
    expect(window.checkAnswer("6 4 3", ev)).toBe(true);
    expect(window.checkAnswer("6-4-3", ev)).toBe(true);
    expect(window.checkAnswer("643 ", ev)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const { window } = loadApp();
    expect(window.checkAnswer("1B", { code: "2B" })).toBe(false);
    expect(window.checkAnswer("", { code: "K" })).toBe(false);
  });

  it("no longer accepts a stray comma before/after/inside an otherwise-correct code", () => {
    // Regression: the report's concrete example — a comma the scorer typed by mistake used to be
    // silently stripped by normalize() and the answer marked correct anyway.
    const { window } = loadApp();
    const ev = { code: "F8", targetQuadrant: "any" };
    expect(window.checkAnswer(",F8", ev)).toBe(false);
    expect(window.checkAnswer("F8,", ev)).toBe(false);
    expect(window.checkAnswer("F,8", ev)).toBe(false);
  });

  it("still silently ignores whitespace and newlines", () => {
    const { window } = loadApp();
    expect(window.checkAnswer("F8\n", { code: "F8" })).toBe(true);
    expect(window.checkAnswer(" F8 ", { code: "F8" })).toBe(true);
  });

  it("accepts a well-formed, self-drawn circle around a free-space ('any' quadrant) out code", () => {
    // "voor gevangen flyball door middenvelder is f8 en (f8) allebei goed" — the scorer circles
    // every out themselves on paper, including the general batter-out box, which ev.code never
    // auto-wraps (see wrapOut()'s own comment).
    const { window } = loadApp();
    const ev = { code: "F8", targetQuadrant: "any" };
    expect(window.checkAnswer("f8", ev)).toBe(true);
    expect(window.checkAnswer("(f8)", ev)).toBe(true);
  });

  it("rejects garbled parentheses around a free-space out code", () => {
    const { window } = loadApp();
    const ev = { code: "F8", targetQuadrant: "any" };
    expect(window.checkAnswer(")(()f8", ev)).toBe(false);
  });

  it("does not extend the self-drawn-circle leniency to a quadrant-specific out (already auto-wrapped by ev.code)", () => {
    const { window } = loadApp();
    const ev = { code: "(CS24)", targetQuadrant: "2e" };
    expect(window.checkAnswer("(CS24)", ev)).toBe(true);
    // typing the parens *again* around an already-wrapped code should not also match
    expect(window.checkAnswer("((CS24))", ev)).toBe(false);
  });
});

describe("buildVerdictText / buildQuadrantMsg", () => {
  // Shared by submitAnswer() (the real check) and the help screen's live worked example
  // (renderHelpExamples()) — a single source of truth, so the feedback wording the scorer
  // actually sees can never drift out of sync with what the help page shows as a sample.
  const ev = { code: "1B", refs: ["Honkslagen, p.9"] };

  it("fully correct", () => {
    const { window } = loadApp();
    expect(window.buildVerdictText(true, true, ev, "1e")).toBe("✓ Correct, teken én vakje kloppen!");
  });

  it("right code, wrong slot", () => {
    const { window } = loadApp();
    expect(window.buildVerdictText(true, false, ev, "2e")).toContain("Juiste vakje: 2e honk");
  });

  it("wrong code, right slot", () => {
    const { window } = loadApp();
    expect(window.buildVerdictText(false, true, ev, "1e")).toContain("Juiste code: 1B");
  });

  it("both wrong", () => {
    const { window } = loadApp();
    const text = window.buildVerdictText(false, false, ev, "1e");
    expect(text).toContain("Juiste code: 1B");
    expect(text).toContain("juiste vakje: 1e honk");
  });

  it("quadrant message notes a scored run when the event scores", () => {
    const { window } = loadApp();
    expect(window.buildQuadrantMsg({ scoresRun: true }, "thuis")).toContain("gescoorde punt");
    expect(window.buildQuadrantMsg({ scoresRun: false }, "1e")).not.toContain("gescoorde punt");
  });
});
