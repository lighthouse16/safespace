import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/server/supabase";
import { AuthCredentialsSchema } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const result = AuthCredentialsSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, fullName } = result.data;
    const supabase = await createRouteHandlerClient(request);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || "",
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      session: data.session ? { expires_at: data.session.expires_at } : null,
      message: data.session ? "Account created and signed in." : "Account created. Please verify your email.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
