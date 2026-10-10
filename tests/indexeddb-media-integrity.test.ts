import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveFloorplanImage,
  getFloorplanImage,
  deleteFloorplanImage,
  clearAllFloorplanImages,
  type PersistedFloorplanImage,
} from '../src/lib/storage/image-db';
import { coordinatedDeleteAssessment } from '../src/lib/storage/coordinated-storage';
import { loadPersistedAssessment, SAFESPACE_STORAGE_KEY } from '../src/lib/storage/persistence';
import { useSafeSpaceStore } from '../src/store/safespace-store';

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
  };
}

// In-memory Mock IndexedDB engine
class MockIDBDatabase {
  closed = false;
  closeCalls = 0;
  stores = new Map<string, Map<string, MockRecord>>();
  failNextTx: 'error' | 'abort' | null = null;

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
        }),
      };
      return tx;
    }

    const dataStore = this.stores.get(storeName) || new Map<string, MockRecord>();
    const tx: MockTransaction = {
      oncomplete: null,
      onerror: null,
      onabort: null,
      objectStore: () => ({
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
          dataStore.delete(key);
          setTimeout(() => tx.oncomplete?.(), 0);
        },
        clear: () => {
          dataStore.clear();
          setTimeout(() => tx.oncomplete?.(), 0);
        },
      }),
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

Object.defineProperty(globalThis, 'window', {
  value: { indexedDB: mockIndexedDB },
  writable: true,
  configurable: true,
});

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

Object.defineProperty(globalThis, 'localStorage', {
  value: new MockLocalStorage(),
  writable: true,
  configurable: true,
});

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
