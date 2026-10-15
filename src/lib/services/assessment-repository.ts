import {
  savePersistedAssessment,
  loadPersistedAssessment,
  getPersistedAssessment,
  clearPersistedAssessment,
  saveActiveWorkspace,
  loadActiveWorkspace,
  addPendingMediaCleanup,
  getPendingMediaCleanups,
  removePendingMediaCleanup,
} from "@/lib/storage/persistence";
import {
  saveFloorplanImage,
  getFloorplanImage,
  deleteFloorplanImage,
} from "@/lib/storage/image-db";
import { coordinatedDeleteAssessment } from "@/lib/storage/coordinated-storage";

/** Browser-local persistence boundary; synchronous layout writes remain synchronous. */
export type AssessmentRepository = {
  savePersistedAssessment: typeof savePersistedAssessment;
  loadPersistedAssessment: typeof loadPersistedAssessment;
  getPersistedAssessment: typeof getPersistedAssessment;
  clearPersistedAssessment: typeof clearPersistedAssessment;
  saveActiveWorkspace: typeof saveActiveWorkspace;
  loadActiveWorkspace: typeof loadActiveWorkspace;
  addPendingMediaCleanup: typeof addPendingMediaCleanup;
  getPendingMediaCleanups: typeof getPendingMediaCleanups;
  removePendingMediaCleanup: typeof removePendingMediaCleanup;
  saveFloorplanImage: typeof saveFloorplanImage;
  getFloorplanImage: typeof getFloorplanImage;
  deleteFloorplanImage: typeof deleteFloorplanImage;
  coordinatedDeleteAssessment: typeof coordinatedDeleteAssessment;
};

// ponytail: Keep coordinated rollback and cleanup in existing storage functions; add adapters only when another durable backend exists.
export const browserAssessmentRepository: AssessmentRepository = {
  savePersistedAssessment,
  loadPersistedAssessment,
  getPersistedAssessment,
  clearPersistedAssessment,
  saveActiveWorkspace,
  loadActiveWorkspace,
  addPendingMediaCleanup,
  getPendingMediaCleanups,
  removePendingMediaCleanup,
  saveFloorplanImage,
  getFloorplanImage,
  deleteFloorplanImage,
  coordinatedDeleteAssessment,
};
