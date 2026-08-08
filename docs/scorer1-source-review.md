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

## Not covered — to-do list for a follow-up PR

Everything below is present in the source PDF but has **no** corresponding
quiz/event in `index.html` today (verified via `Grep` across
`buildBatterEvent`/`buildRunnerEvent`/the MC-quiz pools — none of these
codes or scenarios appear anywhere in the file).

1. **Automatic batter outs (p.18, four bullet points)** — none are
   implemented:
   - Onreglementair slaan (batting with a foot outside the box).
   - Slagman geraakt door zijn eigen geslagen bal.
   - Slagman hindert de achtervanger (batter interferes with the catcher
     — batter is called out; this is the mirror image of the *catcher*
     interference already covered by `INT`/`OB`, but for offense-caused
     interference no event exists).
   - Niet in de juiste slagvolgorde aan slag (Scoreregel 9.03.d, batting
     out of order).
   All four are scored the same way (a bare out credited to the catcher,
   per p.18's closing paragraph) and would need a new `buildBatterEvent`
   case (or a small MC-quiz pool, since none involve fielding-position
   variation).

2. **Automatic runner outs (p.19, five bullet points)** — only one
   ("passeert een andere honkloper") is present, and only as an abstract
   multiple-choice question (`buildEndOfInningQuizEvent`), not as a played
   event with scorecard notation. Missing entirely:
   - Honkloper geraakt door een goed geslagen bal (incl. binnenhoog) — note
     the batter *does* get credited with a honkslag in this case.
   - Honkloper wijkt te ver uit om een tik te ontwijken.
   - Honkloper hindert een veldspeler (runner interference — batter gets
     FC, fielder gets the out credit).
   - Honkloper "te vroeg los" (leaving the base early — softbal/honkbal
     pupillen only).

3. **`5E3`-style "error after a good throw" (p.12, "Error na een goed
   aangegooide bal")** — the current `E` event only models the fielder who
   *makes* the bad play (fielding muff `E6`, throwing error `E5T`, dropped
   fly `E6F`). It has no case for a *good* throw that the receiving
   fielder then drops (assist position + `E` + receiving position, e.g.
   `5E3`), which the PDF calls out as its own named example distinct from
   the plain fielding/throwing errors.

4. **`OB3`-style "obstruction against the batter-runner" (p.12,
   "Obstruction tegen de slagman-honkloper")** — only obstruction against
   an *existing* runner (`OB1`→`OB6`, matching the p.14 example) is
   implemented. The batter-runner-specific obstruction example on p.12
   (obstruction by the first baseman while the batter-runner is advancing
   to first) has no equivalent event.

5. **`FL` (foul line drive), p.17** — the source explicitly calls out
   `FL3` as the line-drive counterpart to `FF3` ("Zo ontstaat de combinatie
   FF3 of, bij een line drive, FL3"). The virtual keyboard can *type* `FL`
   (via the separate `F`/`L` buttons) but no event ever generates it as an
   expected answer, so it's untested/unquizzed.

6. **Stealing/pick-off at third base and home** — `generateRunnerEvent`
   only builds `SB1`/`SB2` (steal of 2nd/3rd), `CS1`/`CS2`, and `PO1`
   (pickoff at 1st). Scoreregel 9.07 (Stolen base / Caught stealing, p.13–
   14) is general and covers stealing home too; there's no `SB3`/`CS3`
   ("uit/gestolen bij thuis") or pickoff at 2nd/3rd (`PO2`/`PO3`).

7. **The two secondary "geen fout" exceptions on p.13** — only the
   "langzame verwerking is geen fout" judgment call is quizzed (in
   `buildEndOfInningQuizEvent`). The two adjoining exceptions — an errant
   throw that wouldn't have gotten the runner anyway, and an errant throw
   made while completing a double/triple play — aren't covered by any
   quiz question.

None of the above are notation *errors* in what's already implemented —
they're scope gaps versus the full p.9–21 "Scoretekens" chapter. Suggest
picking these up as their own PR(s) given the scorecard-keying caveat
already documented in `CLAUDE.md` ("Known limitation") — items 1–2 in
particular add new automatic-out narratives that will exercise that same
`commitToScorecard` keying path.

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
