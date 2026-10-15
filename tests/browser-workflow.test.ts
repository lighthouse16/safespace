import test from "node:test";
import assert from "node:assert/strict";
import { useSafeSpaceStore } from "@/store/safespace-store";

class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as unknown as { window: unknown }).window = globalThis;
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});

test("Browser Workflow: Store initialization defaults to Demo assessment safely", () => {
  const store = useSafeSpaceStore.getState();
  assert.equal(store.assessmentType, "demo");
  assert.equal(store.storageStatus, "idle");
  assert.equal(store.remoteSyncStatus, "idle");
});

test("Browser Workflow: Intake user assessment lifecycle and observable sync state", async () => {
  const store = useSafeSpaceStore.getState();
  const assessmentId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  const result = await store.createAndLoadUserAssessment({
    metadata: {
      id: assessmentId,
      name: "Sunnybrook Ward 4",
      facilityName: "Sunnybrook Health",
      spaceName: "Room 401",
      environmentType: "hospital",
      notes: "Post-op mobility clearance check",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 500 },
      { x: 0, y: 500 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 6.0,
      unit: "m",
      pixelDistance: 600,
      originPolicy: "canvas-origin-0-0",
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.isSaved, true);

  const updatedState = useSafeSpaceStore.getState();
  assert.equal(updatedState.assessmentType, "user");
  assert.equal(updatedState.assessmentId, assessmentId);
  assert.equal(updatedState.canonicalBoundary?.length, 4);
  assert.equal(updatedState.storageStatus, "saved");
});

test("Browser Workflow: Stage 1 furniture addition and footprint validation", () => {
  const store = useSafeSpaceStore.getState();

  // Add chair
  store.addFurniture("chair");
  const stateWithFurniture = useSafeSpaceStore.getState();
  assert.ok(stateWithFurniture.furniture.length > 0, "Furniture item must be added");
  const addedItem = stateWithFurniture.furniture[stateWithFurniture.furniture.length - 1];

  // Rotate furniture
  store.rotateFurniture(addedItem.id);
  const rotatedState = useSafeSpaceStore.getState();
  const rotatedItem = rotatedState.furniture.find((f) => f.id === addedItem.id);
  assert.equal(rotatedItem?.rotation, (addedItem.rotation + 90) % 360);
});

test("Browser Workflow: Stage 3 Route waypoint creation and pathfinding", () => {
  const store = useSafeSpaceStore.getState();

  const initialCount = store.routeWaypoints.length;
  store.addRouteWaypoint("Entry Door", 50, 250);
  store.addRouteWaypoint("Target Bed", 450, 250);

  const stateWithRoute = useSafeSpaceStore.getState();
  assert.equal(stateWithRoute.routeWaypoints.length, initialCount + 2);

  store.recalculateRoute();
  const routedState = useSafeSpaceStore.getState();
  assert.ok(routedState.routeResult !== null, "Route calculation must produce RouteResult");
});
