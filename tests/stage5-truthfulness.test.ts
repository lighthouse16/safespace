import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Stage5Improve } from "../src/components/workflow/Stage5Improve";
import { useSafeSpaceStore } from "../src/store/safespace-store";

const dom = new JSDOM("<!DOCTYPE html><div id='root'></div>", { url: "http://localhost:3000" });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});

test("Stage 5 shows measured candidate details instead of fabricated improvements", async () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  store.setStage("improve");
  const result = store.runOptimization();
  assert.ok(result.candidates.length > 0);
  const rootEl = dom.window.document.getElementById("root")!;
  const root = createRoot(rootEl);
  try {
    await act(async () => root.render(React.createElement(Stage5Improve)));
    const before = rootEl.querySelector('[data-testid="floorplan-pane-before"]');
    const proposed = rootEl.querySelector('[data-testid="floorplan-pane-proposed"]');
    assert.ok(before);
    assert.ok(proposed);
    assert.match(before.textContent ?? "", new RegExp(`${result.baselineEvaluation.summary.actionableDeficitsCount}\\s*Actionable deficits`));
    assert.match(proposed.textContent ?? "", new RegExp(`${result.candidates[0].metrics.actionableDeficitsCount}\\s*Actionable deficits`));
    assert.match(proposed.textContent ?? "", /Measured layout summary/);
    assert.doesNotMatch(rootEl.textContent ?? "", /67%|\+45 cm|Move side chair 45 cm|Shift console table 30 cm|Fewer accessibility risks|Major obstructions/);
  } finally {
    await act(async () => root.unmount());
    store.resetToDemo();
  }
});
