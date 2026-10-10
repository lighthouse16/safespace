import {
  deleteFloorplanImage,
  clearAllFloorplanImages,
  getFloorplanImage,
} from "./image-db";
import {
  clearPersistedAssessment,
  saveActiveWorkspace,
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
 * If either store fails, reports partial failure and prevents false claims of personal data removal.
 */
export async function coordinatedDeleteAssessment(assessmentId?: string): Promise<DeletionResult> {
  let mediaCleared = false;
  let localStorageCleared = false;

  // 1. Delete IndexedDB floorplan media
  try {
    let idDeleteOk = true;
    if (assessmentId) {
      idDeleteOk = await deleteFloorplanImage(assessmentId);
    }
    const clearAllOk = await clearAllFloorplanImages();

    // Verify absence
    const remaining = assessmentId ? await getFloorplanImage(assessmentId) : null;
    mediaCleared = remaining === null && idDeleteOk && clearAllOk;
  } catch {
    mediaCleared = false;
  }

  // 2. Delete localStorage assessment state
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

  const errors: string[] = [];
  if (!mediaCleared) errors.push("Floorplan image could not be completely removed from local database");
  if (!localStorageCleared) errors.push("Assessment layout could not be cleared from browser storage");

  return {
    success: false,
    error: errors.join("; "),
    localStorageCleared,
    mediaCleared,
  };
}
