import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AssessmentsPage from '../src/app/assessments/page';
import {
  saveFloorplanImage,
  getFloorplanImage,
  deleteFloorplanImage,
  clearAllFloorplanImages,
  type PersistedFloorplanImage,
} from '../src/lib/storage/image-db';
import { coordinatedDeleteAssessment } from '../src/lib/storage/coordinated-storage';
import {
  loadPersistedAssessment,
  savePersistedAssessment,
  getPersistedAssessment,
  loadActiveWorkspace,
  saveActiveWorkspace,
  getPendingMediaCleanups,
  clearPendingMediaCleanups,
  SAFESPACE_STORAGE_KEY,
  SAFESPACE_ACTIVE_WORKSPACE_KEY,
  SAFESPACE_PENDING_MEDIA_CLEANUP_KEY,
} from '../src/lib/storage/persistence';
import { useSafeSpaceStore } from '../src/store/safespace-store';
import { computeSceneFingerprint } from '../src/lib/spatial/optimization/optimizer';

interface MockRecord {
  assessmentId: string;
  blob: Blob;
  mimeType: string;
  name: string;
  size: number;
  canvasWidth: number;
  canvasHeight: number;
  updatedAt: string;
}

interface MockRequest<T> {
  result: T;
  onsuccess: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

interface MockTransaction {
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  objectStore: (name: string) => {
    put: (item: MockRecord) => void;
    get: (key: string) => MockRequest<MockRecord | null>;
    delete: (key: string) => void;
    clear: () => void;
    count?: () => MockRequest<number>;
  };
}

// In-memory Mock IndexedDB engine
class MockIDBDatabase {
  closed = false;
  closeCalls = 0;
  stores = new Map<string, Map<string, MockRecord>>();
  failNextTx: 'error' | 'abort' | null = null;
  failOnDeleteId: string | null = null;
  failNextCount = false;
  omitCountFunction = false;

  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };

  createObjectStore(name: string) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return {};
  }

  close() {
    this.closed = true;
    this.closeCalls++;
  }

  transaction(storeName: string): MockTransaction {
    if (this.failNextTx) {
      const mode = this.failNextTx;
      this.failNextTx = null;
      const tx: MockTransaction = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => ({
          put: () => {
            setTimeout(() => {
              if (mode === 'abort') tx.onabort?.();
              else tx.onerror?.();
            }, 0);
          },
          get: () => {
            const req: MockRequest<MockRecord | null> = { result: null, onsuccess: null, onerror: null };
            setTimeout(() => {
              req.onerror?.({});
              tx.onerror?.();
            }, 0);
            return req;
          },
          delete: () => {
            setTimeout(() => {
              tx.onerror?.();
            }, 0);
          },
          clear: () => {
            setTimeout(() => {
              tx.onerror?.();
            }, 0);
          },
          count: () => {
            const req: MockRequest<number> = { result: 0, onsuccess: null, onerror: null };
            setTimeout(() => {
              if (mode === 'abort') tx.onabort?.();
              else {
                req.onerror?.({});
                tx.onerror?.();
              }
            }, 0);
            return req;
          },
        }),
      };
      return tx;
    }

    const dataStore = this.stores.get(storeName) || new Map<string, MockRecord>();
    const tx: MockTransaction = {
      oncomplete: null,
      onerror: null,
      onabort: null,
      objectStore: () => {
        const storeObj: {
          put: (item: MockRecord) => void;
          get: (key: string) => MockRequest<MockRecord | null>;
          delete: (key: string) => void;
          clear: () => void;
          count?: () => MockRequest<number>;
        } = {
          put: (item: MockRecord) => {
            dataStore.set(item.assessmentId, item);
            setTimeout(() => tx.oncomplete?.(), 0);
          },
          get: (key: string) => {
            const req: MockRequest<MockRecord | null> = { result: dataStore.get(key) || null, onsuccess: null, onerror: null };
            setTimeout(() => {
              req.onsuccess?.({ target: req });
              tx.oncomplete?.();
            }, 0);
            return req;
          },
          delete: (key: string) => {
            if (this.failOnDeleteId && key === this.failOnDeleteId) {
              this.failOnDeleteId = null;
              setTimeout(() => tx.onerror?.(), 0);
              return;
            }
            dataStore.delete(key);
            setTimeout(() => tx.oncomplete?.(), 0);
          },
          clear: () => {
            dataStore.clear();
            setTimeout(() => tx.oncomplete?.(), 0);
          },
        };

        if (!this.omitCountFunction) {
          storeObj.count = () => {
            if (this.failNextCount) {
              this.failNextCount = false;
              const req: MockRequest<number> = { result: 0, onsuccess: null, onerror: null };
              setTimeout(() => {
                req.onerror?.({});
                tx.onerror?.();
              }, 0);
              return req;
            }
            const req: MockRequest<number> = { result: dataStore.size, onsuccess: null, onerror: null };
            setTimeout(() => {
              req.onsuccess?.({ target: req });
              tx.oncomplete?.();
            }, 0);
            return req;
          };
        }

        return storeObj;
      },
    };
    return tx;
  }
}

const mockDbInstance = new MockIDBDatabase();
mockDbInstance.createObjectStore('floorplan_images');

const mockIndexedDB = {
  open: () => {
    const req: {
      result: MockIDBDatabase;
      onupgradeneeded: ((ev: unknown) => void) | null;
      onsuccess: ((ev: unknown) => void) | null;
      onerror: ((ev: unknown) => void) | null;
    } = {
      result: mockDbInstance,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };
    setTimeout(() => {
      req.onupgradeneeded?.({ target: req });
      req.onsuccess?.({ target: req });
    }, 0);
    return req;
  },
};

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

const mockLs = new MockLocalStorage();

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost:3000",
});

Object.defineProperty(dom.window, 'localStorage', {
  get() { return mockLs; },
  configurable: true,
});
Object.defineProperty(dom.window, 'indexedDB', {
  get() { return mockIndexedDB; },
  configurable: true,
});

Object.defineProperty(globalThis, 'window', {
  value: dom.window,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: dom.window.document,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  get() { return mockLs; },
  configurable: true,
});
Object.defineProperty(globalThis, 'HTMLElement', {
  value: dom.window.HTMLElement,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'SVGElement', {
  value: dom.window.SVGElement,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'self', {
  value: globalThis,
  writable: true,
  configurable: true,
});
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
  configurable: true,
});
Object.defineProperty(dom.window, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
  configurable: true,
});

