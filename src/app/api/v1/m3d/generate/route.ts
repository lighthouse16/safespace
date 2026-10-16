import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Platform limits may cap this value. Long inference may require an async job backend.
export const maxDuration = 180;

const MODEL_TIMEOUT_MS = 165_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_OBJECTS = 200;

function response(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Endpoint is configured by the deployer, never supplied by the browser. */
function modelBase(): string | null {
  const value = process.env.M3D_INFERENCE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function headers() {
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(process.env.M3D_INFERENCE_TOKEN ? { "Authorization": `Bearer ${process.env.M3D_INFERENCE_TOKEN}` } : {}),
  };
}

function validModelScene(input: unknown): input is {
  class_names: string[];
  translations: number[][];
  sizes: number[][];
  angles?: Array<number | number[]>;
} {
  if (!input || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  const names = obj.class_names;
  const translations = obj.translations;
  const sizes = obj.sizes;
  if (!Array.isArray(names) || !Array.isArray(translations) || !Array.isArray(sizes)) return false;
  if (!names.length || names.length > MAX_OBJECTS || translations.length !== names.length || sizes.length !== names.length) return false;
  if (!names.every((name) => typeof name === "string" && name.length <= 100)) return false;
  if (![translations, sizes].every((arr) => arr.every((v: unknown) =>
    Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((coordinate: unknown) =>
      typeof coordinate === "number" && Number.isFinite(coordinate))))) return false;
  if (obj.angles !== undefined && (!Array.isArray(obj.angles) || obj.angles.length !== names.length ||
    !obj.angles.every((angle: unknown) => typeof angle === "number" ? Number.isFinite(angle) :
      Array.isArray(angle) && angle.length > 0 && typeof angle[0] === "number" && Number.isFinite(angle[0])))) return false;
  return true;
}

// Readiness means the deployment is configured, not that a Colab runtime is continuously alive.
export async function GET() {
  const base = modelBase();
  if (!base) return response({ configured: false, reachable: false, message: "The model backend has not been configured." }, 200);
  try {
    // FastAPI exposes /openapi.json by default. This is a cheap readiness probe.
    const probe = await fetch(`${base}/openapi.json`, {
      headers: headers(), signal: AbortSignal.timeout(7_000), cache: "no-store", redirect: "error",
    });
    if (!probe.ok) return response({ configured: true, reachable: false }, 200);
    const openapi = await probe.json() as { paths?: Record<string, unknown> };
    return response({ configured: true, reachable: Boolean(openapi.paths?.["/generate"]) }, 200);
  } catch {
    return response({ configured: true, reachable: false }, 200);
  }
}

export async function POST(request: NextRequest) {
  const base = modelBase();
  if (!base) return response({ error: "M3DLayout backend is not configured. Ask the deployment owner to set M3D_INFERENCE_URL." }, 503);
  let params: unknown;
  try { params = await request.json(); }
  catch { return response({ error: "Invalid JSON request." }, 400); }
  if (!params || typeof params !== "object") return response({ error: "Invalid generation request." }, 400);
  const { prompt, seed } = params as { prompt?: unknown; seed?: unknown };
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000 ||
      typeof seed !== "number" || !Number.isSafeInteger(seed) || Math.abs(seed) > 2147483647) {
    return response({ error: "Provide a nonempty prompt (max 4000 characters) and a valid integer seed." }, 400);
  }

  try {
    const upstream = await fetch(`${base}/generate`, {
      method: "POST", headers: headers(), redirect: "error", cache: "no-store",
      body: JSON.stringify({ prompt, seed }), signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      // Never expose private upstream URLs, keys or raw service error messages.
      return response({ error: `The inference service returned HTTP ${upstream.status}.` }, upstream.status >= 500 ? 502 : 422);
    }
    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) return response({ error: "The model response is too large." }, 502);
    const raw = await upstream.text();
    if (raw.length > MAX_RESPONSE_BYTES) return response({ error: "The model response is too large." }, 502);
    const result: unknown = JSON.parse(raw);
    if (!validModelScene(result)) return response({ error: "The model response did not contain valid furniture geometry." }, 502);
    return response(result, 200);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return response({ error: "The inference service timed out. The notebook or GPU worker may be asleep." }, 504);
    }
    return response({ error: "Could not reach the inference service. Verify the backend URL and runtime." }, 502);
  }
}
