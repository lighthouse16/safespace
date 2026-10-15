import { NextResponse } from "next/server";
import { createRouteHandlerClient, getAuthenticatedUser } from "@/lib/server/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 50MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    const supabase = await createRouteHandlerClient(request);

    // Verify assessment exists and belongs to the authenticated user
    const { data: assessment, error: aErr } = await supabase
      .from("assessments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (aErr || !assessment) {
      return NextResponse.json({ error: "Assessment not found or access denied" }, { status: 404 });
    }

    const fileExt = file.name.split(".").pop() || "png";
    const storagePath = `${user.id}/${id}/floorplan_${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage bucket
    const { error: uploadErr } = await supabase.storage
      .from("floorplans")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    // Upsert floorplan_assets record
    const { data: asset, error: assetErr } = await supabase
      .from("floorplan_assets")
      .upsert(
        {
          assessment_id: id,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
        },
        { onConflict: "assessment_id" }
      )
      .select()
      .single();

    if (assetErr || !asset) {
      return NextResponse.json({ error: assetErr ? assetErr.message : "Failed to record asset" }, { status: 500 });
    }

    const { data: signedData } = await supabase.storage
      .from("floorplans")
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        fileName: asset.file_name,
        mimeType: asset.mime_type,
        fileSizeBytes: asset.file_size_bytes,
        url: signedData?.signedUrl || null,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createRouteHandlerClient(request);

    // Verify assessment ownership
    const { data: assessment, error: aErr } = await supabase
      .from("assessments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (aErr || !assessment) {
      return NextResponse.json({ error: "Assessment not found or access denied" }, { status: 404 });
    }

    const { data: asset, error } = await supabase
      .from("floorplan_assets")
      .select("*")
      .eq("assessment_id", id)
      .single();

    if (error || !asset) {
      return NextResponse.json({ error: "No floorplan media found" }, { status: 404 });
    }

    const { data: signedData } = await supabase.storage
      .from("floorplans")
      .createSignedUrl(asset.storage_path, 3600);

    return NextResponse.json({
      asset: {
        id: asset.id,
        fileName: asset.file_name,
        mimeType: asset.mime_type,
        fileSizeBytes: asset.file_size_bytes,
        url: signedData?.signedUrl || null,
      },
    });
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

    const supabase = await createRouteHandlerClient(request);

    // Verify assessment ownership
    const { data: assessment, error: aErr } = await supabase
      .from("assessments")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (aErr || !assessment) {
      return NextResponse.json({ error: "Assessment not found or access denied" }, { status: 404 });
    }

    const { data: asset } = await supabase
      .from("floorplan_assets")
      .select("storage_path")
      .eq("assessment_id", id)
      .maybeSingle();

    if (asset?.storage_path) {
      await supabase.storage.from("floorplans").remove([asset.storage_path]);
      await supabase.from("floorplan_assets").delete().eq("assessment_id", id);
    }

    return NextResponse.json({ success: true, message: "Media deleted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
