import { NextResponse } from "next/server";
import { getAuthenticatedUser, createRouteHandlerClient } from "@/lib/server/supabase";
import { interpretFloorplanWithGemini } from "@/lib/server/ai/floorplan-interpreter";
import { AIFloorplanInterpretationRequestSchema } from "@/lib/server/validation";
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
    const result = AIFloorplanInterpretationRequestSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createRouteHandlerClient(request);
    const { data: assessment, error: aErr } = await supabase
      .from("assessments")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (aErr) {
      return NextResponse.json({ error: aErr.message }, { status: 500 });
    }

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied to foreign assessment" }, { status: 403 });
    }

    const { imageBase64, imageMimeType, pixelsPerCm, scaleInfo } = result.data;
    const effectiveScale = pixelsPerCm ?? scaleInfo?.pixelsPerCm;

    // Strict calibration scale requirement
    if (!effectiveScale || effectiveScale <= 0) {
      return NextResponse.json(
        {
          error: "Calibration scale required. Floorplan image must be calibrated with a real-world reference dimension before interpreting spatial dimensions.",
        },
        { status: 400 }
      );
    }

    // Run Gemini interpretation
    const interpRes = await interpretFloorplanWithGemini({
      imageBase64,
      imageMimeType,
      pixelsPerCm: effectiveScale,
    });

    if (!interpRes.success || !interpRes.data) {
      return NextResponse.json(
        { error: interpRes.error || "Floorplan interpretation failed" },
        { status: 502 }
      );
    }

    // Explicit audit record in ai_analyses
    let auditPersisted = false;
    let auditError: string | null = null;
    try {
      const inputHash = crypto.createHash("sha256").update(imageBase64.slice(0, 1000)).digest("hex");
      const { error: insErr } = await supabase.from("ai_analyses").insert({
        assessment_id: id,
        type: "interpretation",
        model_name: interpRes.data.model,
        input_hash: inputHash,
        raw_response: interpRes.data,
        parsed_result: interpRes.data.elements,
      });
      if (insErr) {
        auditError = insErr.message;
      } else {
        auditPersisted = true;
      }
    } catch (err: unknown) {
      auditError = err instanceof Error ? err.message : "Failed to record audit log";
    }

    return NextResponse.json({
      elements: interpRes.data.elements,
      rawCount: interpRes.data.rawCount,
      filteredCount: interpRes.data.filteredCount,
      model: interpRes.data.model,
      scaleUsed: effectiveScale,
      humanReviewRequired: true,
      auditPersisted,
      auditError,
      disclaimer: "AI interpretations are assistance proposals and must be reviewed and accepted by a qualified assessor.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
