import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const outDir = path.resolve(process.cwd(), "out");
if (!fs.existsSync(outDir)) {
  console.error("FAIL: 'out/' directory does not exist. Run 'npm run build' before running verify:export.");
  process.exit(1);
}

const isGithubPages = process.env.GITHUB_ACTIONS === "true" || process.env.EXPORT_GH_PAGES === "true";
const basePath = isGithubPages ? "/safespace" : "";

console.log(`[verify:export] Target environment: ${isGithubPages ? "GitHub Pages (/safespace)" : "Local/Standard (root)"}`);
console.log(`[verify:export] Expected basePath: "${basePath}"`);

// 1. Verify all 6 emitted static HTML files exist (4 application routes + 2 Next.js error pages)
const expectedHtmlFiles = [
  "index.html",
  "assessments.html",
  "assessments/new.html",
  "workspace.html",
  "404.html",
  "_not-found.html",
];

for (const relHtml of expectedHtmlFiles) {
  const fullPath = path.join(outDir, relHtml);
  assert.ok(fs.existsSync(fullPath), `Expected emitted static HTML missing: ${relHtml}`);
}

// 2. Verify retired routes do not emit HTML in a clean static export.
const retiredHtmlFiles = [
  "assessments/queen-care-clinic/analysis.html",
  "assessments/queen-care-clinic/model.html",
  "assessments/queen-care-clinic/options.html",
  "assessments/queen-care-clinic/options/compare.html",
  "assessments/queen-care-clinic/report.html",
  "reports/queen-care-clinic.html",
  "reviews.html",
  "reviews/queen-care-clinic.html",
];

for (const relHtml of retiredHtmlFiles) {
  assert.ok(!fs.existsSync(path.join(outDir, relHtml)), `Retired route still emitted static HTML: ${relHtml}`);
}

// 3. Scan all exported HTML and TXT files for zero fabricated markers or hardcoded scores
const FABRICATED_MARKERS = [
  "Dr. Adrian Lau",
  "HKROT",
  "85 lux",
  "200 lux",
  "HK$850",
  "HK$4,600",
  "HK$4600",
];

function scanDir(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (entry.name.endsWith(".html") || entry.name.endsWith(".txt")) {
      const text = fs.readFileSync(full, "utf-8");
      for (const marker of FABRICATED_MARKERS) {
        assert.ok(
          !text.includes(marker),
          `Fabricated marker "${marker}" found in exported file ${path.relative(outDir, full)}`
        );
      }
      assert.ok(
        !text.includes("68/27"),
        `Fabricated risk fraction 68/27 found in ${entry.name}`
      );
      assert.ok(
        !text.includes("Risk Score: 68") && !text.includes("Risk Score: 39") && !text.includes("Risk Score: 18"),
        `Fabricated risk score label found in ${entry.name}`
      );
    }
  }
}
scanDir(outDir);

console.log(`[verify:export] SUCCESS: 6 static HTML files verified, 8 retired routes absent with basePath="${basePath}", 0 fabricated markers detected.`);
