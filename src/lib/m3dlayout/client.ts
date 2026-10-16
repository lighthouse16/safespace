import type { M3DGenerateResponse } from "./scene-adapter";

const API_URL_STORAGE_KEY = "safespace-m3d-api-url";

export function normalizeApiBase(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Paste the Colab API URL first.");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("The API URL must start with http:// or https://.");
  }
  return trimmed;
}

export function readStoredApiBase(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_M3D_API_URL ?? "";
  return window.localStorage.getItem(API_URL_STORAGE_KEY) || process.env.NEXT_PUBLIC_M3D_API_URL || "";
}

export function storeApiBase(value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(API_URL_STORAGE_KEY, value.trim());
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      if (typeof parsed.error === "string") return parsed.error.slice(0, 280);
    } catch { /* Model services may return non-JSON errors. */ }
    return body.slice(0, 280) || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function generateM3DLayout(
  apiBase: string,
  prompt: string,
  seed: number,
): Promise<M3DGenerateResponse> {
  const base = apiBase.trim() ? normalizeApiBase(apiBase) : null;
  const target = base ? `${base}/generate` : "/api/v1/m3d/generate";
  let response: Response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(base ? { "ngrok-skip-browser-warning": "true" } : {}),
      },
      body: JSON.stringify({ prompt, seed }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`Could not reach the layout inference service. Check the backend connection. ${message}`);
  }
  if (!response.ok) {
    throw new Error(`Layout generation failed (${response.status}): ${await readError(response)}`);
  }
  const data = (await response.json()) as M3DGenerateResponse;
  if (!Array.isArray(data.class_names) || !Array.isArray(data.translations) || !Array.isArray(data.sizes)) {
    throw new Error("The layout model returned a response without furniture boxes.");
  }
  return data;
}


export type ModelBackendStatus = { configured: boolean; reachable: boolean };

export async function checkM3DBackend(): Promise<ModelBackendStatus> {
  const response = await fetch("/api/v1/m3d/generate", { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("Backend status endpoint is unavailable.");
  const value = await response.json() as Partial<ModelBackendStatus>;
  if (typeof value.configured !== "boolean" || typeof value.reachable !== "boolean") {
    throw new Error("Backend status response is invalid.");
  }
  return { configured: value.configured, reachable: value.reachable };
}
