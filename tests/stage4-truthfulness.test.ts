import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Stage4Analysis } from "../src/components/workflow/Stage4Analysis";
import { useSafeSpaceStore } from "../src/store/safespace-store";

const dom = new JSDOM("<!DOCTYPE html><div id='root'></div>", { url: "http://localhost:3000" });
(globalThis as unknown as Record<string, unknown>).window = dom.window;
(globalThis as unknown as Record<string, unknown>).document = dom.window.document;
(globalThis as unknown as Record<string, unknown>).localStorage = dom.window.localStorage;
(globalThis as unknown as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
(globalThis as unknown as Record<string, unknown>).SVGElement = dom.window.SVGElement;
(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

test("Stage 4 displays evaluator data and functional controls without fabricated labels", async () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo("analysis");
  const element = dom.window.document.getElementById("root")!;
  const root = createRoot(element);
  const button = (label: string) => Array.from(element.querySelectorAll("button")).find((b) => b.textContent?.trim() === label);

  try {
    await act(async () => root.render(React.createElement(Stage4Analysis)));
    assert.ok(element.textContent?.includes(`All (${store.getSpatialFindings().findings.length})`));
    assert.ok(!element.querySelector('[aria-label="Fullscreen"], [aria-label="More options"], [aria-label="Measure tool"]'));
    assert.ok(!element.textContent?.includes("Hallway"));
    const routeToggle = button("Route overlay")!;
    const wasEnabled = routeToggle.getAttribute("aria-pressed") === "true";
    await act(async () => routeToggle.click());
    assert.equal(button("Route overlay")?.getAttribute("aria-pressed"), String(!wasEnabled));
    assert.equal(useSafeSpaceStore.getState().layerToggles.route, !wasEnabled);

    await act(async () => button("Reset zoom")!.click());
    assert.equal(useSafeSpaceStore.getState().zoom, 1);
    await act(async () => button("Open report")!.click());
    assert.equal(useSafeSpaceStore.getState().reportModalOpen, true);
  } finally {
    await act(async () => root.unmount());
  }
});
