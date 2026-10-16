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
 * Returns initialized GoogleGenAI client if GEMINI_API_KEY is configured,
 * otherwise returns null. Strictly server-side.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
