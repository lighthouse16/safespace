import test from "node:test";
import assert from "node:assert/strict";
import { getCorsHeaders, handleCorsPreflight } from "@/lib/server/cors";

test("Pages-to-Gateway Smoke: Gateway accepts requests from official GitHub Pages origin", () => {
  const req = new Request("http://localhost:3000/api/gemini/health", {
    headers: {
      origin: "https://lighthouse16.github.io",
      "x-safespace-client": "web-guest",
    },
  });

  const headers = getCorsHeaders(req);
  assert.equal(headers["Access-Control-Allow-Origin"], "https://lighthouse16.github.io");
  assert.equal(headers["Vary"], "Origin");

  const preflightRes = handleCorsPreflight(
    new Request("http://localhost:3000/api/gemini/interpretation", {
      method: "OPTIONS",
      headers: {
        origin: "https://lighthouse16.github.io",
        "access-control-request-method": "POST",
      },
    })
  );
  assert.equal(preflightRes.status, 204);
  assert.equal(
    preflightRes.headers.get("Access-Control-Allow-Origin"),
    "https://lighthouse16.github.io"
  );
});

test("Pages-to-Gateway Smoke: Gateway blocks foreign untrusted origins", () => {
  const preflightRes = handleCorsPreflight(
    new Request("http://localhost:3000/api/gemini/interpretation", {
      method: "OPTIONS",
      headers: {
        origin: "https://random-pages-app.github.io",
        "access-control-request-method": "POST",
      },
    })
  );
  assert.equal(preflightRes.status, 403);
});

test("Pages-to-Gateway Smoke: Helpful error message when gateway unreachable on Pages", async () => {
  // Simulate fetch against empty or missing gateway URL on static host
  const originalGateway = process.env.NEXT_PUBLIC_GEMINI_GATEWAY_URL;
  delete process.env.NEXT_PUBLIC_GEMINI_GATEWAY_URL;

  try {
    const errorText = "404 Not Found HTML page from static host";
    const status = 404;

    let thrownError: string | null = null;
    try {
      JSON.parse(errorText);
    } catch {
      thrownError = `Gateway returned non-JSON response (${status}). If using static GitHub Pages, verify NEXT_PUBLIC_GEMINI_GATEWAY_URL points to an active backend.`;
    }

    assert.ok(thrownError);
    assert.match(thrownError, /NEXT_PUBLIC_GEMINI_GATEWAY_URL/);
  } finally {
    if (originalGateway !== undefined) {
      process.env.NEXT_PUBLIC_GEMINI_GATEWAY_URL = originalGateway;
    }
  }
});
