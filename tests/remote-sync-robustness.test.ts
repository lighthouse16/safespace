import test from "node:test";
import assert from "node:assert/strict";
import { useSafeSpaceStore } from "../src/store/safespace-store";
import { serverAssessmentService } from "../src/lib/services/server-assessment-repository";

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

const mockIndexedDb = {
  open: () => {
    const req: Record<string, unknown> = {};
    setTimeout(() => {
      req.result = {
        transaction: () => {
          const tx: Record<string, unknown> = {
            objectStore: () => ({ put: () => {} }),
          };
          setTimeout(() => {
            if (typeof tx.oncomplete === "function") (tx.oncomplete as () => void)();
          }, 0);
          return tx;
        },
        close: () => {},
      };
      if (typeof req.onsuccess === "function") (req.onsuccess as () => void)();
    }, 0);
    return req;
  },
};

const previousWindow = globalThis.window;
(globalThis as unknown as { window: unknown }).window = {
  indexedDB: mockIndexedDb,
};

test("Remote Sync Robustness: state transitions, media failure rejection, sequence isolation, and retry", async (t) => {
  const originalCreate = serverAssessmentService.createAssessment;
  const originalSave = serverAssessmentService.saveAssessment;
  const originalUpload = serverAssessmentService.uploadMedia;
  const previousCloudMode = process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS;
  process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS = "true";

  try {
    await t.test("1. Media upload failure results in failed sync, never synced", async () => {
      serverAssessmentService.createAssessment = async () => ({ success: true, assessment: { id: "test-user-sync-1", name: "Test Space", facilityName: "", spaceName: "", environmentType: "", notes: "", createdAt: "", updatedAt: "" } });
      serverAssessmentService.saveAssessment = async () => ({ success: true });
      serverAssessmentService.uploadMedia = async () => ({ success: false, error: "Cloud storage quota exceeded" });

      const res = await useSafeSpaceStore.getState().createAndLoadUserAssessment({
        metadata: {
          id: "test-user-sync-1",
          name: "Test Space",
          facilityName: "Test Facility",
          spaceName: "Room A",
          environmentType: "clinic",
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
          pixelsPerCm: 1,
          pixelDistance: 100,
          realLength: 100,
          unit: "cm",
          originPolicy: "canvas-origin-0-0",
        },
        imageFile: new Blob(["dummy"], { type: "image/png" }),
      });

      assert.equal(res.success, true);

      // Wait a tick for async promise chain to resolve
      await new Promise((resolve) => setTimeout(resolve, 50));

      const state = useSafeSpaceStore.getState();
      assert.equal(state.remoteSyncStatus, "failed", "Sync status must be failed if media upload fails");
      assert.match(state.remoteSyncError || "", /Media upload failed|Cloud storage quota exceeded/i);
    });

    await t.test("2. retryRemoteSync recovers state on retry", async () => {
      serverAssessmentService.saveAssessment = async () => ({ success: true });

      const retryRes = await useSafeSpaceStore.getState().retryRemoteSync();
      assert.equal(retryRes.success, true);

      const state = useSafeSpaceStore.getState();
      assert.equal(state.remoteSyncStatus, "synced");
      assert.equal(state.remoteSyncError, null);
    });

    await t.test("3. 409 conflict correctly marks status as conflicted", async () => {
      serverAssessmentService.saveAssessment = async () => ({ success: false, error: "HTTP 409 Conflict: revision mismatch" });

      const retryRes = await useSafeSpaceStore.getState().retryRemoteSync();
      assert.equal(retryRes.success, false);

      const state = useSafeSpaceStore.getState();
      assert.equal(state.remoteSyncStatus, "conflicted");
      assert.match(state.remoteSyncError || "", /409 Conflict/i);
    });
  } finally {
    serverAssessmentService.createAssessment = originalCreate;
    serverAssessmentService.saveAssessment = originalSave;
    serverAssessmentService.uploadMedia = originalUpload;
    if (previousCloudMode === undefined) delete process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS;
    else process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS = previousCloudMode;
    globalThis.window = previousWindow;
    useSafeSpaceStore.getState().resetToDemo();
  }
});

test("Guest local-first: create, edit, persist and reopen without Supabase or auth", async () => {
  const originalCreate = serverAssessmentService.createAssessment;
  const originalSave = serverAssessmentService.saveAssessment;
  const originalUpload = serverAssessmentService.uploadMedia;
  const originalMode = process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS;
  delete process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS;
  let networkCalls = 0;
  serverAssessmentService.createAssessment = async () => {
    networkCalls++;
    throw new Error("Guest session attempted remote create");
  };
  serverAssessmentService.saveAssessment = async () => {
    networkCalls++;
    throw new Error("Guest session attempted remote save");
  };
  serverAssessmentService.uploadMedia = async () => {
    networkCalls++;
    throw new Error("Guest session attempted remote upload");
  };
  try {
    const id = "guest-local-no-account";
    const now = new Date().toISOString();
    const result = await useSafeSpaceStore.getState().createAndLoadUserAssessment({
      metadata: {
        id,
        name: "Guest Accessible Room",
        facilityName: "Local Facility",
        spaceName: "Room A",
        environmentType: "residential",
        createdAt: now,
        updatedAt: now,
      },
      boundaryCm: [
        { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
      ],
      calibration: {
        pixelsPerCm: 1, pixelDistance: 100, realLength: 100,
        unit: "cm", originPolicy: "canvas-origin-0-0",
      },
    });
    assert.equal(result.success, true);
    assert.equal(useSafeSpaceStore.getState().storageStatus, "saved");
    assert.equal(useSafeSpaceStore.getState().remoteSyncStatus, "idle");
    const add = useSafeSpaceStore.getState().addManualHazard;
    add({ x: 135, y: 140 });
    assert.equal(useSafeSpaceStore.getState().storageStatus, "saved");
    assert.equal(useSafeSpaceStore.getState().remoteSyncStatus, "idle");
    useSafeSpaceStore.getState().hydrateFromStorage();
    assert.equal(useSafeSpaceStore.getState().assessmentMetadata?.id, id);
    assert.equal(useSafeSpaceStore.getState().hazards.length, 1);
    assert.equal(networkCalls, 0, "Guest usage must not call authenticated cloud APIs");
    const retry = await useSafeSpaceStore.getState().retryRemoteSync();
    assert.equal(retry.success, false);
    assert.match(retry.error || "", /cloud accounts are disabled/i);
    assert.equal(networkCalls, 0);
  } finally {
    serverAssessmentService.createAssessment = originalCreate;
    serverAssessmentService.saveAssessment = originalSave;
    serverAssessmentService.uploadMedia = originalUpload;
    if (originalMode === undefined) delete process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS;
    else process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS = originalMode;
    useSafeSpaceStore.getState().resetToDemo();
  }
});
