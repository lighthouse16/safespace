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
  // Unsupported model falls back safely to default without silent upgrade
  assert.equal(getActiveImageModel("gemini-nano-banana-2.1", false), DEFAULT_IMAGE_MODEL);

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

test("Model Config: Structured error parsing classifies 400 INVALID_ARGUMENT as INVALID_REQUEST", () => {
  const badArgErr = new Error('{"error":{"code":400,"message":"Unable to process input image.","status":"INVALID_ARGUMENT"}}');
  const parsed = parseGeminiError(badArgErr);

  assert.equal(parsed.code, "INVALID_REQUEST");
  assert.equal(parsed.statusCode, 400);
  assert.equal(parsed.message, "Unable to process input image.");
});

import { transformNormalizedBoxToPhysicalCm } from "../src/lib/server/ai/floorplan-interpreter";

test("Coordinate Transform: 800x600 standard image at 1.0 px/cm maps without letterboxing", () => {
  const res = transformNormalizedBoxToPhysicalCm({
    xmin: 100, // 10%
    ymin: 200, // 20%
    xmax: 300, // 30%
    ymax: 400, // 40%
    imageWidth: 800,
    imageHeight: 600,
    canvasWidth: 800,
    canvasHeight: 600,
    pixelsPerCm: 1.0,
  });

  // canvas width = 800, canvas height = 600
  // x = 0.10 * 800 = 80 cm
  // y = 0.20 * 600 = 120 cm
  // width = 0.20 * 800 = 160 cm
  // depth = 0.20 * 600 = 120 cm
  assert.equal(res.xCm, 80);
  assert.equal(res.yCm, 120);
  assert.equal(res.widthCm, 160);
  assert.equal(res.depthCm, 120);
});

test("Coordinate Transform: High-res 2400x1800 image (4:3) scales accurately into 800x600 canvas", () => {
  const res = transformNormalizedBoxToPhysicalCm({
    xmin: 100,
    ymin: 200,
    xmax: 300,
    ymax: 400,
    imageWidth: 2400,
    imageHeight: 1800,
    canvasWidth: 800,
    canvasHeight: 600,
    pixelsPerCm: 2.0,
  });

  // Uniform scale into 800x600: scale = 800/2400 = 1/3
  // rendered = 800 x 600, offsets = 0, 0
  // canvasPx: x = 80, y = 120, w = 160, h = 120
  // cm = canvasPx / 2.0: x = 40, y = 60, w = 80, h = 60
  assert.equal(res.xCm, 40);
  assert.equal(res.yCm, 60);
  assert.equal(res.widthCm, 80);
  assert.equal(res.depthCm, 60);
});

test("Coordinate Transform: Panoramic 1600x600 image applies vertical letterbox offset", () => {
  const res = transformNormalizedBoxToPhysicalCm({
    xmin: 0,
    ymin: 0, // top of the wide image
    xmax: 500,
    ymax: 500,
    imageWidth: 1600,
    imageHeight: 600,
    canvasWidth: 800,
    canvasHeight: 600,
    pixelsPerCm: 1.0,
  });

  // scale = min(800/1600, 600/600) = 0.5
  // renderedW = 800, renderedH = 300
  // offsetX = 0, offsetY = (600 - 300) / 2 = 150 px
  // canvasPxLeft = 0 + 0 = 0 px -> xCm = 0
  // canvasPxTop = 150 + 0 = 150 px -> yCm = 150
  // canvasPxWidth = 0.5 * 800 = 400 px -> widthCm = 400
  // canvasPxHeight = 0.5 * 300 = 150 px -> depthCm = 150
  assert.equal(res.xCm, 0);
  assert.equal(res.yCm, 150);
  assert.equal(res.widthCm, 400);
  assert.equal(res.depthCm, 150);
});

test("Coordinate Transform: Portrait 600x1200 image applies horizontal letterbox offset", () => {
  const res = transformNormalizedBoxToPhysicalCm({
    xmin: 0, // left of tall image
    ymin: 0,
    xmax: 1000,
    ymax: 1000,
    imageWidth: 600,
    imageHeight: 1200,
    canvasWidth: 800,
    canvasHeight: 600,
    pixelsPerCm: 1.0,
  });

  // scale = min(800/600, 600/1200) = 0.5
  // renderedW = 300, renderedH = 600
  // offsetX = (800 - 300) / 2 = 250 px, offsetY = 0 px
  // canvasPxLeft = 250 px -> xCm = 250
  // canvasPxTop = 0 px -> yCm = 0
  // canvasPxWidth = 300 px -> widthCm = 300
  // canvasPxHeight = 600 px -> depthCm = 600
  assert.equal(res.xCm, 250);
  assert.equal(res.yCm, 0);
  assert.equal(res.widthCm, 300);
  assert.equal(res.depthCm, 600);
});

test("Coordinate Transform: Clamps negative or overflowing normalized values safely to [0, 1000]", () => {
  const res = transformNormalizedBoxToPhysicalCm({
    xmin: -100,
    ymin: -50,
    xmax: 1500,
    ymax: 2000,
    imageWidth: 800,
    imageHeight: 600,
    canvasWidth: 800,
    canvasHeight: 600,
    pixelsPerCm: 1.0,
  });

  // Clamped to 0..1000, filling the 800x600 canvas
  assert.equal(res.xCm, 0);
  assert.equal(res.yCm, 0);
  assert.equal(res.widthCm, 800);
  assert.equal(res.depthCm, 600);
});
