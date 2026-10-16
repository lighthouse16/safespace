"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell";
import {
  AssessmentDetailsStep,
  BoundaryDraftCanvas,
  FloorplanSourceStep,
  IntakeReviewStep,
  resetBoundaryForSourceChange,
  registerCandidateUrl,
  cancelCandidateUrl,
  confirmCandidateUrl,
  disposeCandidateUrl,
  confirmRemoveUrl,
  cleanupAllUrls,
  AsyncSelectionController,
  type AssessmentDetails,
  type BoundaryState,
  type CalibrationState,
  type EnvironmentType,
  type IntakeStep,
  type PendingSourceChange,
  type SourceType,
  type UploadedFileInfo,
} from "@/components/intake";
import { Button } from "@/components/ui/button";
import { validateIntakeBoundary } from "@/lib/spatial";

const STEPS: { id: IntakeStep; label: string }[] = [
  { id: "details", label: "1. Assessment details" },
  { id: "source", label: "2. Floorplan source" },
  { id: "draft", label: "3. Calibration & drafting" },
  { id: "review", label: "4. Review" },
];

const INITIAL_CALIBRATION_STATE: CalibrationState = {
  p1: null,
  p2: null,
  realLength: null,
  unit: "m",
  pixelsPerCm: null,
  isCalibrated: false,
};

export type NewAssessmentPageProps = {
  selectionController?: AsyncSelectionController;
};

