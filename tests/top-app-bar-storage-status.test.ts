import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { TopAppBar } from "../src/components/workflow/TopAppBar";
import { useSafeSpaceStore } from "../src/store/safespace-store";

test("top bar reflects canonical save state without marking demo or prior stages saved", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost" });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);

  try {
    useSafeSpaceStore.getState().resetToDemo();
    await act(async () => root.render(React.createElement(TopAppBar)));
    const badge = () => container.querySelector('[role="status"], [role="alert"]')!;
    assert.equal(badge().textContent?.trim(), "Demo · Unsaved");
    assert.equal(container.querySelectorAll('nav[aria-label="Assessment stages"] button').length, 5);

    await act(async () => useSafeSpaceStore.setState({ assessmentType: "user", storageStatus: "idle", storageError: null }));
    assert.equal(badge().textContent?.trim(), "Unsaved");

    await act(async () => useSafeSpaceStore.setState({ storageStatus: "saved" }));
    assert.equal(badge().textContent?.trim(), "Saved");

    await act(async () => useSafeSpaceStore.setState({ storageStatus: "error", storageError: "Storage unavailable" }));
    assert.equal(badge().textContent?.trim(), "Error");
    assert.equal(badge().getAttribute("role"), "alert");
    assert.equal(badge().getAttribute("title"), "Storage unavailable");

    await act(async () => useSafeSpaceStore.setState({ storageStatus: "quota_exceeded" }));
    assert.equal(badge().textContent?.trim(), "Error");
    assert.equal(container.querySelector('nav [aria-label*="completed"]'), null);
  } finally {
    await act(async () => root.unmount());
    useSafeSpaceStore.getState().resetToDemo();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
    dom.window.close();
  }
});
