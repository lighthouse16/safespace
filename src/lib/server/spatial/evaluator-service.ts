import {
  evaluateSpatialScene,
  type SpatialEvaluationResult,
  type Polygon2D,
} from "@/lib/spatial";
import type { MobilityProfileData, RouteWaypoint, SpatialFurniture, SpatialWall, SpatialDoor } from "@/lib/spatial-model";
import { validateSceneGeometry } from "./geometry-validator";
import { createRouteHandlerClient } from "../supabase";

export interface ServerEvaluateParams {
  assessmentId?: string;
  assessmentType?: "demo" | "user";
  boundary?: Polygon2D | null;
  furniture: SpatialFurniture[];
  waypoints: RouteWaypoint[];
  walls?: SpatialWall[];
  doors?: SpatialDoor[];
  profile: MobilityProfileData;
  persistResult?: boolean;
  request?: Request;
}

export async function runServerEvaluation(
  params: ServerEvaluateParams
): Promise<{ success: boolean; result?: SpatialEvaluationResult; errors?: string[] }> {
  // 1. Validate inputs
  const validation = validateSceneGeometry({
    boundary: params.boundary,
    furniture: params.furniture,
    waypoints: params.waypoints,
    walls: params.walls,
  });

  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // 2. Execute deterministic spatial evaluation
  const result = evaluateSpatialScene({
    assessmentType: params.assessmentType ?? "user",
    canonicalBoundary: params.boundary,
    furniture: params.furniture,
    profile: params.profile,
    routeWaypoints: params.waypoints,
    walls: params.walls,
    doors: params.doors,
  });

  // 3. Optionally persist to public.evaluations if assessmentId provided
  if (params.persistResult && params.assessmentId) {
    try {
      const supabase = await createRouteHandlerClient(params.request);
      // No clinically validated 0–100 risk score exists for this geometry-only engine.
      // Migration 003 makes this legacy DB column nullable instead of fabricating one.
      const { error: persistError } = await supabase.from("evaluations").upsert(
        {
          assessment_id: params.assessmentId,
          score: null,
          status: result.summary.routeFeasibility,
          route_accessibility: result.summary.routeFeasibility,
          clearance_status: result.summary.overallStatusLabel,
          // 2D grid routing does not model actual turning kinematics.
          turning_space_compliance: "not-assessed",
          critical_issues_count: result.summary.actionableDeficitsCount,
          findings: result.findings,
        },
        { onConflict: "assessment_id" }
      );
      if (persistError) return { success: false, errors: ["Evaluation computed but could not be persisted. Check DB migration 003 and permissions."] };
    } catch {
      return { success: false, errors: ["Evaluation computed but persistence failed."] };
    }
  }

  return { success: true, result };
}
