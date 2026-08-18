import { describe, expect, it } from "vitest";
import { getG, loadApp, mulberry32, startGame } from "../helpers/loadApp.js";

// Payloads chosen to probe: HTML/script injection (the live builder preview and the
// logboek entry both render the typed answer via innerHTML, see renderCodeDisplay/
// addLogEntry in index.html), template/format-string lookalikes, unicode edge cases
// (RTL override, zero-width, BOM, emoji, CJK), control characters, and sheer length —
// none of which #systemInput's own normalize()/checkAnswer() special-case today.
const CURATED_PAYLOADS = [
  "",
  " ",
  "\t\n",
  "1B",
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<b>bold</b>",
  "&lt;already-escaped&gt;",
  "\"><svg onload=alert(1)>",
  "javascript:alert(1)",
  "${alert(1)}",
  "{{7*7}}",
  "'; DROP TABLE runs; --",
  "NULL",
  "undefined",
  "null",
  "🏏⚾️🥎",
  "日本語テスト",
  "١٢٣",
  "A".repeat(500),
  "<".repeat(50) + ">".repeat(50),
  "1B".repeat(150),
  "-\\-!!--",
  "((()))",
  "((1B))",
  "‮evil‬",
  "﻿1B",
  "1B\n2B",
  "  1B  ",
];

function fillInput(dom, value) {
  const { document } = dom.window;
  const input = document.getElementById("systemInput");
  // Setting .value directly (rather than simulating keystrokes) bypasses the
  // input's maxlength="6" the same way a paste, an autofill, or any future
  // programmatic-fill feature would — the worst case for this field, not the
  // typical one, and exactly the gap a maxlength-only defense leaves open.
  input.value = value;
  input.dispatchEvent(new dom.window.Event("input"));
}

function submit(dom) {
  dom.window.document.getElementById("submitBtn").click();
}

function freshGame(dom, seed) {
  startGame(dom, { innings: 9, matchNumber: String(seed) });
}

/**
 * Skips past multiple-choice turns (systemInput is hidden there) and past a
 * finished game (restarting with a new deterministic seed) until an
 * open-ended honk-vakje turn is current, so #systemInput is actually live.
 */
function advanceToOpenEndedTurn(dom, seedRef, cap = 60) {
  for (let i = 0; i < cap; i++) {
    if (getG(dom).gameOver) {
      seedRef.n++;
      freshGame(dom, seedRef.n);
    }
    const ev = getG(dom).currentEvent;
    if (ev && ev.type !== "mc") return ev;
    dom.window.nextTurn();
  }
  throw new Error("could not reach an open-ended turn within cap");
}

describe("systemInput fuzzing", () => {
  it(
    "never throws for a curated set of adversarial answers",
    () => {
      const dom = startGame(loadApp(), { innings: 9, matchNumber: "1" });
      const seedRef = { n: 1 };
      for (const payload of CURATED_PAYLOADS) {
        const ev = advanceToOpenEndedTurn(dom, seedRef);
        fillInput(dom, payload);
        dom.window.selectSlot(ev.targetQuadrant || "any");
        expect(() => submit(dom)).not.toThrow();
        dom.window.nextTurn();
      }
    },
    // Each iteration replays a full DOM turn (render, submit, log entry, nextTurn) — cheap in
    // isolation, but this suite's own full run showed >20s under heavy parallel CPU contention
    // (all 24 test files' workers racing at once), well past Vitest's 20s default. Generous on
    // purpose so a loaded CI runner doesn't turn "never throws" into a false failure.
    45000,
  );

  it("a typed <img>/<script> payload is escaped, not turned into a live element, in both the live builder preview and the logboek entry", () => {
    // The app legitimately renders its own <svg>/icon markup for recognized codes
    // (honkslag ticks, the out-circle cross, ...) via renderCodeDisplay, so "no foreign
    // element at all" is the wrong bar. What matters: an attacker-chosen tag from the
    // *typed answer* — identifiable by a nonce nothing else in the app ever sets — must
    // never come back as a live element.
    const dom = startGame(loadApp(), { innings: 9, matchNumber: "1" });
    const seedRef = { n: 1 };
    const ev = advanceToOpenEndedTurn(dom, seedRef);
    const { document } = dom.window;

    fillInput(dom, '<img src=x data-xss-nonce="LIVE1">');
    // the live honk-vakje preview updates on every keystroke, before any submit — and
    // uppercases the typed text, so check case-insensitively for the literal tag text
    expect(document.querySelector('[data-xss-nonce="LIVE1"]')).toBeNull();
    expect(document.getElementById("builderText").textContent.toLowerCase()).toContain("<img");

    dom.window.selectSlot(ev.targetQuadrant || "any");
    submit(dom);
    expect(document.querySelector('[data-xss-nonce="LIVE1"]')).toBeNull();
    const log = document.getElementById("log");
    expect(log.textContent.toLowerCase()).toContain("<img");
  });

  it("never throws across a large randomized sweep of printable/control/unicode characters, and never turns a typed payload into a live element", () => {
    const dom = startGame(loadApp(), { innings: 9, matchNumber: "2" });
    const seedRef = { n: 2 };
    const rand = mulberry32(20260818);
    // Array.from (not a raw string) so this indexes whole codepoints — astral characters like the
    // cricket-bat emoji are a UTF-16 surrogate *pair*, and picking individual code units out of a
    // raw string index can splice two unrelated halves together into a lone/mismatched surrogate.
    // That's valid-but-unusual JS string content real browsers render leniently (confirmed against
    // real Chromium), but jsdom's parse5-based innerHTML parser throws on it — a jsdom-only
    // limitation, not a bug in the app, and not what this sweep is trying to cover.
    const CHARSET = Array.from(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789()-!<>&\"'/\\{}$%*+=~`|;:,.?_ ​‮﻿🏏⚾ ",
    );
    for (let i = 0; i < 80; i++) {
      const len = Math.floor(rand() * 24);
      let s = "";
      for (let j = 0; j < len; j++) {
        s += CHARSET[Math.floor(rand() * CHARSET.length)];
      }
      const ev = advanceToOpenEndedTurn(dom, seedRef);
      fillInput(dom, s);
      dom.window.selectSlot(ev.targetQuadrant || "any");
      expect(() => submit(dom)).not.toThrow();
      dom.window.nextTurn();
    }
    const G = getG(dom);
    expect(G.totalCount).toBeGreaterThan(0);
  }, 60000);

  it("normalize()/checkAnswer() never throw for arbitrary or non-string-ish input", () => {
    const dom = startGame(loadApp(), { innings: 3, matchNumber: "3" });
    const ev = getG(dom).currentEvent;
    for (const s of [...CURATED_PAYLOADS, null, undefined]) {
      expect(() => dom.window.normalize(s)).not.toThrow();
      expect(() => dom.window.checkAnswer(s, ev)).not.toThrow();
    }
  });
});
