import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/server/supabase";

export async function GET(request: Request) {
  try {
    const supabase = await createRouteHandlerClient(request);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || "",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
