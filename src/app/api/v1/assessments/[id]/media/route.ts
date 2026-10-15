import { NextResponse } from "next/server";
import { createRouteHandlerClient, getAuthenticatedUser } from "@/lib/server/supabase";
import { serverAssessmentStore } from "@/lib/server/assessment-store";
import crypto from "node:crypto";

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

    const fileExt = file.name.split(".").pop() || "png";
    const storagePath = `${user.id}/${id}/floorplan_${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      const supabase = await createRouteHandlerClient(request);

      // Verify ownership in Supabase if exists
      const { data: assessment } = await supabase
        .from("assessments")
        .select("id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (assessment) {
        // Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from("floorplans")
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: true,
          });

        if (!uploadErr) {
          // Upsert floorplan_assets record
          const { data: asset } = await supabase
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

          if (asset) {
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
          }
        }
      }
    } catch {
      // Supabase unconfigured or remote table not found
    }

    // Fallback store
    const fallbackUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    serverAssessmentStore.saveMedia(id, user.id, {
      fileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
      url: fallbackUrl,
    });

    return NextResponse.json({
      success: true,
      asset: {
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        url: fallbackUrl,
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

    try {
      const supabase = await createRouteHandlerClient(request);
      const { data: asset, error } = await supabase
        .from("floorplan_assets")
        .select("*")
        .eq("assessment_id", id)
        .single();

      if (!error && asset) {
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
      }
    } catch {
      // Supabase unconfigured
    }

    const localMedia = serverAssessmentStore.getMedia(id, user.id);
    if (!localMedia) {
      return NextResponse.json({ error: "No floorplan media found" }, { status: 404 });
    }

    return NextResponse.json({
      asset: localMedia,
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

    serverAssessmentStore.deleteMedia(id, user.id);

    try {
      const supabase = await createRouteHandlerClient(request);
      const { data: asset } = await supabase
        .from("floorplan_assets")
        .select("storage_path")
        .eq("assessment_id", id)
        .single();

      if (asset?.storage_path) {
        await supabase.storage.from("floorplans").remove([asset.storage_path]);
        await supabase.from("floorplan_assets").delete().eq("assessment_id", id);
      }
    } catch {
      // Supabase unconfigured
    }

    return NextResponse.json({ success: true, message: "Media deleted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