(globalThis as unknown as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
(globalThis as unknown as Record<string, unknown>).cancelAnimationFrame = (id: NodeJS.Timeout) => clearTimeout(id);
(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

test('IndexedDB Storage: save, retrieve, delete lifecycle with connection closing', async () => {
  const dummyBlob = new Blob(['sample-svg-content'], { type: 'image/svg+xml' });
  const record: PersistedFloorplanImage = {
    assessmentId: 'test-assessment-1',
    blob: dummyBlob,
    mimeType: 'image/svg+xml',
    name: 'plan.svg',
    size: dummyBlob.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  };

  const initialCloses = mockDbInstance.closeCalls;

  // 1. Save
  const saved = await saveFloorplanImage(record);
  assert.equal(saved, true, 'Image must be saved successfully');
  assert.ok(mockDbInstance.closeCalls > initialCloses, 'Database connection was closed after save');

  // 2. Retrieve
  const retrieved = await getFloorplanImage('test-assessment-1');
  assert.ok(retrieved !== null, 'Saved record is retrieved');
  assert.equal(retrieved.name, 'plan.svg');
  assert.equal(retrieved.mimeType, 'image/svg+xml');

  // 3. Delete
  const deleted = await deleteFloorplanImage('test-assessment-1');
  assert.equal(deleted, true, 'Image must be deleted successfully');

  // 4. Verify post-deletion retrieval is null
  const postDelete = await getFloorplanImage('test-assessment-1');
  assert.equal(postDelete, null, 'Deleted image returns null');
});

test('IndexedDB Storage: clearAllFloorplanImages purges entire image store', async () => {
  const b1 = new Blob(['image1'], { type: 'image/png' });
  const b2 = new Blob(['image2'], { type: 'image/png' });

  await saveFloorplanImage({
    assessmentId: 'room-1',
    blob: b1,
    mimeType: 'image/png',
    name: 'r1.png',
    size: b1.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });

  await saveFloorplanImage({
    assessmentId: 'room-2',
    blob: b2,
    mimeType: 'image/png',
    name: 'r2.png',
    size: b2.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });

  assert.ok(await getFloorplanImage('room-1') !== null);
  assert.ok(await getFloorplanImage('room-2') !== null);

  const purged = await clearAllFloorplanImages();
  assert.equal(purged, true);

  assert.equal(await getFloorplanImage('room-1'), null);
  assert.equal(await getFloorplanImage('room-2'), null);
});

test('Store Assessment Lifecycle: replaces previous image on new assessment and purges on clear', async () => {
  const store = useSafeSpaceStore.getState();
  const dummyFile = new Blob(['floorplan-binary'], { type: 'image/png' });

  // Create assessment A with image
  await store.createAndLoadUserAssessment({
    metadata: {
      id: 'space-a',
      name: 'Space A',
      facilityName: 'Facility A',
      spaceName: 'Room 1',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 400,
      unit: 'cm',
      pixelDistance: 400,
      originPolicy: 'canvas-origin-0-0',
    },
    imageFile: dummyFile,
  });

  const storedA = await getFloorplanImage('space-a');
  assert.ok(storedA !== null, 'Space A floorplan image is persisted');

  // Create assessment B with new ID
  await store.createAndLoadUserAssessment({
    metadata: {
      id: 'space-b',
      name: 'Space B',
      facilityName: 'Facility B',
      spaceName: 'Room 2',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 400,
      unit: 'cm',
      pixelDistance: 400,
      originPolicy: 'canvas-origin-0-0',
    },
    imageFile: dummyFile,
  });

  // Space A should be purged, Space B should be present
  const storedAPost = await getFloorplanImage('space-a');
  const storedB = await getFloorplanImage('space-b');
  assert.equal(storedAPost, null, 'Previous assessment image A was purged');
  assert.ok(storedB !== null, 'New assessment image B is persisted');

  // Clear user assessment
  await store.clearUserAssessment();
  const storedBPost = await getFloorplanImage('space-b');
  assert.equal(storedBPost, null, 'User assessment clear purges all images');
});

test('Adversarial Storage: IDB save failure aborts creation, rejects operation, and preserves prior state', async () => {
  const dummyFile = new File(['adv-bytes'], 'plan.png', { type: 'image/png' });
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();
  globalThis.localStorage.clear();

  mockDbInstance.failNextTx = 'error';

  const res = await store.createAndLoadUserAssessment({
    metadata: {
      id: 'adv-fail-idb',
      name: 'Fail IDB Space',
      facilityName: 'Test Facility',
      spaceName: 'Room 1',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 300,
      unit: 'cm',
      pixelDistance: 300,
      originPolicy: 'canvas-origin-0-0',
    },
    imageFile: dummyFile,
  });

  assert.equal(res.success, false, 'Operation must report failure');
  assert.match(res.error || '', /IndexedDB|local database/i);
  assert.equal(useSafeSpaceStore.getState().storageStatus, 'error');
  assert.equal(useSafeSpaceStore.getState().assessmentType, 'demo', 'Must not load unpersisted space');
  assert.equal(await getFloorplanImage('adv-fail-idb'), null, 'No orphan image in IDB');
  assert.equal(loadPersistedAssessment().success, false, 'localStorage must be untouched');
});

test('Adversarial Storage: localStorage save failure rolls back IndexedDB image', async () => {
  const dummyFile = new File(['rollback-bytes'], 'plan.png', { type: 'image/png' });
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  const origSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new Error('QuotaExceededError: storage is full');
  };

  try {
    const res = await store.createAndLoadUserAssessment({
      metadata: {
        id: 'adv-rollback-ls',
        name: 'Rollback Space',
        facilityName: 'Test Facility',
        spaceName: 'Room 1',
        environmentType: 'clinic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      boundaryCm: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 300 },
        { x: 0, y: 300 },
      ],
      calibration: {
        pixelsPerCm: 1.0,
        realLength: 300,
        unit: 'cm',
        pixelDistance: 300,
        originPolicy: 'canvas-origin-0-0',
      },
      imageFile: dummyFile,
    });

    assert.equal(res.success, false, 'Must report failure on localStorage exception');
    assert.equal(useSafeSpaceStore.getState().storageStatus, 'error');

    // Invariant: IDB image must be rolled back and cleaned up
    const storedImg = await getFloorplanImage('adv-rollback-ls');
    assert.equal(storedImg, null, 'IDB image must be rolled back after localStorage write failure');
  } finally {
    globalThis.localStorage.setItem = origSetItem;
  }
});

test('Adversarial Storage: IDB delete failure prevents deceptive success in clearUserAssessment', async () => {
  const dummyFile = new File(['del-fail-bytes'], 'plan.png', { type: 'image/png' });
  const store = useSafeSpaceStore.getState();

  const createRes = await store.createAndLoadUserAssessment({
    metadata: {
      id: 'adv-fail-del',
      name: 'Delete Fail Space',
      facilityName: 'Test Facility',
      spaceName: 'Room 1',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 300,
      unit: 'cm',
      pixelDistance: 300,
      originPolicy: 'canvas-origin-0-0',
    },
    imageFile: dummyFile,
  });
  assert.equal(createRes.success, true);
  assert.ok((await getFloorplanImage('adv-fail-del')) !== null, 'Image exists in IDB');

  // Inject IDB error during delete
  mockDbInstance.failNextTx = 'error';
  const delRes = await store.clearUserAssessment();

  assert.equal(delRes.success, false, 'clearUserAssessment must report failure when IDB delete fails');
  assert.equal(useSafeSpaceStore.getState().storageStatus, 'error');
  assert.equal(useSafeSpaceStore.getState().assessmentType, 'user', 'User state must be retained for retry');

  // Retry when IDB is healthy succeeds
  const retryRes = await store.clearUserAssessment();
  assert.equal(retryRes.success, true, 'Retry must succeed once IDB error is resolved');
  assert.equal(await getFloorplanImage('adv-fail-del'), null, 'IDB image is now cleared');
  assert.equal(useSafeSpaceStore.getState().assessmentType, 'demo', 'Clean switch to demo');
});

test('Adversarial Storage: coordinatedDeleteAssessment verifies absence before returning success', async () => {
  const dummyBlob = new Blob(['sample-content'], { type: 'image/png' });
  await saveFloorplanImage({
    assessmentId: 'coord-verify-space',
    blob: dummyBlob,
    mimeType: 'image/png',
    name: 'coord.png',
    size: dummyBlob.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });
  globalThis.localStorage.setItem(SAFESPACE_STORAGE_KEY, JSON.stringify({ metadata: { id: 'coord-verify-space' } }));

  assert.ok((await getFloorplanImage('coord-verify-space')) !== null);
  assert.ok(globalThis.localStorage.getItem(SAFESPACE_STORAGE_KEY) !== null);

  const delRes = await coordinatedDeleteAssessment('coord-verify-space');
  assert.equal(delRes.success, true);
  assert.equal(delRes.localStorageCleared, true);
  assert.equal(delRes.mediaCleared, true);

  // Authoritative check
  assert.equal(await getFloorplanImage('coord-verify-space'), null, 'IDB record must not exist');
  assert.equal(globalThis.localStorage.getItem(SAFESPACE_STORAGE_KEY), null, 'localStorage key must not exist');
});

test('Adversarial Storage P0-1: selective setItem failure on active-workspace key preserves previous assessment and image with no orphan media', async () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  // 1. Seed previous confirmed assessment with image
  const prevFile = new File(['prev-image-data'], 'prev.png', { type: 'image/png' });
  await saveFloorplanImage({
    assessmentId: 'prev-p01-id',
    blob: prevFile,
    mimeType: 'image/png',
    name: 'prev.png',
    size: prevFile.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'prev-p01-id',
      name: 'Previous Confirmed Space',
      facilityName: 'St. Jude Rehab',
      spaceName: 'Physical Therapy Suite',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 400,
      unit: 'cm',
      pixelDistance: 400,
      originPolicy: 'canvas-origin-0-0',
    },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: true,
  });
  saveActiveWorkspace('user');

  // Verify baseline
  assert.ok((await getFloorplanImage('prev-p01-id')) !== null);
  assert.equal(getPersistedAssessment()?.metadata?.id, 'prev-p01-id');
  assert.equal(loadActiveWorkspace(), 'user');

  // 2. Intercept localStorage.setItem: throw ONLY when writing SAFESPACE_ACTIVE_WORKSPACE_KEY
  const origSetItem = globalThis.localStorage.setItem.bind(globalThis.localStorage);
  globalThis.localStorage.setItem = (key: string, value: string) => {
    if (key === SAFESPACE_ACTIVE_WORKSPACE_KEY) {
      throw new Error('DiskFull: Cannot write active workspace pointer');
    }
    origSetItem(key, value);
  };

  const newFile = new File(['new-image-data'], 'new.png', { type: 'image/png' });

  try {
    const res = await store.createAndLoadUserAssessment({
      metadata: {
        id: 'new-p01-id',
        name: 'New Candidate Space',
        facilityName: 'St. Jude Rehab',
        spaceName: 'Room 2',
        environmentType: 'clinic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      boundaryCm: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 500 },
        { x: 0, y: 500 },
      ],
      calibration: {
        pixelsPerCm: 1.0,
        realLength: 500,
        unit: 'cm',
        pixelDistance: 500,
        originPolicy: 'canvas-origin-0-0',
      },
      imageFile: newFile,
    });

    // Operation must report failure
    assert.equal(res.success, false, 'Must report failure when active workspace write fails');
    assert.equal(res.rollbackFailed, false, 'Rollback must have succeeded cleanly');
    assert.equal(useSafeSpaceStore.getState().storageStatus, 'error');

    // Invariant 1: Previous assessment must be preserved in localStorage
    const currentPersisted = getPersistedAssessment();
    assert.equal(currentPersisted?.metadata?.id, 'prev-p01-id', 'Previous assessment must remain intact');

    // Invariant 2: Previous image must be preserved in IndexedDB
    const prevImg = await getFloorplanImage('prev-p01-id');
    assert.ok(prevImg !== null, 'Previous floorplan image must NOT be deleted');

    // Invariant 3: No orphan new image in IndexedDB
    const newImg = await getFloorplanImage('new-p01-id');
    assert.equal(newImg, null, 'New image must be rolled back and not orphaned in IDB');

    // Invariant 4: Active workspace selection restored
    assert.equal(loadActiveWorkspace(), 'user', 'Active workspace selection must remain preserved');

    // Invariant 5: In-memory store does not navigate to new assessment
    assert.notEqual(useSafeSpaceStore.getState().assessmentId, 'new-p01-id', 'Store must not switch to failed assessment');
  } finally {
    globalThis.localStorage.setItem = origSetItem;
  }
});

