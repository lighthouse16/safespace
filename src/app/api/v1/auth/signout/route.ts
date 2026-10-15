import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerClient(request);
    const { error } = await supabase.auth.signOut();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Signed out successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
