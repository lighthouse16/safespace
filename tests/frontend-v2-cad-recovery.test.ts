import test from "node:test";
import assert from "node:assert/strict";
import { useSafeSpaceStore } from "@/store/safespace-store";
import {
  SAFESPACE_STORAGE_VERSION,
  getPersistedAssessment,
  savePersistedAssessment,
  validatePersistedPayload,
  type PersistedAssessmentState,
} from "@/lib/storage/persistence";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
const browserStorage = new MemoryStorage();
Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: browserStorage, configurable: true });

test("CAD V2: manual hazard is distinguishable from verified engine findings and editable", () => {
  useSafeSpaceStore.setState({ assessmentType: "demo", hazards: [], selectedHazardId: null });
  const store = useSafeSpaceStore.getState();
  store.addManualHazard({ x: 100, y: 120 });
  const note = useSafeSpaceStore.getState().hazards[0];
  assert.equal(note.code, "MANUAL");
  assert.equal(note.requiresReview, true);
  assert.equal(note.detectionConfidence, 0);
  assert.match(note.measuredEvidence, /No physical measurement/);
  assert.equal(useSafeSpaceStore.getState().selectedHazardId, note.id);
  useSafeSpaceStore.getState().renameHazard(note.id, "Observed loose cable");
  useSafeSpaceStore.getState().moveHazard(note.id, { x: 130, y: 140 });
  assert.equal(useSafeSpaceStore.getState().hazards[0].title, "Observed loose cable");
  assert.deepEqual(useSafeSpaceStore.getState().hazards[0].position, { x: 130, y: 140 });
  useSafeSpaceStore.getState().deleteHazard(note.id);
  assert.equal(useSafeSpaceStore.getState().hazards.length, 0);
});

test("CAD V2: furniture inspector rename updates canonical store with input validation", () => {
  const initial = useSafeSpaceStore.getState().furniture[0];
  assert.ok(initial);
  useSafeSpaceStore.getState().renameFurniture(initial.id, "Patient chair");
  assert.equal(useSafeSpaceStore.getState().furniture.find((item) => item.id === initial.id)?.name, "Patient chair");
  useSafeSpaceStore.getState().renameFurniture(initial.id, "   ");
  assert.equal(useSafeSpaceStore.getState().furniture.find((item) => item.id === initial.id)?.name, "Patient chair");
});

test("CAD V2: drawn partition affects structural store and supports undo", () => {
  useSafeSpaceStore.setState({
    assessmentType: "demo",
    walls: [],
    history: [],
    future: [],
    structurePast: [],
    structureFuture: [],
    placementError: null,
  });
  useSafeSpaceStore.getState().addPartitionWall({ x: 80, y: 120 }, { x: 80, y: 126 });
  assert.equal(useSafeSpaceStore.getState().walls.length, 0);
  assert.match(useSafeSpaceStore.getState().placementError || "", /at least 10 cm/);
  useSafeSpaceStore.setState({ canonicalBoundary: [
    { x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 160 }, { x: 0, y: 160 },
  ] });
  useSafeSpaceStore.getState().addPartitionWall({ x: 80, y: 120 }, { x: 180, y: 120 });
  assert.equal(useSafeSpaceStore.getState().walls.length, 0);
  assert.match(useSafeSpaceStore.getState().placementError || "", /calibrated floor boundary/);
  useSafeSpaceStore.setState({ canonicalBoundary: null });
  useSafeSpaceStore.getState().addPartitionWall({ x: 80, y: 120 }, { x: 180, y: 120 });
  const updated = useSafeSpaceStore.getState();
  assert.equal(updated.walls.length, 1);
  assert.equal(updated.walls[0].thickness, 12);
  assert.ok(updated.routeResult);
  updated.undo();
  assert.equal(useSafeSpaceStore.getState().walls.length, 0);
});

test("CAD V2: local persisted walls and hazards survive save/load with strict shape validation", () => {
  const wall = { id: "wall-a", start: { x: 10, y: 10 }, end: { x: 90, y: 10 }, thickness: 12, isExterior: false };
  const note = {
    id: "manual-a", code: "MANUAL", title: "Observed cable",
    severity: "medium" as const, position: { x: 20, y: 20 },
    plainDescription: "Manual note", measuredEvidence: "Unverified",
    detectionConfidence: 0, requiresReview: true,
    recommendation: "Review location",
  };
  const payload: PersistedAssessmentState = {
    schemaVersion: SAFESPACE_STORAGE_VERSION,
    assessmentType: "demo",
    metadata: null, canonicalBoundary: null, calibration: null,
    activeProfileId: "walker", routeWaypoints: [], furniture: [],
    walls: [wall], hazards: [note],
  };
  assert.equal(savePersistedAssessment(payload).success, true);
  const restored = getPersistedAssessment();
  assert.ok(restored);
  assert.deepEqual(restored.walls, [wall]);
  assert.deepEqual(restored.hazards, [note]);
  const bad = validatePersistedPayload({ ...payload, walls: [{ id: "bad", start: { x: Infinity, y: 0 }, end: { x: 0, y: 1 }, thickness: -1 }] });
  assert.equal(bad.isValid, false);
});
