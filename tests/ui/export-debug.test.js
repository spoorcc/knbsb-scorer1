import { describe, expect, it } from "vitest";
import { loadApp, startGame } from "../helpers/loadApp.js";

describe("exportDebugData", () => {
  it("alerts and does nothing when no game has started", () => {
    const dom = loadApp();
    let alertMessage = null;
    dom.window.alert = (msg) => {
      alertMessage = msg;
    };
    dom.window.exportDebugData();
    expect(alertMessage).toContain("nog geen wedstrijd");
  });

  it("builds and downloads a JSON snapshot once a game is running", () => {
    const dom = startGame(loadApp());
    const { window } = dom;
    let createdBlob = null;
    let clicked = false;
    window.URL.createObjectURL = (blob) => {
      createdBlob = blob;
      return "blob:fake-url";
    };
    window.URL.revokeObjectURL = () => {};
    const realCreateElement = window.document.createElement.bind(window.document);
    window.document.createElement = (tag) => {
      const el = realCreateElement(tag);
      if (tag === "a") {
        // Stub out click() entirely: jsdom doesn't support navigating to blob: URLs, and the
        // test only needs to know a download was triggered, not that navigation happened.
        el.click = () => {
          clicked = true;
        };
      }
      return el;
    };

    expect(() => window.exportDebugData()).not.toThrow();
    expect(createdBlob).toBeTruthy();
    expect(clicked).toBe(true);
  });

  it("clicking the real exportBtn (not just calling the function) triggers the same alert path pre-game", () => {
    const dom = loadApp();
    let alertMessage = null;
    dom.window.alert = (msg) => {
      alertMessage = msg;
    };
    dom.window.document.getElementById("exportBtn").click();
    expect(alertMessage).toContain("nog geen wedstrijd");
  });
});
