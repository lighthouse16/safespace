"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell";
import {
  AssessmentDetailsStep,
  BoundaryDraftCanvas,
  FloorplanSourceStep,
  IntakeReviewStep,
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

  const [calibration, setCalibration] = useState<CalibrationState>({
    p1: null,
    p2: null,
    realLength: null,
    unit: "cm",
    pixelsPerCm: null,
    isCalibrated: false,
  });

  const [boundary, setBoundary] = useState<BoundaryState>({
    vertices: [],
    isClosed: false,
    selectedVertexIndex: null,
    gridSnap: true,
  });

  // Navigation handlers
  const handleDetailsContinue = (newDetails: AssessmentDetails) => {
    setDetails(newDetails);
    setCurrentStep("source");
  };

  const handleSourceSelect = (newSource: SourceType) => {
    if (newSource !== source) {
      setSource(newSource);
      // Invalidate previous calibration if source type changes
      setCalibration({
        p1: null,
        p2: null,
        realLength: null,
        unit: "cm",
        pixelsPerCm: null,
        isCalibrated: false,
      });
    }
  };

  const handleFileSelect = (file: UploadedFileInfo) => {
    setUploadedFile(file);
    // Invalidate previous calibration when a new source file is selected
    setCalibration({
      p1: null,
      p2: null,
      realLength: null,
      unit: "cm",
      pixelsPerCm: null,
      isCalibrated: false,
    });
  };

  const handleFileRemove = () => {
    setUploadedFile(null);
    setCalibration({
      p1: null,
      p2: null,
      realLength: null,
      unit: "cm",
      pixelsPerCm: null,
      isCalibrated: false,
    });
  };

  const handleResetAll = () => {
    setDetails({
      assessmentName: "",
      facilityName: "",
      spaceName: "",
      environmentType: "residence",
      notes: "",
    });
    setSource("upload");
    if (uploadedFile?.objectUrl) {
      URL.revokeObjectURL(uploadedFile.objectUrl);
    }
    setUploadedFile(null);
    setCalibration({
      p1: null,
      p2: null,
      realLength: null,
      unit: "cm",
      pixelsPerCm: null,
      isCalibrated: false,
    });
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
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            &larr; Exit to Assessments
          </Link>
        </header>

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
            />
          )}
        </main>
      </div>
    </AppShell>
  );
}
