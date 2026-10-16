import { GoogleGenAI } from "@google/genai";
import {
  getActiveTextModel,
  getActiveImageModel,
  DEFAULT_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL,
  type SupportedTextModel,
  type SupportedImageModel,
} from "./model-config";

export {
  getActiveTextModel,
  getActiveImageModel,
  DEFAULT_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL,
  type SupportedTextModel,
  type SupportedImageModel,
};

// Backward-compatibility export
export const GEMINI_MODEL = DEFAULT_TEXT_MODEL;

/**
 * Only server-side environment variables may provide an API key.
 * GEMINI_KEY is a compatible Vercel secret alias for the existing deployment.
 * Prefer GEMINI_API_KEY if both are configured; never expose either in output.
 */
function getServerGeminiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_KEY?.trim() || null;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getServerGeminiKey();
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

export function isGeminiConfigured(): boolean {
  return getServerGeminiKey() !== null;
}
