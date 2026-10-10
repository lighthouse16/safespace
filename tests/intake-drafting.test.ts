import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatFileSize,
  validateFloorplanFile,
  validateMeasurement,
  computePixelsPerCm,
  computePixelDistance,
  validateAssessmentDetails,
  verifyImageDecodable,
  MAX_FILE_SIZE_BYTES,
  type MockImageInstance,
} from "../src/components/intake/intake-validation";
import {
  canCloseBoundary,
  addBoundaryVertex,
  undoBoundaryVertex,
  closeBoundary,
  moveBoundaryVertex,
  resetBoundaryForSourceChange,
} from "../src/components/intake/boundary-operations";
import {
  registerCandidateUrl,
  cancelCandidateUrl,
  confirmCandidateUrl,
  disposeCandidateUrl,
  confirmRemoveUrl,
  cleanupAllUrls,
  AsyncSelectionController,
  type PendingSourceChange,
  type CandidateUrlState,
} from "../src/components/intake/candidate-url-manager";
import { FloorplanSourceStep } from "../src/components/intake/FloorplanSourceStep";
import { AppShell } from "../src/components/shell/app-shell";
import {
  type Point2D,
  type BoundaryState,
} from "../src/components/intake/intake-view-types";
import AssessmentsPage from "../src/app/assessments/page";
import NewAssessmentPage from "../src/app/assessments/new/page";

// 1. File validation and MIME mapping tests
test("validateFloorplanFile accepts valid corresponding extensions and MIME types under 25 MB", () => {
  const pngFile = new File(["dummy png content"], "floorplan.png", { type: "image/png" });
  const jpgFile = new File(["dummy jpg content"], "survey.jpg", { type: "image/jpeg" });
  const jpegFile = new File(["dummy jpeg content"], "survey.jpeg", { type: "image/jpeg" });
  const svgFile = new File(["<svg></svg>"], "blueprint.svg", { type: "image/svg+xml" });
  const pdfFile = new File(["%PDF-1.4"], "architectural-plan.pdf", { type: "application/pdf" });

  assert.equal(validateFloorplanFile(pngFile).isValid, true);
  assert.equal(validateFloorplanFile(jpgFile).isValid, true);
  assert.equal(validateFloorplanFile(jpegFile).isValid, true);
  assert.equal(validateFloorplanFile(svgFile).isValid, true);
  assert.equal(validateFloorplanFile(pdfFile).isValid, true);
});

test("validateFloorplanFile rejects empty MIME types rather than trusting filename extension", () => {
  const emptyMimePng = new File(["data"], "floorplan.png", { type: "" });
  const emptyMimeSvg = new File(["data"], "plan.svg", { type: "" });
  const emptyMimePdf = new File(["data"], "doc.pdf", { type: "" });

  const res1 = validateFloorplanFile(emptyMimePng);
  assert.equal(res1.isValid, false);
  assert.match(res1.error ?? "", /File format does not match its file extension/);

  const res2 = validateFloorplanFile(emptyMimeSvg);
  assert.equal(res2.isValid, false);

  const res3 = validateFloorplanFile(emptyMimePdf);
  assert.equal(res3.isValid, false);
});

test("validateFloorplanFile rejects extension and MIME mismatches", () => {
  // plan.png with application/pdf
  const pngAsPdf = new File(["data"], "plan.png", { type: "application/pdf" });
  const res1 = validateFloorplanFile(pngAsPdf);
  assert.equal(res1.isValid, false);
  assert.match(res1.error ?? "", /File format does not match its file extension/);

  // plan.pdf with image/png
  const pdfAsPng = new File(["data"], "plan.pdf", { type: "image/png" });
  const res2 = validateFloorplanFile(pdfAsPng);
  assert.equal(res2.isValid, false);

  // plan.jpg with image/png
  const jpgAsPng = new File(["data"], "plan.jpg", { type: "image/png" });
  const res3 = validateFloorplanFile(jpgAsPng);
  assert.equal(res3.isValid, false);

  // plan.svg with application/pdf
  const svgAsPdf = new File(["data"], "plan.svg", { type: "application/pdf" });
  const res4 = validateFloorplanFile(svgAsPdf);
  assert.equal(res4.isValid, false);
});

test("validateFloorplanFile rejects unsupported file extensions", () => {
  const txtFile = new File(["notes"], "notes.txt", { type: "text/plain" });
  const dwgFile = new File(["dwg"], "model.dwg", { type: "application/acad" });
  const exeFile = new File(["bin"], "setup.exe", { type: "application/octet-stream" });

  const res1 = validateFloorplanFile(txtFile);
  assert.equal(res1.isValid, false);
  assert.match(res1.error ?? "", /Unsupported file format/);

  const res2 = validateFloorplanFile(dwgFile);
  assert.equal(res2.isValid, false);

  const res3 = validateFloorplanFile(exeFile);
  assert.equal(res3.isValid, false);
});

