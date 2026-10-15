import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/supabase";
import { runServerEvaluation } from "@/lib/server/spatial/evaluator-service";
import { SpatialEvaluateRequestSchema } from "@/lib/server/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const result = SpatialEvaluateRequestSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { boundary, furniture, routeWaypoints, profile } = result.data;
    const evalRes = await runServerEvaluation({
      assessmentId: id,
      assessmentType: "user",
      boundary,
      furniture,
      waypoints: routeWaypoints,
      profile,
      persistResult: true,
      request,
    });

    if (!evalRes.success) {
      return NextResponse.json({ error: "Evaluation failed", details: evalRes.errors }, { status: 400 });
    }

    return NextResponse.json({ evaluation: evalRes.result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