export default function NewAssessmentPage({
  selectionController: externalController,
}: NewAssessmentPageProps = {}) {
  const [internalController] = useState(() => new AsyncSelectionController());
  const selectionController = externalController ?? internalController;

  const [currentStep, setCurrentStep] = useState<IntakeStep>("details");

  // Form & session states
  const [details, setDetails] = useState<AssessmentDetails>({
    assessmentName: "",
    facilityName: "",
    spaceName: "",
    environmentType: "" as unknown as EnvironmentType,
    notes: "",
  });

  const [source, setSource] = useState<SourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);

  const [calibration, setCalibration] = useState<CalibrationState>(INITIAL_CALIBRATION_STATE);

  const [boundary, setBoundary] = useState<BoundaryState>({
    vertices: [],
    isClosed: false,
    selectedVertexIndex: null,
    gridSnap: false,
  });

  // Track active and candidate blob URLs for single-point ownership and lifecycle safety
  const activeUrlRef = useRef<string | null>(null);
  const candidateUrlRef = useRef<string | null>(null);

  const invalidatePendingFileSelection = () => {
    selectionController.invalidate();
  };

  useEffect(() => {
    return () => {
      selectionController.dispose();
      const cleaned = cleanupAllUrls({
        activeUrl: activeUrlRef.current,
        candidateUrl: candidateUrlRef.current,
      });
      activeUrlRef.current = cleaned.activeUrl;
      candidateUrlRef.current = cleaned.candidateUrl;
    };
  }, [selectionController]);

  // Determine whether meaningful intake progress exists
  const hasMeaningfulWork =
    details.assessmentName.trim().length > 0 ||
    details.facilityName.trim().length > 0 ||
    details.spaceName.trim().length > 0 ||
    Boolean(details.environmentType) ||
    Boolean(details.notes && details.notes.trim().length > 0) ||
    uploadedFile !== null ||
    source === "manual" ||
    boundary.vertices.length > 0 ||
    calibration.isCalibrated ||
    calibration.p1 !== null;

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingSourceChange | null>(null);
  const confirmedExitRef = useRef(false);
  const savedDraftRef = useRef(false);

  // Browser beforeunload guard when unsaved session work exists
  useEffect(() => {
    if (!hasMeaningfulWork) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (confirmedExitRef.current || savedDraftRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasMeaningfulWork]);

  // AppShell owns the home and assessments links; guard them before Next handles clicks.
  const handleExitNavigation = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as Element).closest("a[href]");
    if (!anchor || anchor.hasAttribute("download") || (anchor.getAttribute("target") && anchor.getAttribute("target") !== "_self")) return;
    const destination = new URL((anchor as HTMLAnchorElement).href);
    if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
    if (hasMeaningfulWork && !savedDraftRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setShowExitConfirm(true);
      return;
    }
    invalidatePendingFileSelection();
  };

  // Navigation handlers
  const handleDetailsContinue = (newDetails: AssessmentDetails) => {
    setDetails(newDetails);
    setCurrentStep("source");
  };

  const handleSourceSelect = (newSource: SourceType) => {
    if (newSource === source) return;
    invalidatePendingFileSelection();
    const hasWork = boundary.vertices.length > 0 || calibration.p1 !== null;
    if (hasWork) {
      const nextCandidate = disposeCandidateUrl(
        { activeUrl: activeUrlRef.current, candidateUrl: candidateUrlRef.current }
      );
      candidateUrlRef.current = nextCandidate.candidateUrl;
      setPendingChange({ type: "switch_source", targetSource: newSource });
    } else {
      setSource(newSource);
      setCalibration(INITIAL_CALIBRATION_STATE);
      setBoundary(resetBoundaryForSourceChange(boundary));
    }
  };

  const handleFileSelect = (file: UploadedFileInfo) => {
    if (pendingChange !== null && pendingChange.type !== "replace_file") {
      URL.revokeObjectURL(file.objectUrl);
      return;
    }
    const hasWork = boundary.vertices.length > 0 || calibration.p1 !== null;
    if (uploadedFile && hasWork) {
      const nextCandidate = registerCandidateUrl(
        { activeUrl: activeUrlRef.current, candidateUrl: candidateUrlRef.current },
        file.objectUrl
      );
      candidateUrlRef.current = nextCandidate.candidateUrl;
      setPendingChange({ type: "replace_file", candidateFile: file });
    } else {
      if (activeUrlRef.current && activeUrlRef.current !== file.objectUrl) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
      activeUrlRef.current = file.objectUrl;
      setUploadedFile(file);
      setCalibration(INITIAL_CALIBRATION_STATE);
      setBoundary(resetBoundaryForSourceChange(boundary));
    }
  };

  const handleFileRemove = () => {
    invalidatePendingFileSelection();
    const hasWork = boundary.vertices.length > 0 || calibration.p1 !== null;
    if (hasWork) {
      const nextCandidate = disposeCandidateUrl(
        { activeUrl: activeUrlRef.current, candidateUrl: candidateUrlRef.current }
      );
      candidateUrlRef.current = nextCandidate.candidateUrl;
      setPendingChange({ type: "remove_file" });
    } else {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
      setUploadedFile(null);
      setCalibration(INITIAL_CALIBRATION_STATE);
      setBoundary(resetBoundaryForSourceChange(boundary));
    }
  };

  const handleConfirmSourceChange = () => {
    if (!pendingChange) return;
    invalidatePendingFileSelection();

    if (pendingChange.type === "replace_file") {
      const nextState = confirmCandidateUrl({
        activeUrl: activeUrlRef.current,
        candidateUrl: candidateUrlRef.current,
      });
      activeUrlRef.current = nextState.activeUrl;
      candidateUrlRef.current = nextState.candidateUrl;
      setUploadedFile(pendingChange.candidateFile);
    } else if (pendingChange.type === "switch_source") {
      setSource(pendingChange.targetSource);
      const nextState = disposeCandidateUrl({
        activeUrl: activeUrlRef.current,
        candidateUrl: candidateUrlRef.current,
      });
      candidateUrlRef.current = nextState.candidateUrl;
    } else if (pendingChange.type === "remove_file") {
      const nextState = confirmRemoveUrl({
        activeUrl: activeUrlRef.current,
        candidateUrl: candidateUrlRef.current,
      });
      activeUrlRef.current = nextState.activeUrl;
      candidateUrlRef.current = nextState.candidateUrl;
      setUploadedFile(null);
    }

    setCalibration(INITIAL_CALIBRATION_STATE);
    setBoundary(resetBoundaryForSourceChange(boundary));
    setPendingChange(null);
  };

  const handleCancelSourceChange = () => {
    invalidatePendingFileSelection();
    const nextState = cancelCandidateUrl({
      activeUrl: activeUrlRef.current,
      candidateUrl: candidateUrlRef.current,
    });
    candidateUrlRef.current = nextState.candidateUrl;
    setPendingChange(null);
  };

  const handleResetAll = () => {
    if (hasMeaningfulWork) {
      const confirmed = window.confirm(
        "Discard all current intake parameters and start over?"
      );
      if (!confirmed) return;
    }
    savedDraftRef.current = false;
    invalidatePendingFileSelection();
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
    if (candidateUrlRef.current) {
      URL.revokeObjectURL(candidateUrlRef.current);
      candidateUrlRef.current = null;
    }
    setPendingChange(null);
    setDetails({
      assessmentName: "",
      facilityName: "",
      spaceName: "",
      environmentType: "" as unknown as EnvironmentType,
      notes: "",
    });
    setSource("upload");
    setUploadedFile(null);
    setCalibration(INITIAL_CALIBRATION_STATE);
    setBoundary({
      vertices: [],
      isClosed: false,
      selectedVertexIndex: null,
      gridSnap: false,
    });
    setCurrentStep("details");
  };

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isDraftComplete = validateIntakeBoundary(boundary.vertices, boundary.isClosed, calibration.pixelsPerCm).isValid;

  return (
    <div onClickCapture={handleExitNavigation}>
      <AppShell
      activePath="/assessments/new"
      facilityName={
        currentStep !== "details" && details.facilityName.trim().length > 0
          ? details.facilityName.trim()
          : null
      }
      assessmentName={
        currentStep !== "details" && details.assessmentName.trim().length > 0
          ? details.assessmentName.trim()
          : null
      }
      spaceName={
        currentStep !== "details" && details.spaceName.trim().length > 0
          ? details.spaceName.trim()
          : null
      }
      workspaceLabel="New assessment"
      storageLabel="Draft assessment"
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header with draft status badge and stepper matching 02-05 */}
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#17252B]">
              New assessment
            </h1>
          </div>

          {/* Stepper with circles and lines matching 02 to 05 */}
          <nav aria-label="Intake progress" className="py-2">
            <ol className="flex items-center justify-between gap-3 max-w-4xl">
              {STEPS.map((s, idx) => {
                const isCompleted = idx < stepIndex && (s.id !== "draft" || isDraftComplete);
                const isCurrent = idx === stepIndex;
                const subtitles = [
                  details.assessmentName || undefined,
                  source === "upload" ? "Uploaded floorplan" : "Manual drawing",
                  isDraftComplete ? "Scale and boundary complete" : calibration.isCalibrated ? "Boundary still required" : "Set scale and draw boundary",
                  "Session review",
                ];
                return (
                  <li key={s.id} aria-current={isCurrent ? "step" : undefined} className="flex flex-1 items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isCompleted
                            ? "bg-[#0B514B] text-white"
                            : isCurrent
                            ? "bg-[#0B514B] text-white"
                            : "bg-[#F0F3F4] text-[#647078]"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </span>
                      <div className="hidden sm:block">
                        <span
                          className={`text-xs font-semibold leading-none ${
                            isCurrent || isCompleted ? "text-[#17252B]" : "text-[#647078]"
                          }`}
                        >
                          {s.label.replace(/^\d+\.\s*/, "")}
                        </span>
                        {subtitles[idx] && (
                          <span className="block text-[10px] text-[#647078] truncate max-w-[130px]">
                            {subtitles[idx]}
                          </span>
                        )}
                      </div>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 rounded-full ${
                          isCompleted ? "bg-[#0B514B]" : "bg-[#E2E6E8]"
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </header>

        {/* Exit Warning Banner */}
        {showExitConfirm && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <div className="font-semibold text-sm">
                Leave without saving?
              </div>
              <p className="mt-0.5 text-amber-800">
                Leaving now will discard your assessment details, selected floorplan, room outline, and scale calibration. Finish setup to save this assessment to your device.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/assessments"
                onClick={() => {
                  confirmedExitRef.current = true;
                  invalidatePendingFileSelection();
                }}
                className="rounded-lg bg-[#dc2626] px-3 py-1.5 font-semibold text-white hover:bg-red-700 transition"
              >
                Discard and leave
              </Link>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowExitConfirm(false)}
              >
                Stay in assessment
              </Button>
            </div>
          </div>
        )}

        {/* Source Change Reset Confirmation Banner */}
        {pendingChange !== null && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <div className="font-semibold text-sm">
                Reset existing boundary and calibration?
              </div>
              <p className="mt-0.5 text-amber-800">
                Changing or replacing the floorplan source will discard your currently traced boundary vertices and scale calibration.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmSourceChange}
              >
                Discard & Update Source
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCancelSourceChange}
              >
                Keep Current Draft
              </Button>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div>
          {currentStep === "details" && (
            <AssessmentDetailsStep
              initialDetails={details}
              onChange={setDetails}
              onContinue={handleDetailsContinue}
            />
          )}

          {currentStep === "source" && (
            <FloorplanSourceStep
              currentSource={source}
              uploadedFile={uploadedFile}
              onSelectSource={handleSourceSelect}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              onContinue={() => {
                invalidatePendingFileSelection();
                setCurrentStep("draft");
              }}
              onBack={() => {
                invalidatePendingFileSelection();
                setCurrentStep("details");
              }}
              selectionController={selectionController}
            />
          )}

          {currentStep === "draft" && (
            <BoundaryDraftCanvas
              source={source}
              uploadedFile={uploadedFile}
              calibration={calibration}
              boundary={boundary}
              onUpdateCalibration={setCalibration}
              onUpdateBoundary={setBoundary}
              assessmentName={details.assessmentName}
              facilityName={details.facilityName}
              spaceName={details.spaceName}
              onBack={() => setCurrentStep("source")}
              onContinue={() => setCurrentStep("review")}
            />
          )}

          {currentStep === "review" && (
            <IntakeReviewStep
              details={details}
              source={source}
              uploadedFile={uploadedFile}
              calibration={calibration}
              boundary={boundary}
              onBackToDraft={() => setCurrentStep("draft")}
              onResetAll={handleResetAll}
              onSaved={() => { savedDraftRef.current = true; }}
            />
          )}
        </div>
      </div>
      </AppShell>
    </div>
  );
}
