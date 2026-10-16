import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://lighthouse16.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3006",
  "http://127.0.0.1:3006",
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // same-origin or curl/test
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith(".github.io") || origin.endsWith(".vercel.app")) return true;
  return false;
}

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = isOriginAllowed(origin);
  const allowOrigin = allowed ? (origin || "*") : "https://lighthouse16.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleCorsPreflight(request: Request): NextResponse {
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
