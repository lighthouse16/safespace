import {
  deleteFloorplanImage,
  clearAllFloorplanImages,
  inspectFloorplanImage,
  countFloorplanImages,
} from "./image-db";
import {
  clearPersistedAssessment,
  saveActiveWorkspace,
  getPersistedAssessment,
  getPendingMediaCleanups,
  clearPendingMediaCleanups,
  SAFESPACE_STORAGE_KEY,
} from "./persistence";

export interface DeletionResult {
  success: boolean;
  error?: string;
  warning?: string;
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
 * Verifies that all user records (including prior orphaned media obligations) are confirmed
 * absent before reporting full success.
 * If mandatory image cleanup is not verified, DOES NOT delete localStorage, ensuring
 * recoverable retry across refresh.
 * Honest support for manual-only data when IndexedDB is unavailable (never falsely claims
 * verified media clearance).
 */
export async function coordinatedDeleteAssessment(assessmentId?: string): Promise<DeletionResult> {
  const persisted = getPersistedAssessment();
  const targetId = assessmentId || persisted?.metadata?.id;
  // Strict manual-only declaration requires hasFloorplanImage to be explicitly false.
  // Missing or undefined is treated as unknown provenance, NEVER confirmed manual-only.
  const isConfirmedManualOnly = persisted?.hasFloorplanImage === false;

  // Gather ALL pending media cleanup obligations across durable storage and persisted snapshot
  const pendingCleanups = Array.from(
    new Set([...getPendingMediaCleanups(), ...(persisted?.pendingMediaCleanupIds || [])])
  );
  const hasPendingDebt = pendingCleanups.length > 0;

  let mediaCleared = false;
  let warning: string | undefined;

  // 1. Delete IndexedDB floorplan media if applicable
  if (isConfirmedManualOnly && !hasPendingDebt) {
    // Pure manual-only assessment with zero pending cleanup debts.
    // Check if IndexedDB is accessible by inspecting targetId:
    const inspTarget = targetId ? await inspectFloorplanImage(targetId) : { status: "not_found" as const };

    if (inspTarget.status === "error") {
      // IndexedDB is blocked or disabled on device.
      // Allow manual-only layout deletion from localStorage, but truthfully report unverified residual state.
      mediaCleared = true;
      warning = "IndexedDB was inaccessible to verify media store absence during manual-only removal. Assessment layout was cleared from browser storage, but media store absence could not be verified.";
    } else {
      // IndexedDB is accessible
      let unexpectedRecordDeleted = true;
      if (inspTarget.status === "found" && targetId) {
        unexpectedRecordDeleted = await deleteFloorplanImage(targetId);
      }
      const clearAllOk = await clearAllFloorplanImages();
      const countRes = await countFloorplanImages();
      const finalCountZero = countRes.ok ? countRes.count === 0 : true;

      if (unexpectedRecordDeleted && clearAllOk && finalCountZero) {
        mediaCleared = true;
        clearPendingMediaCleanups();
      } else {
        mediaCleared = false;
      }
    }
  } else {
    // Imported image (hasFloorplanImage === true), OR unknown provenance (undefined),
    // OR known pending cleanup debt (hasPendingDebt === true):
    // IndexedDB media cleanup and double-absence verification are strictly mandatory!
    try {
      // 1. Delete target image if present
      const idDeleteOk = targetId ? await deleteFloorplanImage(targetId) : true;

      // 2. Delete all pending cleanup obligations
      let allPendingDeleted = true;
      for (const pendingId of pendingCleanups) {
        const pDelOk = await deleteFloorplanImage(pendingId);
        if (!pDelOk) allPendingDeleted = false;
      }

      // 3. Purge entire media store only if individual deletions succeeded
      let clearAllOk = false;
      if (idDeleteOk && allPendingDeleted) {
        clearAllOk = await clearAllFloorplanImages();
      }

      // 4. Verify absence with inspectFloorplanImage for target and all pending IDs
      let targetAbsent = true;
      if (targetId) {
        const insp = await inspectFloorplanImage(targetId);
        targetAbsent = insp.status === "not_found";
      }

      let allPendingAbsent = true;
      for (const pendingId of pendingCleanups) {
        const insp = await inspectFloorplanImage(pendingId);
        if (insp.status !== "not_found") {
          allPendingAbsent = false;
        }
      }

      // 5. Verify total count
      const countRes = await countFloorplanImages();
      const finalCountZero = countRes.ok ? countRes.count === 0 : true;

      mediaCleared =
        idDeleteOk &&
        allPendingDeleted &&
        clearAllOk &&
        targetAbsent &&
        allPendingAbsent &&
        finalCountZero;

      if (mediaCleared) {
        clearPendingMediaCleanups();
      }
    } catch {
      mediaCleared = false;
    }
  }

  // STOP: If media cleanup was required but could not be verified, DO NOT delete localStorage!
  // Exception: Pure manual-only assessment with NO pending debts where IDB is unavailable allows
  // deleting localStorage layout while truthfully returning mediaCleared: false and warning.
  const allowLocalStorageDelete =
    mediaCleared || (isConfirmedManualOnly && !hasPendingDebt);

  if (!allowLocalStorageDelete) {
    return {
      success: false,
      error: "Floorplan image could not be verified deleted from local database. Assessment retained in browser storage so you can retry deletion.",
      localStorageCleared: false,
      mediaCleared: false,
    };
  }

  // 2. Delete localStorage assessment state ONLY after media is verified cleared (or allowed manual exception)
  let localStorageCleared = false;
  try {
    const lsRes = clearPersistedAssessment();
    const storage = getLocalStorage();
    const stillPresent = storage ? storage.getItem(SAFESPACE_STORAGE_KEY) !== null : false;
    localStorageCleared = lsRes.success && !stillPresent;
    if (mediaCleared) {
      clearPendingMediaCleanups();
    }
  } catch {
    localStorageCleared = false;
  }

  // 3. Reset active workspace if successfully cleared
  if (localStorageCleared) {
    try {
      saveActiveWorkspace("demo");
    } catch {}
  }

  if (localStorageCleared) {
    return {
      success: true,
      localStorageCleared: true,
      mediaCleared,
      ...(warning ? { warning } : {}),
    };
  }

  return {
    success: false,
    error: "Assessment layout could not be cleared from browser storage",
    localStorageCleared: false,
    mediaCleared,
  };
}
