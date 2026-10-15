import { NextResponse } from "next/server";
import { createRouteHandlerClient, getAuthenticatedUser } from "@/lib/server/supabase";
import { AssessmentCreateSchema } from "@/lib/server/validation";
import { serverAssessmentStore } from "@/lib/server/assessment-store";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const supabase = await createRouteHandlerClient(request);
      const { data, error } = await supabase
        .from("assessments")
        .select("id, name, facility_name, space_name, environment_type, notes, schema_version, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        const formatted = data.map((row) => ({
          id: row.id,
          name: row.name,
          facilityName: row.facility_name,
          spaceName: row.space_name,
          environmentType: row.environment_type,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        return NextResponse.json({ assessments: formatted });
      }
    } catch {
      // Supabase unconfigured or remote table not found
    }

    // Fallback to server store
    const localList = serverAssessmentStore.list(user.id);
    const formatted = localList.map((row) => ({
      id: row.id,
      name: row.name,
      facilityName: row.facilityName,
      spaceName: row.spaceName,
      environmentType: row.environmentType,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
    return NextResponse.json({ assessments: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const result = AssessmentCreateSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name, facilityName, spaceName, environmentType, notes } = result.data;

    try {
      const supabase = await createRouteHandlerClient(request);
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          user_id: user.id,
          name,
          facility_name: facilityName || "",
          space_name: spaceName || "",
          environment_type: environmentType || "residential",
          notes: notes || "",
          schema_version: 1,
        })
        .select()
        .single();

      if (!error && data) {
        serverAssessmentStore.create(user.id, {
          name: data.name,
          facilityName: data.facility_name,
          spaceName: data.space_name,
          environmentType: data.environment_type,
          notes: data.notes,
        });

        return NextResponse.json({
          assessment: {
            id: data.id,
            name: data.name,
            facilityName: data.facility_name,
            spaceName: data.space_name,
            environmentType: data.environment_type,
            notes: data.notes,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          },
        }, { status: 201 });
      }
    } catch {
      // Supabase unconfigured or remote table not found
    }

    // Fallback to server store
    const item = serverAssessmentStore.create(user.id, {
      name,
      facilityName,
      spaceName,
      environmentType,
      notes,
    });

    return NextResponse.json({
      assessment: {
        id: item.id,
        name: item.name,
        facilityName: item.facilityName,
        spaceName: item.spaceName,
        environmentType: item.environmentType,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

