import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isWebGLAvailable, Spatial3DErrorBoundary } from "../src/components/spatial/Spatial3DErrorBoundary";
import { tokens } from "../src/components/ui/tokens";
import { useSafeSpaceStore } from "../src/store/safespace-store";

test("isWebGLAvailable safely returns false in headless environment without throwing", () => {
  const available = isWebGLAvailable();
  assert.equal(typeof available, "boolean");
  // In Node.js headless environment without browser WebGL context, safely evaluates to false
  assert.equal(available, false);
});

test("Spatial3DErrorBoundary.getDerivedStateFromError activates fallback state without saving raw error", () => {
  const rawTechError = new Error("THREE.WebGLRenderer shader compilation failed at internal/file/path");
  const state = Spatial3DErrorBoundary.getDerivedStateFromError(rawTechError);

  assert.equal(state.hasError, true);
  assert.equal(state.isContextLost, false);
});

test("Spatial3DErrorBoundary.getDerivedStateFromContextLost activates context lost state", () => {
  const state = Spatial3DErrorBoundary.getDerivedStateFromContextLost();
  assert.equal(state.hasError, true);
  assert.equal(state.isContextLost, true);
});

test("Spatial3DErrorBoundary.getDerivedStateFromRetry handles unavailable and retry increments", () => {
  // In headless Node where WebGL is unavailable
  const state = Spatial3DErrorBoundary.getDerivedStateFromRetry(0);
  assert.equal(state.hasError, true);
  assert.equal(state.isContextLost, false);
});

test("raw technical errors never appear in user-facing fallback output, controlled copy is rendered", () => {
  const boundary = new Spatial3DErrorBoundary({
    children: null,
    onFallbackTo2D: () => {},
  });

  // Simulate caught error state
  boundary.state = {
    hasError: true,
    isContextLost: false,
    retryKey: 0,
  };

  const renderedHtml = renderToStaticMarkup(boundary.render() as React.ReactElement);

  // Technical terms and paths must never appear
  const forbiddenTerms = [
    "THREE.WebGLRenderer",
    "shader compilation failed",
    "internal/file/path",
    "driver",
    "stack",
    "worker",
    "Graphics Context Interrupted",
    "remain fully active",
  ];

  for (const term of forbiddenTerms) {
    assert.equal(
      renderedHtml.includes(term),
      false,
      `Forbidden technical term or unsupported claim "${term}" found in user-facing fallback output`
    );
  }

  // Controlled user copy must appear
  assert.match(renderedHtml, /3D view is unavailable/);
  assert.match(renderedHtml, /3D could not be displayed\. You can continue with the current 2D plan\./);
  assert.match(renderedHtml, /Continue in 2D Plan/);
  assert.match(renderedHtml, /Retry 3D view/);
});

test("context loss renders controlled interrupted copy without technical jargon", () => {
  const boundary = new Spatial3DErrorBoundary({
    children: null,
    onFallbackTo2D: () => {},
  });

  // Simulate context loss state
  boundary.state = {
    hasError: true,
    isContextLost: true,
    retryKey: 0,
  };

  const renderedHtml = renderToStaticMarkup(boundary.render() as React.ReactElement);

  assert.equal(
    renderedHtml.includes("Graphics Context Interrupted"),
    false,
    "Raw technical term 'Graphics Context Interrupted' must not appear"
  );
  assert.match(renderedHtml, /3D view was interrupted/);
  assert.match(renderedHtml, /The 3D view stopped unexpectedly\. You can retry or continue with the current 2D plan\./);
});

test("unsupported phrase 'remain fully active' has zero occurrences across all files in src/", () => {
  const srcDir = path.resolve(import.meta.dirname, "../src");

  function scanDir(dir: string): string[] {
    const matches: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        matches.push(...scanDir(fullPath));
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes("remain fully active")) {
          matches.push(fullPath);
        }
      }
    }
    return matches;
  }

  const offendingFiles = scanDir(srcDir);
  assert.deepEqual(offendingFiles, [], "Files in src/ containing 'remain fully active'");
});

