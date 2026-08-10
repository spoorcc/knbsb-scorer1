// Brute-forces every matchNumber the app's "willekeurig" generator can produce
// (100000-999999, see randomMatchNumber() in index.html) for a 5-inning Honkbal
// match (Honkvast = away, Bal op het dak = home), and reports the matchNumber
// whose simulated PLAYS (not just the final score) come closest to
// analysis/voorbeeldwedstrijd.json — the worked example from the KNBSB
// "Scorer 1" course PDF.
//
// "Closest" is judged primarily on the *type* of plays each team produced
// (hits, walks, strikeouts, fly/ground outs, fielder's choices, sacrifices,
// errors, steals, caught-stealing/pick-offs, wild pitches/passed balls/balks
// — see speelacties in voorbeeldwedstrijd.json), read straight out of the
// simulated game's own scorecard notation (G.scorecard), with the final
// score / per-inning runs as a secondary tie-breaker. An exact play-by-play
// match is not expected to exist anywhere in the 900000-number space — the
// app's event generator is independent of the PDF's narrative — so this
// finds the *closest* one, not an identical replay.
//
// This drives the app's real state machine (initGame/generateEvent/
// applyEventToState, the same functions nextTurn() uses) directly in its
// own script realm, skipping DOM rendering entirely for speed — the answer
// a "player" gives never changes the simulated outcome (see submitAnswer()
// in index.html), so headless simulation reproduces exactly what a full
// playthrough would.
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
const TARGET_RUNS = {
  away: example.eindstand.Honkvast.punten_per_inning,
  home: example.eindstand.BalOpHetDak.punten_per_inning,
};
const TARGET_RUNS_TOTAL = {
  away: example.eindstand.Honkvast.totaal,
  home: example.eindstand.BalOpHetDak.totaal,
};
const TARGET_PLAYS = {
  away: example.speelacties.Honkvast,
  home: example.speelacties.BalOpHetDak,
};
const BUCKETS = ["hit1", "hit23", "hr", "bb", "k", "fly", "ground", "fc", "sac", "e", "sb", "cs", "misplay"];

const dom = loadApp();
// Runs entirely inside the app's own script realm: drives the real state
// machine headlessly, then classifies every code string actually written
// into G.scorecard (both teams) into the same play-type buckets used above.
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

    // 'key' is the honk-vakje quadrant this token was written into ('1e'/'2e'/'3e'/'thuis'/'out').
    // Bare digit tokens are ambiguous in isolation: a real fielded putout (GO/GOU, e.g. "63" or "3")
    // is always committed under the 'out' key (applyEventToState's "batter made an out" branch), while
    // the *same-looking* bare digit under any other key is an advance-credit marker (buildAdvanceCreditEvent
    // writes the batting-order number of whoever drove the runner in, e.g. code:String(battingOrderNum))
    // — bookkeeping, not a play of its own, so it must NOT be counted as a ground-ball out.
    function classify(tok, key){
      if(tok === "KWP" || tok === "KPB") return ["k", "misplay"];
      if(/^K/.test(tok)) return ["k"];
      if(/^1B$/.test(tok)) return ["hit1"];
      if(/^[23]B$/.test(tok)) return ["hit23"];
      if(/^HR$/.test(tok)) return ["hr"];
      if(/^(BB|IBB|HP|INT|OB)$/.test(tok)) return ["bb"];
      if(/^FF/.test(tok)) return ["fly"];
      if(/^F\\d/.test(tok)) return ["fly"];
      if(/^L\\d/.test(tok)) return ["fly"];
      if(/^IF\\d/.test(tok)) return ["fly"];
      if(/^FC/.test(tok)) return ["fc"];
      if(/^SH/.test(tok)) return ["sac"];
      if(/^SF/.test(tok)) return ["sac"];
      if(/^E\\d/.test(tok) || /^\\dE\\d/.test(tok)) return ["e"];
      if(/^SB/.test(tok)) return ["sb"];
      if(/^(CS|PO)/.test(tok)) return ["cs"];
      if(/^(WP|PB|BK|IP)$/.test(tok)) return ["misplay"];
      if(/^OB\\d/.test(tok)) return ["misplay"];
      if(/^\\d+$/.test(tok) && key === "out") return ["ground"];
      return [];
    }

    function countPlays(teamKey){
      const counts = { hit1:0, hit23:0, hr:0, bb:0, k:0, fly:0, ground:0, fc:0, sac:0, e:0, sb:0, cs:0, misplay:0 };
      for(const slotCols of G.scorecard[teamKey]){
        for(const cell of Object.values(slotCols)){
          if(!cell) continue;
          for(const [key, val] of Object.entries(cell)){
            if(key.startsWith("_") || key === "scored" || typeof val !== "string") continue;
            for(const tok of val.split(/\\s+/)){
              if(!tok) continue;
              for(const bucket of classify(tok, key)) counts[bucket]++;
            }
          }
        }
      }
      return counts;
    }

    return JSON.stringify({
      score: G.score,
      inningRuns: G.inningRuns,
      plays: { away: countPlays("away"), home: countPlays("home") },
    });
  })`
);

function distance(sim) {
  let playDist = 0;
  for (const team of ["away", "home"]) {
    for (const bucket of BUCKETS) {
      playDist += Math.abs((sim.plays[team][bucket] ?? 0) - TARGET_PLAYS[team][bucket]);
    }
  }

  let runDist = 0;
  for (const team of ["away", "home"]) {
    for (let i = 0; i < INNINGS; i++) {
      runDist += Math.abs((sim.inningRuns[team][i] ?? 0) - TARGET_RUNS[team][i]);
    }
    runDist += Math.abs(sim.score[team] - TARGET_RUNS_TOTAL[team]);
  }

  // Plays are the primary criterion (per the user's ask); score is a secondary tie-breaker.
  return { total: playDist * 3 + runDist, playDist, runDist };
}

const start = parseInt(process.argv[2] ?? "100000", 10);
const end = parseInt(process.argv[3] ?? "999999", 10);

let best = null;
let bestDist = Infinity;

for (let n = start; n <= end; n++) {
  const sim = JSON.parse(simFn(n));
  const d = distance(sim);
  if (d.total < bestDist) {
    bestDist = d.total;
    best = { matchNumber: n, sim, dist: d };
  }
  if (d.total === 0) break; // can't do better than an exact match
}

console.log(JSON.stringify({ range: [start, end], best }, null, 2));
