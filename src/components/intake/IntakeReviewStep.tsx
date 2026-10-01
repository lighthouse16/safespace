"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  type AssessmentDetails,
  type BoundaryState,
  type CalibrationState,
  ENVIRONMENT_TYPE_LABELS,
  type SourceType,
  type UploadedFileInfo,
} from "./intake-view-types";
import { formatFileSize } from "./intake-validation";

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
  const [integrationAcknowledged, setIntegrationAcknowledged] = useState(false);

  const polygonPoints = boundary.vertices.map((v) => `${v.x},${v.y}`).join(" ");

  return (
    <div className="space-y-6">
      {/* Session Truthfulness Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
              <span className="size-1.5 rounded-full bg-slate-500" />
              Session only
            </span>
            <h2 className="mt-2 text-lg font-semibold text-[#192329]">
              Review Intake & Boundary Draft
            </h2>
          </div>
          <p className="text-xs text-[#64748b] max-w-sm sm:text-right">
            This draft remains in the current browser session until project storage is connected.
          </p>
        </div>

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
                  {details.assessmentName}
                </dd>
              </div>
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Facility / Residence</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {details.facilityName}
                </dd>
              </div>
              <div className="p-3 flex justify-between">
                <dt className="text-slate-500">Space / Area</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {details.spaceName}
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
            </dl>
          </div>

          {/* Right Column: Visual Preview of Traced Boundary */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Traced Perimeter Preview
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-900 p-2 shadow-inner aspect-[4/3] flex items-center justify-center relative">
              <svg viewBox="0 0 800 600" className="w-full h-full select-none block">
                {/* Background Floorplan image if available */}
                {source === "upload" && uploadedFile && uploadedFile.previewAvailable ? (
                  <image
                    href={uploadedFile.objectUrl}
                    x="0"
                    y="0"
                    width={800}
                    height={600}
                    preserveAspectRatio="xMidYMid meet"
                    opacity="0.5"
                  />
                ) : null}

                {/* Traced polygon */}
                {boundary.isClosed ? (
                  <polygon
                    points={polygonPoints}
                    fill="rgba(30, 113, 104, 0.35)"
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
              Boundary contains {boundary.vertices.length} traced vertices using the current scale calibration.
            </p>
          </div>
        </div>

        {/* Integration Notification */}
        {integrationAcknowledged && (
          <div
            role="status"
            className="rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] p-4 text-xs text-[#065f46] space-y-1"
          >
            <div className="font-semibold text-sm">
              Draft complete for session workspace integration
            </div>
            <p>
              Your boundary draft and scale calibration are held in browser memory for this session. When canonical project storage is connected, intake drafts will be retained across sessions.
            </p>
          </div>
        )}
      </div>

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
            onClick={() => setIntegrationAcknowledged(true)}
            className="font-semibold"
          >
            Draft complete for workspace integration
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
