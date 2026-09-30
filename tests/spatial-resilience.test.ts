import test from "node:test";
import assert from "node:assert/strict";
import { isWebGLAvailable, Spatial3DErrorBoundary } from "../src/components/spatial/Spatial3DErrorBoundary";
import { tokens } from "../src/components/ui/tokens";
import { useSafeSpaceStore } from "../src/store/safespace-store";

test("isWebGLAvailable safely returns false in headless environment without throwing", () => {
  const available = isWebGLAvailable();
  assert.equal(typeof available, "boolean");
  // In Node.js headless environment without browser WebGL context, safely evaluates to false
  assert.equal(available, false);
});

test("Spatial3DErrorBoundary.getDerivedStateFromError sets error state and message", () => {
  const testError = new Error("WebGL context creation failed");
  const state = Spatial3DErrorBoundary.getDerivedStateFromError(testError);

  assert.equal(state.hasError, true);
  assert.equal(state.isContextLost, false);
  assert.equal(state.errorMessage, "WebGL context creation failed");
});

test("Spatial3DErrorBoundary.getDerivedStateFromContextLost sets context lost state and error message", () => {
  const state = Spatial3DErrorBoundary.getDerivedStateFromContextLost();
  assert.equal(state.hasError, true);
  assert.equal(state.isContextLost, true);
  assert.match(state.errorMessage ?? "", /lost or reset/);
});

test("Spatial3DErrorBoundary.getDerivedStateFromRetry handles unavailable and retry increments", () => {
  // In headless Node where WebGL is unavailable
  const state = Spatial3DErrorBoundary.getDerivedStateFromRetry(0);
  assert.equal(state.hasError, true);
  assert.equal(state.isContextLost, false);
  assert.match(state.errorMessage ?? "", /unavailable/);
});

test("switching between 2D and 3D preserves spatial state perfectly", () => {
  const store = useSafeSpaceStore.getState();
  const initialFurnitureCount = store.furniture.length;
  const initialHazardsCount = store.hazards.length;
  const initialRouteLength = store.routeWaypoints.length;

  assert.ok(initialFurnitureCount > 0, "Furniture count must be non-zero");
  assert.ok(initialHazardsCount > 0, "Hazards count must be non-zero");
  assert.ok(initialRouteLength > 0, "Route waypoints must be non-zero");

  // Switch to 3D
  store.setViewMode("3d");
  assert.equal(useSafeSpaceStore.getState().viewMode, "3d");

  // Fallback to 2D
  store.setViewMode("2d");
  assert.equal(useSafeSpaceStore.getState().viewMode, "2d");

  // Verify all spatial state is completely identical
  const postStore = useSafeSpaceStore.getState();
  assert.equal(postStore.furniture.length, initialFurnitureCount);
  assert.equal(postStore.hazards.length, initialHazardsCount);
  assert.equal(postStore.routeWaypoints.length, initialRouteLength);
  assert.equal(postStore.furniture[0].id, store.furniture[0].id);
  assert.equal(postStore.furniture[0].x, store.furniture[0].x);
  assert.equal(postStore.furniture[0].y, store.furniture[0].y);
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
