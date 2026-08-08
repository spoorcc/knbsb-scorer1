# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file web app that drills users on **KNBSB "Scorer 1"** scorekeeping
notation for baseball (honkbal) and softball (softbal). It simulates a
practice match between two fixed teams ("Honkvast" vs. "Bal op het dak"),
presents a play-by-play situation in Dutch, and has the user build the
correct scorecard notation (e.g. `1B`, `BB`, `6-3`, `FC1`) using an on-screen
"honkvakje" (base-cell) builder or a virtual keyboard, then checks it against
the expected code. All UI text, narrative, and terminology are in Dutch,
matching the official KNBSB course material.

## Repository structure

- `index.html` — the entire application: CSS in a `<style>` block, markup in
  `<body>`, and all game logic in a single inline `<script>` block (~2,200
  lines of vanilla JS, no framework, no external JS dependencies other than
  Google Fonts). **This is the only source file that ships** — everything
  else in the repo is dev tooling (tests, linters) around it.
- `tests/` — the Vitest suite (see "Testing" below).
- `scripts/extract-inline-script.mjs` — pulls the inline `<script>` out of
  `index.html` so ESLint has a real `.js` file to lint (see "Linting").
- `.github/workflows/pages.yml` — deploys the repo root straight to GitHub
  Pages on every push to `main` (no build step; `index.html` is served as-is,
  `node_modules`/dev tooling included in the repo don't affect the deployed
  site since that job never runs `npm install`).
- `.github/workflows/ci.yml` — runs `npm run lint` and `npm test` on every
  push to `main` and on every pull request.
- `LICENSE` — CC BY-SA 4.0.

## Commands

Run once: `npm install`.

