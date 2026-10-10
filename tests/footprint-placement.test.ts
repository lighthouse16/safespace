import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveWorldFootprint,
  isFootprintContainedInBoundary,
  polygonIntersectsPolygon,
  findFeasibleFootprintPlacement,
  type Polygon2D,
  type CanonicalObject,
} from '../src/lib/spatial';
import { useSafeSpaceStore } from '../src/store/safespace-store';

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
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});

const RECT_ROOM: Polygon2D = [
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 500, y: 400 },
  { x: 0, y: 400 },
];

const L_SHAPED_ROOM: Polygon2D = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 200 },
  { x: 200, y: 200 },
  { x: 200, y: 400 },
  { x: 0, y: 400 },
];

test('Footprint Geometry: deriveWorldFootprint computes rotated 4-corner polygon around center', () => {
  const obj: CanonicalObject = {
    id: 'f1',
    roomId: 'room-1',
    name: 'Desk',
    category: 'furniture',
    position: { x: 200, y: 200 },
    dimensionsCm: { width: 100, depth: 60 },
    rotationDeg: 0,
    isFixed: false,
  };

  const fp0 = deriveWorldFootprint(obj);
  assert.equal(fp0.length, 4);
  assert.deepEqual(fp0[0], { x: 150, y: 170 });
  assert.deepEqual(fp0[1], { x: 250, y: 170 });
  assert.deepEqual(fp0[2], { x: 250, y: 230 });
  assert.deepEqual(fp0[3], { x: 150, y: 230 });

  const obj90: CanonicalObject = { ...obj, rotationDeg: 90 };
  const fp90 = deriveWorldFootprint(obj90);
  assert.equal(fp90.length, 4);
  const xs = fp90.map(p => Math.round(p.x)).sort((a, b) => a - b);
  const ys = fp90.map(p => Math.round(p.y)).sort((a, b) => a - b);
  assert.equal(xs[0], 170);
  assert.equal(xs[3], 230);
  assert.equal(ys[0], 150);
  assert.equal(ys[3], 250);
});

test('Boundary Containment: strictly verifies full polygon footprint inside room boundary', () => {
  const insideFp: Polygon2D = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
  ];
  assert.equal(isFootprintContainedInBoundary(insideFp, RECT_ROOM), true);

  const outsideFp: Polygon2D = [
    { x: 450, y: 100 },
    { x: 550, y: 100 },
    { x: 550, y: 200 },
    { x: 450, y: 200 },
  ];
  assert.equal(isFootprintContainedInBoundary(outsideFp, RECT_ROOM), false);

  const lInside: Polygon2D = [
    { x: 50, y: 250 },
    { x: 150, y: 250 },
    { x: 150, y: 350 },
    { x: 50, y: 350 },
  ];
  assert.equal(isFootprintContainedInBoundary(lInside, L_SHAPED_ROOM), true);

  const lNotch: Polygon2D = [
    { x: 250, y: 250 },
    { x: 350, y: 250 },
    { x: 350, y: 350 },
    { x: 250, y: 350 },
  ];
  assert.equal(isFootprintContainedInBoundary(lNotch, L_SHAPED_ROOM), false);
});

test('Collision Rejection: detects overlapping furniture polygons', () => {
  const p1: Polygon2D = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
  ];
  const pOverlap: Polygon2D = [
    { x: 150, y: 150 },
    { x: 250, y: 150 },
    { x: 250, y: 250 },
    { x: 150, y: 250 },
  ];
  const pSeparate: Polygon2D = [
    { x: 250, y: 250 },
    { x: 350, y: 250 },
    { x: 350, y: 350 },
    { x: 250, y: 350 },
  ];

  assert.equal(polygonIntersectsPolygon(p1, pOverlap), true);
  assert.equal(polygonIntersectsPolygon(p1, pSeparate), false);
});

test('Feasible Placement Search: finds valid position or returns null when impossible', () => {
  const obstacles = [
    {
      id: 'obs1',
      footprint: [
        { x: 100, y: 100 },
        { x: 250, y: 100 },
        { x: 250, y: 250 },
        { x: 100, y: 250 },
      ],
    },
  ];

  const feasible = findFeasibleFootprintPlacement(
    { width: 60, depth: 60 },
    RECT_ROOM,
    obstacles,
    { preferredPoint: { x: 350, y: 300 } }
  );
  assert.ok(feasible !== null);
  assert.deepEqual(feasible.position, { x: 350, y: 300 });

  const tinyRoom: Polygon2D = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 0, y: 40 },
  ];
  const impossible = findFeasibleFootprintPlacement(
    { width: 60, depth: 60 },
    tinyRoom,
    []
  );
  assert.equal(impossible, null);
});

test('Store Integration: moves and rotations outside boundary are rejected safely', () => {
  const store = useSafeSpaceStore.getState();
  const createRes = store.createAndLoadUserAssessment({
    metadata: {
      id: 'placement-test-space',
      name: 'Placement Test Space',
      facilityName: 'Test Facility',
      spaceName: 'Room A',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: RECT_ROOM,
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 500,
      unit: 'cm',
      pixelDistance: 500,
      originPolicy: 'canvas-origin-0-0',
    },
  });
  assert.equal(createRes.success, true, 'User assessment creation must succeed');

  store.addFurniture('chair');
  const chair = useSafeSpaceStore.getState().furniture[0];
  assert.ok(chair, 'Chair was added');
  const initialX = chair.x;
  const initialY = chair.y;

  // Move chair way outside room boundary (x = 800)
  store.moveFurniture(chair.id, 800, 200);
  const chairAfterBadMove = useSafeSpaceStore.getState().furniture.find(f => f.id === chair.id)!;
  assert.equal(chairAfterBadMove.x, initialX, 'Invalid move out of boundary was rejected');
  assert.equal(chairAfterBadMove.y, initialY, 'Y position unchanged');

  // Valid move inside room boundary
  store.moveFurniture(chair.id, 100, 100);
  const chairAfterGoodMove = useSafeSpaceStore.getState().furniture.find(f => f.id === chair.id)!;
  assert.equal(chairAfterGoodMove.x, 100, 'Valid move inside boundary was accepted');
  assert.equal(chairAfterGoodMove.y, 100);

  // Clean up store
  store.resetToDemo();
});
