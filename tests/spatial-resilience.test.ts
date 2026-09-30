import test from "node:test";
import assert from "node:assert/strict";
import { isWebGLAvailable, Spatial3DErrorBoundary } from "../src/components/spatial/Spatial3DErrorBoundary";
import { tokens } from "../src/components/ui/tokens";

test("isWebGLAvailable safely returns false in headless environment without throwing", () => {
  const available = isWebGLAvailable();
  assert.equal(typeof available, "boolean");
  // In Node.js headless environment without WebGL context, it should safely evaluate to false
  assert.equal(available, false);
});

test("Spatial3DErrorBoundary.getDerivedStateFromError sets error state and message", () => {
  const testError = new Error("WebGL context creation failed");
  const state = Spatial3DErrorBoundary.getDerivedStateFromError(testError);

  assert.equal(state.hasError, true);
  assert.equal(state.isContextLost, false);
  assert.equal(state.errorMessage, "WebGL context creation failed");
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
});
