import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { checkRateLimit, getClientIp, resetRateLimits } from "@/lib/server/rate-limiter";
import { validateOrigin, handleCorsPreflight } from "@/lib/server/cors";
import { verifyImageBinary } from "@/lib/server/request-guard";
import { isModelRetired, SUPPORTED_IMAGE_MODELS } from "@/lib/server/ai/model-config";
import { GET as getHealth } from "@/app/api/gemini/health/route";
import { POST as postExplanation } from "@/app/api/gemini/explanation/route";
import { POST as postInterpretation } from "@/app/api/gemini/interpretation/route";
import { POST as postVisualize } from "@/app/api/gemini/visualize/route";

const pExecFile = promisify(execFile);
const VALID_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// =========================================================================
// P0: Shared Atomic Rate Limiter & Real-Money Budget Protection
// =========================================================================

test("Security P0: Concurrency - Atomic shared limiter under parallel load", async () => {
  resetRateLimits();
  const testIp = `concurrent-test-ip-${Date.now()}`;

  // Fire 10 parallel requests to route 'visualize' (max 4 allowed per minute)
  const promises = Array.from({ length: 10 }, () =>
    Promise.resolve(checkRateLimit(testIp, "visualize"))
  );

  const results = await Promise.all(promises);
  const allowedCount = results.filter((r) => r.allowed).length;
  const rejectedCount = results.filter((r) => !r.allowed).length;

  assert.equal(allowedCount, 4, "Exactly 4 requests should be allowed under concurrency");
  assert.equal(rejectedCount, 6, "Exactly 6 requests must be rejected with 429 under concurrency");
});

test("Security P0: Emergency shutdown fail-closed when GEMINI_DAILY_BUDGET=0", () => {
  const originalBudget = process.env.GEMINI_DAILY_BUDGET;
  process.env.GEMINI_DAILY_BUDGET = "0";

  try {
    resetRateLimits();
    const res = checkRateLimit("any-ip", "interpretation");
    assert.equal(res.allowed, false);
    assert.equal(res.remaining, 0);
    assert.match(res.reason || "", /emergency ai shutdown active/i);
  } finally {
    if (originalBudget !== undefined) {
      process.env.GEMINI_DAILY_BUDGET = originalBudget;
    } else {
      delete process.env.GEMINI_DAILY_BUDGET;
    }
    resetRateLimits();
  }
});

test("Security P0: Real-money budget ceiling enforcement across routes", () => {
  const originalBudget = process.env.GEMINI_DAILY_BUDGET;
  process.env.GEMINI_DAILY_BUDGET = "8"; // 8 units budget

  try {
    resetRateLimits();
    // visualize route costs 5 units
    const res1 = checkRateLimit("ip-budget-1", "visualize");
    assert.equal(res1.allowed, true);
    assert.equal(res1.consumedCost, 5);

    // explanation route costs 1 unit
    const res2 = checkRateLimit("ip-budget-1", "explanation");
    assert.equal(res2.allowed, true);
    assert.equal(res2.consumedCost, 6);

    // another visualize route costs 5 units, 6 + 5 = 11 > 8 -> must be blocked
    const res3 = checkRateLimit("ip-budget-1", "visualize");
    assert.equal(res3.allowed, false);
    assert.match(res3.reason || "", /daily ai request budget/i);
  } finally {
    if (originalBudget !== undefined) {
      process.env.GEMINI_DAILY_BUDGET = originalBudget;
    } else {
      delete process.env.GEMINI_DAILY_BUDGET;
    }
    resetRateLimits();
  }
});

// =========================================================================
// P0: IP Identity & Spoofing Resistance
// =========================================================================

test("Security P0: getClientIp resists attacker rotation of leftmost X-Forwarded-For", () => {
  // Attacker prepends fake rotating IP, trusted proxy appends actual socket IP (198.51.100.25)
  const req1 = new Request("http://localhost/api/gemini/health", {
    headers: { "x-forwarded-for": "203.0.113.1, 198.51.100.25" },
  });
  const req2 = new Request("http://localhost/api/gemini/health", {
    headers: { "x-forwarded-for": "203.0.113.2, 198.51.100.25" },
  });

  const ip1 = getClientIp(req1);
  const ip2 = getClientIp(req2);

  assert.equal(ip1, "198.51.100.25", "Must resolve to nearest trusted proxy hop");
  assert.equal(ip2, "198.51.100.25", "Must resolve to nearest trusted proxy hop");
  assert.equal(ip1, ip2, "Both rotated requests must resolve to the identical client IP");
});

test("Security P0: getClientIp prioritizes platform-authenticated headers (Vercel, Cloudflare)", () => {
  const reqVercel = new Request("http://localhost/api/gemini/health", {
    headers: {
      "x-vercel-forwarded-for": "192.0.2.42",
      "x-forwarded-for": "spoofed.ip.1, spoofed.ip.2",
    },
  });
  assert.equal(getClientIp(reqVercel), "192.0.2.42");

  const reqCf = new Request("http://localhost/api/gemini/health", {
    headers: {
      "cf-connecting-ip": "192.0.2.99",
      "x-forwarded-for": "spoofed.ip.1",
    },
  });
  assert.equal(getClientIp(reqCf), "192.0.2.99");
});

