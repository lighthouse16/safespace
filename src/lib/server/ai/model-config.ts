/**
 * SafeSpace Central Gemini Model Configuration & Validation
 *
 * Configurable model IDs verified against Google Gemini live API.
 * Never silently upgrades or substitutes a more expensive model.
 */

export const SUPPORTED_TEXT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash",
  "gemini-3.8-flash",
] as const;

export type SupportedTextModel = (typeof SUPPORTED_TEXT_MODELS)[number];

export const SUPPORTED_IMAGE_MODELS = [
  "gemini-3.1-flash-lite-image",
  "gemini-3.1-flash-image",
] as const;

export const RETIRED_MODELS = [
  "gemini-2.5-flash-image",
] as const;

export function isModelRetired(model: string): boolean {
  return (RETIRED_MODELS as readonly string[]).includes(model);
}

export type SupportedImageModel = (typeof SUPPORTED_IMAGE_MODELS)[number];

export const DEFAULT_TEXT_MODEL: SupportedTextModel = "gemini-3.1-flash-lite";
export const DEFAULT_IMAGE_MODEL: SupportedImageModel = "gemini-3.1-flash-lite-image";
export const DEFAULT_PREMIUM_IMAGE_MODEL: SupportedImageModel = "gemini-3.1-flash-image";

/**
 * Returns configured text model from process.env or verified default.
 */
export function getActiveTextModel(requestedModel?: string): SupportedTextModel {
  const envModel = process.env.GEMINI_TEXT_MODEL?.trim();
  const candidate = requestedModel || envModel || DEFAULT_TEXT_MODEL;

  if (SUPPORTED_TEXT_MODELS.includes(candidate as SupportedTextModel)) {
    return candidate as SupportedTextModel;
  }

  // Fallback strictly to lowest-cost default, never upgrade silently
  return DEFAULT_TEXT_MODEL;
}

/**
 * Returns configured image generation model from process.env or verified default.
 */
export function getActiveImageModel(requestedModel?: string, isPremium = false): SupportedImageModel {
  const envModel = isPremium
    ? process.env.GEMINI_IMAGE_PREMIUM_MODEL?.trim()
    : process.env.GEMINI_IMAGE_MODEL?.trim();

  const candidate = requestedModel || envModel || (isPremium ? DEFAULT_PREMIUM_IMAGE_MODEL : DEFAULT_IMAGE_MODEL);

  if (SUPPORTED_IMAGE_MODELS.includes(candidate as SupportedImageModel)) {
    return candidate as SupportedImageModel;
  }

  return isPremium ? DEFAULT_PREMIUM_IMAGE_MODEL : DEFAULT_IMAGE_MODEL;
}

export interface GeminiApiError {
  code: "QUOTA_EXCEEDED" | "MODEL_NOT_FOUND" | "AUTH_ERROR" | "TIMEOUT" | "INVALID_REQUEST" | "MALFORMED_OUTPUT" | "UPSTREAM_ERROR";
  message: string;
  statusCode: number;
  retryAfterSeconds?: number;
}

/**
 * Parses upstream Gemini / GoogleGenAI errors into structured, safe errors.
 */
export function parseGeminiError(err: unknown): GeminiApiError {
  let message = err instanceof Error ? err.message : String(err);
  let parsedJsonCode: number | undefined;
  let parsedJsonStatus: string | undefined;

  try {
    const json = JSON.parse(message);
    if (json?.error?.message) {
      parsedJsonCode = json.error.code;
      parsedJsonStatus = json.error.status;
      message = json.error.message;
    }
  } catch {}

  // 400 Invalid argument / bad request
  if (
    parsedJsonCode === 400 ||
    parsedJsonStatus === "INVALID_ARGUMENT" ||
    message.includes("INVALID_ARGUMENT") ||
    message.includes("Unable to process input image")
  ) {
    return {
      code: "INVALID_REQUEST",
      message: message.slice(0, 300),
      statusCode: 400,
    };
  }

  // 429 Quota exhaustion
  if (
    parsedJsonCode === 429 ||
    parsedJsonStatus === "RESOURCE_EXHAUSTED" ||
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("quota")
  ) {
    let retryAfterSeconds: number | undefined;
    const retryMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)(?:h|m|s)?/i);
    if (retryMatch) {
      retryAfterSeconds = Math.ceil(parseFloat(retryMatch[1]));
    }
    return {
      code: "QUOTA_EXCEEDED",
      message: "Gemini API rate limit or quota exceeded. Free tier may have 0 quota for certain models.",
      statusCode: 429,
      retryAfterSeconds,
    };
  }

  // 404 Model Not Found
  if (
    parsedJsonCode === 404 ||
    parsedJsonStatus === "NOT_FOUND" ||
    message.includes("404") ||
    message.includes("NOT_FOUND") ||
    message.includes("not found") ||
    message.includes("no longer available")
  ) {
    return {
      code: "MODEL_NOT_FOUND",
      message: "The requested Gemini model is not available or has been deprecated.",
      statusCode: 404,
    };
  }

  // 401 / 403 Auth
  if (
    parsedJsonCode === 401 ||
    parsedJsonCode === 403 ||
    parsedJsonStatus === "UNAUTHENTICATED" ||
    parsedJsonStatus === "PERMISSION_DENIED" ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("API key not valid") ||
    message.includes("UNAUTHENTICATED")
  ) {
    return {
      code: "AUTH_ERROR",
      message: "Gemini API key is invalid or lacks required permissions.",
      statusCode: 401,
    };
  }

  // Timeout
  if (message.includes("timeout") || message.includes("timed out") || message.includes("AbortError")) {
    return {
      code: "TIMEOUT",
      message: "Gemini request timed out. Please try again.",
      statusCode: 504,
    };
  }

  return {
    code: "UPSTREAM_ERROR",
    message: message.slice(0, 300),
    statusCode: 502,
  };
}