test('Adversarial Storage P0-1: failure when same assessment ID is reused preserves previous image in IndexedDB', async () => {
  const store = useSafeSpaceStore.getState();
  store.resetToDemo();

  // 1. Seed assessment with image for 'reused-space-id'
  const originalBlob = new Blob(['original-floorplan-bytes'], { type: 'image/png' });
  await saveFloorplanImage({
    assessmentId: 'reused-space-id',
    blob: originalBlob,
    mimeType: 'image/png',
    name: 'original.png',
    size: originalBlob.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'reused-space-id',
      name: 'Original Reused Space',
      facilityName: 'Clinic',
      spaceName: 'Room 1',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 300,
      unit: 'cm',
      pixelDistance: 300,
      originPolicy: 'canvas-origin-0-0',
    },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: true,
  });

  // 2. Intercept localStorage.setItem: throw on active workspace key
  const origSetItem = globalThis.localStorage.setItem.bind(globalThis.localStorage);
  globalThis.localStorage.setItem = (key: string, value: string) => {
    if (key === SAFESPACE_ACTIVE_WORKSPACE_KEY) {
      throw new Error('Simulated workspace write failure');
    }
    origSetItem(key, value);
  };

  const replacementFile = new File(['replacement-bytes'], 'replace.png', { type: 'image/png' });

  try {
    const res = await store.createAndLoadUserAssessment({
      metadata: {
        id: 'reused-space-id', // Same ID reused!
        name: 'Updated Reused Space',
        facilityName: 'Clinic',
        spaceName: 'Room 1',
        environmentType: 'clinic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      boundaryCm: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 300 },
        { x: 0, y: 300 },
      ],
      calibration: {
        pixelsPerCm: 1.0,
        realLength: 300,
        unit: 'cm',
        pixelDistance: 300,
        originPolicy: 'canvas-origin-0-0',
      },
      imageFile: replacementFile,
    });

    assert.equal(res.success, false);

    // Invariant: Floorplan image for reused-space-id must still exist in IDB
    const imgAfterFailure = await getFloorplanImage('reused-space-id');
    assert.ok(imgAfterFailure !== null, 'Reused assessment image must NOT be destroyed on failure');

    // Invariant: Persisted payload remains intact
    const persisted = getPersistedAssessment();
    assert.equal(persisted?.metadata?.id, 'reused-space-id');
  } finally {
    globalThis.localStorage.setItem = origSetItem;
  }
});

