import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRateLimit } from "../src/lib/server/rate-limiter";
import { getCorsHeaders } from "../src/lib/server/cors";
import { GET as getHealth } from "../src/app/api/gemini/health/route";
import { POST as postInterpretation } from "../src/app/api/gemini/interpretation/route";
import { POST as postExplanation } from "../src/app/api/gemini/explanation/route";
import { POST as postVisualize } from "../src/app/api/gemini/visualize/route";

// Each test suite gets a fresh quota file, isolated from parallel suites.
const testQuotaDir = mkdtempSync(join(tmpdir(), "safespace-gateway-suite-"));
process.env.RATE_LIMIT_STORE_DIR = testQuotaDir;
process.env.GEMINI_DAILY_BUDGET = "200";
process.on("exit", () => rmSync(testQuotaDir, { recursive: true, force: true }));

test("Gateway Rate Limiter: Enforces per-minute limit on anonymous IP", () => {
  const testIp = `test-ip-${Date.now()}`;

  // Image visualization route allows 4 req/min
  for (let i = 0; i < 4; i++) {
    const res = checkRateLimit(testIp, "visualize");
    assert.equal(res.allowed, true, `Request ${i + 1} should be allowed`);
  }

  // 5th request in the same minute must be rejected with 429 Retry-After
  const rejected = checkRateLimit(testIp, "visualize");
  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterSeconds && rejected.retryAfterSeconds > 0);
  assert.match(rejected.reason || "", /too many requests/i);
});

test("Gateway CORS: Whitelists official GitHub Pages and localhost development origins", () => {
  const ghReq = new Request("http://localhost/api/gemini/health", {
    headers: { origin: "https://lighthouse16.github.io" },
  });
  const ghHeaders = getCorsHeaders(ghReq);
  assert.equal(ghHeaders["Access-Control-Allow-Origin"], "https://lighthouse16.github.io");

  const localReq = new Request("http://localhost/api/gemini/health", {
    headers: { origin: "http://localhost:3000" },
  });
  const localHeaders = getCorsHeaders(localReq);
  assert.equal(localHeaders["Access-Control-Allow-Origin"], "http://localhost:3000");
});

test("Gateway Health: Returns operational status and model defaults", async () => {
  const req = new Request("http://localhost/api/gemini/health");
  const res = await getHealth(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.status, "ok");
  assert.equal(data.models.text, "gemini-3.1-flash-lite");
  assert.equal(data.models.image, "gemini-3.1-flash-lite-image");
});

test("Gateway Interpretation: Rejects request missing user consent", async () => {
  const req = new Request("http://localhost/api/gemini/interpretation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: false,
      imageMimeType: "image/png",
      imageBase64: "dGVzdA==",
      pixelsPerCm: 2.5,
    }),
  });

  const res = await postInterpretation(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /validation failed/i);
});

test("Gateway Interpretation: Rejects request with non-positive calibration scale", async () => {
  const req = new Request("http://localhost/api/gemini/interpretation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: true,
      imageMimeType: "image/png",
      imageBase64: "dGVzdA==",
      pixelsPerCm: 0,
    }),
  });

  const res = await postInterpretation(req);
  assert.equal(res.status, 400);
});

test("Gateway Interpretation: Rejects unsupported MIME types", async () => {
  const req = new Request("http://localhost/api/gemini/interpretation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: true,
      imageMimeType: "application/pdf",
      imageBase64: "dGVzdA==",
      pixelsPerCm: 2.0,
    }),
  });

  const res = await postInterpretation(req);
  assert.equal(res.status, 400);
});

test("Gateway Explanation: Rejects request missing user consent", async () => {
  const req = new Request("http://localhost/api/gemini/explanation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: false,
      assessmentName: "Test Space",
      profileLabel: "Walker",
    }),
  });

  const res = await postExplanation(req);
  assert.equal(res.status, 400);
});

test("Gateway Visualize: Rejects request missing user consent", async () => {
  const req = new Request("http://localhost/api/gemini/visualize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: false,
      furnitureList: [{ name: "Chair" }],
    }),
  });

  const res = await postVisualize(req);
  assert.equal(res.status, 400);
});
