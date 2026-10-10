import {
  deleteFloorplanImage,
  clearAllFloorplanImages,
  getFloorplanImage,
} from "./image-db";
import {
  clearPersistedAssessment,
  saveActiveWorkspace,
  getPersistedAssessment,
  SAFESPACE_STORAGE_KEY,
} from "./persistence";

export interface DeletionResult {
  success: boolean;
  error?: string;
  localStorageCleared: boolean;
  mediaCleared: boolean;
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Authoritative coordinated deletion operation across both localStorage and IndexedDB.
 * Verifies that all user records are confirmed absent before reporting success.
 * If mandatory image cleanup is not verified, DOES NOT delete localStorage, ensuring
 * recoverable retry across refresh.
 * Honest support for manual-only data when IndexedDB is unavailable.
 */
export async function coordinatedDeleteAssessment(assessmentId?: string): Promise<DeletionResult> {
  const persisted = getPersistedAssessment();
  const targetId = assessmentId || persisted?.metadata?.id;
  const isExplicitManualOnly = persisted?.hasFloorplanImage === false;

  let mediaCleared = false;

  // 1. Delete IndexedDB floorplan media if applicable
  try {
    if (isExplicitManualOnly) {
      // Geometry has no image: honest support for manual-only data with no nonexistent media to delete
      mediaCleared = true;
      try {
        if (targetId) await deleteFloorplanImage(targetId);
      } catch {}
    } else {
      const idDeleteOk = targetId ? await deleteFloorplanImage(targetId) : true;
      const clearAllOk = await clearAllFloorplanImages();
      const remaining = targetId ? await getFloorplanImage(targetId) : null;
      mediaCleared = idDeleteOk && clearAllOk && remaining === null;
    }
  } catch {
    if (isExplicitManualOnly) {
      mediaCleared = true;
    } else {
      mediaCleared = false;
    }
  }

  // STOP: If mandatory image cleanup could not be verified, DO NOT delete localStorage!
  // This preserves the only durable reference to personal floorplan media so the operator can retry deletion.
  if (!mediaCleared) {
    return {
      success: false,
      error: "Floorplan image could not be verified deleted from local database. Assessment retained in browser storage so you can retry deletion.",
      localStorageCleared: false,
      mediaCleared: false,
    };
  }

  // 2. Delete localStorage assessment state ONLY after media is verified cleared
  let localStorageCleared = false;
  try {
    const lsRes = clearPersistedAssessment();
    const storage = getLocalStorage();
    const stillPresent = storage ? storage.getItem(SAFESPACE_STORAGE_KEY) !== null : false;
    localStorageCleared = lsRes.success && !stillPresent;
  } catch {
    localStorageCleared = false;
  }

  // 3. Reset active workspace if successfully cleared
  if (localStorageCleared) {
    try {
      saveActiveWorkspace("demo");
    } catch {}
  }

  if (mediaCleared && localStorageCleared) {
    return {
      success: true,
      localStorageCleared: true,
      mediaCleared: true,
    };
  }

  return {
    success: false,
    error: "Assessment layout could not be cleared from browser storage",
    localStorageCleared: false,
    mediaCleared: true,
  };
}
