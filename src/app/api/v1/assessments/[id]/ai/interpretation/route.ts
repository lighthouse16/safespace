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

    const { imageBase64, imageMimeType, scaleInfo } = result.data;

    // Run Gemini interpretation
    const interpRes = await interpretFloorplanWithGemini({
      imageBase64,
      imageMimeType,
      pixelsPerCm: scaleInfo?.pixelsPerCm,
    });

    if (!interpRes.success || !interpRes.data) {
      return NextResponse.json(
        { error: interpRes.error || "Floorplan interpretation failed" },
        { status: 502 }
      );
    }

    // Persist audit record in ai_analyses
    try {
      const supabase = await createRouteHandlerClient(request);
      const inputHash = crypto.createHash("sha256").update(imageBase64.slice(0, 1000)).digest("hex");
      await supabase.from("ai_analyses").insert({
        assessment_id: id,
        type: "interpretation",
        model_name: interpRes.data.model,
        input_hash: inputHash,
        raw_response: interpRes.data,
        parsed_result: interpRes.data.elements,
      });
    } catch {
      // Audit log error does not prevent returning analysis
    }

    return NextResponse.json({
      success: true,
      elements: interpRes.data.elements,
      rawCount: interpRes.data.rawCount,
      filteredCount: interpRes.data.filteredCount,
      model: interpRes.data.model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
