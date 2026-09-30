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
  type AssessmentDetails,
  type BoundaryState,
  type CalibrationState,
  type IntakeStep,
  type SourceType,
  type UploadedFileInfo,
} from "@/components/intake";
import { Button } from "@/components/ui/button";

const STEPS: { id: IntakeStep; label: string }[] = [
  { id: "details", label: "1. Assessment details" },
  { id: "source", label: "2. Floorplan source" },
  { id: "draft", label: "3. Calibration & drafting" },
  { id: "review", label: "4. Session review" },
];

const INITIAL_CALIBRATION_STATE: CalibrationState = {
  p1: null,
  p2: null,
  realLength: null,
  unit: "cm",
  pixelsPerCm: null,
  isCalibrated: false,
};

export default function NewAssessmentPage() {
  const [currentStep, setCurrentStep] = useState<IntakeStep>("details");

  // Form & session states
  const [details, setDetails] = useState<AssessmentDetails>({
    assessmentName: "",
    facilityName: "",
    spaceName: "",
    environmentType: "residence",
    notes: "",
  });

  const [source, setSource] = useState<SourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);

  const [calibration, setCalibration] = useState<CalibrationState>(INITIAL_CALIBRATION_STATE);

  const [boundary, setBoundary] = useState<BoundaryState>({
    vertices: [],
    isClosed: false,
    selectedVertexIndex: null,
    gridSnap: true,
  });

  // Track active blob URL for single-point ownership and cleanup on unmount
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    activeUrlRef.current = uploadedFile?.objectUrl ?? null;
  }, [uploadedFile]);

  useEffect(() => {
    return () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, []);

  const setUploadedFileAndManageUrl = (file: UploadedFileInfo | null) => {
    if (activeUrlRef.current && activeUrlRef.current !== file?.objectUrl) {
      URL.revokeObjectURL(activeUrlRef.current);
    }
    activeUrlRef.current = file?.objectUrl ?? null;
    setUploadedFile(file);
  };

  // Determine whether meaningful intake progress exists
  const hasMeaningfulWork =
    details.assessmentName.trim().length > 0 ||
    details.facilityName.trim().length > 0 ||
    details.spaceName.trim().length > 0 ||
    Boolean(details.notes && details.notes.trim().length > 0) ||
    uploadedFile !== null ||
    source === "manual" ||
    boundary.vertices.length > 0 ||
    calibration.isCalibrated ||
    calibration.p1 !== null;

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingSourceAction, setPendingSourceAction] = useState<(() => void) | null>(null);

  // Browser beforeunload guard when unsaved session work exists
  useEffect(() => {
    if (!hasMeaningfulWork) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasMeaningfulWork]);

  // Prompt before exiting to assessments if unsaved work exists
  const handleExitNavigation = (e: React.MouseEvent) => {
    if (hasMeaningfulWork) {
      e.preventDefault();
      setShowExitConfirm(true);
    }
  };

  // Navigation handlers
  const handleDetailsContinue = (newDetails: AssessmentDetails) => {
    setDetails(newDetails);
    setCurrentStep("source");
  };

  const handleSourceSelect = (newSource: SourceType) => {
    if (newSource === source) return;
    const execute = () => {
      setSource(newSource);
      setCalibration(INITIAL_CALIBRATION_STATE);
      setBoundary(resetBoundaryForSourceChange(boundary));
    };
    if (boundary.vertices.length > 0) {
      setPendingSourceAction(() => execute);
    } else {
      execute();
    }
  };

  const handleFileSelect = (file: UploadedFileInfo) => {
    const execute = () => {
      setUploadedFileAndManageUrl(file);
      setCalibration(INITIAL_CALIBRATION_STATE);
      setBoundary(resetBoundaryForSourceChange(boundary));
    };
    if (uploadedFile && boundary.vertices.length > 0) {
      setPendingSourceAction(() => execute);
    } else {
      execute();
    }
  };

  const handleFileRemove = () => {
    const execute = () => {
      setUploadedFileAndManageUrl(null);
      setCalibration(INITIAL_CALIBRATION_STATE);
      setBoundary(resetBoundaryForSourceChange(boundary));
    };
    if (boundary.vertices.length > 0) {
      setPendingSourceAction(() => execute);
    } else {
      execute();
    }
  };

  const handleResetAll = () => {
    if (hasMeaningfulWork) {
      const confirmed = window.confirm(
        "Discard all current intake parameters and start over?"
      );
      if (!confirmed) return;
    }
    setDetails({
      assessmentName: "",
      facilityName: "",
      spaceName: "",
      environmentType: "residence",
      notes: "",
    });
    setSource("upload");
    setUploadedFileAndManageUrl(null);
    setCalibration(INITIAL_CALIBRATION_STATE);
    setBoundary({
      vertices: [],
      isClosed: false,
      selectedVertexIndex: null,
      gridSnap: true,
    });
    setCurrentStep("details");
  };

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <AppShell activePath="/assessments">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header with truthful Session-only badge */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                New Assessment Intake
              </span>
              <span
                role="status"
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200"
              >
                Session only
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#192329] sm:text-3xl">
              {STEPS[stepIndex].label.replace(/^\d+\.\s*/, "")}
            </h1>
          </div>

          <Link
            href="/assessments"
            onClick={handleExitNavigation}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            &larr; Exit to Assessments
          </Link>
        </header>

        {/* Restrained Session Exit Warning Dialog */}
        {showExitConfirm && (
          <div
            role="alertdialog"
            aria-labelledby="exit-dialog-title"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <div id="exit-dialog-title" className="font-semibold text-sm">
                Discard current intake draft?
              </div>
              <p className="mt-0.5 text-amber-800">
                Leaving will discard the in-progress draft geometry and calibration. This session draft is held in browser memory only.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/assessments"
                className="rounded-lg bg-[#dc2626] px-3 py-1.5 font-semibold text-white hover:bg-red-700 transition"
              >
                Discard & Exit
              </Link>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowExitConfirm(false)}
              >
                Continue Editing
              </Button>
            </div>
          </div>
        )}

        {/* Restrained Source Change Reset Confirmation Dialog */}
        {pendingSourceAction !== null && (
          <div
            role="alertdialog"
            aria-labelledby="source-change-title"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <div id="source-change-title" className="font-semibold text-sm">
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
                onClick={() => {
                  const act = pendingSourceAction;
                  setPendingSourceAction(null);
                  act();
                }}
              >
                Discard & Update Source
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPendingSourceAction(null)}
              >
                Keep Current Draft
              </Button>
            </div>
          </div>
        )}

        {/* Workflow Progress Bar */}
        <nav aria-label="Intake progress" className="grid grid-cols-4 gap-2">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="space-y-1.5">
              <div
                className={`h-1.5 rounded-full transition ${
                  idx <= stepIndex ? "bg-[#1e7168]" : "bg-slate-200"
                }`}
              />
              <span
                className={`hidden text-xs font-medium sm:block truncate ${
                  idx === stepIndex
                    ? "text-[#1e7168] font-semibold"
                    : idx < stepIndex
                    ? "text-slate-700"
                    : "text-slate-400"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </nav>

        {/* Step Content */}
        <main>
          {currentStep === "details" && (
            <AssessmentDetailsStep
              initialDetails={details}
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
              onContinue={() => setCurrentStep("draft")}
              onBack={() => setCurrentStep("details")}
            />
          )}

          {currentStep === "draft" && (
            <div className="space-y-6">
              <BoundaryDraftCanvas
                source={source}
                uploadedFile={uploadedFile}
                calibration={calibration}
                boundary={boundary}
                onUpdateCalibration={setCalibration}
                onUpdateBoundary={setBoundary}
              />

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCurrentStep("source")}
                >
                  Back to Source
                </Button>

                <div className="flex items-center gap-3">
                  {!boundary.isClosed && (
                    <span className="text-xs text-[#94a3b8]">
                      Close boundary polygon to proceed
                    </span>
                  )}
                  <Button
                    type="button"
                    onClick={() => setCurrentStep("review")}
                    disabled={!boundary.isClosed || !calibration.isCalibrated}
                  >
                    Continue to Review
                  </Button>
                </div>
              </div>
            </div>
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
              onExitToAssessments={handleExitNavigation}
            />
          )}
        </main>
      </div>
    </AppShell>
  );
}