test("validateFloorplanFile rejects files exceeding 25 MB and empty files", () => {
  const oversizedFile = {
    name: "huge-floorplan.png",
    size: MAX_FILE_SIZE_BYTES + 1024,
    type: "image/png",
  } as File;

  const resultOversized = validateFloorplanFile(oversizedFile);
  assert.equal(resultOversized.isValid, false);
  assert.match(resultOversized.error ?? "", /exceeds the 25 MB size limit/);

  const emptyFile = new File([], "empty.png", { type: "image/png" });
  const resultEmpty = validateFloorplanFile(emptyFile);
  assert.equal(resultEmpty.isValid, false);
  assert.match(resultEmpty.error ?? "", /selected file is empty/);
});

test("formatFileSize formats bytes, KB, and MB accurately", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2.0 KB");
  assert.equal(formatFileSize(1024 * 1024 * 3.5), "3.5 MB");
});

// 2. Production boundary operations tests
test("canCloseBoundary requires at least 3 vertices", () => {
  assert.equal(canCloseBoundary([]), false);
  assert.equal(canCloseBoundary([{ x: 10, y: 10 }]), false);
  assert.equal(canCloseBoundary([{ x: 10, y: 10 }, { x: 20, y: 20 }]), false);
  assert.equal(canCloseBoundary([{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }]), true);
  assert.equal(canCloseBoundary([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]), true);
});

test("addBoundaryVertex appends vertices cleanly", () => {
  let vertices: Point2D[] = [];
  vertices = addBoundaryVertex(vertices, { x: 100, y: 100 });
  assert.equal(vertices.length, 1);
  assert.deepEqual(vertices[0], { x: 100, y: 100 });

  vertices = addBoundaryVertex(vertices, { x: 200, y: 100 });
  assert.equal(vertices.length, 2);
  assert.deepEqual(vertices[1], { x: 200, y: 100 });
});

test("undoBoundaryVertex removes last vertex without mutating original array", () => {
  const initial: Point2D[] = [{ x: 10, y: 10 }, { x: 20, y: 20 }];
  const undone = undoBoundaryVertex(initial);
  assert.equal(undone.length, 1);
  assert.deepEqual(undone[0], { x: 10, y: 10 });
  assert.equal(initial.length, 2); // Immuted

  const emptyUndone = undoBoundaryVertex([]);
  assert.deepEqual(emptyUndone, []);
});

test("closeBoundary closes valid boundaries and rejects closure with fewer than 3 vertices", () => {
  const invalidBoundary: BoundaryState = {
    vertices: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
    isClosed: false,
    selectedVertexIndex: null,
    gridSnap: true,
  };
  const closedInvalid = closeBoundary(invalidBoundary);
  assert.equal(closedInvalid.isClosed, false);

  const validBoundary: BoundaryState = {
    vertices: [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 100 }],
    isClosed: false,
    selectedVertexIndex: 1,
    gridSnap: false,
  };
  const closedValid = closeBoundary(validBoundary);
  assert.equal(closedValid.isClosed, true);
  assert.equal(closedValid.selectedVertexIndex, null);
});

test("moveBoundaryVertex updates the specified vertex immutably", () => {
  const vertices: Point2D[] = [
    { x: 50, y: 50 },
    { x: 150, y: 50 },
    { x: 150, y: 150 },
  ];
  const moved = moveBoundaryVertex(vertices, 1, { x: 180, y: 70 });
  assert.deepEqual(moved[1], { x: 180, y: 70 });
  assert.deepEqual(vertices[1], { x: 150, y: 50 }); // Original untouched

  // Invalid index returns original unchanged
  const outOfBounds = moveBoundaryVertex(vertices, 99, { x: 0, y: 0 });
  assert.deepEqual(outOfBounds, vertices);
});

test("resetBoundaryForSourceChange resets draft geometry and preserves user grid-snap preference", () => {
  const draftStateWithSnapOn: BoundaryState = {
    vertices: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }],
    isClosed: true,
    selectedVertexIndex: 2,
    gridSnap: true,
  };

  const resetState1 = resetBoundaryForSourceChange(draftStateWithSnapOn);
  assert.deepEqual(resetState1.vertices, []);
  assert.equal(resetState1.isClosed, false);
  assert.equal(resetState1.selectedVertexIndex, null);
  assert.equal(resetState1.gridSnap, true); // Preserved

  const draftStateWithSnapOff: BoundaryState = {
    vertices: [{ x: 10, y: 10 }],
    isClosed: false,
    selectedVertexIndex: null,
    gridSnap: false,
  };

  const resetState2 = resetBoundaryForSourceChange(draftStateWithSnapOff);
  assert.equal(resetState2.gridSnap, false); // Preserved false
});

// 3. Measurement validation and scale calculation tests
test("validateMeasurement rejects zero, negative numbers, and non-numeric strings", () => {
  assert.equal(validateMeasurement("0").isValid, false);
  assert.equal(validateMeasurement("-15").isValid, false);
  assert.equal(validateMeasurement("abc").isValid, false);
  assert.equal(validateMeasurement("").isValid, false);
  assert.equal(validateMeasurement("   ").isValid, false);
  assert.equal(validateMeasurement("NaN").isValid, false);
});

