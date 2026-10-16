"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Building2,
  Layers,
  Building,
  ClipboardList,
  Calendar,
  User,
  Pencil,
  Ruler,
  SquareDashed,
  Maximize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type AssessmentDetails,
  type BoundaryState,
  type CalibrationState,
  ENVIRONMENT_TYPE_LABELS,
  type SourceType,
  type UploadedFileInfo,
} from "./intake-view-types";
import { computePixelDistance } from "./intake-validation";
import { INTAKE_ORIGIN_POLICY, validateIntakeBoundary } from "@/lib/spatial";
import { getIntakeReviewReadiness } from "./review-readiness";
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
  onSaved?: () => void;
};

export function IntakeReviewStep({
  details,
  source,
  uploadedFile,
  calibration,
  boundary,
  onBackToDraft,
  onResetAll,
  onSaved,
}: IntakeReviewStepProps) {
  const router = useRouter();
  const createAndLoadUserAssessment = useSafeSpaceStore((s) => s.createAndLoadUserAssessment);
  const retryPendingMediaCleanup = useSafeSpaceStore((s) => s.retryPendingMediaCleanup);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);
  const [isRetryingCleanup, setIsRetryingCleanup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);

  const {
    validation: previewValidation,
    canConfirm,
    message: incompleteMessage,
  } = getIntakeReviewReadiness(boundary, calibration, details.assessmentName);
  const polygonPoints = boundary.vertices.map((v) => `${v.x},${v.y}`).join(" ");

  const executeConfirmAndOpen = async () => {
    setValidationError(null);
    if (!canConfirm) {
      setValidationError(incompleteMessage);
      return;
    }

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

      const res = await createAndLoadUserAssessment({
        metadata: {
          id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `assessment-${Date.now()}`,
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
        imageFile: uploadedFile?.file,
      });

      if (!res.success) {
        setIsSubmitting(false);
        setValidationError(`Failed to initialize assessment workspace: ${res.error || "Storage write error"}`);
        return;
      }

      onSaved?.();
      if (res.previousMediaCleanupFailed) {
        setIsSubmitting(false);
        setCleanupWarning(
          res.cleanupWarning ||
          "Assessment created, but the previous floorplan image could not be cleaned up from browser storage. Personal data may remain locally."
        );
        return;
      }

      router.push("/workspace");
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

      {/* Explain incomplete geometry rather than silently disabling the primary action. */}
      {!canConfirm && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div id="missing-boundary-help">
            <p className="font-semibold">Finish the room outline before continuing</p>
            <p className="mt-1 text-xs leading-relaxed">{incompleteMessage}</p>
          </div>
          <Button type="button" variant="secondary" onClick={onBackToDraft} className="shrink-0">
            Back to draw boundary
          </Button>
        </div>
      )}

      {/* Media Cleanup Warning Banner */}
      {cleanupWarning && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-3"
        >
          <div className="font-semibold text-sm text-amber-800">
            Previous Floorplan Cleanup Warning
          </div>
          <p className="leading-relaxed">{cleanupWarning}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isRetryingCleanup}
              onClick={async () => {
                setIsRetryingCleanup(true);
                const retryRes = await retryPendingMediaCleanup();
                setIsRetryingCleanup(false);
                if (retryRes.success) {
                  setCleanupWarning(null);
                  router.push("/workspace");
                } else {
                  setCleanupWarning(
                    `Retry failed. ${retryRes.remainingCount} previous floorplan image(s) still could not be deleted from browser storage.`
                  );
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold transition cursor-pointer text-xs"
            >
              {isRetryingCleanup ? "Retrying..." : "Retry Cleanup"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/workspace")}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 font-semibold text-amber-900 transition cursor-pointer text-xs"
            >
              Continue to Workspace
            </button>
          </div>
        </div>
      )}

      {/* 2-Column Grid matching 05-intake-review.png */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Assessment Summary Card */}
        <div className="rounded-2xl border border-[#E2E6E8] bg-white p-6 shadow-xs">
          <h3 className="text-xl font-bold text-[#17252B]">
            Assessment summary
          </h3>
          <p className="mt-1 text-xs text-[#647078]">
            Review your assessment details and drafted floorplan before creating the user assessment.
          </p>

          <div className="mt-6 divide-y divide-[#E2E6E8] text-xs">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 text-[#647078]">
                <FileText size={18} strokeWidth={1.8} className="text-[#647078]" />
                <span>Assessment name</span>
              </div>
              <span className="font-semibold text-[#17252B] text-right truncate max-w-[240px]">
                {details.assessmentName.trim() || "Not provided"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 text-[#647078]">
                <Building2 size={18} strokeWidth={1.8} className="text-[#647078]" />
                <span>Facility or residence</span>
              </div>
              <span className="font-medium text-[#17252B] text-right truncate max-w-[240px]">
                {details.facilityName.trim() || "Not provided"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 text-[#647078]">
                <Layers size={18} strokeWidth={1.8} className="text-[#647078]" />
                <span>Space or area name</span>
              </div>
              <span className="font-medium text-[#17252B] text-right truncate max-w-[240px]">
                {details.spaceName.trim() || "Not provided"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 text-[#647078]">
                <Building size={18} strokeWidth={1.8} className="text-[#647078]" />
                <span>Environment type</span>
              </div>
              <span className="font-medium text-[#17252B]">
                {details.environmentType === "residence"
                  ? "Residential"
                  : ENVIRONMENT_TYPE_LABELS[details.environmentType] || "Not provided"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 text-[#647078]">
                <ClipboardList size={18} strokeWidth={1.8} className="text-[#647078]" />
                <span>Assessment purpose</span>
              </div>
              <span className="font-medium text-[#17252B]">General accessibility review</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 text-[#647078]">
                <Calendar size={18} strokeWidth={1.8} className="text-[#647078]" />
                <span>Created</span>
              </div>
              <span className="font-medium text-[#17252B]">
                On confirmation
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 text-[#647078]">
                <User size={18} strokeWidth={1.8} className="text-[#647078]" />
                <span>Created by</span>
              </div>
              <span className="font-medium text-[#17252B]">Not recorded</span>
            </div>

            <div className="flex items-start justify-between py-3 gap-4">
              <div className="flex items-center gap-3 text-[#647078] shrink-0">
                <Pencil size={18} strokeWidth={1.8} className="text-[#647078]" />
                <span>Notes</span>
              </div>
              <span className="font-medium text-[#17252B] text-right text-xs max-w-[280px] leading-relaxed">
                {details.notes?.trim() || "Not provided"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Geometry Preview & Floorplan Details Cards */}
        <div className="space-y-6">
          {/* Draft Geometry Preview Card */}
          <div className="rounded-2xl border border-[#E2E6E8] bg-white p-5 shadow-xs">
            <h3 className="text-base font-bold text-[#17252B]">
              Draft geometry preview
            </h3>
            <p className="mt-0.5 text-xs text-[#647078]">
              Preview of the traced apartment boundary and drafted floorplan.
            </p>

            {/* Geometry Preview Container */}
            {(() => {
              const previewFloorplanUrl =
                source === "upload" && uploadedFile?.previewAvailable
                  ? uploadedFile.objectUrl
                  : null;

              return (
                <div className="relative mt-4 aspect-4/3 w-full overflow-hidden rounded-xl border border-[#E2E6E8] bg-[#F7F8F8] flex items-center justify-center">
                  <svg
                    viewBox="0 0 800 600"
                    className="w-full h-full object-contain"
                      aria-label="Boundary draft preview"
                    >
                      <defs>
                        <pattern id="preview-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E6E8" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="800" height="600" fill="#FFFFFF" />
                      <rect width="800" height="600" fill="url(#preview-grid)" />

                      {/* Floorplan image preview */}
                      {previewFloorplanUrl && (
                        <image
                          href={previewFloorplanUrl}
                          x="0"
                          y="0"
                          width="800"
                          height="600"
                          preserveAspectRatio="xMidYMid meet"
                          opacity="0.92"
                        />
                      )}


                      {/* Boundary Polygon */}
                      {boundary.isClosed && boundary.vertices.length >= 3 ? (
                        <polygon
                          points={polygonPoints}
                          fill="rgba(11, 81, 75, 0.15)"
                          stroke="#0B514B"
                          strokeWidth={3}
                          strokeDasharray="6 4"
                        />
                      ) : (
                        <polyline
                          points={polygonPoints}
                          fill="none"
                          stroke="#0B514B"
                          strokeWidth={3}
                        />
                      )}

                      {/* Vertices */}
                      {boundary.vertices.map((v, i) => (
                        <circle
                          key={i}
                          cx={v.x}
                          cy={v.y}
                          r={4.5}
                          fill="#ffffff"
                          stroke="#0B514B"
                          strokeWidth={2}
                        />
                      ))}
                    </svg>

                    {/* Mini overview thumbnail matching 05-intake-review.png */}
                    {previewFloorplanUrl && (
                      <div className="absolute top-3 right-3 w-16 h-12 rounded border border-[#CBD5E1] bg-white p-0.5 shadow-2xs overflow-hidden hidden sm:block pointer-events-none">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewFloorplanUrl} alt="Overview thumbnail" className="w-full h-full object-contain" />
                      </div>
                    )}

                    </div>
                  );
              })()}
              <span className="sr-only">
                Boundary contains {boundary.vertices.length} traced vertices using current scale calibration ({calibration.pixelsPerCm ? calibration.pixelsPerCm.toFixed(2) : "0"} px/cm).
              </span>
            </div>

            {/* Floorplan Details Card */}
            <div className="rounded-2xl border border-[#E2E6E8] bg-white p-5 shadow-xs">
              <h3 className="text-base font-bold text-[#17252B]">
                Floorplan details
              </h3>

              <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <Ruler size={16} strokeWidth={1.8} className="text-[#647078] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-[#647078]">Scale</p>
                    <p className="mt-0.5 font-bold text-[#17252B]">
                      {calibration.pixelsPerCm ? `${calibration.pixelsPerCm.toFixed(2)} px/cm` : "Not calibrated"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <SquareDashed size={16} strokeWidth={1.8} className="text-[#647078] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-[#647078]">Boundary type</p>
                    <p className="mt-0.5 font-bold text-[#17252B]">
                      {boundary.isClosed ? "Closed boundary" : boundary.vertices.length ? "Boundary in progress" : "Not drawn"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Maximize2 size={16} strokeWidth={1.8} className="text-[#647078] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-[#647078]">Estimated dimensions</p>
                    <p className="mt-0.5 font-bold text-[#17252B]">
                      {previewValidation.boundsCm
                        ? `${(previewValidation.boundsCm.widthCm / 100).toFixed(1)} m (W) × ${(previewValidation.boundsCm.heightCm / 100).toFixed(1)} m (L)${previewValidation.areaCm2 !== undefined ? ` (≈ ${(previewValidation.areaCm2 / 10000).toFixed(1)} m²)` : ""}`
                        : "Not measured"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <FileText size={16} strokeWidth={1.8} className="text-[#647078] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#647078]">Source file</p>
                    <p className="mt-0.5 font-bold text-[#17252B] truncate">
                      {uploadedFile?.name || "Manual drawing"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Confirmation Teal Banner matching 05-intake-review.png */}
      {canConfirm && (
      <div className="rounded-2xl border border-[#0B514B]/20 bg-[#E8F3F1] p-4 text-xs text-[#0B514B] flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0B514B] text-white font-bold text-xs">
          ✓
        </span>
        <div>
          <p className="font-bold text-[#17252B]">
            Confirming intake saves this assessment in this browser.
          </p>
          <p className="mt-0.5 text-[#073D38]">
            Only one assessment is saved on this device. Confirming a new one replaces the previous saved assessment after your confirmation, then opens the local workspace. Uploaded floorplan images are stored in this browser’s IndexedDB on this device and persist across reloads; they are not backed up to an account.
          </p>
        </div>
      </div>

      )}

      {/* Overwrite Confirmation Modal */}
      {showOverwriteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="replace-modal-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowOverwriteModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 id="replace-modal-title" className="text-base font-bold text-slate-900">
              Replace Existing Saved Assessment?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              A previously confirmed assessment is already saved on this device. Confirming will replace that assessment with this new space.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                autoFocus
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

      {/* Action Footer matching 05-intake-review.png */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <button
          type="button"
          onClick={onBackToDraft}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E2E6E8] bg-white px-4 py-2.5 text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer"
        >
          <ChevronLeft size={16} />
          <span>Back to drafting</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onResetAll}
            className="rounded-xl border border-[#E2E6E8] bg-white px-4 py-2.5 text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition cursor-pointer"
          >
            Start new assessment
          </button>

          <button
            type="button"
            onClick={handleConfirmAndOpen}
            disabled={isSubmitting || !canConfirm}
            aria-describedby={!canConfirm ? "missing-boundary-help" : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B514B] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#073D38] transition cursor-pointer disabled:opacity-50"
          >
            <span>{isSubmitting ? "Opening Workspace..." : "Confirm & open in workspace"}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
