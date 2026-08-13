#!/usr/bin/env node
// Plays one full KNBSB Scorer 1 match through the *real* app UI in a real browser (not the
// headless engine-only shortcut used by analysis/find-matching-wedstrijdnummer.mjs), answering
// every question correctly, then takes a full-page screenshot of the finished game (including the
// printed "volledig scoreformulier" at the bottom).
//
// Why drive the real DOM instead of just calling initGame/generateEvent/applyEventToState
// directly: this exercises the exact same click/fill/select path a human player uses (the same
// pattern tests/integration/*.test.js's playFullGameCorrectly() helpers use against jsdom), so the
// screenshot reflects what the app actually renders, not just what its internal state looks like.
//
// Usage:
//   node play-and-screenshot.mjs --index /path/to/index.html --sport Honkbal --innings 5 \
//     --match 795231 [--out /path/to/out.png] [--max-turns 1500] [--viewport-width 1400] [--headed]
//
// matchNumber seeds the app's own PRNG (see CLAUDE.md's "Architecture" section), so the same
// --match value always reproduces the exact same game — the screenshot is fully deterministic for
// a given (sport, innings, match) triple.

import { parseArgs } from "node:util";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

function usageError(msg) {
  console.error(`Error: ${msg}\n`);
  console.error(
    "Usage: node play-and-screenshot.mjs --index <path/to/index.html> --sport Honkbal|Softbal --innings <n> --match <matchNumber> [--out <path.png>] [--max-turns <n>] [--viewport-width <n>] [--headed]"
  );
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    index: { type: "string" },
    sport: { type: "string" },
    innings: { type: "string" },
    match: { type: "string" },
    out: { type: "string" },
    "max-turns": { type: "string", default: "1500" },
    "viewport-width": { type: "string", default: "1400" },
    headed: { type: "boolean", default: false },
  },
});

if (!args.index) usageError("--index <path/to/index.html> is required");
if (!args.match) usageError("--match <matchNumber> is required");
const indexPath = path.resolve(args.index);
if (!fs.existsSync(indexPath)) usageError(`index.html not found at ${indexPath}`);

const sport = args.sport === "Softbal" ? "Softbal" : "Honkbal"; // same fallback the app itself uses
if (args.sport && sport !== args.sport) {
  console.error(`Warning: --sport "${args.sport}" is not "Honkbal" or "Softbal" — defaulting to Honkbal.`);
}
const innings = parseInt(args.innings, 10) || 3; // 3 is the app's own default
const matchNumber = args.match;
const maxTurns = parseInt(args["max-turns"], 10);
const viewportWidth = parseInt(args["viewport-width"], 10);
const outPath = path.resolve(args.out || `scoreformulier-${matchNumber}.png`);