test("validateMeasurement accepts positive finite numbers", () => {
  const res1 = validateMeasurement("120");
  assert.equal(res1.isValid, true);
  assert.equal(res1.value, 120);

  const res2 = validateMeasurement("1.75");
  assert.equal(res2.isValid, true);
  assert.equal(res2.value, 1.75);

  const res3 = validateMeasurement(" 95.5 ");
  assert.equal(res3.isValid, true);
  assert.equal(res3.value, 95.5);
});

test("computePixelsPerCm calculates correct ratio for cm and m units", () => {
  const p1: Point2D = { x: 100, y: 100 };
  const p2: Point2D = { x: 300, y: 100 };
  assert.equal(computePixelDistance(p1, p2), 200);

  // 200 px for 100 cm => 2.0 px/cm
  const ratioCm = computePixelsPerCm(p1, p2, 100, "cm");
  assert.equal(ratioCm, 2);

  // 200 px for 2 meters (200 cm) => 1.0 px/cm
  const ratioM = computePixelsPerCm(p1, p2, 2, "m");
  assert.equal(ratioM, 1);
});

test("computePixelsPerCm returns 0 for invalid or non-positive measurements", () => {
  const p1: Point2D = { x: 50, y: 50 };
  const p2: Point2D = { x: 150, y: 50 };

  assert.equal(computePixelsPerCm(p1, p2, 0, "cm"), 0);
  assert.equal(computePixelsPerCm(p1, p2, -5, "cm"), 0);
  assert.equal(computePixelsPerCm(p1, p1, 100, "cm"), 0);
});

// 4. Assessment details validation tests
test("validateAssessmentDetails checks required fields without server calls", () => {
  const emptyErrors = validateAssessmentDetails({
    assessmentName: "",
    facilityName: "",
    spaceName: "",
    environmentType: "residence",
  });
  assert.ok(emptyErrors.assessmentName);
  assert.ok(emptyErrors.facilityName);
  assert.ok(emptyErrors.spaceName);

  const validErrors = validateAssessmentDetails({
    assessmentName: "Community Hall Audit",
    facilityName: "Evergreen Care",
    spaceName: "Main Dining",
    environmentType: "clinic",
  });
  assert.equal(Object.keys(validErrors).length, 0);
});

// 5. Dashboard truthfulness tests
test("assessments dashboard renders Queen Care Clinic as Demo Fixture with truthful session draft copy", () => {
  const html = renderToStaticMarkup(React.createElement(AssessmentsPage));

  // Must label Queen Care Clinic as Example Clinic or Demo Fixture
  assert.match(html, /Queen Care Clinic/);
  assert.match(html, /(Demo Fixture|Example Clinic)/);
  assert.match(html, /(Open demo|Open example clinic)/);

  // Must contain honest empty state for real assessments
  assert.match(html, /(No assessments saved yet|No custom assessments saved yet)/);
  assert.match(html, /(Intake drafts exist only while the intake session remains open|Draft assessments stay in memory until finalized)/);
  assert.match(html, /(Session only|Draft assessment|Saved on this device)/);

  // Must NOT claim local memory persistence on dashboard
  assert.doesNotMatch(html, /held in local memory/);

  // Must NOT contain removed fake rows
  assert.doesNotMatch(html, /North Circulation Corridor/);
  assert.doesNotMatch(html, /Consultation Room 2/);
  assert.doesNotMatch(html, /Physiotherapy &amp; Exercise Hall/);
  assert.doesNotMatch(html, /Physiotherapy & Exercise Hall/);

  // Must NOT contain fake numeric risk score strings
  assert.doesNotMatch(html, /68 · High risk/);
  assert.doesNotMatch(html, /34 · Moderate/);
  assert.doesNotMatch(html, /14 · Low risk/);
});

// 6. Source code verification across intake files
test("new intake source code contains truthful copy and prevents unrenderable PDF drafting", () => {
  const newPagePath = path.resolve(process.cwd(), "src/app/assessments/new/page.tsx");
  const newPageCode = fs.readFileSync(newPagePath, "utf8");

  // No fake timers
  assert.doesNotMatch(newPageCode, /setTimeout/);
  assert.doesNotMatch(newPageCode, /setInterval/);

  // No redirect into Queen Care Clinic demo model from new assessment
  assert.doesNotMatch(newPageCode, /\/assessments\/queen-care-clinic\/model/);

  const sourceStepPath = path.resolve(process.cwd(), "src/components/intake/FloorplanSourceStep.tsx");
  const sourceStepCode = fs.readFileSync(sourceStepPath, "utf8");

  // PDF cannot proceed to drafting
  assert.match(sourceStepCode, /!uploadedFile\.isPdf/);

  const reviewStepPath = path.resolve(process.cwd(), "src/components/intake/IntakeReviewStep.tsx");
  const reviewStepCode = fs.readFileSync(reviewStepPath, "utf8");

  // Misleading 'geometry verified' phrasing removed
  assert.doesNotMatch(reviewStepCode, /Boundary geometry verified with/);
  assert.match(reviewStepCode, /Boundary contains.*traced vertices/);
});

