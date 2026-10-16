import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/v1/m3d/generate/route";

const validScene = {
  class_names: ["sofa", "coffee_table"],
  translations: [[0, 0.4, 0], [1.5, 0.3, 0]],
  sizes: [[1.8, 0.9, 0.8], [0.8, 0.4, 0.6]],
  angles: [0, [0]],
};

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/m3d/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("model gateway: no server configuration yields 503 without contacting Colab", async () => {
  const previous = process.env.M3D_INFERENCE_URL;
  const savedFetch = globalThis.fetch;
  try {
    delete process.env.M3D_INFERENCE_URL;
    globalThis.fetch = async () => { throw new Error("must not contact upstream"); };
    const status = await GET();
    assert.equal((await status.json()).configured, false);
    const result = await POST(request({ prompt: "living room", seed: 0 }));
    assert.equal(result.status, 503);
  } finally {
    globalThis.fetch = savedFetch;
    if (previous === undefined) delete process.env.M3D_INFERENCE_URL;
    else process.env.M3D_INFERENCE_URL = previous;
  }
});

test("model gateway: private configured upstream, health probe, validated response and no URL override", async () => {
  const old = process.env.M3D_INFERENCE_URL;
  const savedFetch = globalThis.fetch;
  const hits: Array<{ url: string; body?: string }> = [];
  try {
    process.env.M3D_INFERENCE_URL = "https://example.ngrok-free.app";
    globalThis.fetch = async (url, opts) => {
      hits.push({ url: String(url), body: String(opts?.body || "") });
      return new Response(String(url).endsWith("openapi.json")
        ? JSON.stringify({ paths: { "/generate": { post: {} } } })
        : JSON.stringify(validScene),
      { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const health = await GET();
    assert.equal((await health.json()).reachable, true);
    const result = await POST(request({ prompt: "room with sofa", seed: 42, url: "https://attacker.invalid" }));
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), validScene);
    assert.equal(hits[1].url, "https://example.ngrok-free.app/generate");
    assert.deepEqual(JSON.parse(hits[1].body || "{}"), { prompt: "room with sofa", seed: 42 });
  } finally {
    globalThis.fetch = savedFetch;
    if (old === undefined) delete process.env.M3D_INFERENCE_URL;
    else process.env.M3D_INFERENCE_URL = old;
  }
});

test("model gateway: rejects malformed requests and invalid geometry, sanitizes upstream failures", async () => {
  const old = process.env.M3D_INFERENCE_URL;
  const savedFetch = globalThis.fetch;
  try {
    process.env.M3D_INFERENCE_URL = "https://example.ngrok-free.app";
    assert.equal((await POST(request({ prompt: "", seed: 0 }))).status, 400);
    assert.equal((await POST(request({ prompt: "ok", seed: 1.5 }))).status, 400);
    globalThis.fetch = async () => new Response(JSON.stringify({ class_names: ["chair"], translations: [[]], sizes: [[1, 2, 3]] }), { status: 200 });
    assert.equal((await POST(request({ prompt: "room", seed: 0 }))).status, 502);
    globalThis.fetch = async () => new Response("Private API KEY hello!", { status: 500 });
    const response = await POST(request({ prompt: "room", seed: 0 }));
    assert.equal(response.status, 502);
    assert.doesNotMatch(JSON.stringify(await response.json()), /Private API KEY/);
  } finally {
    globalThis.fetch = savedFetch;
    if (old === undefined) delete process.env.M3D_INFERENCE_URL;
    else process.env.M3D_INFERENCE_URL = old;
  }
});
