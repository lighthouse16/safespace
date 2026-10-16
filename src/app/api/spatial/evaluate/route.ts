import { readBoundedJson } from "@/lib/server/request-guard";
import { jsonResponse, handleCorsPreflight } from "@/lib/server/cors";
export const runtime = "nodejs";
export async function OPTIONS(request: Request) { return handleCorsPreflight(request); }
import { GuestSpatialSceneSchema } from "@/lib/server/spatial/guest-request";
import { runServerEvaluation } from "@/lib/server/spatial/evaluator-service";
export async function POST(request: Request) {
  const body = await readBoundedJson<unknown>(request, 128 * 1024);
  if (!body.success) return body.response!;
  const parsed = GuestSpatialSceneSchema.safeParse(body.data);
  if (!parsed.success) return jsonResponse({ error: "Invalid calibrated scene", details: parsed.error.flatten() }, 400, request);
  try {
    const { boundary, furniture, routeWaypoints, walls, profile } = parsed.data;
    const calculated = await runServerEvaluation({ assessmentType: "user", boundary, furniture, waypoints: routeWaypoints, walls, profile, persistResult: false });
    if (!calculated.success || !calculated.result) return jsonResponse({ error: "Geometry evaluation rejected", details: calculated.errors }, 400, request);
    return jsonResponse({
      evaluation: calculated.result, source: "deterministic-server-spatial-engine",
      stored: false, measurementUnits: "centimeters",
      provenance: "client-calibrated-geometry-recomputed-by-server",
      limitations: "2D route clearance is modeled; turning maneuvers, physical lighting and clinical fall probability are not assessed.",
    }, 200, request, { "Cache-Control": "no-store" });
  } catch { return jsonResponse({ error: "Spatial evaluator could not process this scene" }, 500, request); }
}