test('Adversarial Storage P0-2: cold store reset replacement cleans up old image using persisted ID, not transient demo state', async () => {
  const store = useSafeSpaceStore.getState();

  // 1. Seed persisted user assessment in localStorage and IDB
  const oldBlob = new Blob(['old-persisted-image'], { type: 'image/png' });
  await saveFloorplanImage({
    assessmentId: 'cold-persisted-old-id',
    blob: oldBlob,
    mimeType: 'image/png',
    name: 'old.png',
    size: oldBlob.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'cold-persisted-old-id',
      name: 'Cold Old Space',
      facilityName: 'Cold Facility',
      spaceName: 'Suite 1',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [
      { x: 0, y: 0 },
      { x: 350, y: 0 },
      { x: 350, y: 350 },
      { x: 0, y: 350 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 350,
      unit: 'cm',
      pixelDistance: 350,
      originPolicy: 'canvas-origin-0-0',
    },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: true,
  });

  // 2. Perform a cold reset of in-memory Zustand store (e.g. fresh tab in demo mode)
  store.resetToDemo();
  assert.equal(useSafeSpaceStore.getState().assessmentType, 'demo', 'Transient in-memory state is demo');
  assert.equal(useSafeSpaceStore.getState().assessmentId, 'demo-queen-care', 'Transient ID is demo');

  // Verify old image exists prior to replacement
  assert.ok((await getFloorplanImage('cold-persisted-old-id')) !== null);

  // 3. User creates a new assessment
  const newFile = new File(['new-persisted-image'], 'new.png', { type: 'image/png' });
  const res = await store.createAndLoadUserAssessment({
    metadata: {
      id: 'fresh-new-assessment-id',
      name: 'Fresh New Space',
      facilityName: 'Fresh Facility',
      spaceName: 'Room 101',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
      { x: 0, y: 400 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 400,
      unit: 'cm',
      pixelDistance: 400,
      originPolicy: 'canvas-origin-0-0',
    },
    imageFile: newFile,
  });

  assert.equal(res.success, true);

  // Invariant: Old image identified from PERSISTED snapshot was deleted
  const oldImageAfter = await getFloorplanImage('cold-persisted-old-id');
  assert.equal(oldImageAfter, null, 'Previous image must be cleaned up using persisted record ID despite demo in-memory state');

  // New image exists
  const newImageAfter = await getFloorplanImage('fresh-new-assessment-id');
  assert.ok(newImageAfter !== null, 'New image committed to IndexedDB');
});

test('Adversarial Storage P0-3: IDB delete failure retains localStorage record, ensuring recoverable retry across refresh', async () => {
  // 1. Seed assessment in localStorage and IDB
  const dummyFile = new File(['recoverable-bytes'], 'plan.png', { type: 'image/png' });
  await saveFloorplanImage({
    assessmentId: 'p03-recoverable-del',
    blob: dummyFile,
    mimeType: 'image/png',
    name: 'plan.png',
    size: dummyFile.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'p03-recoverable-del',
      name: 'Recoverable Deletion Space',
      facilityName: 'Clinic',
      spaceName: 'Room 5',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 0, y: 300 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 300,
      unit: 'cm',
      pixelDistance: 300,
      originPolicy: 'canvas-origin-0-0',
    },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: true,
  });

  // Verify initial state
  assert.ok((await getFloorplanImage('p03-recoverable-del')) !== null);
  assert.ok(globalThis.localStorage.getItem(SAFESPACE_STORAGE_KEY) !== null);

  // 2. Inject failure on IDB delete
  mockDbInstance.failNextTx = 'error';

  const delRes = await coordinatedDeleteAssessment('p03-recoverable-del');

  // Deletion must report failure
  assert.equal(delRes.success, false, 'Must report failure when IDB media deletion fails');
  assert.equal(delRes.localStorageCleared, false, 'localStorage must NOT be cleared when media deletion fails');

  // Crucial invariant: localStorage record must NOT be deleted!
  assert.ok(
    globalThis.localStorage.getItem(SAFESPACE_STORAGE_KEY) !== null,
    'localStorage key must be retained to preserve durable reference'
  );

  // Simulate hard browser reload: assessment can still be loaded and inspected
  const reloaded = loadPersistedAssessment();
  assert.equal(reloaded.success, true, 'Assessment survives hard refresh for deletion retry');
  if (reloaded.success) {
    assert.equal(reloaded.data.metadata?.id, 'p03-recoverable-del');
  }

  // 3. Retry deletion when IDB is healthy
  const retryRes = await coordinatedDeleteAssessment('p03-recoverable-del');
  assert.equal(retryRes.success, true, 'Retry must succeed');
  assert.equal(retryRes.localStorageCleared, true);
  assert.equal(retryRes.mediaCleared, true);

  // Authoritative double absence check
  assert.equal(await getFloorplanImage('p03-recoverable-del'), null, 'IDB record absent');
  assert.equal(globalThis.localStorage.getItem(SAFESPACE_STORAGE_KEY), null, 'localStorage key absent');
});

test('Adversarial Storage P0-3: honest support for manual-only data when IndexedDB is unavailable', async () => {
  // 1. Seed manual-only assessment (hasFloorplanImage: false)
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'manual-only-space',
      name: 'Manual Geometry Room',
      facilityName: 'Community Clinic',
      spaceName: 'Room A',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [
      { x: 0, y: 0 },
      { x: 250, y: 0 },
      { x: 250, y: 250 },
      { x: 0, y: 250 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 250,
      unit: 'cm',
      pixelDistance: 250,
      originPolicy: 'canvas-origin-0-0',
    },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: false,
  });

  // Verify seeded
  assert.ok(globalThis.localStorage.getItem(SAFESPACE_STORAGE_KEY) !== null);

  // 2. Disable IndexedDB completely by injecting failure
  mockDbInstance.failNextTx = 'error';

  // 3. Execute coordinated deletion on manual-only space
  const delRes = await coordinatedDeleteAssessment('manual-only-space');

  // Must honestly succeed: layout was cleared from browser storage, but media clearance is unverified
  assert.equal(delRes.success, true, 'Manual-only assessment deletion succeeds honestly without IDB media');
  assert.equal(delRes.localStorageCleared, true);
  assert.equal(delRes.layoutCleared, true);
  assert.equal(delRes.mediaCleared, false, 'mediaCleared must be false when IDB is unavailable');
  assert.equal(delRes.mediaClearanceVerified, false, 'mediaClearanceVerified must be false when IDB is unavailable');
  assert.ok(typeof delRes.warning === 'string', 'Warning must be present when IDB is unavailable');
  assert.equal(globalThis.localStorage.getItem(SAFESPACE_STORAGE_KEY), null);
});