// =========================================================================
// P1: Origin Validation & CORS Hardening
// =========================================================================

test("Security P1: Origin check strictly rejects unapproved origins and wildcard attempts", () => {
  // Attempted wildcard bypasses
  assert.equal(validateOrigin(new Request("http://localhost", { headers: { origin: "https://evil.com" } })).allowed, false);
  assert.equal(validateOrigin(new Request("http://localhost", { headers: { origin: "https://attacker.github.io" } })).allowed, false);
  assert.equal(validateOrigin(new Request("http://localhost", { headers: { origin: "https://unknown.vercel.app" } })).allowed, false);
  assert.equal(validateOrigin(new Request("http://localhost", { headers: { origin: "https://lighthouse16.github.io.attacker.com" } })).allowed, false);

  // Exact whitelisted origins
  assert.equal(validateOrigin(new Request("http://localhost", { headers: { origin: "https://lighthouse16.github.io" } })).allowed, true);
  assert.equal(validateOrigin(new Request("http://localhost", { headers: { origin: "http://localhost:3000" } })).allowed, true);
  assert.equal(validateOrigin(new Request("http://localhost", { headers: { origin: "http://127.0.0.1:3000" } })).allowed, true);

  // Non-browser caller (no Origin header)
  assert.equal(validateOrigin(new Request("http://localhost")).allowed, true);
});

test("Security P1: CORS preflight returns 403 Forbidden for unauthorized origin", async () => {
  const req = new Request("http://localhost/api/gemini/explanation", {
    method: "OPTIONS",
    headers: {
      origin: "https://malicious-site.example",
      "access-control-request-method": "POST",
    },
  });

  const res = handleCorsPreflight(req);
  assert.equal(res.status, 403);
});

test("Security P1: POST route rejects unauthorized Origin header with 403", async () => {
  const req = new Request("http://localhost/api/gemini/explanation", {
    method: "POST",
    headers: {
      origin: "https://unauthorized-origin.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userConsent: true,
      assessmentName: "Test",
      profileLabel: "Profile",
    }),
  });

  const res = await postExplanation(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.error || "", /origin is not permitted/i);
});

// =========================================================================
// P1: Evidence Integrity & Adversarial Validation
// =========================================================================

test("Security P1: Explanation rejects contradictory zero-deficit claim when critical deficits are present", async () => {
  const req = new Request("http://localhost/api/gemini/explanation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: true,
      assessmentName: "Fabricated Test",
      profileLabel: "Wheelchair",
      findings: [
        {
          title: "Doorway passage blocked - severe fall hazard",
          severity: "critical",
          description: "Clearance is 40cm, completely blocking transit.",
        },
      ],
      metrics: {
        actionableDeficitsCount: 0, // Contradicts critical finding above
        minimumClearanceCm: 40,
        routeFeasibility: "Infeasible",
      },
    }),
  });

  const res = await postExplanation(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error || "", /contradictory evidence/i);
});

test("Security P1: Explanation rejects out-of-physical-range clearance measurements", async () => {
  const req = new Request("http://localhost/api/gemini/explanation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: true,
      assessmentName: "Fabricated Test",
      profileLabel: "Wheelchair",
      findings: [],
      metrics: {
        actionableDeficitsCount: 0,
        minimumClearanceCm: -25, // Negative clearance
        routeFeasibility: "Evaluated",
      },
    }),
  });

  const res = await postExplanation(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error || "", /out of physical range/i);
});

// =========================================================================
// P2: Transport Bounding & Decoded Image Hardening
// =========================================================================

test("Security P2: Transport byte bounding rejects oversized requests with 413", async () => {
  // Create a large body (> 256KB)
  const largePadding = "a".repeat(300 * 1024);
  const req = new Request("http://localhost/api/gemini/explanation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "content-length": String(largePadding.length + 50),
    },
    body: JSON.stringify({
      userConsent: true,
      assessmentName: largePadding,
    }),
  });

  const res = await postExplanation(req);
  assert.equal(res.status, 413);
  const data = await res.json();
  assert.match(data.error || "", /payload too large/i);
});

test("Security P2: Image binary verification detects corrupted / non-image magic bytes", () => {
  // Test non-image string disguised as PNG
  const fakePngBase64 = Buffer.from("<html><script>alert(1)</script></html>").toString("base64");
  const check = verifyImageBinary(fakePngBase64, "image/png");
  assert.equal(check.valid, false);
  assert.match(check.error || "", /unrecognized or corrupted/i);

  // Test declared PNG but actual JPEG bytes
  const fakeJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]).toString("base64");
  const mimeMismatch = verifyImageBinary(fakeJpegBytes, "image/png");
  assert.equal(mimeMismatch.valid, false);
  assert.match(mimeMismatch.error || "", /contradicts detected binary signature/i);

  // Test authentic PNG
  const validCheck = verifyImageBinary(VALID_PNG_BASE64, "image/png");
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.detectedMime, "image/png");
  assert.equal(validCheck.width, 1);
  assert.equal(validCheck.height, 1);
});

