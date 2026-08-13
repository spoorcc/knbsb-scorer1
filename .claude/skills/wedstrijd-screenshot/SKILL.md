---
name: wedstrijd-screenshot
description: Plays one full KNBSB Scorer 1 match (this repo's index.html trainer app) end-to-end through a real browser, answering every question correctly, and captures a full-page screenshot of the finished game and its printed scoreformulier. Use this whenever the user gives a sport + innings + wedstrijdnummer (matchNumber) and asks to "play", "score", "run through", or screenshot that match — e.g. for the README's own scoreformulier screenshots, to visually check what a specific matchNumber produces, or to document a bug repro. Also trigger on requests like "maak een screenshot van wedstrijd X" or "speel wedstrijdnummer X af en laat het scoreformulier zien", even without the word "skill".
---

# Wedstrijd screenshot

Drives a complete, deterministic playthrough of this app's own game engine through
its real UI — the same click/fill/select path a human player uses, not a
headless shortcut — then screenshots the result. `matchNumber` seeds the
app's PRNG (see `CLAUDE.md`'s Architecture section), so the same
`(sport, innings, matchNumber)` triple always reproduces the exact same
game and the exact same screenshot.

Driving the real DOM instead of calling `initGame`/`generateEvent`/
`applyEventToState` directly matters here: the point of the screenshot is
what the app actually *renders* (scoreboard, veld, logboek, the printed
scoreformulier with its circles/lines/arrows), and only playing through
the real UI guarantees that's what ends up on screen.

## Running it

Requires the three parameters the user provides: **sport** (`Honkbal` or
`Softbal`), **innings** (1–9), and **matchNumber** (the wedstrijdnummer —
any string the app accepts in its own `?wedstrijd=` share link). If any of
these is missing or ambiguous, ask the user rather than guessing — a
different matchNumber produces a genuinely different game.

```sh
node .claude/skills/wedstrijd-screenshot/scripts/play-and-screenshot.mjs \
  --index /absolute/path/to/index.html \
  --sport Honkbal \
  --innings 5 \
  --match 795231 \
  --out /absolute/path/to/scoreformulier-795231.png
```

- `--index` — absolute path to this repo's `index.html`. Always pass it
  explicitly; don't assume a cwd.
- `--out` — optional; defaults to `./scoreformulier-<matchNumber>.png` if
  omitted. Prefer an explicit path under the caller's scratch directory (or
  wherever the user wants the file) so it's easy to find afterwards.
- `--max-turns` — optional safety cap (default 1500). A 9-inning game with
  extra-base plays and pinch-runner/pitcher-change follow-ups can run to a
  few hundred turns; raise this only if a run genuinely errors out with
  "Exceeded N turns" rather than bumping it preemptively.
- `--headed` — optional, launches a visible (non-headless) browser. Only
  useful for debugging the script itself, not for normal use.

The script handles its own lifecycle: it starts a throwaway static HTTP
server for the directory containing `index.html`, launches Chromium via
Playwright (trying a normal package/browser resolution first, falling back
to this sandbox's pre-installed `/opt/pw-browsers/chromium`), plays the
whole game, screenshots it, and tears both down again — nothing needs to be
started or stopped by hand first.

On success it prints a JSON summary to stdout:

```json
{
  "sport": "Honkbal",
  "innings": 3,
  "matchNumber": "100002",
  "turns": 67,
  "finalScore": { "away": 3, "home": 6 },
  "correctCount": 67,
  "totalCount": 67,
  "screenshot": "/absolute/path/to/scoreformulier-100002.png"
}
```

`correctCount`/`totalCount` should always be equal — the script answers
every question with the event's own correct code/quadrant/option, the same
way `playFullGameCorrectly()` does in `tests/integration/*.test.js`. If
they're not equal, something is wrong with the script (not the app) and is
worth investigating before handing the screenshot back.

## After it finishes

Hand the screenshot back to the user with `SendUserFile` (`status: "proactive"`
if they're not actively waiting on it, `"normal"` if they are), with a short
caption noting the sport/innings/matchNumber and the final score — the kind
of detail someone would want if they're about to paste this into a README
or a bug report. Don't just say the file was created; the whole point of
this skill is the visual, so show it.

If a run throws "Exceeded N turns", that means the game got stuck — most
likely a real bug in the app's event/state machine, not something to retry
with a higher `--max-turns` and move past silently. Investigate before
reporting back.