test('Media Provenance Regression: upload -> edit furniture -> apply/revert -> reload -> blocked IDB retains localStorage -> healthy IDB deletes both', async () => {
  const dummyFile = new File(['provenance-test-image-bytes'], 'floorplan.png', { type: 'image/png' });
  const store = useSafeSpaceStore.getState();

  // 1. Upload image and create user assessment
  const createRes = await store.createAndLoadUserAssessment({
    metadata: {
      id: 'prov-flow-space',
      name: 'Provenance Flow Clinic',
      facilityName: 'St. Jude Rehabilitation',
      spaceName: 'Suite A',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ],
    calibration: {
      pixelsPerCm: 1.0,
      realLength: 500,
      unit: 'cm',
      pixelDistance: 500,
      originPolicy: 'canvas-origin-0-0',
    },
    imageFile: dummyFile,
  });

  assert.equal(createRes.success, true);
  assert.equal(useSafeSpaceStore.getState().hasFloorplanImage, true, 'Store state must reflect imported media provenance');

  let persisted = getPersistedAssessment();
  assert.equal(persisted?.hasFloorplanImage, true, 'Initial persisted payload must retain hasFloorplanImage === true');
  assert.ok((await getFloorplanImage('prov-flow-space')) !== null, 'Image must be committed in IndexedDB');

  // 2. Edit furniture (triggers persistUserMutation)
  useSafeSpaceStore.getState().addFurniture('table');
  const addedFurniture = useSafeSpaceStore.getState().furniture;
  assert.ok(addedFurniture.length > 0, 'Furniture should be added');
  const tableItem = addedFurniture[0];

  persisted = getPersistedAssessment();
  assert.equal(persisted?.hasFloorplanImage, true, 'Provenance must survive furniture edit');
  assert.equal(useSafeSpaceStore.getState().hasFloorplanImage, true);

  // 3. Edit mobility profile & route (triggers persistUserMutation)
  useSafeSpaceStore.getState().setProfile('wheelchair');
  persisted = getPersistedAssessment();
  assert.equal(persisted?.hasFloorplanImage, true, 'Provenance must survive profile edit');

  useSafeSpaceStore.getState().addRouteWaypoint('Waypoint 1', 20, 20);
  persisted = getPersistedAssessment();
  assert.equal(persisted?.hasFloorplanImage, true, 'Provenance must survive route edit');

  // 4. Apply layout candidate (Stage 5)
  const stateBeforeOpt = useSafeSpaceStore.getState();
  const currentFingerprint = computeSceneFingerprint({
    furniture: stateBeforeOpt.furniture,
    waypoints: stateBeforeOpt.routeWaypoints,
    boundary: stateBeforeOpt.canonicalBoundary,
    rooms: stateBeforeOpt.rooms,
    walls: stateBeforeOpt.walls,
    doors: stateBeforeOpt.doors,
    profile: stateBeforeOpt.activeProfile,
  });

  const candidate = {
    id: 'cand-prov-1',
    name: 'Option 1',
    description: 'Move Table 20cm',
    strategy: 'minimal_displacement' as const,
    moves: [],
    moveCount: 1,
    totalDisplacementCm: 20,
    furniture: [{ ...tableItem, x: tableItem.x + 20 }],
    routeResult: {} as unknown as import('../src/lib/spatial/routing/types').RouteResult,
    evaluation: {} as unknown as import('../src/lib/spatial/analysis/types').SpatialEvaluationResult,
    metrics: {} as unknown as import('../src/lib/spatial/optimization/types').LayoutCandidateMetrics,
  };

  useSafeSpaceStore.setState({
    activeOptimizationResult: {
      status: 'improved',
      candidates: [candidate],
      baselineEvaluation: {} as unknown as import('../src/lib/spatial/analysis/types').SpatialEvaluationResult,
      baselineRouteResult: null,
      message: 'Improved layout found',
      movableFurnitureCount: 1,
      unmovableFurnitureCount: 0,
      sceneFingerprint: currentFingerprint,
      computeBudget: { maxEvaluations: 10, evaluatedCount: 1, prunedCount: 0, budgetExhausted: false },
    },
  });

  const applyRes = useSafeSpaceStore.getState().applyLayoutCandidate('cand-prov-1');
  assert.equal(applyRes.success, true);
  persisted = getPersistedAssessment();
  assert.equal(persisted?.hasFloorplanImage, true, 'Provenance must survive Apply candidate');

  // 5. Revert layout candidate
  const revertRes = useSafeSpaceStore.getState().revertLayoutCandidate();
  assert.equal(revertRes.success, true);
  persisted = getPersistedAssessment();
  assert.equal(persisted?.hasFloorplanImage, true, 'Provenance must survive Revert candidate');

  // 6. Hard reload (reset in-memory store and hydrate from storage)
  useSafeSpaceStore.getState().resetToDemo();
  assert.equal(useSafeSpaceStore.getState().assessmentType, 'demo');

  useSafeSpaceStore.getState().hydrateFromStorage();
  assert.equal(useSafeSpaceStore.getState().assessmentType, 'user');
  assert.equal(useSafeSpaceStore.getState().assessmentId, 'prov-flow-space');
  assert.equal(useSafeSpaceStore.getState().hasFloorplanImage, true, 'Hydrated state must retain hasFloorplanImage === true');

  // Await background async getFloorplanImage triggered by hydration to complete
  await new Promise((r) => setTimeout(r, 50));

  // 7. Block IndexedDB deletion
  mockDbInstance.failNextTx = 'error';

  // 8. Attempt Delete while IndexedDB is blocked
  const failedDelRes = await coordinatedDeleteAssessment('prov-flow-space');
  assert.equal(failedDelRes.success, false, 'Delete must fail when IndexedDB media cleanup is blocked');
  assert.equal(failedDelRes.localStorageCleared, false, 'localStorage must NOT be cleared');
  assert.equal(failedDelRes.mediaCleared, false, 'mediaCleared must NOT report true');

  // Verification: Assessment remains durable in localStorage for retry
  const remainingPersisted = getPersistedAssessment();
  assert.ok(remainingPersisted !== null, 'Durable assessment record must remain in localStorage');
  assert.equal(remainingPersisted?.metadata?.id, 'prov-flow-space');
  assert.equal(remainingPersisted?.hasFloorplanImage, true, 'Provenance bit remains true');

  // 9. Restore IndexedDB and retry deletion
  mockDbInstance.failNextTx = null;
  const retryDelRes = await coordinatedDeleteAssessment('prov-flow-space');
  assert.equal(retryDelRes.success, true, 'Deletion must succeed after IndexedDB is healthy');
  assert.equal(retryDelRes.localStorageCleared, true, 'localStorage cleared');
  assert.equal(retryDelRes.mediaCleared, true, 'mediaCleared true');

  // Double absence check
  assert.equal(getPersistedAssessment(), null, 'localStorage must be absent');
  assert.equal(await getFloorplanImage('prov-flow-space'), null, 'IndexedDB image must be absent');
});

