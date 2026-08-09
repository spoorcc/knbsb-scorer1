# Scorer 1 source-material review (Januari 2024 KNBSB "Scorer 1" course PDF)

This is a page-by-page audit of `index.html`'s scoring rules, scoreteken
symbols, narrative descriptions, and `refs:` citations against the official
KNBSB "Scorer 1" course PDF (Januari 2024). Page numbers below are the
PDF's own printed page numbers (footer "N | Pagina"), which line up 1:1
with the `refs:` citations already used in the code (e.g. `p.14` means the
PDF page whose footer reads `14 | Pagina`).

## Reference corrections made in this PR

Two `refs:` citations pointed at the wrong page and have been fixed:

- `buildBatterEvent` case `'E'`, throwing-error variant (`E1T`/`E2T`/…):
  cited **"Error bij het aangooien naar een honk, p.11"**. That heading is
  actually on **page 12** (page 11 ends with "Error bij het 'fielden' van
  de bal"; "Error bij het aangooien naar een honk" is the next heading, at
  the top of page 12). Fixed to `p.12`.
- `buildPinchHitterQuizEvent`: cited only **"De scorekaart, p.7"** (where
  `PH` is first defined as an abbreviation). The actual annotation
  convention quizzed here — writing the sub's name plus the half-inning
  timing behind it — is explained on **page 20** ("Verandering van
  werper, slagman en veldspeler"), the same section the parallel
  Pinch-Runner event already cites (`p.21`). Added `p.20` alongside `p.7`.

Also corrected the `explain`/quiz-option text for the pitcher-change event
(`buildPitcherChangeQuizEvent`): it previously described writing the bare
position number `1` in the *outgoing* pitcher's own next position box.
That's not what the worked example on p.22/28 (Van Iersel → Van Ispen)
shows, and it's not what the code actually does (`pitcherChange` pushes a
`type:'sub'` entry — a new row below the outgoing pitcher, same mechanism
as a Pinch Hitter — see `applyEventToState` around line 1921). The copy now
says the incoming pitcher gets a **new row** under the outgoing one with
the bare `1` and the timing, matching both the source and the
implementation.

All other `refs:` citations in the file were checked against the PDF's
actual headings/page footers and are correct (Honkslagen p.9; BB/IBB/HP
p.10; Velderskeus p.10; third-strike WP/PB p.11; Fouten p.11–12; Stolen
base p.13; Caught stealing/Obstruction/Wild Pitch p.14; Passed Ball/BalK
p.15; Drie slag/Uit door aangooi p.16; Uit door vangbal/Sacrifice hit p.17;
Sacrifice fly p.18; Pick off/Dubbelspel p.19; Verandering van werper,
slagman en veldspeler p.20–21).

## Confirmed: correctly covered

The following source sections have accurate scoretekens, narrative framing,
and citations, cross-checked example-by-example against the PDF:

- Honkslagen (1B/2B/3B/HR), incl. targeting the right honk-vakje quadrant.
- BB, IBB, HP.
- Velderskeus (FC): all three fielder's-choice geometries (force at 2nd,
  force at 3rd, force at home with bases loaded), *and* the "poging
  mislukt zonder fout" case where the batter still gets FC while the lead
  runner's cell gets the batter's lineup number — matches p.10 precisely.
- Third strike Wild Pitch / Passed Ball (`KWP`/`KPB`), and the "K then
  thrown out at first" combination (`K23`).
- Fouten: fielding error (`E6`), throwing error (`E5T`), dropped fly
  (`E6F`), extra-base error with the follow-up pijltje (`PIJL`), INT vs. OB
  split by sport.
- Uit door aangooi (assisted/unassisted groundouts), Fly/Line
  drive/Foul fly/Infield fly outs (with IF correctly gated on 1st+2nd
  occupied and <2 outs).
- Sacrifice hit and sacrifice fly, including the "error negates the
  sacrifice but the notation stays SH/SF + E" edge case.
