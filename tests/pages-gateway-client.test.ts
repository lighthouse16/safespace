import test from "node:test";
import assert from "node:assert/strict";
import { getCorsHeaders, handleCorsPreflight } from "@/lib/server/cors";
import { parseResponseOrThrow, checkGatewayHealth } from "@/lib/services/gemini-gateway-client";

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

test("Pages-to-Gateway Smoke: parseResponseOrThrow gives actionable guidance on HTML 404", async () => {
  const htmlRes = new Response("<!DOCTYPE html><html><body>404 Not Found on static host</body></html>", {
    status: 404,
    headers: { "Content-Type": "text/html" },
  });

  await assert.rejects(
    async () => {
      await parseResponseOrThrow(htmlRes, "Floorplan interpretation");
    },
    (err: Error) => {
      assert.match(err.message, /NEXT_PUBLIC_GEMINI_GATEWAY_URL/);
      assert.match(err.message, /non-JSON response \(404\)/);
      return true;
    }
  );
});

test("Pages-to-Gateway Smoke: checkGatewayHealth reports unreachable on wrong gateway URL", async () => {
  const originalGateway = process.env.NEXT_PUBLIC_GEMINI_GATEWAY_URL;
  // Non-existent port
  process.env.NEXT_PUBLIC_GEMINI_GATEWAY_URL = "http://127.0.0.1:59998";

  try {
    const health = await checkGatewayHealth();
    assert.equal(health.status, "unreachable");
    assert.equal(health.geminiConfigured, false);
  } finally {
    if (originalGateway !== undefined) {
      process.env.NEXT_PUBLIC_GEMINI_GATEWAY_URL = originalGateway;
    } else {
      delete process.env.NEXT_PUBLIC_GEMINI_GATEWAY_URL;
    }
  }
});
