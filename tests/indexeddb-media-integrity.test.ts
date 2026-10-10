import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveFloorplanImage,
  getFloorplanImage,
  deleteFloorplanImage,
  clearAllFloorplanImages,
  type PersistedFloorplanImage,
} from '../src/lib/storage/image-db';
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
