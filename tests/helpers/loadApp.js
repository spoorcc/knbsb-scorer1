import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = path.join(__dirname, "..", "..", "index.html");
const html = readFileSync(INDEX_HTML_PATH, "utf8");

/**
 * Loads index.html into a fresh JSDOM instance with the inline <script>
 * executed, exactly as a browser would. Every `function` declared at the
 * top level of that script (initGame, hitAdvance, checkAnswer, ...) ends up
 * as a real property on `window` and can be called directly.
 *
 * Top-level `let`/`const` bindings (the mutable game state `G`, the seeded
 * `rng`, the team rosters, button config, ...) are *not* attached to
 * `window` — that's standard JS, not a testing limitation — so `evalIn`/
 * `getG` below read them back through `window.eval`, which runs in the
 * same script realm and can see that lexical scope.
 */
export function loadApp({ url = "http://localhost/" } = {}) {
  const dom = new JSDOM(html, { runScripts: "dangerously", url });
  return dom;
}

/** Runs `expr` as an indirect eval inside the app's realm and returns the result. */
export function evalIn(dom, expr) {
  return dom.window.eval(expr);
}

/** Convenience accessor for the current game-state object `G`. */
export function getG(dom) {
  return evalIn(dom, "G");
}

/**
 * Starts a game via the real `startGame()` function (same one the Start
 * button calls). Passing an explicit matchNumber seeds the app's own `rng`
 * (mulberry32) deterministically — the app was designed for this
 * (shareable match links), so tests lean on the same mechanism instead of
 * stubbing Math.random.
 */
export function startGame(dom, { innings = 3, sport = "Honkbal", matchNumber = "100000" } = {}) {
  dom.window.startGame(innings, sport, matchNumber);
  return dom;
}

/** Seeds the app's internal rng deterministically without going through the UI. */
export function initGame(dom, { innings = 3, sport = "Honkbal", matchNumber = "100000" } = {}) {
  dom.window.initGame(innings, sport, matchNumber);
  return dom;
}

/** Re-seeds the app's rng (mulberry32) mid-test, e.g. right before a specific call to fuzz. */
export function seedRng(dom, seed) {
  dom.window.seedRng(seed);
}

/** Pins the app's rng to a single constant value (bypassing mulberry32 entirely). */
export function stubRngConstant(dom, value) {
  evalIn(dom, `rng = () => (${value})`);
}

/** Deterministic rng() sequence for the app's realm; cycles once exhausted. */
export function stubRngSequence(dom, values) {
  dom.window.__rngSeq = values;
  dom.window.__rngSeqI = 0;
  evalIn(dom, "rng = () => { const v = window.__rngSeq[window.__rngSeqI % window.__rngSeq.length]; window.__rngSeqI++; return v; }");
}

/**
 * A Math.random()-shaped return value that makes `pick(arr)`
 * (Math.floor(rng()*arr.length)) resolve to `arr[index]` for an array of
 * the given length. Works for both stubRngConstant/stubRngSequence values.
 */
export function randomForPickIndex(index, length) {
  return (index + 0.5) / length;
}

/**
 * A standalone mulberry32 PRNG for the *test's own* randomness (e.g. deciding
 * which turns to answer wrong in a fuzz run) — independent of the app's
 * internal `rng`, so it never perturbs the app's own deterministic sequence.
 * Same algorithm the app itself uses, just not wired into its `rng` binding.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
