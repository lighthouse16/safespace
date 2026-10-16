import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = resolve("out");
const prefix = "/safespace";
const types = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (!(pathname === prefix || pathname.startsWith(prefix + "/"))) {
      res.writeHead(404); res.end(); return;
    }
    let path = pathname.slice(prefix.length).replace(/^\/+/, "");
    if (!path || path.endsWith("/")) path += "index.html";
    else if (!extname(path)) path += "/index.html";
    const dest = resolve(root, path);
    if (!dest.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const bytes = await readFile(dest);
    res.setHeader("Content-Type", types[extname(dest)] ?? "application/octet-stream");
    res.end(bytes);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = "http://127.0.0.1:" + server.address().port + prefix + "/";
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (r.url().includes("/api/v1/")) requests.push(r.url()); });
  await page.goto(url, { waitUntil: "networkidle" });
  assert.ok(await page.locator("body").innerText().then((s) => s.includes("SafeSpace")));
  // Regression: public Pages uses /safespace/ basePath, not root-relative
  // image URLs; verify the IMAGE ITSELF loaded, not merely its <img> tag.
  const preview = page.getByRole("img", {
    name: "Illustrative floorplan with an example route overlay; not a completed assessment"
  });
  await preview.waitFor({ state: "visible" });
  assert.ok(await preview.evaluate((el) => el instanceof HTMLImageElement &&
    el.complete && el.naturalWidth > 0), "Hero preview image must load on GitHub Pages");
  assert.ok((await preview.getAttribute("src")).startsWith("/safespace/"),
    "Hero image URL must include the GitHub Pages base path");
  const previewRegion = page.getByRole("region", { name: "SafeSpace Workspace Preview" });
  assert.equal(await previewRegion.getByText("Assessment", { exact: true }).count(), 0);
  assert.equal(await previewRegion.getByText("Compliant width", { exact: true }).count(), 0);
  assert.equal(await previewRegion.getByText("32 m", { exact: true }).count(), 0);
  assert.equal(await previewRegion.getByText("Not evaluated", { exact: true }).count(), 1);
  await page.goto(url + "assessments/", { waitUntil: "networkidle" });
  assert.equal(await page.getByText("On this device").count(), 1);
  assert.equal(await page.getByRole("button", { name: "Sign in" }).count(), 0);
  assert.ok(await page.getByText(/No account is needed/).count() > 0);
  await page.getByRole("link", { name: /New assessment/ }).first().click();
  await page.waitForURL(/\/safespace\/assessments\/new/);
  assert.match(page.url(), /\/safespace\/assessments\/new/);
  await page.getByLabel("Assessment name").fill("GitHub Pages guest");
  await page.getByLabel("Facility or residence name").fill("Testing");
  await page.getByLabel("Space or area name").fill("Room");
  await page.getByLabel("Environment type").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continue to floorplan source" }).click();
  await page.getByRole("button", { name: /Draw the space manually/ }).click();
  await page.getByRole("button", { name: /Continue to calibration/ }).click();
  const canvas = page.locator("svg.touch-none");
  await canvas.click({ position: { x: 120, y: 100 } });
  await canvas.click({ position: { x: 300, y: 100 } });
  assert.equal(await page.getByText(/Reference line drawn/).count(), 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log("PAGES GUEST E2E PASS: static route assets, navigation, intake, calibration; no auth/API.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
