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
