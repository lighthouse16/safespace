import test from "node:test";
import assert from "node:assert/strict";
import { getGeminiClient, isGeminiConfigured } from "@/lib/server/ai/gemini-client";
import { GET as getHealth } from "@/app/api/gemini/health/route";

test("Gemini server reads GEMINI_KEY secret alias without exposing it", async () => {
  const originalPreferred = process.env.GEMINI_API_KEY;
  const originalAlias = process.env.GEMINI_KEY;
  const dummyKey = "test-only-gemini-alias-not-real";
  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_KEY;
    assert.equal(isGeminiConfigured(), false);
    assert.equal(getGeminiClient(), null);

    process.env.GEMINI_KEY = dummyKey;
    assert.equal(isGeminiConfigured(), true);
    assert.ok(getGeminiClient());

    const response = await getHealth(new Request("https://safespace-gateway.vercel.app/api/gemini/health"));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.geminiConfigured, true);
    assert.ok(!JSON.stringify(payload).includes(dummyKey));

    process.env.GEMINI_API_KEY = "  test-preferred-placeholder  ";
    assert.equal(isGeminiConfigured(), true);
    assert.ok(getGeminiClient());

    process.env.GEMINI_KEY = "   ";
    assert.equal(isGeminiConfigured(), true);
    delete process.env.GEMINI_API_KEY;
    assert.equal(isGeminiConfigured(), false);
  } finally {
    if (originalPreferred === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalPreferred;
    if (originalAlias === undefined) delete process.env.GEMINI_KEY;
    else process.env.GEMINI_KEY = originalAlias;
  }
});
