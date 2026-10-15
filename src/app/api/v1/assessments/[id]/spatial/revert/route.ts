import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/supabase";
import { revertServerCandidate } from "@/lib/server/spatial/optimizer-service";

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

    const revertRes = await revertServerCandidate({
      assessmentId: id,
      request,
    });

    if (!revertRes.success) {
      return NextResponse.json({ error: revertRes.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Candidate reverted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
