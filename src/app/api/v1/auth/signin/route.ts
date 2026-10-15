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

    if (!data.user || !data.session) {
      return NextResponse.json({ error: "Invalid credentials or unconfirmed account" }, { status: 401 });
    }

    return NextResponse.json(
      {
        user: { id: data.user.id, email: data.user.email },
        session: data.session,
        message: "Signed in successfully.",
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
