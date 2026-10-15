import type {
  PersistedAssessmentState,
  AssessmentMetadata,
  CalibrationProvenance,
} from "@/lib/storage/persistence";
import type { Polygon2D } from "@/lib/spatial";
import type { MobilityProfileData, RouteWaypoint, SpatialFurniture } from "@/lib/spatial-model";

export interface DbAssessmentRow {
  id: string;
  user_id: string;
  name: string;
  facility_name: string;
  space_name: string;
  environment_type: string;
  notes: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

export interface DbSceneRow {
  assessment_id: string;
  boundary: Polygon2D | null;
  furniture: SpatialFurniture[];
  walls?: unknown[];
  doors?: unknown[];
  windows?: unknown[];
}

export interface DbCalibrationRow {
  assessment_id: string;
  pixels_per_meter: number;
  raw_distance_px: number;
  reference_distance_m: number;
}

export interface DbMobilityRow {
  assessment_id: string;
  profile: string;
  turning_space_cm: number;
  passage_width_cm: number;
  walker_width_cm: number;
  clearance_tolerance_cm: number;
  bed_side_access_cm: number;
  door_threshold_max_cm: number;
  reach_range_low_cm: number;
  reach_range_high_cm: number;
  notes: string;
}

export interface DbRouteRow {
  assessment_id: string;
  name: string;
  checkpoints: RouteWaypoint[];
  path_points: unknown[];
  length_meters: number;
  min_clearance_cm: number;
  clearance_status: string;
  is_passable: boolean;
}

export interface DbAssetRow {
  assessment_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  image_width?: number | null;
  image_height?: number | null;
}

export interface DbOptimizationRow {
  assessment_id: string;
  candidates: unknown[];
  selected_candidate_id: string | null;
  snapshot_before_apply: SpatialFurniture[] | null;
  applied_at: string | null;
}

export function dbRowsToPersistedState(params: {
  assessment: DbAssessmentRow;
  scene?: DbSceneRow | null;
  calibration?: DbCalibrationRow | null;
  mobility?: DbMobilityRow | null;
  route?: DbRouteRow | null;
  asset?: DbAssetRow | null;
  optimization?: DbOptimizationRow | null;
}): PersistedAssessmentState {
  const { assessment, scene, calibration, mobility, route, asset, optimization } = params;

  const metadata: AssessmentMetadata = {
    id: assessment.id,
    name: assessment.name,
    facilityName: assessment.facility_name,
    spaceName: assessment.space_name,
    environmentType: assessment.environment_type,
    notes: assessment.notes || "",
    createdAt: assessment.created_at,
    updatedAt: assessment.updated_at,
  };

  let calibProvenance: CalibrationProvenance | null = null;
  if (calibration && calibration.pixels_per_meter > 0) {
    calibProvenance = {
      pixelsPerCm: calibration.pixels_per_meter / 100,
      realLength: calibration.reference_distance_m,
      unit: "m",
      pixelDistance: calibration.raw_distance_px,
      originPolicy: "canvas-origin-0-0",
    };
  }

  let activeProfileSnapshot: MobilityProfileData | null = null;
  if (mobility) {
    activeProfileSnapshot = {
      id: mobility.profile,
      name: mobility.profile,
      description: mobility.notes || "",
      minClearanceCm: mobility.passage_width_cm,
      turningSpaceCm: mobility.turning_space_cm,
      fallHistory: false,
      requiresSupport: false,
      lowLightSensitivity: "Moderate",
    };
  }

  return {
    schemaVersion: 1,
    assessmentType: "user",
    metadata,
    canonicalBoundary: (scene?.boundary as Polygon2D) || null,
    calibration: calibProvenance,
    activeProfileId: mobility?.profile || "manual-wheelchair",
    activeProfileSnapshot,
    routeWaypoints: route?.checkpoints || [],
    furniture: scene?.furniture || [],
    appliedLayoutBaseline: optimization?.snapshot_before_apply || null,
    appliedCandidateId: optimization?.selected_candidate_id || null,
    appliedSceneFingerprint: null,
    hasFloorplanImage: Boolean(asset),
    pendingMediaCleanupIds: [],
  };
}
