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
 * Awaits full transaction completion (tx.oncomplete) before confirming success.
 */
export async function saveFloorplanImage(record: PersistedFloorplanImage): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record);

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export type MediaInspectResult =
  | { status: "found"; record: PersistedFloorplanImage }
  | { status: "not_found" }
  | { status: "error"; error: string };

export type MediaCountResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * Inspects a persisted floorplan image record by assessment ID.
 * Distinguishes confirmed absent (not_found) from database access/read failure (error).
 */
export async function inspectFloorplanImage(
  assessmentId: string
): Promise<MediaInspectResult> {
  if (!isIndexedDBAvailable()) {
    return { status: "error", error: "IndexedDB is unavailable in this environment" };
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
        const db = request.result;
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(assessmentId);

          req.onsuccess = () => {
            const result = req.result as PersistedFloorplanImage | undefined;
            db.close();
            if (result) {
              resolve({ status: "found", record: result });
            } else {
              resolve({ status: "not_found" });
            }
          };

          req.onerror = (ev) => {
            const msg = (ev.target as IDBRequest)?.error?.message || "Error reading from IndexedDB";
            db.close();
            resolve({ status: "error", error: msg });
          };

          tx.onabort = () => {
            db.close();
            resolve({ status: "error", error: "IndexedDB transaction aborted" });
          };
        } catch (err) {
          db.close();
          resolve({ status: "error", error: err instanceof Error ? err.message : String(err) });
        }
      };

      request.onerror = (ev) => {
        const msg = (ev.target as IDBOpenDBRequest)?.error?.message || "Failed to open IndexedDB";
        resolve({ status: "error", error: msg });
      };
    } catch (err) {
      resolve({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  });
}

/**
 * Counts total floorplan image records in IndexedDB.
 */
export async function countFloorplanImages(): Promise<MediaCountResult> {
  if (!isIndexedDBAvailable()) {
    return { ok: false, error: "IndexedDB is unavailable in this environment" };
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
        const db = request.result;
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          if (typeof store.count !== "function") {
            db.close();
            resolve({ ok: true, count: 0 });
            return;
          }
          const req = store.count();

          req.onsuccess = () => {
            const count = typeof req.result === "number" ? req.result : 0;
            db.close();
            resolve({ ok: true, count });
          };

          req.onerror = (ev) => {
            const msg = (ev.target as IDBRequest)?.error?.message || "Failed to count IndexedDB records";
            db.close();
            resolve({ ok: false, error: msg });
          };

          tx.onabort = () => {
            db.close();
            resolve({ ok: false, error: "Transaction aborted" });
          };
        } catch (err) {
          db.close();
          resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      };

      request.onerror = (ev) => {
        const msg = (ev.target as IDBOpenDBRequest)?.error?.message || "Failed to open IndexedDB";
        resolve({ ok: false, error: msg });
      };
    } catch (err) {
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

/**
 * Retrieves a persisted floorplan image record by assessment ID.
 */
export async function getFloorplanImage(
  assessmentId: string
): Promise<PersistedFloorplanImage | null> {
  const inspected = await inspectFloorplanImage(assessmentId);
  return inspected.status === "found" ? inspected.record : null;
}

/**
 * Deletes a persisted floorplan image record by assessment ID.
 * Awaits full transaction completion before confirming deletion.
 */
export async function deleteFloorplanImage(assessmentId: string): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(assessmentId);

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

/**
 * Purges all stored floorplan images in IndexedDB.
 * Used during full assessment deletion to prevent orphaned personal data.
 */
export async function clearAllFloorplanImages(): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}
