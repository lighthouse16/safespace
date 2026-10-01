"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  type SourceType,
  type UploadedFileInfo,
} from "./intake-view-types";
import { FloorplanDropzone } from "./FloorplanDropzone";

export type FloorplanSourceStepProps = {
  currentSource: SourceType;
  uploadedFile: UploadedFileInfo | null;
  onFileSelect: (file: UploadedFileInfo) => void;
  onFileRemove: () => void;
  onSelectSource: (source: SourceType) => void;
  onContinue: () => void;
  onBack: () => void;
  invalidationToken?: number | string;
};

export function FloorplanSourceStep({
  currentSource,
  uploadedFile,
  onFileSelect,
  onFileRemove,
  onSelectSource,
  onContinue,
  onBack,
  invalidationToken,
}: FloorplanSourceStepProps) {
  const isPdfSelected = currentSource === "upload" && uploadedFile?.isPdf === true;
  const canContinue =
    currentSource === "manual" ||
    (currentSource === "upload" && uploadedFile !== null && !uploadedFile.isPdf);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-base font-semibold text-[#192329]">
          Choose Floorplan Source
        </h2>
        <p className="mt-1 text-xs text-[#64748b]">
          Select whether to import an existing architectural plan or trace a blank grid manually.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Card 1: Upload */}
          <button
            type="button"
            onClick={() => onSelectSource("upload")}
            className={`flex flex-col text-left p-5 rounded-xl border-2 transition cursor-pointer ${
              currentSource === "upload"
                ? "border-[#1e7168] bg-[#e8f3f1]/30"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-[#192329]">
                Upload an existing floorplan
              </span>
              <span
                className={`size-4 rounded-full border-2 flex items-center justify-center ${
                  currentSource === "upload"
                    ? "border-[#1e7168] bg-[#1e7168]"
                    : "border-slate-300"
                }`}
              >
                {currentSource === "upload" && (
                  <span className="size-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#64748b]">
              Import PNG, JPEG, or SVG to calibrate scale and trace boundaries. PDF supports browser preview only; replace with an image or choose manual before drafting.
            </p>
          </button>

          {/* Card 2: Manual */}
          <button
            type="button"
            onClick={() => onSelectSource("manual")}
            className={`flex flex-col text-left p-5 rounded-xl border-2 transition cursor-pointer ${
              currentSource === "manual"
                ? "border-[#1e7168] bg-[#e8f3f1]/30"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-[#192329]">
                Draw the space manually
              </span>
              <span
                className={`size-4 rounded-full border-2 flex items-center justify-center ${
                  currentSource === "manual"
                    ? "border-[#1e7168] bg-[#1e7168]"
                    : "border-slate-300"
                }`}
              >
                {currentSource === "manual" && (
                  <span className="size-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#64748b]">
              Start with a blank coordinate grid without any background fixture. Trace boundary points directly.
            </p>
          </button>
        </div>

        {/* Selected Source Section */}
        <div className="mt-6 border-t border-slate-200 pt-6">
          {currentSource === "upload" ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Floorplan File Upload
              </h3>
              <FloorplanDropzone
                currentFile={uploadedFile}
                onFileSelect={onFileSelect}
                onFileRemove={onFileRemove}
                invalidationToken={invalidationToken}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
              <div className="mx-auto size-10 rounded-full bg-white border border-slate-200 grid place-items-center text-[#1e7168]">
                <svg
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 10h16M10 4v16"
                  />
                </svg>
              </div>
              <div className="mt-3 text-sm font-semibold text-[#192329]">
                Blank Grid Workspace
              </div>
              <p className="mt-1 text-xs text-[#64748b] max-w-md mx-auto">
                Add points to trace the room boundary on an empty coordinate plane. You will establish physical scale using a reference segment.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back to Details
        </Button>
        <div className="flex items-center gap-3">
          {isPdfSelected && (
            <span className="text-xs text-amber-800">
              Visual drafting requires PNG, JPEG, or SVG. Replace PDF or switch to manual.
            </span>
          )}
          <Button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
          >
            Continue to Calibration & Drafting
          </Button>
        </div>
      </div>
    </div>
  );
}