test('Media Provenance Guard: savePersistedAssessment preserves hasFloorplanImage when omitted', () => {
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'guard-test-space',
      name: 'Guard Room',
      facilityName: 'Clinic',
      spaceName: 'Room G',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
    calibration: { pixelsPerCm: 1.0, realLength: 200, unit: 'cm', pixelDistance: 200, originPolicy: 'canvas-origin-0-0' },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: true,
  });

  assert.equal(getPersistedAssessment()?.hasFloorplanImage, true);

  // Subsequent save omitting hasFloorplanImage (simulating unhardened code)
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'guard-test-space',
      name: 'Guard Room Updated',
      facilityName: 'Clinic',
      spaceName: 'Room G',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
    calibration: { pixelsPerCm: 1.0, realLength: 200, unit: 'cm', pixelDistance: 200, originPolicy: 'canvas-origin-0-0' },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
  });

  // Guard must preserve existing true value, NOT default to false!
  assert.equal(getPersistedAssessment()?.hasFloorplanImage, true, 'Guard must prevent overwrite to false');
});

test('Media Provenance: unknown provenance (undefined) requires IDB verification and fails closed if blocked', async () => {
  // Legacy snapshot where hasFloorplanImage is completely undefined
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'legacy-unknown-space',
      name: 'Legacy Room',
      facilityName: 'Clinic',
      spaceName: 'Room L',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
    calibration: { pixelsPerCm: 1.0, realLength: 200, unit: 'cm', pixelDistance: 200, originPolicy: 'canvas-origin-0-0' },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
  });

  const persisted = getPersistedAssessment();
  assert.equal(persisted?.hasFloorplanImage, undefined, 'Legacy snapshot has undefined hasFloorplanImage');

  // Block IDB
  mockDbInstance.failNextTx = 'error';

  // Coordinated delete must NOT treat unknown provenance as manual-only!
  const delRes = await coordinatedDeleteAssessment('legacy-unknown-space');
  assert.equal(delRes.success, false, 'Unknown provenance must fail closed when IDB blocked');
  assert.equal(delRes.localStorageCleared, false);
  assert.equal(delRes.mediaCleared, false);
  assert.ok(getPersistedAssessment() !== null, 'localStorage remains intact');

  // When IDB is unblocked, it can clean up
  mockDbInstance.failNextTx = null;
  const retryRes = await coordinatedDeleteAssessment('legacy-unknown-space');
  assert.equal(retryRes.success, true);
  assert.equal(retryRes.localStorageCleared, true);
});

test('Media Provenance: replacement old-image cleanup failure reports actionable warning', async () => {
  const dummyFile1 = new File(['img1'], 'plan1.png', { type: 'image/png' });
  const dummyFile2 = new File(['img2'], 'plan2.png', { type: 'image/png' });
  const store = useSafeSpaceStore.getState();

  // Create initial assessment A
  const resA = await store.createAndLoadUserAssessment({
    metadata: {
      id: 'space-replace-a',
      name: 'Space A',
      facilityName: 'Facility',
      spaceName: 'Room A',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }],
    calibration: { pixelsPerCm: 1.0, realLength: 300, unit: 'cm', pixelDistance: 300, originPolicy: 'canvas-origin-0-0' },
    imageFile: dummyFile1,
  });
  assert.equal(resA.success, true);
  assert.ok((await getFloorplanImage('space-replace-a')) !== null);

  // Set mockDbInstance to fail when deleting 'space-replace-a'
  mockDbInstance.failOnDeleteId = 'space-replace-a';

  const resB = await store.createAndLoadUserAssessment({
    metadata: {
      id: 'space-replace-b',
      name: 'Space B',
      facilityName: 'Facility',
      spaceName: 'Room B',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }],
    calibration: { pixelsPerCm: 1.0, realLength: 300, unit: 'cm', pixelDistance: 300, originPolicy: 'canvas-origin-0-0' },
    imageFile: dummyFile2,
  });

  assert.equal(resB.success, true, 'Creation of B succeeds');
  assert.equal(resB.previousMediaCleanupFailed, true, 'Must report previousMediaCleanupFailed === true');
  assert.ok(typeof resB.cleanupWarning === 'string', 'Must provide actionable cleanupWarning');
  assert.equal(mockDbInstance.failOnDeleteId, null, 'Delete failure was intercepted');
});