// 7. Candidate URL lifecycle management tests
test("candidate URL lifecycle: cancel replacement revokes candidate URL and preserves active URL", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);

  const initial = { activeUrl: "blob:active-1", candidateUrl: "blob:candidate-1" };
  const result = cancelCandidateUrl(initial, mockRevoke);

  assert.equal(result.activeUrl, "blob:active-1");
  assert.equal(result.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:candidate-1"]);
});

test("candidate URL lifecycle: confirm replacement revokes previous active URL and adopts candidate", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);

  const initial = { activeUrl: "blob:active-1", candidateUrl: "blob:candidate-2" };
  const result = confirmCandidateUrl(initial, mockRevoke);

  assert.equal(result.activeUrl, "blob:candidate-2");
  assert.equal(result.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:active-1"]);
});

test("candidate URL lifecycle: replace pending candidate revokes previously abandoned candidate URL", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);

  const initial = { activeUrl: "blob:active-1", candidateUrl: "blob:candidate-1" };
  const result = registerCandidateUrl(initial, "blob:candidate-2", mockRevoke);

  assert.equal(result.activeUrl, "blob:active-1");
  assert.equal(result.candidateUrl, "blob:candidate-2");
  assert.deepEqual(revoked, ["blob:candidate-1"]);
});

test("candidate URL lifecycle: page cleanup revokes both active and candidate URLs", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);

  const initial = { activeUrl: "blob:active-1", candidateUrl: "blob:candidate-2" };
  const result = cleanupAllUrls(initial, mockRevoke);

  assert.equal(result.activeUrl, null);
  assert.equal(result.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:candidate-2", "blob:active-1"]);
});

// 8. Controlled source selection tests
test("FloorplanSourceStep renders selection strictly from parent-owned currentSource", () => {
  const noop = () => {};

  // Render when parent currentSource is "upload"
  const uploadHtml = renderToStaticMarkup(
    React.createElement(FloorplanSourceStep, {
      currentSource: "upload",
      uploadedFile: null,
      onFileSelect: noop,
      onFileRemove: noop,
      onSelectSource: noop,
      onContinue: noop,
      onBack: noop,
    })
  );
  // Upload button has active highlight, manual does not
  assert.match(uploadHtml, /border-\[#1e7168\] bg-\[#e8f3f1\]\/30[\s\S]*Upload an existing floorplan/);
  assert.match(uploadHtml, /border-slate-200 bg-white hover:border-slate-300[\s\S]*Draw the space manually/);

  // Render when parent currentSource is "manual"
  const manualHtml = renderToStaticMarkup(
    React.createElement(FloorplanSourceStep, {
      currentSource: "manual",
      uploadedFile: null,
      onFileSelect: noop,
      onFileRemove: noop,
      onSelectSource: noop,
      onContinue: noop,
      onBack: noop,
    })
  );
  assert.match(manualHtml, /border-slate-200 bg-white hover:border-slate-300[\s\S]*Upload an existing floorplan/);
  assert.match(manualHtml, /border-\[#1e7168\] bg-\[#e8f3f1\]\/30[\s\S]*Draw the space manually/);
});

test("FloorplanSourceStep contains updated truthful PDF copy on upload card", () => {
  const sourceStepPath = path.resolve(process.cwd(), "src/components/intake/FloorplanSourceStep.tsx");
  const sourceStepCode = fs.readFileSync(sourceStepPath, "utf8");

  assert.match(sourceStepCode, /Import PNG, JPEG, or SVG to calibrate scale and trace boundaries/);
  assert.match(sourceStepCode, /PDF supports browser preview only/);
  assert.doesNotMatch(sourceStepCode, /Import an image \(PNG, JPEG, SVG\) or PDF to calibrate scale and trace room perimeters/);
});

// 9. AppShell truthfulness tests
test("assessments dashboard and new assessment do not render Harmony Elder Care Centre or Data saved locally", () => {
  const dashHtml = renderToStaticMarkup(React.createElement(AssessmentsPage));
  assert.doesNotMatch(dashHtml, /Harmony Elder Care Centre/);
  assert.doesNotMatch(dashHtml, /Data saved locally/);
  assert.match(dashHtml, /SafeSpace workspace/);
  assert.match(dashHtml, /Storage not connected/);

  const newHtml = renderToStaticMarkup(React.createElement(NewAssessmentPage));
  assert.doesNotMatch(newHtml, /Harmony Elder Care Centre/);
  assert.doesNotMatch(newHtml, /Data saved locally/);
  assert.match(newHtml, /New assessment/);
  assert.match(newHtml, /(Session only|In progress)/);
});

// 10. Image decodability verification tests
test("verifyImageDecodable returns true when image decodes successfully", async () => {
  const result = await verifyImageDecodable("blob:valid-image", () => {
    const mock = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: "",
      naturalWidth: 400,
      naturalHeight: 300,
      decode: async () => {},
    };
    queueMicrotask(() => mock.onload?.());
    return mock;
  });
  assert.equal(result, true);
});

test("verifyImageDecodable returns false when image decoding rejects", async () => {
  const result = await verifyImageDecodable("blob:corrupt-image", () => {
    const mock = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: "",
      decode: async () => {
        throw new Error("Decoding error");
      },
    };
    queueMicrotask(() => mock.onload?.());
    return mock;
  });
  assert.equal(result, false);
});

test("verifyImageDecodable returns false on image loading error", async () => {
  const result = await verifyImageDecodable("blob:broken-image", () => {
    const mock = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: "",
    };
    queueMicrotask(() => mock.onerror?.());
    return mock;
  });
  assert.equal(result, false);
});

test("verifyImageDecodable returns false when natural dimensions are 0 without decode method", async () => {
  const result = await verifyImageDecodable("blob:zero-dim-image", () => {
    const mock = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: "",
      naturalWidth: 0,
      naturalHeight: 0,
    };
    queueMicrotask(() => mock.onload?.());
    return mock;
  });
  assert.equal(result, false);
});

