import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/server/supabase";
import { AuthCredentialsSchema } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const result = AuthCredentialsSchema.omit({ fullName: true }).safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = result.data;
    const supabase = await createRouteHandlerClient(request);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      session: data.session
        ? {
            access_token: data.session.access_token,
            expires_at: data.session.expires_at,
          }
        : null,
      message: "Signed in successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
