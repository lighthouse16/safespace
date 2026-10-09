"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  type AssessmentDetails,
  type BoundaryState,
  type CalibrationState,
  ENVIRONMENT_TYPE_LABELS,
  type SourceType,
  type UploadedFileInfo,
} from "./intake-view-types";
import { formatFileSize, computePixelDistance } from "./intake-validation";
import {
  validateIntakeBoundary,
  INTAKE_ORIGIN_POLICY,
  type IntakeBoundaryValidationResult,
} from "@/lib/spatial";
import { loadPersistedAssessment } from "@/lib/storage/persistence";
import { useSafeSpaceStore } from "@/store/safespace-store";

export type IntakeReviewStepProps = {
  details: AssessmentDetails;
  source: SourceType;
  uploadedFile: UploadedFileInfo | null;
  calibration: CalibrationState;
  boundary: BoundaryState;
  onBackToDraft: () => void;
  onResetAll: () => void;
  onExitToAssessments?: (e: React.MouseEvent) => void;
};

export function IntakeReviewStep({
  details,
  source,
  uploadedFile,
  calibration,
  boundary,
  onBackToDraft,
  onResetAll,
  onExitToAssessments,
}: IntakeReviewStepProps) {
  const router = useRouter();
  const createAndLoadUserAssessment = useSafeSpaceStore((s) => s.createAndLoadUserAssessment);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);

  // Pre-validate for preview statistics
  const previewValidation: IntakeBoundaryValidationResult = validateIntakeBoundary(
    boundary.vertices,
    boundary.isClosed,
    calibration.pixelsPerCm
  );

  const polygonPoints = boundary.vertices.map((v) => `${v.x},${v.y}`).join(" ");

  const executeConfirmAndOpen = () => {
    setValidationError(null);

    const validation = validateIntakeBoundary(
      boundary.vertices,
      boundary.isClosed,
      calibration.pixelsPerCm
    );

    if (!validation.isValid || !validation.polygonCm || !validation.boundsCm) {
      setValidationError(validation.error || "Boundary validation failed.");
      return;
    }

    if (!details.assessmentName.trim()) {
      setValidationError("Assessment name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const realLengthCm = calibration.realLength! * (calibration.unit === "m" ? 100 : 1);
      const pixelDist =
        calibration.p1 && calibration.p2
          ? computePixelDistance(calibration.p1, calibration.p2)
          : calibration.pixelsPerCm! * realLengthCm;

      const res = createAndLoadUserAssessment({
        metadata: {
          id: `assessment-${Date.now()}`,
          name: details.assessmentName.trim(),
          facilityName: details.facilityName.trim(),
          spaceName: details.spaceName.trim(),
          environmentType: details.environmentType,
          notes: details.notes?.trim() || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        boundaryCm: validation.polygonCm,
        calibration: {
          pixelsPerCm: calibration.pixelsPerCm!,
          realLength: calibration.realLength!,
          unit: calibration.unit,
          pixelDistance: pixelDist,
          originPolicy: INTAKE_ORIGIN_POLICY,
        },
      });

      if (!res.success) {
        setIsSubmitting(false);
        setValidationError(`Failed to initialize assessment workspace: ${res.error || "Storage write error"}`);
        return;
      }

      router.push("/");
    } catch (err) {
      setIsSubmitting(false);
      const message = err instanceof Error ? err.message : String(err);
      setValidationError(`Failed to initialize assessment workspace: ${message}`);
    }
  };

  const handleConfirmAndOpen = () => {
    const existing = loadPersistedAssessment();
    if (existing.success && existing.data.assessmentType === "user") {
      setShowOverwriteModal(true);
      return;
    }
    executeConfirmAndOpen();
  };

  return (
    <div className="space-y-6">
      {/* Session & Storage Disclosure */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-600" />
              Ready for Confirmation
            </span>
            <h2 className="mt-2 text-lg font-semibold text-[#192329]">
              Review Intake & Boundary Draft
            </h2>
          </div>
          <p className="text-xs text-[#64748b] max-w-sm sm:text-right">
            Confirming this intake creates an independent user assessment and opens it in the main spatial workspace.
          </p>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 space-y-1"
          >
            <div className="font-semibold text-sm">Cannot Confirm Assessment</div>
            <p>{validationError}</p>
          </div>
        )}

        {/* Fact Sheet Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column: Assessment Parameters */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Assessment Metadata
            </h3>
            <dl className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-xs">
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Assessment Name</dt>
                <dd className="font-semibold text-slate-900 text-right">
                  {details.assessmentName || "—"}
                </dd>
              </div>
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Facility / Residence</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {details.facilityName || "—"}
                </dd>
              </div>
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Space / Area</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {details.spaceName || "—"}
                </dd>
              </div>
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Environment Type</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {ENVIRONMENT_TYPE_LABELS[details.environmentType]}
                </dd>
              </div>
              {details.notes && (
                <div className="p-3">
                  <dt className="text-slate-500 mb-1">Notes</dt>
                  <dd className="text-slate-700 whitespace-pre-wrap">{details.notes}</dd>
                </div>
              )}
            </dl>

            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">
              Floorplan & Scale Facts
            </h3>
            <dl className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-xs">
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Source Type</dt>
                <dd className="font-medium text-slate-900">
                  {source === "upload" ? "Uploaded file" : "Manual drawing"}
                </dd>
              </div>
              {source === "upload" && uploadedFile && (
                <div className="p-3 flex justify-between">
                  <dt className="text-slate-500">Filename & Size</dt>
                  <dd className="font-medium text-slate-900 text-right truncate max-w-xs">
                    {uploadedFile.name} ({formatFileSize(uploadedFile.size)})
                  </dd>
                </div>
              )}
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Ground-Truth Reference</dt>
                <dd className="font-medium text-slate-900">
                  {calibration.isCalibrated
                    ? `${calibration.realLength} ${calibration.unit}`
                    : "Uncalibrated"}
                </dd>
              </div>
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Calculated Physical Scale</dt>
                <dd className="font-mono font-medium text-[#1e7168]">
                  {calibration.pixelsPerCm
                    ? `${calibration.pixelsPerCm.toFixed(2)} px/cm (${(
                        calibration.pixelsPerCm * 100
                      ).toFixed(0)} px/m)`
                    : "None"}
                </dd>
              </div>
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Boundary Polygon</dt>
                <dd className="font-medium text-slate-900">
                  {boundary.vertices.length} vertices (
                  {boundary.isClosed ? "Closed loop" : "Open path"})
                </dd>
              </div>
              {previewValidation.boundsCm && (
                <div className="p-3 flex justify-between">
                  <dt className="text-slate-500">Physical Dimensions</dt>
                  <dd className="font-mono font-semibold text-slate-800">
                    {Math.round(previewValidation.boundsCm.widthCm)} × {Math.round(previewValidation.boundsCm.heightCm)} cm
                    {previewValidation.areaCm2 && (
                      <span className="text-slate-500 font-normal ml-1">
                        ({(previewValidation.areaCm2 / 10000).toFixed(1)} m²)
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Right Column: Geometry Preview */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Drafted Geometry Preview
            </h3>
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg border border-slate-200 bg-[#f8faf8] p-4 flex items-center justify-center">
              <svg
                viewBox="0 0 800 600"
                className="w-full h-full max-h-72"
                aria-label="Boundary draft preview"
              >
                {/* SVG background grid */}
                <defs>
                  <pattern id="preview-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8e4" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="800" height="600" fill="url(#preview-grid)" />

                {/* Boundary Polygon */}
                {boundary.isClosed && boundary.vertices.length >= 3 ? (
                  <polygon
                    points={polygonPoints}
                    fill="rgba(30, 113, 104, 0.25)"
                    stroke="#1e7168"
                    strokeWidth={3}
                  />
                ) : (
                  <polyline
                    points={polygonPoints}
                    fill="none"
                    stroke="#1e7168"
                    strokeWidth={3}
                  />
                )}

                {/* Vertices */}
                {boundary.vertices.map((v, i) => (
                  <circle
                    key={i}
                    cx={v.x}
                    cy={v.y}
                    r={5}
                    fill="#ffffff"
                    stroke="#1e7168"
                    strokeWidth={2}
                  />
                ))}
              </svg>
            </div>
            <p className="text-[11px] text-[#64748b] text-center">
              Boundary contains {boundary.vertices.length} traced vertices using current scale calibration ({calibration.pixelsPerCm ? calibration.pixelsPerCm.toFixed(2) : "0"} px/cm).
            </p>

            {/* Storage Lifecycle Disclosure */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">
                Data Persistence & Source File Lifecycle
              </div>
              <p>
                Your confirmed room boundary, scale calibration provenance, and assessment metadata will be saved permanently in browser storage.
              </p>
              <p className="text-slate-500">
                Uploaded floorplan images remain in browser memory for the active session and are never saved as durable blob URLs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overwrite Confirmation Modal */}
      {showOverwriteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="replace-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 id="replace-modal-title" className="text-base font-bold text-slate-900">
              Replace Existing Saved Assessment?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              A previously confirmed user assessment is already saved in this browser. Confirming will permanently replace that assessment with this new space.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowOverwriteModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                onClick={() => {
                  setShowOverwriteModal(false);
                  executeConfirmAndOpen();
                }}
              >
                Replace & Open Workspace
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBackToDraft}>
          Back to Drafting
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onResetAll}
            className="text-slate-600 hover:text-[#dc2626]"
          >
            Start New Assessment
          </Button>

          <Button
            type="button"
            size="md"
            onClick={handleConfirmAndOpen}
            disabled={isSubmitting || !previewValidation.isValid}
            className="font-semibold bg-[#1e7168] hover:bg-[#185e56] text-white"
          >
            {isSubmitting ? "Opening Workspace..." : "Confirm & Open in Workspace"}
          </Button>

          <Link
            href="/assessments"
            onClick={onExitToAssessments}
            className="text-xs font-semibold text-teal-700 hover:underline px-2"
          >
            Return to Assessments &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
