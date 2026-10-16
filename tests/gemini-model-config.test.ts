import test from "node:test";
import assert from "node:assert/strict";
import {
  getActiveTextModel,
  getActiveImageModel,
  parseGeminiError,
  DEFAULT_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_PREMIUM_IMAGE_MODEL,
  SUPPORTED_TEXT_MODELS,
  SUPPORTED_IMAGE_MODELS,
} from "../src/lib/server/ai/model-config";

test("Model Config: Default models match approved low-cost specifications", () => {
  assert.equal(DEFAULT_TEXT_MODEL, "gemini-3.1-flash-lite");
  assert.equal(DEFAULT_IMAGE_MODEL, "gemini-3.1-flash-lite-image");
  assert.equal(DEFAULT_PREMIUM_IMAGE_MODEL, "gemini-3.1-flash-image");
  assert.ok(SUPPORTED_TEXT_MODELS.includes(DEFAULT_TEXT_MODEL));
  assert.ok(SUPPORTED_IMAGE_MODELS.includes(DEFAULT_IMAGE_MODEL));
});

test("Model Config: Text model selection respects supported list and rejects unsupported names", () => {
  assert.equal(getActiveTextModel("gemini-3.1-flash-lite"), "gemini-3.1-flash-lite");
  assert.equal(getActiveTextModel("gemini-3.5-flash-lite"), "gemini-3.5-flash-lite");

  // Unsupported or fabricated model name safely falls back to default, never upgrades silently
  assert.equal(getActiveTextModel("gpt-5-ultra"), DEFAULT_TEXT_MODEL);
  assert.equal(getActiveTextModel(""), DEFAULT_TEXT_MODEL);
});

test("Model Config: Image model selection respects standard vs premium tiers", () => {
  assert.equal(getActiveImageModel("gemini-3.1-flash-lite-image", false), "gemini-3.1-flash-lite-image");
  assert.equal(getActiveImageModel("gemini-3.1-flash-image", true), "gemini-3.1-flash-image");
  assert.equal(getActiveImageModel("gemini-nano-banana-2.1", false), "gemini-nano-banana-2.1");

  // Invalid model safely defaults without silent upgrade
  assert.equal(getActiveImageModel("dall-e-4", false), DEFAULT_IMAGE_MODEL);
  assert.equal(getActiveImageModel("dall-e-4", true), DEFAULT_PREMIUM_IMAGE_MODEL);
});

test("Model Config: Structured error parsing classifies 429 quota exhaustion with retry guidance", () => {
  const quotaErr = new Error('{"error":{"code":429,"message":"You exceeded your current quota, please check your plan. retry in 60s","status":"RESOURCE_EXHAUSTED"}}');
  const parsed = parseGeminiError(quotaErr);

  assert.equal(parsed.code, "QUOTA_EXCEEDED");
  assert.equal(parsed.statusCode, 429);
  assert.ok(parsed.message.toLowerCase().includes("quota"));
});

test("Model Config: Structured error parsing classifies 404 model not found", () => {
  const notFoundErr = new Error('{"error":{"code":404,"message":"models/gemini-2.5-flash is no longer available","status":"NOT_FOUND"}}');
  const parsed = parseGeminiError(notFoundErr);

  assert.equal(parsed.code, "MODEL_NOT_FOUND");
  assert.equal(parsed.statusCode, 404);
});

test("Model Config: Structured error parsing classifies 401 authentication error", () => {
  const authErr = new Error("API key not valid. Please pass a valid API key.");
  const parsed = parseGeminiError(authErr);

  assert.equal(parsed.code, "AUTH_ERROR");
  assert.equal(parsed.statusCode, 401);
});

test("Model Config: Structured error parsing classifies timeouts", () => {
  const timeoutErr = new Error("The operation was aborted due to timeout");
  const parsed = parseGeminiError(timeoutErr);

  assert.equal(parsed.code, "TIMEOUT");
  assert.equal(parsed.statusCode, 504);
});
