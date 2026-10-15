import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/app/assessments/new/page.tsx", import.meta.url), "utf8");
const review = readFileSync(new URL("../src/components/intake/IntakeReviewStep.tsx", import.meta.url), "utf8");

test("unsaved intake guards AppShell exits and unloads only until persistence succeeds", () => {
  assert.match(page, /<div onClickCapture=\{handleExitNavigation\}>\s*<AppShell/);
  assert.match(page, /e\.defaultPrevented \|\| e\.button !== 0 \|\| e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey/);
  assert.match(page, /anchor\.hasAttribute\("download"\).*anchor\.getAttribute\("target"\)/);
  assert.match(page, /destination\.origin !== window\.location\.origin/);
  assert.match(page, /hasMeaningfulWork && !savedDraftRef\.current/);
  assert.match(page, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*setShowExitConfirm\(true\)/);
  assert.match(page, /confirmedExitRef\.current \|\| savedDraftRef\.current/);
  assert.match(page, /onSaved=\{\(\) => \{ savedDraftRef\.current = true; \}\}/);
  assert.match(review, /if \(!res\.success\) \{[\s\S]*?return;\s*\}\s*onSaved\?\.\(\)/);
});

test("review discloses local image persistence and rejects unverified recommended geometry", () => {
  assert.match(review, /Uploaded floorplan images are stored in this browser’s IndexedDB on this device and persist across reloads; they are not backed up to an account\./);
  assert.doesNotMatch(page, /onApplyRecommendedBoundary/);
  assert.doesNotMatch(review, /Use recommended boundary/);
});
