import { describe, expect, it } from "vitest";
import { evalIn, getG, loadApp, startGame } from "../helpers/loadApp.js";

describe("scoreteken builder", () => {
  it("appendToken() adds characters and mirrors them into the system input", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    dom.window.appendToken("1");
    dom.window.appendToken("B");
    expect(evalIn(dom, "builderStr")).toBe("1B");
    expect(document.getElementById("systemInput").value).toBe("1B");
  });

  it("clearBtn wipes the builder string", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    dom.window.appendToken("6");
    dom.window.appendToken("4");
    document.getElementById("clearBtn").click();
    expect(evalIn(dom, "builderStr")).toBe("");
  });

  it("typing into #systemInput uppercases and updates builderStr", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    const input = document.getElementById("systemInput");
    input.value = "1b";
    input.dispatchEvent(new dom.window.Event("input"));
    expect(evalIn(dom, "builderStr")).toBe("1B");
  });

  it("selectSlot() highlights the chosen quadrant and updates the hint text", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    dom.window.selectSlot("2e");
    expect(evalIn(dom, "selectedSlot")).toBe("2e");
    expect(document.getElementById("builderText").classList.contains("slot-2e")).toBe(true);
    expect(document.getElementById("qHighlight").classList.contains("state-selected")).toBe(true);
    expect(document.getElementById("quadrantHint").textContent).toContain("2e honk");
  });

  it("clicking a qbtn calls selectSlot with its data-slot", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    document.querySelector('.qbtn[data-slot="thuis"]').click();
    expect(evalIn(dom, "selectedSlot")).toBe("thuis");
  });

  it("setupKeyboard() wires position buttons 1-9 to append their number", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    const posButtons = document.getElementById("grpPos").querySelectorAll("button");
    expect(posButtons).toHaveLength(9);
    posButtons[2].click(); // 3rd button -> position 3
    expect(evalIn(dom, "builderStr")).toBe("3");
  });

  it("toggleKeyboardBtn expands/collapses the on-screen keyboard and flips its label", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    const btn = document.getElementById("toggleKeyboardBtn");
    const keyboard = document.getElementById("keyboard");
    expect(keyboard.classList.contains("kb-collapsed")).toBe(true);
    btn.click();
    expect(keyboard.classList.contains("kb-collapsed")).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(btn.textContent).toContain("Verberg toetsenbord");
    btn.click();
    expect(keyboard.classList.contains("kb-collapsed")).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("infoBtn toggles the caption's hidden class", () => {
    const dom = startGame(loadApp());
    const { document } = dom.window;
    const caption = document.getElementById("builderCaption");
    expect(caption.classList.contains("hidden")).toBe(true);
    document.getElementById("infoBtn").click();
    expect(caption.classList.contains("hidden")).toBe(false);
  });
});

describe("nextTurn()", () => {
  it("resets the builder/slot state and renders the current event's narrative", () => {
    const dom = startGame(loadApp());
    const G = getG(dom);
    expect(dom.window.document.getElementById("narrativeText").innerHTML).toBe(G.currentEvent.narrative);
    expect(evalIn(dom, "builderStr")).toBe("");
    expect(evalIn(dom, "selectedSlot")).toBeNull();
  });
});
