import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";

export const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Returns initialized GoogleGenAI client if GEMINI_API_KEY is configured,
 * otherwise returns null.
 */
export function getGeminiClient(): GoogleGenAI | null {
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export function isGeminiConfigured(): boolean {
  return Boolean(apiKey);
}
