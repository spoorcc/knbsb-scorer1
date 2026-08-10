// Brute-forces every matchNumber the app's "willekeurig" generator can produce
// (100000-999999, see randomMatchNumber() in index.html) for a 5-inning Honkbal
// match (Honkvast = away, Bal op het dak = home), and reports the matchNumber
// whose simulated per-inning score comes closest to analysis/voorbeeldwedstrijd.json
// (the worked example from the KNBSB "Scorer 1" course PDF).
//
// This drives the app's real state machine (initGame/generateEvent/applyEventToState,
// the same functions nextTurn() uses) directly in its own script realm, skipping DOM
// rendering entirely for speed — the answer a "player" gives never changes the
// simulated outcome (see submitAnswer() in index.html), so headless simulation
// reproduces exactly what a full playthrough would.
//
// Usage:
//   node analysis/find-matching-wedstrijdnummer.mjs [start] [end]
// Defaults to the app's full matchNumber range, 100000-999999.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadApp, evalIn } from "../tests/helpers/loadApp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const example = JSON.parse(readFileSync(path.join(__dirname, "voorbeeldwedstrijd.json"), "utf8"));

const INNINGS = example.wedstrijd.innings_gespeeld;
const TARGET_AWAY = example.eindstand.Honkvast.punten_per_inning;
const TARGET_HOME = example.eindstand.BalOpHetDak.punten_per_inning;
const TARGET_AWAY_TOTAL = example.eindstand.Honkvast.totaal;
const TARGET_HOME_TOTAL = example.eindstand.BalOpHetDak.totaal;

const dom = loadApp();
const simFn = evalIn(
  dom,
  `(function(matchNumber){
    initGame(${INNINGS}, "Honkbal", String(matchNumber));
    let iterations = 0;
    while(!G.gameOver){
      iterations++;
      if(iterations > 5000) throw new Error("stuck");
      const ev = (G.pendingEvents && G.pendingEvents.length) ? G.pendingEvents.shift() : generateEvent();
      G.currentEvent = ev;
      applyEventToState(ev);
    }
    while(G.pendingEvents && G.pendingEvents.length){
      const leftover = G.pendingEvents.shift();
      if(leftover && typeof leftover.applyBases === "function"){ leftover.applyBases(G.bases); }
    }
    return JSON.stringify({ score: G.score, inningRuns: G.inningRuns });
  })`
);

function distance(sim) {
  const away = sim.inningRuns.away;
  const home = sim.inningRuns.home;
  let d = 0;
  for (let i = 0; i < INNINGS; i++) {
    d += Math.abs((away[i] ?? 0) - TARGET_AWAY[i]);
    d += Math.abs((home[i] ?? 0) - TARGET_HOME[i]);
  }
  // Final totals are the headline numbers people check first, so weight them extra.
  d += 2 * Math.abs(sim.score.away - TARGET_AWAY_TOTAL);
  d += 2 * Math.abs(sim.score.home - TARGET_HOME_TOTAL);
  return d;
}

const start = parseInt(process.argv[2] ?? "100000", 10);
const end = parseInt(process.argv[3] ?? "999999", 10);

let best = null;
let bestDist = Infinity;

for (let n = start; n <= end; n++) {
  const sim = JSON.parse(simFn(n));
  const d = distance(sim);
  if (d < bestDist) {
    bestDist = d;
    best = { matchNumber: n, sim, dist: d };
  }
  if (d === 0) break; // can't do better than an exact match
}

console.log(JSON.stringify({ range: [start, end], best }, null, 2));
