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

    if (!data.user) {
      return NextResponse.json({ error: "Failed to create user account" }, { status: 500 });
    }

    return NextResponse.json(
      {
        user: { id: data.user.id, email: data.user.email },
        session: data.session,
        message: "Account created successfully.",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
