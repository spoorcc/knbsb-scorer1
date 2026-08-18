#!/usr/bin/env node
// Mutation testing for index.html's inline <script>.
//
// The app ships as a single index.html (see CLAUDE.md — that's deliberate,
// not something this tool should push back into separate files). Stryker
// and friends assume real per-file JS modules, so instead this script:
//
//   1. parses the inline <script> with acorn,
//   2. walks the AST generating small single-token mutants (flipped
//      operators, negated conditions, boundary shifts, swapped literals),
//   3. for each mutant, splices the mutated token back into a full copy of
//      index.html, temporarily overwrites the real index.html with it
//      (tests/helpers/loadApp.js reads that file by path), runs the test
//      suite, and records whether it caught the mutant,
//   4. always restores the original index.html afterwards, even on crash.
//
// A mutant that survives (tests still pass) means no test exercises that
// line's behavior closely enough to notice it changed — a coverage gap,
// and sometimes a sign of a real bug (see README notes from `npm run
// mutation-test`).
//
// Usage:
//   npm run mutation-test                  # default sample, quick test subset
//   node scripts/mutation-test.mjs --limit 200 --full
//   node scripts/mutation-test.mjs --list                 # just list mutants, don't run
//   node scripts/mutation-test.mjs --filter hitAdvance     # only mutants inside matching source line
//   node scripts/mutation-test.mjs --seed 42               # change which sample of mutants is picked
//
// Since this repeatedly overwrites the real index.html in place (see step 3 above) and restores it
// only at the very end, do not edit index.html — by hand or with another tool call — while this is
// running, and don't run two instances at once: either would race the restore and can leave a
// mutant permanently stuck in the working tree. It refuses to start on a dirty index.html to catch
// the common case (accidentally leftover uncommitted edits) but can't detect a concurrent process.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);
const indexPath = path.join(rootDir, "index.html");

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
const LIMIT = parseInt(flag("limit", "60"), 10);
const LIST_ONLY = flag("list", false) === true;
const FULL = flag("full", false) === true;
const FILTER = flag("filter", null);
const SEED = parseInt(flag("seed", "1"), 10);

const QUICK_TEST_ARGS = ["vitest", "run", "tests/unit", "tests/state", "tests/events", "tests/ui", "tests/rendering", "--reporter=dot", "--bail=1"];
const FULL_TEST_ARGS = ["vitest", "run", "--reporter=dot", "--bail=1"];

if (!LIST_ONLY) {
  const gitStatus = execFileSync("git", ["status", "--porcelain", "--", "index.html"], { cwd: rootDir }).toString();
  if (gitStatus.trim()) {
    throw new Error("mutation-test: index.html has uncommitted changes — commit/stash them first, so a crash or a concurrent edit can't get confused with a stuck mutant.");
  }
}

// --- locate the single inline <script> block, same regex extract-inline-script.mjs uses ---
const originalHtml = readFileSync(indexPath, "utf8");
const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const matches = [...originalHtml.matchAll(scriptRe)];
if (matches.length !== 1) {
  throw new Error(`mutation-test: expected exactly one inline <script>, found ${matches.length}`);
}
const [fullMatch, scriptBody] = matches[0];
const scriptStartInHtml = matches[0].index + fullMatch.indexOf(scriptBody);

// --- parse & collect mutation candidates ---
const ast = acorn.parse(scriptBody, { ecmaVersion: "latest", sourceType: "script" });

const FLIP = {
  // arithmetic
  "+": "-", "-": "+", "*": "/", "/": "*", "%": "*",
  // equality
  "==": "!=", "!=": "==", "===": "!==", "!==": "===",
  // relational (boundary mutation, like Stryker's EqualityOperator/ConditionalExpression mutators)
  "<": "<=", "<=": "<", ">": ">=", ">=": ">",
  // logical
  "&&": "||", "||": "&&",
  // update
  "++": "--", "--": "++",
};

/** @type {{start:number,end:number,original:string,mutated:string,line:number,kind:string}[]} */
const mutants = [];

function lineOf(pos) {
  return scriptBody.slice(0, pos).split("\n").length;
}

function addOperatorMutant(node, opStart, opEnd, kind) {
  const original = scriptBody.slice(opStart, opEnd);
  const mutated = FLIP[original];
  if (!mutated) return;
  mutants.push({ start: opStart, end: opEnd, original, mutated, line: lineOf(opStart), kind });
}

