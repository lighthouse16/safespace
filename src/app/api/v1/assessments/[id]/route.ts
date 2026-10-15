import { NextResponse } from "next/server";
import { createRouteHandlerClient, getAuthenticatedUser } from "@/lib/server/supabase";
import { FullAssessmentPayloadSchema } from "@/lib/server/validation";
import { dbRowsToPersistedState } from "@/lib/server/assessment-mapper";
import { serverAssessmentStore } from "@/lib/server/assessment-store";


interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const supabase = await createRouteHandlerClient(request);

      // Fetch assessment row
      const { data: assessment, error: aErr } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (!aErr && assessment) {
        // Fetch related rows in parallel
        const [
          { data: scene },
          { data: calibration },
          { data: mobility },
          { data: route },
          { data: asset },
          { data: optimization },
        ] = await Promise.all([
          supabase.from("scenes").select("*").eq("assessment_id", id).maybeSingle(),
          supabase.from("calibrations").select("*").eq("assessment_id", id).maybeSingle(),
          supabase.from("mobility_configs").select("*").eq("assessment_id", id).maybeSingle(),
          supabase.from("routes").select("*").eq("assessment_id", id).maybeSingle(),
          supabase.from("floorplan_assets").select("*").eq("assessment_id", id).maybeSingle(),
          supabase.from("optimizations").select("*").eq("assessment_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);

        const state = dbRowsToPersistedState({
          assessment,
          scene,
          calibration,
          mobility,
          route,
          asset,
          optimization,
        });

        return NextResponse.json({ assessment: state });
      }
    } catch {
      // Supabase unconfigured or remote table not found
    }

    // Check fallback store
    const local = serverAssessmentStore.get(id, user.id);
    if (!local) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (local.bundle) {
      return NextResponse.json({ assessment: local.bundle });
    }

    // Return minimum initialized bundle
    return NextResponse.json({
      assessment: {
        schemaVersion: 1,
        assessmentType: "user",
        metadata: {
          id: local.id,
          name: local.name,
          facilityName: local.facilityName,
          spaceName: local.spaceName,
          environmentType: local.environmentType,
          notes: local.notes,
          createdAt: local.createdAt,
          updatedAt: local.updatedAt,
        },
        canonicalBoundary: null,
        calibration: null,
        activeProfileId: "manual-wheelchair",
        routeWaypoints: [],
        furniture: [],
        hasFloorplanImage: Boolean(local.media),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const result = FullAssessmentPayloadSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const payload = result.data;

    // 1. Always update server fallback store atomically
    serverAssessmentStore.saveBundle(id, user.id, payload as unknown as import("@/lib/storage/persistence").PersistedAssessmentState);

    try {
      const supabase = await createRouteHandlerClient(request);

      let calibrationParam = null;
      if (payload.calibration) {
        const ppm = payload.calibration.unit === "m"
          ? (payload.calibration.pixelDistance / payload.calibration.realLength)
          : (payload.calibration.pixelsPerCm * 100);
        calibrationParam = {
          pixels_per_meter: ppm,
          raw_distance_px: payload.calibration.pixelDistance,
          reference_distance_m: payload.calibration.unit === "m"
            ? payload.calibration.realLength
            : payload.calibration.realLength / 100,
        };
      }

      let mobilityParam = null;
      if (payload.activeProfileSnapshot) {
        const p = payload.activeProfileSnapshot;
        mobilityParam = {
          profile: p.id || payload.activeProfileId,
          turning_space_cm: p.turningSpaceCm,
          passage_width_cm: p.minClearanceCm,
          walker_width_cm: p.minClearanceCm,
          clearance_tolerance_cm: 0,
          bed_side_access_cm: 0,
          door_threshold_max_cm: 0,
          reach_range_low_cm: 0,
          reach_range_high_cm: 0,
          notes: p.description || "",
        };
      }

      let routeParam = null;
      if (payload.routeWaypoints) {
        routeParam = {
          name: "Primary Route",
          checkpoints: payload.routeWaypoints,
        };
      }

      // Atomic execution via PostgreSQL transaction RPC if Supabase is connected
      await supabase.rpc("save_assessment_bundle", {
        p_assessment_id: id,
        p_name: payload.metadata?.name || "Untitled Assessment",
        p_facility: payload.metadata?.facilityName || "",
        p_space: payload.metadata?.spaceName || "",
        p_environment: payload.metadata?.environmentType || "residential",
        p_notes: payload.metadata?.notes || "",
        p_boundary: payload.canonicalBoundary || [],
        p_furniture: payload.furniture || [],
        p_calibration: calibrationParam,
        p_mobility: mobilityParam,
        p_route: routeParam,
      });
    } catch {
      // Supabase unconfigured or remote table not found
    }

    return NextResponse.json({ success: true, message: "Assessment updated atomically." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let deletedAny = serverAssessmentStore.delete(id, user.id);

    try {
      const supabase = await createRouteHandlerClient(request);

      const { data: asset } = await supabase
        .from("floorplan_assets")
        .select("storage_path")
        .eq("assessment_id", id)
        .maybeSingle();

      if (asset?.storage_path) {
        await supabase.storage.from("floorplans").remove([asset.storage_path]);
      }

      const { error: delErr } = await supabase
        .from("assessments")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (!delErr) {
        deletedAny = true;
      }
    } catch {
      // Supabase unconfigured or remote table not found
    }

    if (!deletedAny) {
      return NextResponse.json({ error: "Assessment not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Assessment deleted permanently." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