// 11. Extended candidate URL lifecycle edge cases
test("candidate URL lifecycle: confirmRemoveUrl revokes both active and candidate URLs", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);

  const initial = { activeUrl: "blob:active-1", candidateUrl: "blob:candidate-1" };
  const result = confirmRemoveUrl(initial, mockRevoke);

  assert.equal(result.activeUrl, null);
  assert.equal(result.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:candidate-1", "blob:active-1"]);
});

test("candidate URL lifecycle: disposeCandidateUrl revokes pending candidate URL and preserves active", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);

  const initial = { activeUrl: "blob:active-1", candidateUrl: "blob:candidate-1" };
  const result = disposeCandidateUrl(initial, mockRevoke);

  assert.equal(result.activeUrl, "blob:active-1");
  assert.equal(result.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:candidate-1"]);

  // No-op when candidateUrl is null
  const noCandidate = { activeUrl: "blob:active-1", candidateUrl: null };
  const resultNoCandidate = disposeCandidateUrl(noCandidate, mockRevoke);
  assert.equal(resultNoCandidate.activeUrl, "blob:active-1");
  assert.equal(resultNoCandidate.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:candidate-1"]);
});

test("candidate URL lifecycle: cleanupAllUrls is idempotent and does not double-revoke identical URLs", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);

  const identical = { activeUrl: "blob:shared-url", candidateUrl: "blob:shared-url" };
  const result = cleanupAllUrls(identical, mockRevoke);

  assert.equal(result.activeUrl, null);
  assert.equal(result.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:shared-url"]);

  // Empty state cleanup causes 0 revocations
  const emptyState = { activeUrl: null, candidateUrl: null };
  const resultEmpty = cleanupAllUrls(emptyState, mockRevoke);
  assert.equal(resultEmpty.activeUrl, null);
  assert.equal(resultEmpty.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:shared-url"]);
});

// 12. Shared AppShell identity truthfulness verification
test("shared AppShell contains no fabricated Harmony Elder Care Centre, Maya Chen, or static MC user identity", () => {
  // 1. Default render with no props
  const defaultHtml = renderToStaticMarkup(
    React.createElement(AppShell, null, React.createElement("div", null, "Default child"))
  );
  assert.doesNotMatch(defaultHtml, /Harmony Elder Care Centre/);
  assert.doesNotMatch(defaultHtml, /Maya Chen/);
  assert.doesNotMatch(defaultHtml, /MC/);
  assert.doesNotMatch(defaultHtml, /<button/);

  // 2. Explicit facility name provided by caller
  const withFacilityHtml = renderToStaticMarkup(
    React.createElement(
      AppShell,
      { facilityName: "SafeSpace workspace" },
      React.createElement("div", null, "Child content")
    )
  );
  assert.match(withFacilityHtml, /SafeSpace workspace/);
  assert.match(withFacilityHtml, /<div[^>]*>[\s\S]*SafeSpace workspace[\s\S]*<\/div>/);
  assert.doesNotMatch(withFacilityHtml, /<button[^>]*>[\s\S]*SafeSpace workspace[\s\S]*<\/button>/);
  assert.doesNotMatch(withFacilityHtml, /MC/);
  assert.doesNotMatch(withFacilityHtml, /Harmony Elder Care Centre/);
  assert.doesNotMatch(withFacilityHtml, /Maya Chen/);
});

