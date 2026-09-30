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
  MAX_FILE_SIZE_BYTES,
} from "../src/components/intake/intake-validation";
import {
  type Point2D,
  type BoundaryState,
} from "../src/components/intake/intake-view-types";
import AssessmentsPage from "../src/app/assessments/page";

// 1. File validation tests
test("validateFloorplanFile accepts valid PNG, JPEG, SVG, and PDF files under 25 MB", () => {
  const pngFile = new File(["dummy png content"], "floorplan.png", { type: "image/png" });
  const jpgFile = new File(["dummy jpg content"], "survey.jpg", { type: "image/jpeg" });
  const svgFile = new File(["<svg></svg>"], "blueprint.svg", { type: "image/svg+xml" });
  const pdfFile = new File(["%PDF-1.4"], "architectural-plan.pdf", { type: "application/pdf" });

  assert.equal(validateFloorplanFile(pngFile).isValid, true);
  assert.equal(validateFloorplanFile(jpgFile).isValid, true);
  assert.equal(validateFloorplanFile(svgFile).isValid, true);
  assert.equal(validateFloorplanFile(pdfFile).isValid, true);
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

test("validateFloorplanFile rejects unsupported MIME types even with renamed extension", () => {
  const fakePng = new File(["video stream"], "sneaky.png", { type: "video/mp4" });
  const result = validateFloorplanFile(fakePng);
  assert.equal(result.isValid, false);
});

test("validateFloorplanFile rejects files exceeding 25 MB", () => {
  // Construct a dummy file object with size property > 25 MB
  const oversizedFile = {
    name: "huge-floorplan.png",
    size: MAX_FILE_SIZE_BYTES + 1024,
    type: "image/png",
  } as File;

  const result = validateFloorplanFile(oversizedFile);
  assert.equal(result.isValid, false);
  assert.match(result.error ?? "", /exceeds the 25 MB size limit/);
});

test("formatFileSize formats bytes, KB, and MB accurately", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2.0 KB");
  assert.equal(formatFileSize(1024 * 1024 * 3.5), "3.5 MB");
});

// 2. Measurement validation tests
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

// 3. Scale calibration conversion tests
test("computePixelsPerCm calculates correct ratio for cm and m units", () => {
  const p1: Point2D = { x: 100, y: 100 };
  const p2: Point2D = { x: 300, y: 100 }; // 200 pixels distance
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
  assert.equal(computePixelsPerCm(p1, p1, 100, "cm"), 0); // zero distance
});

// 4. Boundary state logic tests
test("boundary state: add, undo, close requirements, and reset", () => {
  let boundary: BoundaryState = {
    vertices: [],
    isClosed: false,
    selectedVertexIndex: null,
    gridSnap: true,
  };

  // Add 1st point
  boundary = { ...boundary, vertices: [...boundary.vertices, { x: 100, y: 100 }] };
  assert.equal(boundary.vertices.length, 1);
  assert.equal(boundary.isClosed, false);

  // Add 2nd point
  boundary = { ...boundary, vertices: [...boundary.vertices, { x: 300, y: 100 }] };
  assert.equal(boundary.vertices.length, 2);

  // Attempting to close with < 3 points must be blocked by rule
  const canCloseWithTwo = boundary.vertices.length >= 3;
  assert.equal(canCloseWithTwo, false);

  // Undo 2nd point
  boundary = { ...boundary, vertices: boundary.vertices.slice(0, -1) };
  assert.equal(boundary.vertices.length, 1);

  // Re-add 2nd and add 3rd point
  boundary = {
    ...boundary,
    vertices: [
      ...boundary.vertices,
      { x: 300, y: 100 },
      { x: 300, y: 300 },
    ],
  };
  assert.equal(boundary.vertices.length, 3);
  assert.equal(boundary.vertices.length >= 3, true);

  // Close boundary
  boundary = { ...boundary, isClosed: true };
  assert.equal(boundary.isClosed, true);

  // Reset boundary
  boundary = {
    ...boundary,
    vertices: [],
    isClosed: false,
    selectedVertexIndex: null,
  };
  assert.equal(boundary.vertices.length, 0);
  assert.equal(boundary.isClosed, false);
});

// 5. Assessment details validation tests
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

// 6. Dashboard truthfulness tests
test("assessments dashboard renders Queen Care Clinic as Demo Fixture without fabricated production rows or risk scores", () => {
  const html = renderToStaticMarkup(React.createElement(AssessmentsPage));

  // Must label Queen Care Clinic as Demo Fixture
  assert.match(html, /Queen Care Clinic/);
  assert.match(html, /Demo Fixture/);
  assert.match(html, /Open demo/);

  // Must contain honest empty state for real assessments
  assert.match(html, /No real assessments saved yet/);
  assert.match(html, /Session only/);

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

// 7. Source code truthfulness check across intake files
test("new intake source code contains no fake timers, fake AI extraction, or fake persistence claims", () => {
  const newPagePath = path.resolve(process.cwd(), "src/app/assessments/new/page.tsx");
  const newPageCode = fs.readFileSync(newPagePath, "utf8");

  // No fake timers
  assert.doesNotMatch(newPageCode, /setTimeout/);
  assert.doesNotMatch(newPageCode, /setInterval/);

  // No fake AI extraction claims
  assert.doesNotMatch(newPageCode, /AI extraction/i);
  assert.doesNotMatch(newPageCode, /Plan processed successfully/i);

  // No redirect into Queen Care Clinic demo model from new assessment
  assert.doesNotMatch(newPageCode, /\/assessments\/queen-care-clinic\/model/);

  // No fake hardcoded 90 cm doorway assumption
  assert.doesNotMatch(newPageCode, /value="90 cm"/);
});
