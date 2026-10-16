import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRateLimit, resetRateLimits } from "@/lib/server/rate-limiter";

test("Corrupted quota state fails closed instead of silently resetting AI budget", () => {
  const oldDir = process.env.RATE_LIMIT_STORE_DIR;
  const oldBudget = process.env.GEMINI_DAILY_BUDGET;
  const temp = mkdtempSync(join(tmpdir(), "safespace-quota-corrupt-"));
  try {
    process.env.GEMINI_DAILY_BUDGET = "5";
    process.env.RATE_LIMIT_STORE_DIR = temp;
    resetRateLimits();
    writeFileSync(join(temp, "state.json"), "{malformed", "utf8");
    const response = checkRateLimit("guest", "interpretation");
    assert.equal(response.allowed, false);
    assert.match(response.reason || "", /quota storage unavailable/);
    // A path occupied by an existing file must never grant quota.
    process.env.RATE_LIMIT_STORE_DIR = join(temp, "state.json");
    assert.equal(checkRateLimit("guest", "interpretation").allowed, false);
  } finally {
    if (oldDir === undefined) delete process.env.RATE_LIMIT_STORE_DIR;
    else process.env.RATE_LIMIT_STORE_DIR = oldDir;
    if (oldBudget === undefined) delete process.env.GEMINI_DAILY_BUDGET;
    else process.env.GEMINI_DAILY_BUDGET = oldBudget;
    rmSync(temp, { recursive: true, force: true });
  }
});