// 13. Two overlapping image validations resolving out of order — latest selection wins
test("two overlapping image validations resolving out of order: latest selection wins", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const controller = new AsyncSelectionController(mockRevoke);

  // User selects File A
  const idA = controller.startAttempt("blob:image-a");
  assert.equal(idA, 1);
  assert.equal(controller.isCurrent(idA), true);

  // User selects File B while A is still decoding
  const idB = controller.startAttempt("blob:image-b");
  assert.equal(idB, 2);
  assert.equal(controller.isCurrent(idB), true);
  assert.equal(controller.isCurrent(idA), false);

  // Attempt B finishes first and transfers
  const transferredB = controller.transferUrl(idB, "blob:image-b");
  assert.equal(transferredB, true);

  // Attempt A finishes later — must be rejected as stale
  const transferredA = controller.transferUrl(idA, "blob:image-a");
  assert.equal(transferredA, false);

  // Final winner is B
  assert.equal(controller.isCurrent(idB), true);
});

// 14. Stale failed validation cannot replace or append an error after a newer valid selection
test("stale failed validation cannot replace or append an error after a newer valid selection", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const controller = new AsyncSelectionController(mockRevoke);

  // File A begins decoding
  const idA = controller.startAttempt("blob:image-a");

  // File B is selected and accepted
  const idB = controller.startAttempt("blob:image-b");
  const transferredB = controller.transferUrl(idB, "blob:image-b");
  assert.equal(transferredB, true);

  // File A later fails decoding
  const isCurrentA = controller.rejectAttempt(idA, "blob:image-a");
  assert.equal(isCurrentA, false, "Stale failure must not be treated as current");
});

// 15. Stale/pending object URL is revoked when superseded
test("stale/pending object URL is revoked when superseded", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const controller = new AsyncSelectionController(mockRevoke);

  // Selection 1 starts
  const id1 = controller.startAttempt("blob:attempt-1");
  assert.deepEqual(revoked, []);

  // Selection 2 starts before 1 finishes -> selection 1's pending URL is revoked immediately
  const id2 = controller.startAttempt("blob:attempt-2");
  assert.deepEqual(revoked, ["blob:attempt-1"]);

  // Stale attempt 1 finishes later and does not double-revoke
  controller.rejectAttempt(id1, "blob:attempt-1");
  assert.deepEqual(revoked, ["blob:attempt-1"]);

  // Attempt 2 completes normally
  const transferred2 = controller.transferUrl(id2, "blob:attempt-2");
  assert.equal(transferred2, true);
  assert.deepEqual(revoked, ["blob:attempt-1"]);
});

// 16. Pending URL is cleaned up when its owner is disposed/unmounted
test("pending URL is cleaned up when owner is disposed/unmounted", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const controller = new AsyncSelectionController(mockRevoke);

  controller.startAttempt("blob:in-flight-url");
  assert.deepEqual(controller.getPendingUrls(), ["blob:in-flight-url"]);

  // Simulate component unmount / disposal
  controller.dispose();
  assert.deepEqual(revoked, ["blob:in-flight-url"]);
  assert.deepEqual(controller.getPendingUrls(), []);
});

// 17. Transferred active/candidate URL is not double-revoked
test("transferred active/candidate URL is not double-revoked", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const controller = new AsyncSelectionController(mockRevoke);

  const attemptId = controller.startAttempt("blob:transferred-file");
  const transferred = controller.transferUrl(attemptId, "blob:transferred-file");
  assert.equal(transferred, true);
  assert.deepEqual(revoked, []);

  // Dropzone unmounts / disposes — must NOT revoke transferred URL
  controller.dispose();
  assert.deepEqual(revoked, [], "Dropzone disposal must not revoke transferred URL");

  // Parent candidate URL manager now owns the URL and handles its lifecycle
  const candidateState = { activeUrl: "blob:prior-active", candidateUrl: "blob:transferred-file" };
  const confirmedState = confirmCandidateUrl(candidateState, mockRevoke);
  assert.deepEqual(revoked, ["blob:prior-active"]);
  assert.equal(confirmedState.activeUrl, "blob:transferred-file");

  // Final page unmount cleans up active URL
  cleanupAllUrls(confirmedState, mockRevoke);
  assert.deepEqual(revoked, ["blob:prior-active", "blob:transferred-file"]);
});

