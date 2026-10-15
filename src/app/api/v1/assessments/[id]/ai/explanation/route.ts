import { NextResponse } from "next/server";
import { getAuthenticatedUser, createRouteHandlerClient } from "@/lib/server/supabase";
import { explainFindingsWithGemini } from "@/lib/server/ai/findings-explainer";
import { AIFindingsExplanationRequestSchema } from "@/lib/server/validation";
import crypto from "crypto";

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
    const result = AIFindingsExplanationRequestSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { assessmentName, profileLabel, findings, metrics } = result.data;

    const explainRes = await explainFindingsWithGemini({
      assessmentName,
      profileLabel,
      findings,
      summaryMetrics: metrics as {
        actionableDeficitsCount: number;
        minimumClearanceCm: number | null;
        routeFeasibility: string;
      },
    });

    if (!explainRes.success || !explainRes.data) {
      return NextResponse.json(
        { error: explainRes.error || "Findings explanation failed" },
        { status: 502 }
      );
    }

    // Persist audit record in ai_analyses
    try {
      const supabase = await createRouteHandlerClient(request);
      const inputHash = crypto
        .createHash("sha256")
        .update(`${assessmentName}:${profileLabel}:${findings.length}`)
        .digest("hex");
      await supabase.from("ai_analyses").insert({
        assessment_id: id,
        type: "explanation",
        model_name: explainRes.data.model,
        input_hash: inputHash,
        raw_response: explainRes.data,
        parsed_result: explainRes.data,
      });
    } catch {
      // Non-blocking audit record
    }

    return NextResponse.json({
      success: true,
      explanation: explainRes.data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