- Stolen base, Caught stealing (+ the "would've been out but for an
  error" CS+E case), Obstruction, Pick off.
- Wild Pitch, Passed Ball, BalK/Illegal pitch (sport-specific code).
- Dubbelspel (DP), incl. the connecting-line semantics.
- Verandering van werper/slagman/veldspeler: position swaps between two
  already-listed players, Pinch Hitter, Pinch Runner, pitcher changes
  (bootje + stint-color).
- End-of-half-inning schuine streep.

## Gaps closed in the follow-up PR

Items 1–6 below (originally filed as a to-do list) are now implemented as
real `buildBatterEvent`/`buildRunnerEvent` cases, wired into the weighted
pools in `generateBatterEvent`/`generateRunnerEvent` so they actually turn
up during play, not just as static definitions:

1. **Automatic batter outs (p.18)** — new case `AUTOOUT` (`buildBatterEvent`).
   Picks one of the four p.18 scenarios (onreglementair slaan, geraakt door
   eigen bal, hindert de achtervanger, niet in de juiste slagvolgorde) as
   narrative; the "hindert de achtervanger" variant only appears when a
   runner is actually on base for the catcher to be throwing at. All four
   share the single scoreteken the PDF says Scorer 1 uses for them: a bare
   out credited to the catcher, code `2`.

2. **Automatic runner outs (p.19)** — three of the four remaining scenarios
   (the fifth is intentionally deferred, see below) are now played events:
   - `EVADE1`/`EVADE2` (`buildRunnerEvent`): runner strays outside the
     baseline to dodge a tag between 1st/2nd or 2nd/3rd — bare fielder
     digit, no assist chain, per p.19's "noteer het 'uitgemaakt' voor de
     veldspeler die door de honkloper werd ontweken."
   - `PASS1` (`buildRunnerEvent`, requires 1st+2nd occupied): the trailing
     runner passes his own lead runner and is out; the lead runner is
     unaffected. (The existing abstract MC question on this same rule in
     `buildEndOfInningQuizEvent` was kept as-is — it's still valid
     reinforcement, just no longer the *only* way this scenario appears.)
   - `FCINT` (`buildBatterEvent`, requires 1st occupied): the runner
     interferes with a fielder — batter gets `FC` + the fielder who fielded
     the ball, the runner gets an out credited to the *hindered* fielder
     with no assist chain. Reuses the existing `outRunner` →
     `buildForcedOutFollowUpEvent` deferred-question mechanism that FC/DP
     already use, but see the `buildForcedOutFollowUpEvent` note below —
     its hardcoded refs/explain text didn't fit this scenario, so both are
     now overridable per-call.
   - Still deferred: "te vroeg los" (leaving the base early) — the PDF
     marks this "alleen softbal en honkbal pupillen" (youth divisions
     only), and the app has no division/league concept to gate it on, so
     it's left out rather than force-fit into the general game.

3. **`5E3`-style "error after a good throw" (p.12)** — the `E` case gained
   a fourth variant (`'A'`): a clean assist to first that the first
   baseman then drops, coded as `<thrower>E3` (e.g. `5E3`), distinct from
   the existing fielding-muff/throwing-error/dropped-fly variants.

4. **`OB3`-style obstruction of the batter-runner (p.12)** — new case
   `OBBATTER` (`buildBatterEvent`): a fielder (pitcher or first baseman)
   blocks the batter-runner's path to first without having the ball, code
   `OB1`/`OB3`, free trip to first (same free-base mechanic as `HP`).

5. **`FL` (foul line drive, p.17)** — new case `FL` (`buildBatterEvent`),
   mirroring `FF`: a line drive caught in foul territory, code `FL2`/`FL3`/
   `FL5`.

6. **Stealing/pick-off at third and home** — new `buildRunnerEvent` cases
   `SB3`/`CS3` (steal of home / caught stealing home, the latter unassisted
   by the catcher: code `CS2`) and `PO2`/`PO3` (pickoff at 2nd/3rd, mirroring
   the existing `PO1`).

### `buildForcedOutFollowUpEvent` now accepts overrides

The deferred-question builder for a non-batter runner put out by the same
play (`FC`'s lead-runner-out, `DP`'s companion-out, and now `FCINT`'s
interference-out) used to hardcode `refs:['Velderskeus, p.10', 'Dubbelspel,
p.19']` and one of two fixed `explain` strings, regardless of which of the
three scenarios triggered it — accurate for FC/DP, but wrong for `FCINT`
(there's no assist chain to describe, and "Dubbelspel" doesn't apply). It
now takes optional `customRefs`/`customExplain` parameters (threaded through
`result.outRunner.refs`/`.explain` in `applyEventToState`), defaulting to
the original FC/DP text so those two call sites are unchanged.

## Still open

- **The two secondary "geen fout" exceptions on p.13** — only the
  "langzame verwerking is geen fout" judgment call is quizzed (in
  `buildEndOfInningQuizEvent`). The two adjoining exceptions — an errant
  throw that wouldn't have gotten the runner anyway, and an errant throw
  made while completing a double/triple play — still aren't covered by any
  quiz question. Left for a future pass since both are pure judgment-call
  MC material (no new scoreteken), not blocked by anything in this PR.
- **"Te vroeg los"** (p.19, leaving the base early) — see item 2 above;
  deliberately not implemented because it's scoped to youth divisions the
  app doesn't model.

## Out of scope (correctly not implemented)

- The `PA`–`E` statistics columns and the `Totaal`/`Totaal per inning` run
  tally boxes: the PDF itself says these are out of scope for Scorer 1
  ("Het uitwerken van de kolommen PA tot en met E valt buiten deze
  opleiding", p.5; "De invulling van de andere vakjes wordt behandeld in
  'Scorer 2'", p.8).
- The full Voorbeeldwedstrijd (p.22–26/worked scorecards p.27–28) is a
  narrated end-to-end example for self-study, not a rule to encode as a
  quiz — though it would make a good scripted `matchNumber` integration
  test if the team ever wants one.

## Follow-up: symbol/glyph audit against the actual page renders

The first pass above checked text codes and `refs:` citations, not the
*drawn* scoretekens (honkslag tick-marks, arrow, dot, endmark, bootje). This
pass rendered the actual PDF pages (via PyMuPDF, since `pdftoppm` isn't
installable offline here) and the two fully worked-example scorecards on
p.27–28, and compared them pixel-for-pixel against `index.html`'s CSS and
against a live screenshot of the rendered app (Playwright + the repo's
pre-installed Chromium).

### Fixed in this pass

- **Honkslag mark (1B/2B/3B) stroke direction was inverted.** The source
  draws the base "schuine dikke streep" (p.9) as a diagonal stroke (~20°
  off vertical) with near-horizontal cross-ticks — confirmed at high zoom
  on p.9 and p.20. `index.html`'s `.hs-mark`/`.hs-tick` had this backwards:
  a vertical main stroke with the *ticks* rotated -18°. Swapped the
  rotations (`.hs-mark::before` now `rotate(20deg)`, `.hs-tick` now
  `rotate(-6deg)`) and verified visually via a Playwright screenshot of the
  rendered scorecard — now reads as a diagonal stroke with near-horizontal
  crossbars, matching the source's style.
- **Dubbelspel (double play) codes were wrong.** `buildBatterEvent`'s `DP`
  case gave *both* players the identical full throw chain (e.g. both got
  `643` for a 6-4-3 double play). Two independent dedicated examples in the
  source — p.19 ("64" for the runner / "43" for the batter) and p.20 (an
  unassisted "5" for the runner / "53" for the batter, where there's no
  shared chain at all since the first out involves no throw) — both show
  each player's cell holding *only their own portion* of the chain, up to
  and including their own out, with the two out-circles connected by a
  line to indicate they're one continuous play ("Daarom worden de twee
  nullen met een streep aan elkaar verbonden," p.19). Split the code: the
  forced-out runner now gets `combo[0]+combo[1]` (e.g. `64`), the batter
  gets `combo[1]+combo[2]` (e.g. `43`). `buildForcedOutFollowUpEvent`'s
  hardcoded refs/explain (already made overridable in the previous PR for
  `FCINT`) now carries a DP-specific explanation of the split instead of
  the old "you get the same code as the batter" text.

### Confirmed correct (no change needed)

- **Homerun**: dot at the exact 4-quadrant crosspoint + "HR" text in the
  `thuis` quadrant — matches p.9's image exactly (`.honk-dot` is
  positioned relative to the whole `.honk-cell`, not one quadrant).
- **Pijltje (arrow)**: a plain upward arrow (vertical shaft + triangle
  head) — matches the p.12 "E6 + ↑" example. `.arrow-mark` is correct as-is.
- **Bootje (pitcher change)**: source draws a horizontal bar with both
  ends curved/angled upward (p.21); `.sc-boatmark::before`'s SVG polyline
  (`1,10 20,26 80,26 99,10`) draws the same U-with-upturned-ends shape.
  The red/black "stint color" alternation after the bootje also matches
  p.21's own black-vs-red side-by-side example exactly.
- **Combined out-circles** (e.g. `K23`, `13`, `96`): the source circles the
  *whole* multi-line code as one unit (confirmed at high zoom on p.27's
  "K / 23" cell) — matches `renderScorecardCellHTML`'s single
  `.builder-text.slot-any.out-mark` circle around the full `cell.out` text.
- **"Door de volgende slagman" digit-credit** and **extra-base-error
  E+pijltje placement**: spot-checked several cells in the p.27/28 worked
  example (Van Made's `85`-then-`5` advance, Van Asten's `E6`+arrow
  pattern) against the narrative on p.22–26 — both match the app's
  existing implementation.

### Still open (not fixed here — flagged for a future PR)

- **No visual line connects the two DP out-circles across rows.** The
  *codes* are now split correctly (see above), but the source's connecting
  line between the runner's circle and the batter's circle (crossing
  between two different lineup rows in the same inning column) isn't drawn
  anywhere in `renderFullScorecard`. Doing this generally requires a
  post-render measurement pass (the two rows can be arbitrarily far apart
  if the runner reached base many batters earlier) — bigger scope than a
  CSS tweak, left for its own PR.
- **Pinch-runner "streepje tussen de honken" is taught but never
  rendered.** `buildPinchRunnerQuizEvent`'s quiz text correctly explains
  that a PR substitution gets a short tick mark between the two
  honk-vakje quadrants where the swap happened (p.21), but nothing in
  `applyEventToState`'s `lineupChange` handling or
  `renderScorecardCellHTML` actually draws it in the runner's own cell.
- **Verbindingsstreepje vs. pijltje nuance (lower confidence).** p.12 shows
  two visually different connectors for "same continuous play": a plain
  tick/line when a hit-code and a later error-code are already both
  explicit in adjacent quadrants (the "1B then E8" example — no
  arrowhead), versus the arrow/pijltje when the *entire* advance is
  explained by one error alone with no separate hit code (the "E6 then ↑"
  example, which is what `EEXTRA`/`buildExtraBaseArrowEvent` already model
  correctly). This is based on only one example of each, and the source
  never states the distinction in prose, so it's flagged rather than
  changed — worth a second look before acting on it.
