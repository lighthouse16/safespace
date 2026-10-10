/**
 * SafeSpace IndexedDB Storage Module
 *
 * Persists user-imported floorplan raster/SVG blobs locally in the browser.
 * Bypasses localStorage 5MB quota restrictions and avoids transient objectURL expiration.
 * Fails closed gracefully in private browsing / blocked storage environments.
 */

const DB_NAME = "safespace_media_v1";
const STORE_NAME = "floorplan_images";
const DB_VERSION = 1;

export type PersistedFloorplanImage = {
  assessmentId: string;
  blob: Blob;
  mimeType: string;
  name: string;
  size: number;
  canvasWidth: number;  // Intake draft canvas width (default 800)
  canvasHeight: number; // Intake draft canvas height (default 600)
  updatedAt: string;
};

function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "assessmentId" });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        // Private mode or storage quota/permission failure
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Saves or updates a floorplan image blob in IndexedDB.
 */
export async function saveFloorplanImage(record: PersistedFloorplanImage): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Retrieves a persisted floorplan image record by assessment ID.
 */
export async function getFloorplanImage(
  assessmentId: string
): Promise<PersistedFloorplanImage | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(assessmentId);

      req.onsuccess = () => {
        const result = req.result as PersistedFloorplanImage | undefined;
        resolve(result || null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Deletes a persisted floorplan image record by assessment ID.
 */
export async function deleteFloorplanImage(assessmentId: string): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(assessmentId);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
