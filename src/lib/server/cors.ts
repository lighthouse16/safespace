import { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://lighthouse16.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3006",
  "http://127.0.0.1:3006",
];

export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) || [];
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]));
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // non-browser or same-origin
  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
}

export function validateOrigin(request: Request): { allowed: boolean; origin: string | null } {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser caller (curl, server-to-server, unit test)
    return { allowed: true, origin: null };
  }
  if (isOriginAllowed(origin)) {
    return { allowed: true, origin };
  }
  return { allowed: false, origin };
}

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-SafeSpace-Client",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export function handleCorsPreflight(request: Request): NextResponse {
  const originValidation = validateOrigin(request);
  if (!originValidation.allowed) {
    return NextResponse.json(
      { error: "Forbidden: Origin not allowed by SafeSpace CORS policy." },
      { status: 403 }
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export function jsonResponse(
  body: unknown,
  status = 200,
  request?: Request,
  additionalHeaders: Record<string, string> = {}
): NextResponse {
  const cors = request ? getCorsHeaders(request) : {};
  return NextResponse.json(body, {
    status,
    headers: {
      ...cors,
      ...additionalHeaders,
    },
  });
}
