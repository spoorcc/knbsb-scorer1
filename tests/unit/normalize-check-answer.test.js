import { describe, expect, it } from "vitest";
import { loadApp } from "../helpers/loadApp.js";

describe("normalize", () => {
  it("uppercases and strips non-alphanumeric characters", () => {
    const { window } = loadApp();
    expect(window.normalize("1b")).toBe("1B");
    expect(window.normalize(" 6-4-3 ")).toBe("643");
    expect(window.normalize("f-9!")).toBe("F9");
    expect(window.normalize("")).toBe("");
    expect(window.normalize(null)).toBe("");
    expect(window.normalize(undefined)).toBe("");
  });
});

describe("checkAnswer", () => {
  it("matches regardless of case and punctuation", () => {
    const { window } = loadApp();
    const ev = { code: "6-4-3" };
    expect(window.checkAnswer("643", ev)).toBe(true);
    expect(window.checkAnswer("6 4 3", ev)).toBe(true);
    expect(window.checkAnswer("6-4-3", ev)).toBe(true);
    expect(window.checkAnswer("643 ", ev)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const { window } = loadApp();
    expect(window.checkAnswer("1B", { code: "2B" })).toBe(false);
    expect(window.checkAnswer("", { code: "K" })).toBe(false);
  });
});
