import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerClient(request).catch(() => null);
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }

    const response = NextResponse.json({ success: true, message: "Signed out successfully." });
    response.cookies.set("safespace_session", "", {
      httpOnly: true,
      path: "/",
      expires: new Date(0),
      sameSite: "lax",
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