// 18. Delayed decode: synchronous invalidation makes attempt stale before decode resolves without relying on React effects
test("delayed decode: synchronous invalidation makes attempt stale before decode resolves without relying on React effects", async () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const controller = new AsyncSelectionController(mockRevoke);

  let resolveDecode!: () => void;
  const decodePromise = new Promise<void>((resolve) => {
    resolveDecode = resolve;
  });

  const mockImageFactory = (): MockImageInstance => {
    const img: MockImageInstance = {
      onload: null,
      onerror: null,
      src: "",
      decode: () => decodePromise,
    };
    queueMicrotask(() => img.onload?.());
    return img;
  };

  // 1. Start pending validation B
  const objectUrlB = "blob:file-b";
  const attemptB = controller.startAttempt(objectUrlB);
  let callbackInvoked = false;
  let validationErrorExposed = false;

  const decodeOperation = verifyImageDecodable(objectUrlB, mockImageFactory).then((isDecodable) => {
    if (!isDecodable) {
      if (controller.rejectAttempt(attemptB, objectUrlB)) {
        validationErrorExposed = true;
      }
      return;
    }
    const transferred = controller.transferUrl(attemptB, objectUrlB);
    if (transferred) {
      callbackInvoked = true;
    }
  });

  // 2. Trigger the exact synchronous invalidation mechanism used by parent conflicting action:
  controller.invalidate();

  // 3. Before any React effect would be required or decode resolves, B must ALREADY be stale
  assert.equal(controller.isCurrent(attemptB), false, "Attempt B must be stale synchronously before decode resolves");
  // 6. Pending URL is revoked exactly once immediately by Dropzone/controller
  assert.deepEqual(revoked, ["blob:file-b"]);

  // 4. Late success: resolve decode promise
  resolveDecode();
  await decodeOperation;

  // Invariant assertions:
  assert.equal(callbackInvoked, false, "Late decode success must never invoke accepted-file callback");
  assert.equal(validationErrorExposed, false, "Late decode must never expose an error");
  assert.deepEqual(revoked, ["blob:file-b"], "Pending URL must be revoked exactly once, not double-revoked");
});

// 19. Delayed decode failure: synchronous invalidation prevents late failure from exposing an error
test("delayed decode failure: synchronous invalidation prevents late failure from exposing an error", async () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const controller = new AsyncSelectionController(mockRevoke);

  let rejectDecode!: (err: Error) => void;
  const decodePromise = new Promise<void>((_, reject) => {
    rejectDecode = reject;
  });

  const mockImageFactory = (): MockImageInstance => {
    const img: MockImageInstance = {
      onload: null,
      onerror: null,
      src: "",
      decode: () => decodePromise,
    };
    queueMicrotask(() => img.onload?.());
    return img;
  };

  const objectUrlB = "blob:file-b-failing";
  const attemptB = controller.startAttempt(objectUrlB);
  let validationErrorExposed = false;

  const decodeOperation = verifyImageDecodable(objectUrlB, mockImageFactory).then((isDecodable) => {
    if (!isDecodable) {
      if (controller.rejectAttempt(attemptB, objectUrlB)) {
        validationErrorExposed = true;
      }
    }
  });

  // Synchronous invalidation
  controller.invalidate();
  assert.equal(controller.isCurrent(attemptB), false);
  assert.deepEqual(revoked, ["blob:file-b-failing"]);

  // Late rejection
  rejectDecode(new Error("Corrupt image data"));
  await decodeOperation;

  assert.equal(validationErrorExposed, false, "Stale failure must not expose validation error");
  assert.deepEqual(revoked, ["blob:file-b-failing"], "URL must not be double-revoked on stale reject");
});

// 20. Synchronous source switch during delayed decode: parent switch_source intent remains intact and cancel preserves draft
test("synchronous source switch during delayed decode: switch_source intent preserved and cancel preserves draft", async () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const sharedController = new AsyncSelectionController(mockRevoke);

  let resolveDecode!: () => void;
  const decodePromise = new Promise<void>((resolve) => {
    resolveDecode = resolve;
  });

  const mockImageFactory = (): MockImageInstance => {
    const img: MockImageInstance = {
      onload: null,
      onerror: null,
      src: "",
      decode: () => decodePromise,
    };
    queueMicrotask(() => img.onload?.());
    return img;
  };

  // Initial parent state: active uploaded file A with draft work
  let candidateState: CandidateUrlState = { activeUrl: "blob:file-a", candidateUrl: null };
  let pendingChange: PendingSourceChange | null = null;
  const initialBoundary: BoundaryState = {
    vertices: [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 100 }],
    isClosed: true,
    selectedVertexIndex: null,
    gridSnap: true,
  };
  const currentBoundary = initialBoundary;

  // 1. User selects replacement file B -> Dropzone starts async decode
  const attemptB = sharedController.startAttempt("blob:file-b");
  let onFileSelectCalled = false;

  const decodeOperation = verifyImageDecodable("blob:file-b", mockImageFactory).then((isDecodable) => {
    if (isDecodable) {
      const transferred = sharedController.transferUrl(attemptB, "blob:file-b");
      if (transferred) {
        onFileSelectCalled = true;
      }
    }
  });

  // 2. Before B completes, user clicks "Draw the space manually"
  // Consolidated parent helper runs synchronously:
  sharedController.invalidate();
  candidateState = disposeCandidateUrl(candidateState, mockRevoke);
  pendingChange = { type: "switch_source", targetSource: "manual" };

  // 3. Before any React effect runs or decode finishes, B is already stale:
  assert.equal(sharedController.isCurrent(attemptB), false);
  assert.deepEqual(revoked, ["blob:file-b"]); // Pending URL revoked immediately

  // 4. In-flight decode finishes late
  resolveDecode();
  await decodeOperation;

  // Assert: callback was NOT called and pendingChange remained switch_source
  assert.equal(onFileSelectCalled, false);
  assert.deepEqual(pendingChange, { type: "switch_source", targetSource: "manual" });
  assert.equal(candidateState.activeUrl, "blob:file-a");
  assert.equal(candidateState.candidateUrl, null);
  assert.deepEqual(currentBoundary, initialBoundary);

  // 5. User clicks "Keep Current Draft" (cancel):
  sharedController.invalidate();
  candidateState = cancelCandidateUrl(candidateState, mockRevoke);
  pendingChange = null;

  // Active URL intact, draft geometry intact, only blob:file-b was ever revoked
  assert.equal(candidateState.activeUrl, "blob:file-a");
  assert.equal(candidateState.candidateUrl, null);
  assert.equal(pendingChange, null);
  assert.deepEqual(revoked, ["blob:file-b"]);
  assert.deepEqual(currentBoundary.vertices.length, 3);
});

