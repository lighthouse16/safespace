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

    const supabase = await createRouteHandlerClient(request);
    const { data: assessment, error: aErr } = await supabase
      .from("assessments")
      .select("id, user_id, name")
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

    const { assessmentName, profileLabel, findings, metrics } = result.data;

    // Fetch authoritative server evaluation from evaluations table
    const { data: evalRecord } = await supabase
      .from("evaluations")
      .select("*")
      .eq("assessment_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Use authoritative server-verified evaluation when present, fallback to client-supplied validated schema
    const authoritativeFindings = evalRecord?.findings && Array.isArray(evalRecord.findings) && evalRecord.findings.length > 0
      ? evalRecord.findings
      : findings;

    const authoritativeMetrics = {
      actionableDeficitsCount: evalRecord?.critical_issues_count ?? metrics?.actionableDeficitsCount ?? 0,
      minimumClearanceCm: metrics?.minimumClearanceCm ?? null,
      routeFeasibility: evalRecord?.route_accessibility ?? metrics?.routeFeasibility ?? "Infeasible",
    };

    const effectiveName = assessment.name || assessmentName;
    const explainRes = await explainFindingsWithGemini({
      assessmentName: effectiveName,
      profileLabel,
      findings: authoritativeFindings,
      summaryMetrics: authoritativeMetrics as {
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
    let auditPersisted = false;
    let auditError: string | null = null;
    try {
      const inputHash = crypto.createHash("sha256").update(JSON.stringify(authoritativeFindings)).digest("hex");
      const { error: insErr } = await supabase.from("ai_analyses").insert({
        assessment_id: id,
        type: "explanation",
        model_name: explainRes.data.model,
        input_hash: inputHash,
        raw_response: explainRes.data,
        parsed_result: {
          executiveSummary: explainRes.data.executiveSummary,
          clinicalRiskNarrative: explainRes.data.clinicalRiskNarrative,
          caregiverRecommendations: explainRes.data.caregiverRecommendations,
        },
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
      executiveSummary: explainRes.data.executiveSummary,
      clinicalRiskNarrative: explainRes.data.clinicalRiskNarrative,
      caregiverRecommendations: explainRes.data.caregiverRecommendations,
      model: explainRes.data.model,
      evidenceGrounding: {
        serverVerified: Boolean(evalRecord),
        findingsCount: authoritativeFindings.length,
        auditPersisted,
        auditError,
      },
      disclaimer: explainRes.data.disclaimer || "AI explanations are decision support suggestions. Spatial safety requirements must be verified against applicable accessibility standards.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