test('Orphan-Media Boundary: imported A replaced by manual B with failed cleanup of A, checks durable cleanup debt + UI warning, then delete B purges all IDB media', async () => {
  const dummyFileA = new File(['image-content-a'], 'floorplan-a.png', { type: 'image/png' });
  const store = useSafeSpaceStore.getState();

  // 1. Create imported assessment A (with image)
  const resA = await store.createAndLoadUserAssessment({
    metadata: {
      id: 'space-orphan-a',
      name: 'Imported Space A',
      facilityName: 'Clinic A',
      spaceName: 'Room A',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }],
    calibration: { pixelsPerCm: 1.0, realLength: 300, unit: 'cm', pixelDistance: 300, originPolicy: 'canvas-origin-0-0' },
    imageFile: dummyFileA,
  });
  assert.equal(resA.success, true);
  assert.ok((await getFloorplanImage('space-orphan-a')) !== null, 'Image A committed in IndexedDB');

  // 2. Inject failure on deleting 'space-orphan-a' during replacement
  mockDbInstance.failOnDeleteId = 'space-orphan-a';

  // 3. Create manual-only assessment B (no imageFile)
  const resB = await store.createAndLoadUserAssessment({
    metadata: {
      id: 'space-orphan-b',
      name: 'Manual Space B',
      facilityName: 'Clinic B',
      spaceName: 'Room B',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    boundaryCm: [{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 250 }, { x: 0, y: 250 }],
    calibration: { pixelsPerCm: 1.0, realLength: 250, unit: 'cm', pixelDistance: 250, originPolicy: 'canvas-origin-0-0' },
    // no imageFile -> manual-only
  });

  assert.equal(resB.success, true, 'Creation of B succeeds');
  assert.equal(resB.previousMediaCleanupFailed, true, 'Reports previous cleanup failure');

  // Check durable cleanup debt
  const pendingDebts = getPendingMediaCleanups();
  assert.ok(pendingDebts.includes('space-orphan-a'), 'Durable cleanup debt queue must track space-orphan-a');

  const persistedB = getPersistedAssessment();
  assert.equal(persistedB?.metadata?.id, 'space-orphan-b');
  assert.equal(persistedB?.hasFloorplanImage, false, 'Assessment B is manual-only');
  assert.ok(persistedB?.pendingMediaCleanupIds?.includes('space-orphan-a'), 'Persisted state retains pending cleanup debt');

  // Check actual UI warning in store
  const storeState = useSafeSpaceStore.getState();
  assert.ok(typeof storeState.mediaCleanupWarning === 'string', 'Store must expose user-facing mediaCleanupWarning');
  assert.ok(storeState.mediaCleanupWarning.includes('space-orphan-a'), 'Warning explicitly identifies uncleaned media');

  // 4. Attempt deleting B while IDB deletion of A is still blocked
  mockDbInstance.failOnDeleteId = 'space-orphan-a';
  const delBlockedRes = await coordinatedDeleteAssessment('space-orphan-b');

  // Must fail closed: cannot claim complete deletion while A remains unpurged!
  assert.equal(delBlockedRes.success, false, 'Delete B must fail while orphan media A cannot be deleted');
  assert.equal(delBlockedRes.localStorageCleared, false, 'localStorage must be retained for retry');
  assert.equal(delBlockedRes.mediaCleared, false, 'mediaCleared must be false');
  assert.ok((await getFloorplanImage('space-orphan-a')) !== null, 'Image A still in IDB');
  assert.ok(getPersistedAssessment() !== null, 'Assessment B still in localStorage');

  // 5. Unblock IDB and retry delete of B
  mockDbInstance.failOnDeleteId = null;
  const delRetryRes = await coordinatedDeleteAssessment('space-orphan-b');

  assert.equal(delRetryRes.success, true, 'Retry deletion must succeed');
  assert.equal(delRetryRes.localStorageCleared, true, 'localStorage cleared');
  assert.equal(delRetryRes.mediaCleared, true, 'mediaCleared verified true');

  // Verify all IDB media and pending debts are purged
  assert.equal(await getFloorplanImage('space-orphan-a'), null, 'Orphan image A must be completely erased from IDB');
  assert.equal(await getFloorplanImage('space-orphan-b'), null, 'Image B must be absent');
  assert.equal(getPendingMediaCleanups().length, 0, 'Pending cleanup debts must be cleared');
  assert.equal(getPersistedAssessment(), null, 'localStorage assessment must be cleared');
});

test('Media Integrity: IDB truly unavailable and manual-only B confirms truthful warning without claiming unverified deletion', async () => {
  // Clear any existing debts
  clearPendingMediaCleanups();

  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'manual-space-truthful',
      name: 'Manual Truthful Space',
      facilityName: 'Health Center',
      spaceName: 'Room H',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
    calibration: { pixelsPerCm: 1.0, realLength: 200, unit: 'cm', pixelDistance: 200, originPolicy: 'canvas-origin-0-0' },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: false,
  });

  assert.equal(getPersistedAssessment()?.hasFloorplanImage, false);
  assert.equal(getPendingMediaCleanups().length, 0, 'No pending media debts');

  // Inject IDB error so database inspection fails
  mockDbInstance.failNextTx = 'error';

  const delRes = await coordinatedDeleteAssessment('manual-space-truthful');

  // Manual layout deletion succeeds
  assert.equal(delRes.success, true, 'Manual layout deletion succeeds without blocking on unavailable IDB');
  assert.equal(delRes.localStorageCleared, true, 'localStorage is cleared');
  assert.equal(delRes.layoutCleared, true, 'layoutCleared must be true');
  assert.equal(delRes.mediaCleared, false, 'mediaCleared must be false when IDB is unavailable');
  assert.equal(delRes.mediaClearanceVerified, false, 'mediaClearanceVerified must be false when IDB is unavailable');
  // Truthful reporting: warning is present, confirming media store absence could not be verified
  assert.ok(typeof delRes.warning === 'string', 'Warning must be present when IDB is unavailable');
  assert.ok(delRes.warning.includes('IndexedDB was inaccessible'), 'Must disclose IndexedDB was inaccessible');
  assert.ok(delRes.warning.includes('could not be verified'), 'Must truthfully report media absence was not verified');
});

