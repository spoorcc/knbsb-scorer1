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

  it("wraps a parenthesized out code in the out-circle widget, on their own line from the throw sequence, same as the log/scorecard rendering", () => {
    const { window } = loadApp();
    expect(window.renderCodeDisplay("(CS24)")).toBe('<span class="out-circle-inner"><span class="oc-line">CS</span><span class="oc-line num-tail">24</span></span>');
    expect(window.renderCodeDisplay("(PO13)")).toBe('<span class="out-circle-inner"><span class="oc-line">PO</span><span class="oc-line num-tail">13</span></span>');
  });

  it("leaves an un-parenthesized CS/PO code as plain text (the scorer hasn't circled it yet)", () => {
    const { window } = loadApp();
    expect(window.renderCodeDisplay("CS24")).toBe("CS24");
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

  it("breaks a compound two-part code (e.g. CS25E5) onto its own two lines, same as an out-circle code, even without a space", () => {
    // Regression: the live builder preview used to fall through to generic word-break:break-all for
    // an in-progress, not-yet-parenthesized code like "CS26E6", breaking it wherever it overflowed
    // instead of at the CS26/E6 boundary the logboek and scoreformulier already use.
    const { window } = loadApp();
    expect(window.renderCodeDisplay("CS26E6")).toBe(
      '<span class="compound-code"><span class="oc-line">CS26</span><span class="oc-line num-tail">E6</span></span>'
    );
    // works the same whether or not the scorer already typed the separating space
    expect(window.renderCodeDisplay("CS25 E5")).toBe(
      '<span class="compound-code"><span class="oc-line">CS25</span><span class="oc-line num-tail">E5</span></span>'
    );
  });
});

describe("renderScorecardCellHTML — wider box for an out that ends the runner's path", () => {
  // Regression: an out at 2nd/3rd used to always render in its single quarter-box, even though the
  // next quadrant along the base path (which that runner can now never reach) stays empty forever.
  it("widens a 2e out into the (permanently empty) 3e box", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ "2e": "(CS24)" });
    expect(html).toContain('class="hist-text q-2e q-wide"');
  });

  it("widens a 3e out into the (permanently empty) thuis box", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ "3e": "(CS25)" });
    expect(html).toContain('class="hist-text q-3e q-wide"');
  });

  it("does not widen a non-out code (the runner may still advance into the next quadrant)", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ "2e": "SB" });
    expect(html).toContain('class="hist-text q-2e"');
    expect(html).not.toContain("q-wide");
  });

  it("does not widen a 2e out when 3e is already occupied (shouldn't normally happen, but stay safe)", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ "2e": "(CS24)", "3e": "SB" });
    expect(html).toContain('class="hist-text q-2e"');
    expect(html).not.toContain("q-2e q-wide");
  });

  it("a thuis out has no further quadrant to widen into", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ thuis: "(CS35)" });
    expect(html).toContain('class="hist-text q-thuis"');
    expect(html).not.toContain("q-wide");
  });
});

describe("renderPriorHistory — same wider ellipse in the live builder", () => {
  // Regression: the printed scoreformulier widens an out at 2e/3e into the next, permanently-empty
  // quadrant (see the q-wide tests above), but the live builder's own honk-vakje never got the same
  // treatment for a prior at-bat's own history, so the exact same code looked squeezed there.
  function setup() {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    return dom;
  }

  it("widens a prior 2e out into the 3e box", () => {
    const dom = setup();
    dom.window.renderPriorHistory({ priorHistory: { "2e": "(CS24)" }, targetQuadrant: "thuis" });
    const el = dom.window.document.getElementById("hist2e");
    expect(el.classList.contains("q-wide")).toBe(true);
  });

  it("widens a prior 3e out into the thuis box", () => {
    const dom = setup();
    dom.window.renderPriorHistory({ priorHistory: { "3e": "(CS25)" }, targetQuadrant: "any" });
    const el = dom.window.document.getElementById("hist3e");
    expect(el.classList.contains("q-wide")).toBe(true);
  });

  it("does not widen a non-out code", () => {
    const dom = setup();
    dom.window.renderPriorHistory({ priorHistory: { "2e": "SB" }, targetQuadrant: "thuis" });
    const el = dom.window.document.getElementById("hist2e");
    expect(el.classList.contains("q-wide")).toBe(false);
  });

  it("clears a stale q-wide class from a previous turn's render", () => {
    const dom = setup();
    dom.window.renderPriorHistory({ priorHistory: { "2e": "(CS24)" }, targetQuadrant: "thuis" });
    dom.window.renderPriorHistory({ priorHistory: { "2e": "SB" }, targetQuadrant: "thuis" });
    const el = dom.window.document.getElementById("hist2e");
    expect(el.classList.contains("q-wide")).toBe(false);
  });
});

describe("addLogEntry — same wider ellipse in the logboek's history spans", () => {
  function setup() {
    const dom = loadApp();
    dom.window.initGame(3, "Honkbal", "1");
    return dom;
  }

  it("widens a prior 2e out into the 3e box in the logged entry", () => {
    const dom = setup();
    const ev = { narrative: "Test", priorHistory: { "2e": "(CS24)" }, refs: ["p.1"], code: "1B" };
    dom.window.addLogEntry(ev, "1B", "thuis", true, true, true);
    const entry = dom.window.document.querySelector("#log .log-entry");
    expect(entry.querySelector(".hist-text.q-2e").classList.contains("q-wide")).toBe(true);
  });

  it("does not widen a non-out prior code in the logged entry", () => {
    const dom = setup();
    const ev = { narrative: "Test", priorHistory: { "2e": "SB" }, refs: ["p.1"], code: "1B" };
    dom.window.addLogEntry(ev, "1B", "thuis", true, true, true);
    const entry = dom.window.document.querySelector("#log .log-entry");
    expect(entry.querySelector(".hist-text.q-2e").classList.contains("q-wide")).toBe(false);
  });
});

describe("renderScorecardCellHTML — post-pitcher-change red ink", () => {
  // Regression: the scored-run dot and the pinch-runner streepje used to always render black, even
  // when the cell's other notation (hist-text) correctly turned red after a pitcher change, because
  // (a) the dot's red CSS rule lost a specificity fight against the always-black rule, and (b) the
  // PR mark never carried a stint color at all.
  it("gives the scored-run dot the sc-stint-b class when the run scored during the red-ink stint", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ thuis: "1B", scored: true, _stintQ: { thuis: 1 } });
    expect(html).toMatch(/<span class="honk-dot sc-stint-b"/);
  });

  it("leaves the scored-run dot black when the run scored during the black-ink stint", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ thuis: "1B", scored: true, _stintQ: { thuis: 0 } });
    expect(html).toContain('<span class="honk-dot"');
    expect(html).not.toContain("sc-stint-b");
  });

  it("gives the pinch-runner streepje the sc-stint-b class when the swap happened during the red-ink stint", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ "1e": "1B", _prQ: "1e", _stintQ: { pr: 1 } });
    expect(html).toContain('class="sc-pr-mark sc-pr-1e sc-stint-b"');
  });

  it("leaves the pinch-runner streepje black when the swap happened during the black-ink stint", () => {
    const { window } = loadApp();
    const html = window.renderScorecardCellHTML({ "1e": "1B", _prQ: "1e", _stintQ: { pr: 0 } });
    expect(html).toContain('class="sc-pr-mark sc-pr-1e"');
  });
});
