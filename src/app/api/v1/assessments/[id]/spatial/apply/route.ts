import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/supabase";
import { applyServerCandidate } from "@/lib/server/spatial/optimizer-service";
import { SpatialApplyRequestSchema } from "@/lib/server/validation";

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
    const result = SpatialApplyRequestSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { candidateId, expectedSceneFingerprint, sceneFingerprint } = result.data;
    const targetFingerprint = (expectedSceneFingerprint || sceneFingerprint)!;
    const applyRes = await applyServerCandidate({
      assessmentId: id,
      candidateId,
      expectedSceneFingerprint: targetFingerprint,
      request,
    });

    if (!applyRes.success) {
      return NextResponse.json({ error: applyRes.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Candidate applied successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