test('Media Integrity: failed IDB count verification does not assume zero and preserves layout for retry', async () => {
  clearPendingMediaCleanups();

  // Part A: Imported space with floorplan image
  const imageBlob = new Blob(['sample-imported-image'], { type: 'image/png' });
  await saveFloorplanImage({
    assessmentId: 'imported-count-fail-space',
    blob: imageBlob,
    mimeType: 'image/png',
    name: 'plan.png',
    size: imageBlob.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });

  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'imported-count-fail-space',
      name: 'Imported Count Fail Space',
      facilityName: 'Clinic A',
      spaceName: 'Room 1',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }],
    calibration: { pixelsPerCm: 1.0, realLength: 300, unit: 'cm', pixelDistance: 300, originPolicy: 'canvas-origin-0-0' },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: true,
  });

  // Inject count failure so total verification fails
  mockDbInstance.failNextCount = true;

  const delResImported = await coordinatedDeleteAssessment('imported-count-fail-space');

  // Must not claim success or verified media clearance!
  assert.equal(delResImported.success, false, 'Deletion must fail when count verification fails');
  assert.equal(delResImported.mediaCleared, false, 'mediaCleared must not be true when count fails');
  assert.equal(delResImported.mediaClearanceVerified, false, 'mediaClearanceVerified must be false');
  assert.equal(delResImported.localStorageCleared, false, 'localStorage must be preserved for retry');
  assert.ok(getPersistedAssessment() !== null, 'Persisted record must remain intact for retry');

  // Part B: Manual-only assessment with accessible IDB but count failure
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'manual-count-fail-space',
      name: 'Manual Count Fail Space',
      facilityName: 'Clinic B',
      spaceName: 'Room 2',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }],
    calibration: { pixelsPerCm: 1.0, realLength: 300, unit: 'cm', pixelDistance: 300, originPolicy: 'canvas-origin-0-0' },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: false,
  });

  // Clean up image from Part A so store is empty
  await deleteFloorplanImage('imported-count-fail-space');

  // Inject count failure when deleting manual assessment
  mockDbInstance.failNextCount = true;

  const delResManual = await coordinatedDeleteAssessment('manual-count-fail-space');

  assert.equal(delResManual.success, false, 'Manual space delete must fail when accessible IDB count verification fails');
  assert.equal(delResManual.mediaCleared, false, 'mediaCleared must be false when count fails');
  assert.equal(delResManual.mediaClearanceVerified, false, 'mediaClearanceVerified must be false');
  assert.equal(delResManual.localStorageCleared, false, 'localStorage must be preserved for retry');
});

test('Privacy Hardening: failed durable cleanup debt recording surfaces unacknowledged liability and does not silently lose orphaned media reference', async () => {
  const store = useSafeSpaceStore.getState();
  clearPendingMediaCleanups();

  // 1. Seed existing imported assessment A
  const imgA = new Blob(['image-a'], { type: 'image/png' });
  await saveFloorplanImage({
    assessmentId: 'debt-space-a',
    blob: imgA,
    mimeType: 'image/png',
    name: 'a.png',
    size: imgA.size,
    canvasWidth: 800,
    canvasHeight: 600,
    updatedAt: new Date().toISOString(),
  });

  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'debt-space-a',
      name: 'Space A',
      facilityName: 'Facility',
      spaceName: 'Room A',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
    calibration: { pixelsPerCm: 1.0, realLength: 200, unit: 'cm', pixelDistance: 200, originPolicy: 'canvas-origin-0-0' },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: true,
  });

  // 2. Configure mock to fail deletion of space A's image during replacement
  mockDbInstance.failOnDeleteId = 'debt-space-a';

  // 3. Inject storage failure for debt queue key
  const origSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = (key: string, val: string) => {
    if (key === SAFESPACE_PENDING_MEDIA_CLEANUP_KEY) {
      throw new Error('QuotaExceededError: storage full');
    }
    return origSetItem.call(globalThis.localStorage, key, val);
  };

  try {
    const res = await store.createAndLoadUserAssessment({
      metadata: {
        id: 'debt-space-b',
        name: 'Space B (Manual)',
        facilityName: 'Facility',
        spaceName: 'Room B',
        environmentType: 'clinic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      boundaryCm: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
      calibration: { pixelsPerCm: 1.0, realLength: 200, unit: 'cm', pixelDistance: 200, originPolicy: 'canvas-origin-0-0' },
    });

    assert.equal(res.previousMediaCleanupFailed, true, 'Old image cleanup failed');
    assert.ok(typeof res.cleanupWarning === 'string', 'Must return cleanup warning');
    assert.ok(res.cleanupWarning.includes('Previous assessment image'), 'Discloses previous image failure');
  } finally {
    globalThis.localStorage.setItem = origSetItem;
    // Clean up space A image
    await deleteFloorplanImage('debt-space-a');
  }
});

test('Mounted UI: AssessmentsPage renders visible warning notice when IDB is unavailable during manual-only delete', async () => {
  clearPendingMediaCleanups();

  // 1. Seed manual-only assessment in localStorage
  savePersistedAssessment({
    schemaVersion: 1,
    assessmentType: 'user',
    metadata: {
      id: 'manual-ui-delete-space',
      name: 'Manual UI Space',
      facilityName: 'Care Home',
      spaceName: 'Room 101',
      environmentType: 'clinic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    canonicalBoundary: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
    calibration: { pixelsPerCm: 1.0, realLength: 200, unit: 'cm', pixelDistance: 200, originPolicy: 'canvas-origin-0-0' },
    activeProfileId: 'walker',
    routeWaypoints: [],
    furniture: [],
    hasFloorplanImage: false,
  });

  // 2. Mount AssessmentsPage in JSDOM
  const rootEl = dom.window.document.getElementById('root')!;
  rootEl.innerHTML = '';
  const root = createRoot(rootEl);

  await act(async () => {
    root.render(React.createElement(AssessmentsPage));
  });

  // Verify assessment card is rendered with "Delete" button
  const deleteBtn = Array.from(rootEl.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Delete');
  assert.ok(deleteBtn, 'Delete button must be present in assessment card');

  // Click Delete button to open confirm modal
  await act(async () => {
    deleteBtn.click();
  });

  // Verify modal is open
  const confirmBtn = Array.from(rootEl.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Delete Assessment'
  );
  assert.ok(confirmBtn, 'Delete Assessment confirmation button must be present in dialog');

  // Inject IDB error so database inspection fails during deletion
  mockDbInstance.failNextTx = 'error';

  // Click confirmation button to execute deletion
  await act(async () => {
    confirmBtn.click();
    await new Promise((r) => setTimeout(r, 60));
  });

  // Invariant: Modal must be closed after successful layout removal
  const dialogStillOpen = rootEl.querySelector('[role="dialog"]');
  assert.equal(dialogStillOpen, null, 'Delete dialog must close on completion');

  // Invariant: Deletion warning notice banner must be visibly displayed to operator
  const warningBanner = rootEl.querySelector('[data-testid="deletion-warning-banner"]') || rootEl.querySelector('[role="status"]');
  assert.ok(warningBanner !== null, 'Warning banner must be visibly rendered in DOM');
  const bannerText = warningBanner.textContent || '';
  assert.ok(bannerText.includes('IndexedDB was inaccessible'), 'Banner must state IndexedDB was inaccessible');
  assert.ok(bannerText.includes('could not be verified'), 'Banner must state media absence could not be verified');

  // Cleanup mounted root
  await act(async () => {
    root.unmount();
  });
  rootEl.innerHTML = '';
});

