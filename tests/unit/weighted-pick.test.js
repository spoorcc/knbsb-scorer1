import { describe, expect, it } from "vitest";
import { loadApp, randomForPickIndex, stubRngConstant } from "../helpers/loadApp.js";

describe("pick", () => {
  it("returns an element of the array using rng()", () => {
    const dom = loadApp();
    stubRngConstant(dom, 0);
    expect(dom.window.pick(["a", "b", "c"])).toBe("a");
    stubRngConstant(dom, 0.999999);
    expect(dom.window.pick(["a", "b", "c"])).toBe("c");
  });
});

describe("weightedPick", () => {
  const pool = [
    { key: "low", w: 1 },
    { key: "mid", w: 2 },
    { key: "high", w: 7 },
  ];

  it("picks the first bucket when rng lands at the very start", () => {
    const dom = loadApp();
    stubRngConstant(dom, 0);
    expect(dom.window.weightedPick(pool)).toBe("low");
  });

  it("picks the boundary-correct bucket for a mid-range draw", () => {
    const dom = loadApp();
    // total weight = 10; r = 0.15 * 10 = 1.5 -> past "low" (0..1), inside "mid" (1..3)
    stubRngConstant(dom, 0.15);
    expect(dom.window.weightedPick(pool)).toBe("mid");
  });

  it("picks the last bucket for a draw near the top of the range", () => {
    const dom = loadApp();
    stubRngConstant(dom, 0.99);
    expect(dom.window.weightedPick(pool)).toBe("high");
  });

  it("never returns a key outside the pool, across many draws", () => {
    const dom = loadApp();
    const validKeys = new Set(pool.map((p) => p.key));
    for (let i = 0; i < 200; i++) {
      stubRngConstant(dom, i / 200);
      expect(validKeys.has(dom.window.weightedPick(pool))).toBe(true);
    }
  });
});

describe("shuffleMcOptions", () => {
  it("preserves the set of options and correctly tracks the moved correct index", () => {
    const dom = loadApp();
    const options = ["A", "B", "C", "D"];
    const { options: shuffled, correctIndex } = dom.window.shuffleMcOptions(options, 0);
    expect(shuffled.slice().sort()).toEqual(options.slice().sort());
    expect(shuffled[correctIndex]).toBe("A");
  });

  it("keeps correctIndex pointing at the same value across many shuffles", () => {
    const dom = loadApp();
    const options = ["one", "two", "three", "four"];
    for (let i = 0; i < 50; i++) {
      stubRngConstant(dom, (i % 10) / 10);
      const { options: shuffled, correctIndex } = dom.window.shuffleMcOptions(options, 2);
      expect(shuffled[correctIndex]).toBe("three");
    }
  });
});

describe("randomForPickIndex helper", () => {
  it("resolves pick() to the requested index for arrays of various lengths", () => {
    const dom = loadApp();
    const arr = ["x0", "x1", "x2", "x3", "x4"];
    for (let i = 0; i < arr.length; i++) {
      stubRngConstant(dom, randomForPickIndex(i, arr.length));
      expect(dom.window.pick(arr)).toBe(arr[i]);
    }
  });
});