function walk(node) {
  if (!node || typeof node.type !== "string") return;

  switch (node.type) {
    case "BinaryExpression":
    case "LogicalExpression": {
      // operator sits between left.end and right.start
      const between = scriptBody.slice(node.left.end, node.right.start);
      const opMatch = between.match(/[+\-*/%<>=!&|]+/);
      if (opMatch && FLIP[opMatch[0]] !== undefined) {
        const opStart = node.left.end + opMatch.index;
        addOperatorMutant(node, opStart, opStart + opMatch[0].length, node.type === "LogicalExpression" ? "logical" : "binary");
      }
      break;
    }
    case "UpdateExpression": {
      const opStart = node.prefix ? node.start : node.end - node.operator.length;
      addOperatorMutant(node, opStart, opStart + node.operator.length, "update");
      break;
    }
    case "UnaryExpression": {
      if (node.operator === "!") {
        // negate a boolean guard: `!x` -> `x` (drop the `!`)
        mutants.push({ start: node.start, end: node.start + 1, original: "!", mutated: "", line: lineOf(node.start), kind: "unary-not" });
      } else if (node.operator === "-" && node.argument.type === "Literal" && typeof node.argument.value === "number") {
        // numeric sign flip: `-1` -> `1`
        mutants.push({ start: node.start, end: node.start + 1, original: "-", mutated: "", line: lineOf(node.start), kind: "unary-minus" });
      }
      break;
    }
    case "Literal": {
      if (typeof node.value === "boolean") {
        mutants.push({ start: node.start, end: node.end, original: String(node.value), mutated: String(!node.value), line: lineOf(node.start), kind: "boolean-literal" });
      }
      break;
    }
    default:
      break;
  }

  for (const key in node) {
    if (key === "start" || key === "end" || key === "loc" || key === "range") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) if (item && typeof item.type === "string") walk(item);
    } else if (val && typeof val.type === "string") {
      walk(val);
    }
  }
}

walk(ast);

// --- optional filter + deterministic sample so re-runs with the same --seed are reproducible ---
let candidates = mutants;
if (FILTER) {
  candidates = candidates.filter((m) => {
    const lineText = scriptBody.split("\n")[m.line - 1] || "";
    return lineText.includes(FILTER);
  });
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
candidates = shuffle(candidates, mulberry32(SEED));
if (LIMIT > 0) candidates = candidates.slice(0, LIMIT);

console.log(`mutation-test: ${mutants.length} mutants found, running ${candidates.length} (limit=${LIMIT}${FILTER ? `, filter="${FILTER}"` : ""})`);

if (LIST_ONLY) {
  for (const m of candidates) {
    console.log(`  L${m.line} [${m.kind}] ${JSON.stringify(m.original)} -> ${JSON.stringify(m.mutated)}`);
  }
  process.exit(0);
}

function buildMutatedHtml(mutant) {
  const mutatedScript = scriptBody.slice(0, mutant.start) + mutant.mutated + scriptBody.slice(mutant.end);
  return originalHtml.slice(0, scriptStartInHtml) + mutatedScript + originalHtml.slice(scriptStartInHtml + scriptBody.length);
}

const testArgs = FULL ? FULL_TEST_ARGS : QUICK_TEST_ARGS;
const results = { killed: 0, survived: 0, errored: 0 };
const survivors = [];

try {
  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i];
    writeFileSync(indexPath, buildMutatedHtml(m));
    let status;
    try {
      execFileSync("npx", testArgs, { cwd: rootDir, stdio: "pipe", timeout: 120000 });
      status = "SURVIVED";
    } catch (err) {
      status = err.status === undefined ? "ERRORED" : "KILLED";
    }
    if (status === "SURVIVED") {
      results.survived++;
      survivors.push(m);
    } else if (status === "KILLED") {
      results.killed++;
    } else {
      results.errored++;
    }
    console.log(`  [${i + 1}/${candidates.length}] L${m.line} [${m.kind}] ${JSON.stringify(m.original)}->${JSON.stringify(m.mutated)}: ${status}`);
  }
} finally {
  writeFileSync(indexPath, originalHtml);
}

const total = results.killed + results.survived;
const score = total > 0 ? ((results.killed / total) * 100).toFixed(1) : "n/a";
console.log("\n--- mutation-test summary ---");
console.log(`killed: ${results.killed}  survived: ${results.survived}  errored(non-test-failure): ${results.errored}`);
console.log(`mutation score: ${score}%`);
if (survivors.length > 0) {
  console.log("\nSurvivors (no test noticed these changes):");
  const lines = scriptBody.split("\n");
  for (const m of survivors) {
    console.log(`  L${m.line} [${m.kind}] ${JSON.stringify(m.original)} -> ${JSON.stringify(m.mutated)}`);
    console.log(`    ${lines[m.line - 1]?.trim()}`);
  }
}
process.exit(results.survived > 0 ? 1 : 0);
