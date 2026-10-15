import {
  optimizeLayout,
  computeSceneFingerprint,
  type OptimizationResult,
  type Polygon2D,
} from "@/lib/spatial";
import type { MobilityProfileData, RouteWaypoint, SpatialFurniture } from "@/lib/spatial-model";
import { validateSceneGeometry } from "./geometry-validator";
import { createRouteHandlerClient } from "../supabase";

export interface ServerOptimizeParams {
  assessmentId?: string;
  boundary?: Polygon2D | null;
  furniture: SpatialFurniture[];
  waypoints: RouteWaypoint[];
  profile: MobilityProfileData;
  persistResult?: boolean;
  request?: Request;
}

export async function runServerOptimization(
  params: ServerOptimizeParams
): Promise<{
  success: boolean;
  result?: OptimizationResult;
  sceneFingerprint?: string;
  errors?: string[];
}> {
  // 1. Validate inputs
  const validation = validateSceneGeometry({
    boundary: params.boundary,
    furniture: params.furniture,
    waypoints: params.waypoints,
  });

  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // 2. Compute fingerprint
  const fingerprint = computeSceneFingerprint({
    furniture: params.furniture,
    waypoints: params.waypoints,
    boundary: params.boundary ?? null,
    profile: params.profile,
  });

  // 3. Execute deterministic layout optimizer
  const result = optimizeLayout({
    furniture: params.furniture,
    waypoints: params.waypoints,
    boundary: params.boundary,
    profile: params.profile,
  });

  // 4. Optionally persist candidates to optimizations table
  if (params.persistResult && params.assessmentId) {
    try {
      const supabase = await createRouteHandlerClient(params.request);
      await supabase.from("optimizations").insert({
        assessment_id: params.assessmentId,
        status: result.status,
        scene_fingerprint: fingerprint,
        candidates: result.candidates,
        snapshot_before_apply: params.furniture,
      });
    } catch {
      // Non-blocking persistence
    }
  }

  return { success: true, result, sceneFingerprint: fingerprint };
}

export async function applyServerCandidate(params: {
  assessmentId: string;
  candidateId: string;
  expectedSceneFingerprint: string;
  request?: Request;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createRouteHandlerClient(params.request);

    // Fetch existing scene and profile
    const [sceneRes, optRes, mobRes, routeRes] = await Promise.all([
      supabase.from("scenes").select("*").eq("assessment_id", params.assessmentId).single(),
      supabase
        .from("optimizations")
        .select("*")
        .eq("assessment_id", params.assessmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("mobility_configs").select("*").eq("assessment_id", params.assessmentId).maybeSingle(),
      supabase.from("routes").select("*").eq("assessment_id", params.assessmentId).maybeSingle(),
    ]);

    if (sceneRes.error || !sceneRes.data) {
      return { success: false, error: "Assessment scene not found" };
    }

    const currentFurniture: SpatialFurniture[] = sceneRes.data.furniture || [];
    const waypoints: RouteWaypoint[] = routeRes.data?.checkpoints || [];
    const boundary: Polygon2D = sceneRes.data.boundary;

    // Verify scene fingerprint to prevent applying stale candidate
    const currentFingerprint = computeSceneFingerprint({
      furniture: currentFurniture,
      waypoints,
      boundary: boundary || null,
      profileId: mobRes.data?.profile || "manual-wheelchair",
      minClearanceCm: mobRes.data?.passage_width_cm,
      turningSpaceCm: mobRes.data?.turning_space_cm,
    });

    if (currentFingerprint !== params.expectedSceneFingerprint) {
      return {
        success: false,
        error: "Scene geometry changed since optimization was generated. Candidate rejected.",
      };
    }

    const candidates = (optRes.data?.candidates as Array<{ id: string; furniture: SpatialFurniture[] }>) || [];
    const candidate = candidates.find((c) => c.id === params.candidateId);
    if (!candidate) {
      return { success: false, error: `Candidate ${params.candidateId} not found in stored alternatives` };
    }

    // Call PostgreSQL atomic RPC function
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("apply_layout_candidate", {
      p_assessment_id: params.assessmentId,
      p_candidate_id: params.candidateId,
      p_expected_fingerprint: params.expectedSceneFingerprint,
    });

    if (rpcErr) {
      return { success: false, error: rpcErr.message };
    }

    if (rpcRes && typeof rpcRes === "object" && "success" in rpcRes && !rpcRes.success) {
      return { success: false, error: (rpcRes as { error?: string }).error || "Failed to apply layout candidate" };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Internal error" };
  }
}

export async function revertServerCandidate(params: {
  assessmentId: string;
  request?: Request;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createRouteHandlerClient(params.request);

    // Call PostgreSQL atomic RPC function
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("revert_layout_candidate", {
      p_assessment_id: params.assessmentId,
    });

    if (rpcErr) {
      return { success: false, error: rpcErr.message };
    }

    if (rpcRes && typeof rpcRes === "object" && "success" in rpcRes && !rpcRes.success) {
      return { success: false, error: (rpcRes as { error?: string }).error || "Failed to revert layout candidate" };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Internal error" };
  }
}
