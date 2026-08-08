# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file, dependency-free web app that drills users on **KNBSB "Scorer 1"**
scorekeeping notation for baseball (honkbal) and softball (softbal). It
simulates a practice match between two fixed teams ("Honkvast" vs. "Bal op
het dak"), presents a play-by-play situation in Dutch, and has the user build
the correct scorecard notation (e.g. `1B`, `BB`, `6-3`, `FC1`) using an
on-screen "honkvakje" (base-cell) builder or a virtual keyboard, then checks
it against the expected code. All UI text, narrative, and terminology are in
Dutch, matching the official KNBSB course material.

## Repository structure

There is no build tooling, package manager, or test suite — everything lives
in one file:

- `index.html` — the entire application: CSS in a `<style>` block, markup in
  `<body>`, and all game logic in a single inline `<script>` block (~1,500
  lines of vanilla JS, no framework, no external JS dependencies other than
  Google Fonts).
- `.github/workflows/pages.yml` — deploys the repo root straight to GitHub
  Pages on every push to `main` (no build step; `index.html` is served as-is).
- `LICENSE` — CC BY-SA 4.0.

## Development workflow

There is no build/lint/test command — this is intentional; treat `index.html`
as the single source of truth.

- **Run locally**: open `index.html` directly in a browser, or serve the
  directory (e.g. `python3 -m http.server`) and visit it. Any static file
  server works since there's no bundling.
- **Verify changes**: reload the page and click through a practice game in
  the browser — there is no automated test suite, so manual verification in
  a browser is the only way to confirm a change works.
- **Deploy**: pushing to `main` triggers `.github/workflows/pages.yml`, which
  publishes the repo root to GitHub Pages unmodified.

## Architecture (all inside `index.html`'s `<script>`)

The app is a state machine driven by a single global game-state object `G`,
created by `initGame(maxInnings, sport)`. Key parts of `G`: `inning`/`half`,
`outs`, `bases` (array of 3 runner-or-null slots), `score`, `battingIdx` (per
team), `scorecard` (per-team, per-lineup-slot, per-inning notation grid),
`slotEvents` (substitutions/position/pitcher changes per lineup slot), and
`pendingEvents`/`history` (the queue of situations still to be presented).

Data flow for one "turn":

1. **Event generation** — `generateEvent()` picks either a batter event
   (`generateBatterEvent()` → `buildBatterEvent()`) or, if runners are on
   base, a runner-advancement/pinch-runner/quiz event
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
   `G` (advance runners, add outs/runs, commit notation into
   `G.scorecard`, and end the half-inning via `endHalfInning()` when
   `G.outs>=3`).
4. **Scorecard commit** — `commitToScorecard()` writes the confirmed
   notation into `G.scorecard[team][lineupSlot][inning]`, which
   `renderFullScorecard()` later renders as the authentic paper-style KNBSB
   scoreform at the bottom of the page (black/white/gray, distinct from the
   rest of the app's federation color theme).

Base-advancement logic (`hitAdvance`, `forcedWalk`, `advanceAllByOne`) is
pure: given old base state + how far the batter/runners move, it returns new
`bases`, `runs` scored, and an `advanced` list — `applyEventToState` is the
only place that mutates `G` from these results. End-of-half/end-of-inning
extra events (pitcher change, position change, pinch hitter, an
end-of-inning quiz) are queued probabilistically in `endHalfInning()` via
`G.pendingEvents`.

The scoring vocabulary (code buttons like `1B`/`BB`/`K`/`FC`/`SB`/`WP`, and
fielding positions `1`–`9`) is defined near the bottom of the script in
`REACH_BUTTONS`, `OUT_BUTTONS`, `SPECIAL_BUTTONS`, `RUNNER_BUTTONS`,
`EXTRA_BUTTONS`, and `POS_SHORT`/`POS_NAMES` — extend these (plus the
corresponding `case` in `buildBatterEvent`/`buildRunnerEvent`) when adding a
new scoring situation.