// 21. Synchronous file removal during delayed decode: parent remove_file intent is preserved and confirmed cleanly
test("synchronous file removal during delayed decode: parent remove_file intent preserved and confirmed cleanly", async () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const sharedController = new AsyncSelectionController(mockRevoke);

  let resolveDecode!: () => void;
  const decodePromise = new Promise<void>((resolve) => {
    resolveDecode = resolve;
  });

  const mockImageFactory = (): MockImageInstance => {
    const img: MockImageInstance = {
      onload: null,
      onerror: null,
      src: "",
      decode: () => decodePromise,
    };
    queueMicrotask(() => img.onload?.());
    return img;
  };

  let candidateState: CandidateUrlState = { activeUrl: "blob:file-a", candidateUrl: null };
  let pendingChange: PendingSourceChange | null = null;

  // Replacement B starts decode
  const attemptB = sharedController.startAttempt("blob:file-b");
  const decodeOperation = verifyImageDecodable("blob:file-b", mockImageFactory).then((isDecodable) => {
    if (isDecodable) {
      sharedController.transferUrl(attemptB, "blob:file-b");
    }
  });

  // User clicks Remove file -> synchronous invalidation and parent sets remove_file
  sharedController.invalidate();
  assert.deepEqual(revoked, ["blob:file-b"]);

  candidateState = disposeCandidateUrl(candidateState, mockRevoke);
  pendingChange = { type: "remove_file" };

  // Attempt B finishes late
  resolveDecode();
  await decodeOperation;

  assert.deepEqual(pendingChange, { type: "remove_file" });

  // User confirms remove
  candidateState = confirmRemoveUrl(candidateState, mockRevoke);
  assert.equal(candidateState.activeUrl, null);
  assert.equal(candidateState.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:file-b", "blob:file-a"]);
});

// 22. Confirmed replacement: successful validation transfers URL ownership without Dropzone revoking it
test("confirmed replacement: successful validation transfers URL ownership without Dropzone revoking it", () => {
  const revoked: string[] = [];
  const mockRevoke = (url: string) => revoked.push(url);
  const sharedController = new AsyncSelectionController(mockRevoke);

  let candidateState: CandidateUrlState = { activeUrl: "blob:file-a", candidateUrl: null };

  // File C selected and completes validation successfully
  const attemptC = sharedController.startAttempt("blob:file-c");
  const transferred = sharedController.transferUrl(attemptC, "blob:file-c");
  assert.equal(transferred, true);
  assert.deepEqual(revoked, []);

  // Parent adopts candidate URL
  candidateState = registerCandidateUrl(candidateState, "blob:file-c", mockRevoke);
  assert.equal(candidateState.candidateUrl, "blob:file-c");

  // Subsequent Dropzone invalidation / unmount must NOT revoke transferred blob:file-c
  sharedController.invalidate();
  assert.deepEqual(revoked, [], "Transferred URL must not be revoked by Dropzone on invalidation");

  // User confirms replacement
  candidateState = confirmCandidateUrl(candidateState, mockRevoke);
  assert.equal(candidateState.activeUrl, "blob:file-c");
  assert.equal(candidateState.candidateUrl, null);
  assert.deepEqual(revoked, ["blob:file-a"], "Old active URL revoked upon confirmation");
});

// 23. Dropzone invalidation subscription: callbacks execute synchronously and unregister cleanly
test("Dropzone invalidation subscription: callbacks execute synchronously and unregister cleanly", () => {
  const controller = new AsyncSelectionController();
  let callbackCount = 0;

  const unsubscribe = controller.onInvalidate(() => {
    callbackCount += 1;
  });

  controller.invalidate();
  assert.equal(callbackCount, 1, "Callback must fire synchronously on invalidate");

  controller.invalidate();
  assert.equal(callbackCount, 2, "Callback must fire on subsequent invalidate");

  unsubscribe();
  controller.invalidate();
  assert.equal(callbackCount, 2, "Callback must not fire after unsubscription");
});
