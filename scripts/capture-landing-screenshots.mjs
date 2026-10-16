import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
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
const port = server.address().port;
const url = `http://127.0.0.1:${port}${prefix}/`;

await mkdir("artifacts/screenshots", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const outPath = `artifacts/screenshots/${vp.name}.png`;
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`Captured ${outPath}`);
  await page.close();
}

await browser.close();
server.close();
console.log("All screenshots captured successfully.");
