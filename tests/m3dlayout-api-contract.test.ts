import test from "node:test";
import assert from "node:assert/strict";
import { generateM3DLayout } from "../src/lib/m3dlayout/client";
import { sceneToFurniture } from "../src/lib/m3dlayout/scene-adapter";
import { placeModelFurniture } from "../src/lib/m3dlayout/placement-policy";

test("API contract smoke: Colab response drives actual accepted coordinates", async () => {
  const originalFetch = globalThis.fetch;
  const captured: Array<{ url: string; method: string; body: string }> = [];
  try {
    globalThis.fetch = async (resource, init) => {
      captured.push({ url: String(resource), method: init?.method ?? "", body: String(init?.body) });
      return new Response(JSON.stringify({
        class_names: ["sofa", "coffee_table"],
        translations: [[0, 0.4, 0], [2, 0.3, 0]],
        sizes: [[1.8, 0.7, 0.7], [0.8, 0.5, 0.6]],
        angles: [0, 0],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const frame = { roomId: "room-1", centerX: 300, centerY: 200, maxWidthCm: 500, maxDepthCm: 400 };
    const scene = await generateM3DLayout("https://example.ngrok-free.app/", "The room is a living room.", 2);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, "https://example.ngrok-free.app/generate");
    assert.equal(captured[0].method, "POST");
    assert.deepEqual(JSON.parse(captured[0].body), { prompt: "The room is a living room.", seed: 2 });
    const items = sceneToFurniture(scene, frame);
    const accepted = placeModelFurniture(items, frame);
    assert.equal(accepted.unplaced.length, 0);
    assert.equal(accepted.furniture.length, 2);
    assert.ok(accepted.furniture[0].x < accepted.furniture[1].x);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid API output fails closed and cannot become a plan", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ class_names: ["sofa"] }), { status: 200 });
    await assert.rejects(generateM3DLayout("https://example.ngrok-free.app", "room", 0), /without furniture boxes/);
    globalThis.fetch = async () => new Response("runtime error", { status: 503 });
    await assert.rejects(generateM3DLayout("https://example.ngrok-free.app", "room", 0), /returned 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