test("switching between 2D and 3D preserves spatial state perfectly", () => {
  const store = useSafeSpaceStore.getState();
  const initialSnapshot = {
    viewMode: store.viewMode,
    rooms: structuredClone(store.rooms),
    walls: structuredClone(store.walls),
    doors: structuredClone(store.doors),
    furniture: structuredClone(store.furniture),
    hazards: structuredClone(store.hazards),
    routeWaypoints: structuredClone(store.routeWaypoints),
  };

  try {
    assert.ok(initialSnapshot.rooms.length > 0, "Rooms count must be non-zero");
    assert.ok(initialSnapshot.walls.length > 0, "Walls count must be non-zero");
    assert.ok(initialSnapshot.doors.length > 0, "Doors count must be non-zero");
    assert.ok(initialSnapshot.furniture.length > 0, "Furniture count must be non-zero");
    assert.ok(initialSnapshot.hazards.length > 0, "Hazards count must be non-zero");
    assert.ok(initialSnapshot.routeWaypoints.length > 0, "Route waypoints must be non-zero");

    // Switch to 3D
    store.setViewMode("3d");
    assert.equal(useSafeSpaceStore.getState().viewMode, "3d");

    // Fallback to 2D
    store.setViewMode("2d");
    assert.equal(useSafeSpaceStore.getState().viewMode, "2d");

    // Verify all spatial state is completely identical across full domain models
    const postStore = useSafeSpaceStore.getState();
    assert.deepEqual(postStore.rooms, initialSnapshot.rooms);
    assert.deepEqual(postStore.walls, initialSnapshot.walls);
    assert.deepEqual(postStore.doors, initialSnapshot.doors);
    assert.deepEqual(postStore.furniture, initialSnapshot.furniture);
    assert.deepEqual(postStore.hazards, initialSnapshot.hazards);
    assert.deepEqual(postStore.routeWaypoints, initialSnapshot.routeWaypoints);
  } finally {
    useSafeSpaceStore.setState({
      viewMode: initialSnapshot.viewMode,
      rooms: initialSnapshot.rooms,
      walls: initialSnapshot.walls,
      doors: initialSnapshot.doors,
      furniture: initialSnapshot.furniture,
      hazards: initialSnapshot.hazards,
      routeWaypoints: initialSnapshot.routeWaypoints,
    });
  }
});

test("Spatial3DErrorBoundary isolates context-loss events strictly to its own container subtree", () => {
  const boundary = new Spatial3DErrorBoundary({ children: null });

  let preventDefaultCalled = false;
  let stateUpdated = false;
  boundary.setState = () => {
    stateUpdated = true;
  };

  // Mock DOM elements
  const mockChild = { nodeType: 1 } as unknown as Node;
  const mockOutside = { nodeType: 1 } as unknown as Node;
  const mockContainer = {
    contains: (node: unknown) => node === mockChild,
  } as unknown as HTMLDivElement;

  Object.defineProperty(boundary, "containerRef", {
    value: { current: mockContainer },
  });

  // Context loss from sibling canvas / external node
  const externalEvent = {
    target: mockOutside,
    preventDefault: () => {
      preventDefaultCalled = true;
    },
  } as unknown as Event;

  boundary.handleContextLost(externalEvent);
  assert.equal(preventDefaultCalled, false, "External context loss must not prevent default or affect this boundary");
  assert.equal(stateUpdated, false, "External context loss must not trigger fallback state");

  // Context loss from inner canvas
  const internalEvent = {
    target: mockChild,
    preventDefault: () => {
      preventDefaultCalled = true;
    },
  } as unknown as Event;

  boundary.handleContextLost(internalEvent);
  assert.equal(preventDefaultCalled, true, "Internal context loss must call preventDefault");
  assert.equal(stateUpdated, true, "Internal context loss must trigger fallback state");
});

test("design tokens export calm clinical palette and architectural contrast", () => {
  assert.equal(tokens.colors.canvas, "#f7f8f6");
  assert.equal(tokens.colors.primary.default, "#1e7168");
  assert.equal(tokens.colors.text.primary, "#192329");
  assert.equal(tokens.colors.warning.default, "#d97706");
  assert.equal(tokens.colors.danger.default, "#dc2626");
  assert.equal(tokens.colors.success.default, "#16a34a");
  assert.ok(tokens.radii.md);
  assert.ok(tokens.shadows.card);
  assert.ok(tokens.zIndex.modal > tokens.zIndex.overlay);
});
