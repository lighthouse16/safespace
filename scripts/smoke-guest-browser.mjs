/**
 * Browser-level guest acceptance smoke.
 * Usage: npm run build && npm run test:browser:guest
 * Requires Chrome Stable installed; no credentials, Supabase or Gemini API key.
 * Never sends test data to authenticated cloud endpoints.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const port = Number(process.env.SAFESPACE_SMOKE_PORT || 3029);
const base = "http://127.0.0.1:" + port;
const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
server.stderr.on("data", (chunk) => { serverOutput += String(chunk); });
let browser, page;
const pageErrors = [];
const protectedRequests = [];

async function serverReady() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Next server stopped:\n" + serverOutput.slice(-1500));
    try {
      const result = await fetch(base + "/assessments", { signal: AbortSignal.timeout(1500) });
      if (result.ok) return;
    } catch { /* awaiting server startup */ }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("Next server did not start:\n" + serverOutput.slice(-1500));
}
async function check() {
  await serverReady();
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/")) protectedRequests.push(req.url());
  });
  await page.goto(base + "/assessments", { waitUntil: "networkidle" });
  assert.equal(await page.getByRole("button", { name: "Sign in" }).count(), 0);
  // Next.js client hydration can finish just after networkidle on GitHub runners.
  await page.getByText("On this device").waitFor({ state: "visible", timeout: 15000 });
  await page.getByText(/No account is needed/).waitFor({ state: "visible", timeout: 15000 });

  await page.getByRole("link", { name: /New assessment/ }).first().click();
  await page.getByLabel("Assessment name").fill("Browser guest acceptance");
  await page.getByLabel("Facility or residence name").fill("Local Facility");
  await page.getByLabel("Space or area name").fill("Room A");
  await page.getByLabel("Environment type").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continue to floorplan source" }).click();
  await page.getByRole("button", { name: /Draw the space manually/ }).click();
  await page.getByRole("button", { name: /Continue to calibration/ }).click();

  const draft = page.locator("svg.touch-none");
  assert.equal(await draft.count(), 1);
  await draft.click({ position: { x: 120, y: 100 } });
  await draft.click({ position: { x: 300, y: 100 } });
  assert.equal(await page.getByText(/Reference line drawn/).count(), 1,
    "Entering calibration must activate the calibration tool automatically");
  await page.getByLabel("Reference length (real-world)").fill("2");
  await page.getByRole("button", { name: /Apply scale/ }).click();
  for (const [x,y] of [[100,90],[350,90],[350,335],[100,335]]) {
    await draft.click({ position: { x, y } });
  }
  assert.equal(await page.getByText("4 vertices").count(), 2);
  await page.getByRole("button", { name: "Close Boundary" }).click();
  assert.equal(await page.getByText("Boundary polygon closed").count(), 1);
  await page.getByRole("button", { name: "Continue to review" }).last().click();
  await page.getByRole("button", { name: "Confirm & open in workspace" }).click();
  await page.waitForURL("**/workspace");
  const stages = page.locator('nav[aria-label="Assessment stages"] button');
  await stages.first().waitFor();
  assert.equal(await page.getByText("Saved locally", { exact: true }).count(), 1);

  await page.getByRole("button", { name: "Hazard pin tool" }).click();
  const floor = page.locator('svg[class*="cursor-"]').first();
  const rect = await floor.boundingBox();
  assert.ok(rect);
  await floor.click({ position: { x: Math.floor(rect.width/2), y: Math.floor(rect.height/2) } });
  assert.equal(await page.locator("#manual-observation-layer > g").count(), 1);

  // Exercise Profile, Routes and Report in a real browser.
  await stages.nth(1).click();
  await page.getByRole("heading", { name: "Select mobility profile" }).waitFor();
  const wheelchairProfile = page.getByRole("button", { name: /Wheelchair/i }).first();
  await wheelchairProfile.click();
  assert.equal(await wheelchairProfile.getAttribute("aria-pressed"), "true");

  await stages.nth(2).click();
  await page.getByRole("button", { name: "Open report" }).click();
  const report = page.getByRole("dialog", { name: "SafeSpace Assessment Summary Report" });
  await report.waitFor();
  assert.ok(await report.getByText("Local Facility").count() > 0,
    "Report must use actual saved assessment metadata");
  await report.getByRole("button", { name: "Close summary report" }).click();

  await stages.nth(3).click();
  await page.getByRole("button", { name: "Summarize findings" }).click();
  assert.equal(await page.getByText(/Local spatial evaluator/).count(), 1);
  assert.equal(await page.getByText(/not medical advice/).count(), 1);

  await stages.nth(4).click();
  assert.ok(await page.getByRole("heading", { name: /Layout Improvement Options|Applied Layout Review/ }).count() > 0,
    "Stage 5 must render a truthful optimization state");

  await page.goto(base + "/assessments", { waitUntil: "networkidle" });
  assert.ok(await page.getByText("Browser guest acceptance").count() > 0);
  await page.getByRole("link", { name: /Open in workspace/ }).click();
  await page.waitForURL("**/workspace");
  await page.locator('nav[aria-label="Assessment stages"] button').first().waitFor();
  assert.equal(await page.locator("#manual-observation-layer > g").count(), 1,
    "Manual annotations must persist across navigation and reload");

  // Independently exercise the uploaded PNG path through image validation and drafting.
  await page.goto(base + "/assessments/new");
  await page.getByLabel("Assessment name").fill("Uploaded image acceptance");
  await page.getByLabel("Facility or residence name").fill("Local Facility");
  await page.getByLabel("Space or area name").fill("Room B");
  await page.getByLabel("Environment type").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continue to floorplan source" }).click();
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "public", "demo-floorplan.png"));
  await page.getByRole("button", { name: /Continue to calibration/ }).click();
  assert.ok(await page.getByRole("heading", { name: "Calibration & drafting" }).count() > 0);
  assert.equal(await page.locator("svg.touch-none").count(), 1);

  assert.equal(protectedRequests.length, 0, "Guest must never call protected API");
  assert.deepEqual(pageErrors, [], "Guest flow must not generate browser errors");
  console.log("GUEST BROWSER E2E PASS: intake, calibration, CAD, profile, routes, report, analysis, improve, reopen, PNG upload; no auth/API.");
}

try {
  await check();
} catch (error) {
  console.error("GUEST BROWSER E2E FAIL:", error);
  if (page) {
    try {
      await mkdir("test-results", { recursive: true });
      await page.screenshot({ path: "test-results/guest-e2e-failure.png", fullPage: true });
    } catch {}
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
