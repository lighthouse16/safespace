import { readBoundedJson } from "@/lib/server/request-guard";
import { jsonResponse, handleCorsPreflight } from "@/lib/server/cors";
export const runtime = "nodejs";
export async function OPTIONS(request: Request) { return handleCorsPreflight(request); }
import { GuestOptimizeSchema } from "@/lib/server/spatial/guest-request";
import { runServerOptimization } from "@/lib/server/spatial/optimizer-service";
export async function POST(request: Request) {
  const body = await readBoundedJson<unknown>(request, 128 * 1024);
  if (!body.success) return body.response!;
  const parsed = GuestOptimizeSchema.safeParse(body.data);
  if (!parsed.success) return jsonResponse({ error: "Invalid optimization scene", details: parsed.error.flatten() }, 400, request);
  try {
    const { scene, maxCandidates, maxEvaluations } = parsed.data;
    const result = await runServerOptimization({
      boundary: scene.boundary, furniture: scene.furniture, waypoints: scene.routeWaypoints,
      walls: scene.walls, profile: scene.profile, maxCandidates, maxEvaluations, persistResult: false,
    });
    if (!result.success || !result.result) return jsonResponse({ error: "Geometry optimization rejected", details: result.errors }, 400, request);
    return jsonResponse({
      optimization: result.result, sceneFingerprint: result.sceneFingerprint,
      source: "deterministic-server-constraint-optimizer", stored: false,
      limitations: "Provisional candidates require explicit acceptance and independent route re-evaluation.",
    }, 200, request, { "Cache-Control": "no-store" });
  } catch { return jsonResponse({ error: "Spatial optimizer could not process this scene" }, 500, request); }
}
