import { describe, expect, it } from "vitest";
import { loadApp } from "../helpers/loadApp.js";

describe("honkslagMarkHTML", () => {
  // The mark is an inline SVG: one <line> for the diagonal stroke, plus one
  // <line> per tick — so N ticks means N+1 total <line> elements.
  it("draws one tick for a single, two for a double, three for a triple", () => {
    const { window } = loadApp();
    expect((window.honkslagMarkHTML(1).match(/<line/g) || []).length).toBe(2);
    expect((window.honkslagMarkHTML(2).match(/<line/g) || []).length).toBe(3);
    expect((window.honkslagMarkHTML(3).match(/<line/g) || []).length).toBe(4);
  });

  it("draws no ticks for an unknown count (just the bare stroke)", () => {
    const { window } = loadApp();
    expect((window.honkslagMarkHTML(4).match(/<line/g) || []).length).toBe(1);
  });
});

describe("renderCodeDisplay", () => {
  it("renders honkslag codes as the authentic tick-mark widget", () => {
    const { window } = loadApp();
    expect(window.renderCodeDisplay("1B")).toContain("hs-mark");
    expect(window.renderCodeDisplay("2B")).toContain("hs-mark");
    expect(window.renderCodeDisplay("3B")).toContain("hs-mark");
  });

  it("wraps CS/PO codes in the out-circle widget, spaced out for legibility, with the digits kept unbreakable so a line wrap can only fall at that space", () => {
    const { window } = loadApp();
    expect(window.renderCodeDisplay("CS24")).toBe('<span class="out-circle-inner">CS <span class="num-tail">24</span></span>');
    expect(window.renderCodeDisplay("PO13")).toBe('<span class="out-circle-inner">PO <span class="num-tail">13</span></span>');
  });

  it("renders PIJL / the arrow character as the arrow-mark widget", () => {
    const { window } = loadApp();
    expect(window.renderCodeDisplay("PIJL")).toBe('<span class="arrow-mark"></span>');
    expect(window.renderCodeDisplay("↑")).toBe('<span class="arrow-mark"></span>');
  });

  it("passes through any other code unchanged", () => {
    const { window } = loadApp();
    expect(window.renderCodeDisplay("K")).toBe("K");
    expect(window.renderCodeDisplay("F9")).toBe("F9");
    expect(window.renderCodeDisplay("6-4-3")).toBe("6-4-3");
  });
});