// Playwright isn't a devDependency of this project (no build step, no browser tests in the repo's
// own suite — see CLAUDE.md), so try a normal package resolution first (works if the caller's
// environment does have it installed) and fall back to this sandbox's known global install.
async function loadPlaywright() {
  const attempts = ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"];
  let lastErr;
  for (const specifier of attempts) {
    try {
      return await import(specifier);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `Could not load Playwright (tried: ${attempts.join(", ")}). Install it with "npm install -g playwright" or point NODE_PATH at an existing install. Last error: ${lastErr?.message}`
  );
}

// Same idea for the browser binary: prefer whatever Playwright would normally find on its own
// (a real "npx playwright install" elsewhere), fall back to this sandbox's pre-installed Chromium.
async function launchChromium(chromium, headless) {
  const candidates = [undefined, process.env.PLAYWRIGHT_CHROMIUM_PATH, "/opt/pw-browsers/chromium"];
  let lastErr;
  for (const executablePath of candidates) {
    if (executablePath !== undefined && !fs.existsSync(executablePath)) continue;
    try {
      return await chromium.launch(executablePath ? { headless, executablePath } : { headless });
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Could not launch Chromium via any known path. Last error: ${lastErr?.message}`);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

// A tiny static server for just this one directory — the app is a single self-contained
// index.html (per CLAUDE.md, "the only source file that ships"), so this only really needs to
// serve that one file, but it walks the whole directory in case a future change adds a same-folder
// asset. Bound to 127.0.0.1 on an OS-assigned port so it never collides with anything already
// running (e.g. a dev server the user has open).
function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split("?")[0]);
        const filePath = path.normalize(path.join(rootDir, urlPath === "/" ? "/index.html" : urlPath));
        if (!filePath.startsWith(path.normalize(rootDir))) {
          res.writeHead(403);
          res.end();
          return;
        }
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// Drives one full game to completion through the real UI, answering every question correctly —
// mirrors tests/integration/double-play-line.test.js's playFullGameCorrectly() helper, which
// exercises the exact same DOM path (click/fill/selectSlot) a human player uses, just against a
// real browser instead of jsdom. G/selectSlot/etc. are reachable as bare identifiers inside
// page.evaluate() because top-level let/const in a classic <script> tag share the page's global
// lexical scope in a real browser — they are deliberately *not* window.G/window.selectSlot (see
// CLAUDE.md's "Testing" section for why the app itself doesn't expose them that way either).
async function playToEnd(page, { maxTurns, onProgress }) {
  let turns = 0;
  for (;;) {
    const gameOver = await page.evaluate(() => document.getElementById("endScreen") && !document.getElementById("endScreen").classList.contains("hidden"));
    if (gameOver) break;
    turns++;
    if (turns > maxTurns) {
      throw new Error(`Exceeded ${maxTurns} turns without reaching the end screen — likely stuck. Check the screenshot/DOM state manually.`);
    }

    const isMc = await page.evaluate(() => Boolean(G.currentEvent && G.currentEvent.type === "mc"));
    if (isMc) {
      const correctIndex = await page.evaluate(() => G.currentEvent.correctIndex);
      const buttons = await page.locator("#mcOptions .mc-btn").all();
      await buttons[correctIndex].click();
    } else {
      await page.evaluate(() => {
        const ev = G.currentEvent;
        selectSlot(ev.targetQuadrant);
        const input = document.getElementById("systemInput");
        input.value = ev.code;
        input.dispatchEvent(new Event("input"));
      });
    }
    await page.click("#submitBtn"); // submitAnswer(): shows correct/incorrect feedback
    await page.click("#submitBtn"); // nextTurn(): advances, or reveals the end screen on the last play

    if (onProgress && turns % 10 === 0) onProgress(turns);
  }
  return turns;
}

async function main() {
  const { chromium } = await loadPlaywright();
  const server = await startStaticServer(path.dirname(indexPath));
  const port = server.address().port;
  const indexFileName = path.basename(indexPath);

  const browser = await launchChromium(chromium, !args.headed);
  try {
    const page = await browser.newPage({ viewport: { width: viewportWidth, height: 1000 } });
    const url = `http://127.0.0.1:${port}/${indexFileName}?innings=${innings}&sport=${sport}&wedstrijd=${encodeURIComponent(matchNumber)}`;
    console.error(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "load" });

    const turns = await playToEnd(page, {
      maxTurns,
      onProgress: (n) => console.error(`  ...${n} turns played`),
    });

    // .q-highlight and a few other elements animate on state change (transition: .18s ease, see
    // index.html) — give the very last one a moment to settle before capturing pixels.
    await page.waitForTimeout(250);

    const summary = await page.evaluate(() => ({
      score: G.score,
      correctCount: G.correctCount,
      totalCount: G.totalCount,
    }));

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, fullPage: true });

    console.log(
      JSON.stringify(
        {
          sport,
          innings,
          matchNumber,
          turns,
          finalScore: summary.score,
          correctCount: summary.correctCount,
          totalCount: summary.totalCount,
          screenshot: outPath,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