- `npm test` — run the full Vitest suite once.
- `npm run test:watch` — Vitest in watch mode.
- `npm run test:coverage` — Vitest with a coverage report (coverage % is only
  meaningful for `tests/helpers/**`; see the comment in `vitest.config.js`
  for why `index.html` itself can't be instrumented).
- `npm run lint` — ESLint (inline script) + Stylelint (inline CSS) + HTMLHint
  (markup), in that order.
- `npm run verify` — lint, then test; run this before considering any change
  to `index.html` done.

To run a single test file: `npx vitest run tests/events/batter-events.test.js`.
To run tests matching a name: `npx vitest run -t "buildBatterEvent"`.

**Always run `npm run verify` after editing `index.html`.** There is no other
safety net — the app has no build step and no type checker, so the test
suite and linters are the only automated check that a change didn't break
game logic, scorecard bookkeeping, or markup/CSS validity.

## Testing

`tests/helpers/loadApp.js` loads the *real* `index.html` into a JSDOM
instance with `runScripts: "dangerously"` and executes its inline `<script>`
exactly as a browser would — no extraction, no mocking of the app's own
functions. Top-level `function` declarations in that script (`initGame`,
`hitAdvance`, `checkAnswer`, `applyEventToState`, ...) end up as real
properties on `window` and are called directly from tests. Top-level
`let`/`const` data (the mutable game state `G`, the app's own `rng`, team
rosters, button config) are *not* global properties — that's normal JS
scoping, not a test limitation — so `evalIn(dom, expr)` / `getG(dom)` read
them back via `window.eval`, which runs in the same script realm.

Determinism: the app seeds its own PRNG (`rng`, a mulberry32 implementation)
from a `matchNumber` — the same mechanism that powers its shareable-match-link
feature (`?innings=&sport=&wedstrijd=`). Tests lean on this instead of
stubbing `Math.random`: `startGame(dom, {innings, sport, matchNumber})` /
`initGame(dom, {..., matchNumber})` produce a fully reproducible game. For
tests that need to force a specific branch inside a single `buildXEvent()`
call, use `stubRngConstant`/`stubRngSequence`/`randomForPickIndex` from the
same helper file rather than re-seeding.

Test layout mirrors the engine's own layers:

- `tests/unit/` — pure functions (`hitAdvance`, `forcedWalk`,
  `advanceAllByOne`, `normalize`/`checkAnswer`, `weightedPick`/`pick`,
  lineup helpers, rendering-string helpers).
- `tests/state/` — `initGame`, `applyEventToState`, `endHalfInning`.
- `tests/events/` — `buildBatterEvent`/`buildRunnerEvent` for every scoring
  key, the multiple-choice quiz builders, and `generateEvent` fuzzing.
- `tests/ui/` — DOM wiring: setup screen, the honk-vakje builder, the
  open-ended and multiple-choice submit flows, keyboard toggling, debug
  export.
- `tests/rendering/` — scoreboard/field/scorecard DOM output.
- `tests/integration/` — plays complete games through the real UI (button
  clicks, not internal function calls) and checks invariants: scores never
  regress, per-inning run totals sum to the final score, and — the
  scorecard's defining rule — **the total count of "scored" dots on the
  scoreform must equal the final combined score**. `known-issues.test.js`
  documents one confirmed, deliberately-not-fixed exception to that last
  invariant (see below); don't "fix" that test's assertions without
  actually fixing the underlying scorecard bug.

## Linting

ESLint has no first-party way to lint a `<script>` embedded in an HTML file,
so `npm run lint:js` first runs `scripts/extract-inline-script.mjs` (pulls
the script into `lint-artifacts/index.inline.js`, gitignored) and then lints
that. If you add a *second* `<script>` block to `index.html`, that extractor
will throw — it asserts there's exactly one.

Stylelint targets `index.html` directly via `postcss-html` (`.stylelintrc.json`)
using `stylelint-config-recommended` (correctness rules only, not the
opinionated stylistic rule set — this app's CSS predates and doesn't follow
those conventions, and reformatting it wholesale isn't worth the diff).

## Architecture (all inside `index.html`'s `<script>`)

The app is a state machine driven by a single global game-state object `G`,
created by `initGame(maxInnings, sport, matchNumber)`. `matchNumber` seeds
`rng` (via `seedRng()`/`mulberry32`) — the same match number always replays
the exact same game, which is both the shareable-link feature and the app's
own debugging tool (a real match number can be pasted into `?wedstrijd=` to
reproduce a bug report exactly).

Key parts of `G`: `inning`/`half`, `outs`, `bases` (array of 3
runner-or-null slots), `score`, `battingIdx` (per team), `scorecard`
(per-team, per-lineup-slot, per-inning notation grid — see the known
limitation below), `slotEvents` (substitutions/position/pitcher changes per
lineup slot), `stintColor`/`boatMarkers`/`subMarkers`/`fieldSubMarkers`
(visual bookkeeping for pitcher-change color-coding and substitution
markers on the printed scoreform), and `pendingEvents` (the queue of
situations still to be presented — see "deferred events" below).

Data flow for one "turn":

1. **Event generation** — `generateEvent()` picks either a batter event
   (`generateBatterEvent()` → `buildBatterEvent()`) or, if runners are on
   base, a runner-advancement/pinch-runner/pitcher-change event
   (`generateRunnerEvent()`, `buildPinchRunnerQuizEvent()`, etc.), using
   weighted random pools (`weightedPick`) so common plays (hits, strikeouts,
   groundouts) appear more often than rare ones (interference, illegal
   pitch). Each event carries a Dutch `narrative`, the correct `code`, and a
   `targetQuadrant` (which cell of the honk-vakje the code belongs in: `1e`,
   `2e`, `3e`, `thuis`, or `any` for outs).
2. **Rendering** — `renderField()`, `renderScoreboard()`, `renderBuilder()`,
   `renderFullScorecard()` reflect `G` and the in-progress answer into the
   DOM. The "honk-vakje" builder UI (the four-quadrant base cell) is the
   signature widget; `selectSlot()` / `appendToken()` build up the user's
   code string quadrant by quadrant.
3. **Checking** — `submitAnswer()` compares the user's string against
   `ev.code` via `checkAnswer()`/`normalize()` (case/punctuation-insensitive
   match), shows correct/incorrect feedback with a rules reference
   (`ev.refs`/`ev.explain`), then calls `applyEventToState(ev)` to mutate
   `G` regardless of whether the user answered correctly (the *simulated*
   game always proceeds on the real outcome; only `correctCount`/
   `totalCount` reflect the user's performance).
4. **Scorecard commit** — `commitToScorecard()` writes the confirmed
   notation into `G.scorecard[team][lineupSlot][inning]`, which
   `renderFullScorecard()` later renders as the authentic paper-style KNBSB
   scoreform at the bottom of the page (black/white/gray, distinct from the
   rest of the app's federation color theme).

### Deferred events

A single play often needs more than one question. `applyEventToState` can
push follow-up events onto `G.pendingEvents` — e.g. a 1B that also drives a
runner home queues a separate "credit" question for that runner
(`buildAdvanceCreditEvent`), a fielder's-choice/double-play queues a
follow-up for the forced-out runner (`buildForcedOutFollowUpEvent`), an
extra-base error queues a "pijltje" follow-up. `nextTurn()` always drains
`G.pendingEvents` before calling `generateEvent()` for a fresh play. Ordering
matters: events belonging to the *same* runner/person are queued before
other runners' follow-ups from the same play (see the comment above the
`extraBaseErrorCode` push in `applyEventToState`) — this was a real bug
class in earlier iterations and is worth preserving when touching that code.

Base-advancement logic (`hitAdvance`, `forcedWalk`, `advanceAllByOne`) is
otherwise pure: given old base state + how far the batter/runners move, it
returns new `bases`, `runs` scored, and an `advanced` list.
`applyEventToState` is the only place that mutates `G` from these results.
Note `hitAdvance` calls `rng()` itself for one specific judgment call (an
unforced runner on 2nd taking the extra base on a single) — it is not
purely a function of its arguments.

The scoring vocabulary (code buttons like `1B`/`BB`/`K`/`FC`/`SB`/`WP`, and
fielding positions `1`–`9`) is defined near the bottom of the script in
`REACH_BUTTONS`, `OUT_BUTTONS`, `SPECIAL_BUTTONS`, `RUNNER_BUTTONS`,
`EXTRA_BUTTONS`, and `POS_SHORT`/`POS_NAMES` — extend these (plus the
corresponding `case` in `buildBatterEvent`/`buildRunnerEvent`, plus tests in
`tests/events/`) when adding a new scoring situation.

### Known limitation (tracked, not fixed)

`G.scorecard[teamKey][battingSlot][inning]` is keyed only by lineup slot +
inning, which assumes a player bats at most once per inning. In a big inning
(batting around the order), the same slot can bat twice; the second at-bat's
`commitToScorecard` call merges into the same cell as the first, which can
under-report the scorecard's "scored dot count == final score" invariant.
Confirmed repro: `matchNumber="100002"`, 3 innings, Honkbal — pinned down in
`tests/integration/known-issues.test.js`. Fixing it means giving each cell an
at-bat index in addition to slot+inning, plus updating `renderFullScorecard`
to display multiple at-bats in one inning cell — out of scope for casual
changes; coordinate before touching `commitToScorecard`'s keying.