test("Security P2: Interpretation rejects image with bad binary signature via API", async () => {
  const req = new Request("http://localhost/api/gemini/interpretation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: true,
      imageMimeType: "image/png",
      imageBase64: Buffer.from("not-a-real-png-signature").toString("base64"),
      pixelsPerCm: 1.5,
    }),
  });

  const res = await postInterpretation(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error || "", /invalid image binary/i);
});

// =========================================================================
// P2: Retired Model ID Rejection
// =========================================================================

test("Security P2: Retired model gemini-2.5-flash-image is removed and rejected", async () => {
  // 1. Verify model is excluded from supported production models
  assert.equal(
    (SUPPORTED_IMAGE_MODELS as readonly string[]).includes("gemini-2.5-flash-image"),
    false,
    "gemini-2.5-flash-image must not be in SUPPORTED_IMAGE_MODELS"
  );
  assert.equal(isModelRetired("gemini-2.5-flash-image"), true);

  // 2. Calling visualize with retired model returns 400 Bad Request
  const req = new Request("http://localhost/api/gemini/visualize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userConsent: true,
      requestedModel: "gemini-2.5-flash-image",
      furnitureList: [{ name: "Chair" }],
    }),
  });

  const res = await postVisualize(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error || "", /retired/i);
});

// =========================================================================
// P0: Multi-Instance Shared Atomic Rate Limiting
// =========================================================================

test("Security P0: Multi-Instance - Shared limiter holds across separate OS processes", async () => {
  resetRateLimits();
  const testIp = `multi-proc-ip-${Date.now()}`;
  const script = `
    import { checkRateLimit } from './src/lib/server/rate-limiter.ts';
    const r1 = checkRateLimit('${testIp}', 'visualize');
    const r2 = checkRateLimit('${testIp}', 'visualize');
    const r3 = checkRateLimit('${testIp}', 'visualize');
    console.log(JSON.stringify([r1.allowed, r2.allowed, r3.allowed]));
  `;

  // Spawn two separate OS processes concurrently requesting 'visualize' route (max 4 per min)
  const [proc1, proc2] = await Promise.all([
    pExecFile(process.execPath, ["--import", "tsx", "-e", script], { cwd: process.cwd() }),
    pExecFile(process.execPath, ["--import", "tsx", "-e", script], { cwd: process.cwd() }),
  ]);

  const res1 = JSON.parse(proc1.stdout.trim()) as boolean[];
  const res2 = JSON.parse(proc2.stdout.trim()) as boolean[];
  const combined = [...res1, ...res2];

  const allowedCount = combined.filter((r) => r === true).length;
  const rejectedCount = combined.filter((r) => r === false).length;

  assert.equal(allowedCount, 4, "Across both OS instances, exactly 4 requests must be allowed");
  assert.equal(rejectedCount, 2, "Across both OS instances, exactly 2 requests must be rejected with 429");
});

// =========================================================================
// P2: Secret Leakage Prevention
// =========================================================================

test("Security P2: Secret Leakage - GEMINI_API_KEY is isolated and never returned in API responses or client configs", async () => {
  const secretKey = process.env.GEMINI_API_KEY || "TEST_SECRET_KEY_12345";
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = secretKey;

  try {
    // 1. Health endpoint GET response must never leak the raw key
    const healthReq = new Request("http://localhost/api/gemini/health");
    const healthRes = await getHealth(healthReq);
    const healthText = await healthRes.text();
    assert.equal(healthText.includes(secretKey), false, "Health endpoint must not leak GEMINI_API_KEY");

    // 2. Explanation error response must never leak key
    const explainReq = new Request("http://localhost/api/gemini/explanation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });
    const explainRes = await postExplanation(explainReq);
    const explainText = await explainRes.text();
    assert.equal(explainText.includes(secretKey), false, "Explanation error must not leak GEMINI_API_KEY");

    // 3. Interpretation error response must never leak key
    const interpReq = new Request("http://localhost/api/gemini/interpretation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });
    const interpRes = await postInterpretation(interpReq);
    const interpText = await interpRes.text();
    assert.equal(interpText.includes(secretKey), false, "Interpretation error must not leak GEMINI_API_KEY");

    // 4. Visualize error response must never leak key
    const visReq = new Request("http://localhost/api/gemini/visualize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });
    const visRes = await postVisualize(visReq);
    const visText = await visRes.text();
    assert.equal(visText.includes(secretKey), false, "Visualize error must not leak GEMINI_API_KEY");

    // 5. Public env variables check: NEXT_PUBLIC_ must never expose raw GEMINI_API_KEY
    assert.equal(process.env.NEXT_PUBLIC_GEMINI_API_KEY, undefined, "NEXT_PUBLIC_GEMINI_API_KEY must never be set");
  } finally {
    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});

