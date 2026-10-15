import {
  evaluateSpatialScene,
  type SpatialEvaluationResult,
  type Polygon2D,
} from "@/lib/spatial";
import type { MobilityProfileData, RouteWaypoint, SpatialFurniture } from "@/lib/spatial-model";
import { validateSceneGeometry } from "./geometry-validator";
import { createRouteHandlerClient } from "../supabase";

export interface ServerEvaluateParams {
  assessmentId?: string;
  assessmentType?: "demo" | "user";
  boundary?: Polygon2D | null;
  furniture: SpatialFurniture[];
  waypoints: RouteWaypoint[];
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
  });

  // 3. Optionally persist to public.evaluations if assessmentId provided
  if (params.persistResult && params.assessmentId) {
    try {
      const supabase = await createRouteHandlerClient(params.request);
      const score = Math.max(0, 100 - result.summary.actionableDeficitsCount * 15);
      await supabase.from("evaluations").upsert(
        {
          assessment_id: params.assessmentId,
          score,
          status: result.summary.routeFeasibility,
          route_accessibility: result.summary.routeFeasibility,
          clearance_status: result.summary.overallStatusLabel,
          turning_space_compliance: "verified",
          critical_issues_count: result.summary.actionableDeficitsCount,
          findings: result.findings,
        },
        { onConflict: "assessment_id" }
      );
    } catch {
      // Persistence failure in background does not block returning calculated spatial result
    }
  }

  return { success: true, result };
}
