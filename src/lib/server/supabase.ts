import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "safespace-production-session-secret-default-key-2026";

export interface SessionPayload {
  userId: string;
  email: string;
  fullName?: string;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, "exp">, expiresInSeconds = 7 * 24 * 3600): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${hmac}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
    const payload: SessionPayload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Creates an authenticated Supabase client for Route Handlers and Server Actions.
 * Supports both Cookie-based auth and Bearer JWT in the Authorization header.
 */
export async function createRouteHandlerClient(request?: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  // 1. If explicit Authorization header is passed (API calls / tests), use it
  const authHeader = request?.headers?.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  // 2. Otherwise use cookie store
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Can fail in Server Components; safe in Route Handlers
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.delete({ name, ...options });
        } catch {
          // Can fail in Server Components; safe in Route Handlers
        }
      },
    },
  });
}

/**
 * Creates admin Supabase client with service role key if available.
 */
export function createAdminClient() {
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  const key = supabaseServiceRoleKey || supabaseAnonKey;
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Extracts and validates the authenticated user from the request.
 * Checks HMAC safespace_session cookie/bearer first, then Supabase auth.
 */
export async function getAuthenticatedUser(request?: Request): Promise<User | null> {
  // 1. Check custom signed session cookie or Bearer header
  const cookieHeader = request?.headers?.get("cookie");
  const authHeader = request?.headers?.get("authorization");

  let sessionToken: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token.includes(".")) {
      sessionToken = token;
    }
  }

  if (!sessionToken && cookieHeader) {
    const match = cookieHeader.match(/safespace_session=([^;]+)/);
    if (match) {
      sessionToken = match[1];
    }
  }

  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      const c = cookieStore.get("safespace_session");
      if (c?.value) {
        sessionToken = c.value;
      }
    } catch {
      // safe fallback if outside request context
    }
  }

  if (sessionToken) {
    const verified = verifySessionToken(sessionToken);
    if (verified) {
      return {
        id: verified.userId,
        email: verified.email,
        app_metadata: {},
        user_metadata: { full_name: verified.fullName || "" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as unknown as User;
    }
  }

  // 2. Fall back to Supabase auth client
  try {
    const supabase = await createRouteHandlerClient(request);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return user;
    }
  } catch {
    // Supabase unavailable or unconfigured
  }

  return null;
}

