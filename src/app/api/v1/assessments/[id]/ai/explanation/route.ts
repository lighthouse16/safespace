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

    let assessmentNameFromDb = "";
    let hasAccess = false;
    let supabaseClient = null;

    try {
      const supabase = await createRouteHandlerClient(request);
      supabaseClient = supabase;
      const { data: assessment, error: aErr } = await supabase
        .from("assessments")
        .select("id, user_id, name")
        .eq("id", id)
        .maybeSingle();

      if (!aErr && assessment) {
        if (assessment.user_id !== user.id) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        assessmentNameFromDb = assessment.name;
        hasAccess = true;
      }
    } catch {
      // Supabase unconfigured / table missing
    }

    if (!hasAccess) {
      const { serverAssessmentStore } = await import("@/lib/server/assessment-store");
      const local = serverAssessmentStore.get(id, user.id);
      if (!local) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }
      assessmentNameFromDb = local.name;
    }

    const { assessmentName, profileLabel, findings, metrics } = result.data;

    // Fetch authoritative server evaluation to verify client-supplied findings
    let evalRecord = null;
    if (supabaseClient) {
      try {
        const { data } = await supabaseClient
          .from("evaluations")
          .select("*")
          .eq("assessment_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        evalRecord = data;
      } catch {
        // Fallback to client metrics
      }
    }

    // Use authoritative server-verified evaluation when present, fallback to client-supplied validated schema
    const authoritativeFindings = evalRecord?.findings && Array.isArray(evalRecord.findings) && evalRecord.findings.length > 0
      ? evalRecord.findings
      : findings;

    const authoritativeMetrics = {
      actionableDeficitsCount: evalRecord?.critical_issues_count ?? metrics?.actionableDeficitsCount ?? 0,
      minimumClearanceCm: metrics?.minimumClearanceCm ?? null,
      routeFeasibility: evalRecord?.route_accessibility ?? metrics?.routeFeasibility ?? "Infeasible",
    };

    const effectiveName = assessmentNameFromDb || assessmentName;
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

    // Explicit audit record in ai_analyses
    let auditPersisted = false;
    let auditError: string | null = null;
    if (supabaseClient) {
      try {
        const inputHash = crypto
          .createHash("sha256")
          .update(`${effectiveName}:${profileLabel}:${authoritativeFindings.length}`)
          .digest("hex");
        const { error: insErr } = await supabaseClient.from("ai_analyses").insert({
          assessment_id: id,
          type: "explanation",
          model_name: explainRes.data.model,
          input_hash: inputHash,
          raw_response: explainRes.data,
          parsed_result: explainRes.data,
        });
        if (insErr) {
          auditError = insErr.message;
        } else {
          auditPersisted = true;
        }
      } catch (err: unknown) {
        auditError = err instanceof Error ? err.message : "Audit log exception";
      }
    }

    return NextResponse.json({
      success: true,
      explanation: explainRes.data,
      auditPersisted,
      auditError,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
