"use client";

import React from "react";
import { ChevronRight, ChevronLeft, FileText, Pencil } from "lucide-react";
import {
  type SourceType,
  type UploadedFileInfo,
} from "./intake-view-types";
import { FloorplanDropzone } from "./FloorplanDropzone";
import type { AsyncSelectionController } from "./candidate-url-manager";

export type FloorplanSourceStepProps = {
  currentSource: SourceType;
  uploadedFile: UploadedFileInfo | null;
  onFileSelect: (file: UploadedFileInfo) => void;
  onFileRemove: () => void;
  onSelectSource: (source: SourceType) => void;
  onContinue: () => void;
  onBack: () => void;
  selectionController?: AsyncSelectionController;
};

export function FloorplanSourceStep({
  currentSource,
  uploadedFile,
  onFileSelect,
  onFileRemove,
  onSelectSource,
  onContinue,
  onBack,
  selectionController,
}: FloorplanSourceStepProps) {
  const isPdfSelected = currentSource === "upload" && uploadedFile?.isPdf === true;
  const canContinue =
    currentSource === "manual" ||
    (currentSource === "upload" && uploadedFile !== null && !uploadedFile.isPdf);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E2E6E8] bg-white p-6 sm:p-8 shadow-xs">
        {/* Step Badge */}
        <div className="mb-4">
          <span className="inline-block rounded-md bg-[#F0F3F4] px-2.5 py-1 text-xs font-semibold text-[#17252B]">
            Step 2 of 4
          </span>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-[#17252B]">
          Choose floorplan source
        </h2>
        <p className="mt-1.5 text-xs text-[#647078]">
          Select how you&apos;d like to provide the floorplan for this assessment.
        </p>

        {/* Source Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* Card 1: Upload */}
          <button
            type="button"
            onClick={() => onSelectSource("upload")}
            className={`flex items-start gap-4 p-5 rounded-xl border-2 transition cursor-pointer text-left ${
              currentSource === "upload"
                ? "border-[#0B514B] bg-white ring-1 ring-[#0B514B]"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                currentSource === "upload"
                  ? "bg-[#E8F3F1] text-[#0B514B]"
                  : "bg-[#F0F3F4] text-[#17252B]"
              }`}
            >
              <FileText size={20} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#17252B]">
                  Upload an existing floorplan
                </span>
                <span
                  className={`size-5 rounded-full border-2 flex items-center justify-center ${
                    currentSource === "upload"
                      ? "border-[#0B514B] bg-white"
                      : "border-[#CBD5E1]"
                  }`}
                >
                  {currentSource === "upload" && (
                    <span className="size-2.5 rounded-full bg-[#0B514B]" />
                  )}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#647078]">
                Use a PDF, PNG or DWG file of your current floorplan.
              </p>
              <span className="sr-only">
                Import PNG, JPEG, or SVG to calibrate scale and trace boundaries. PDF supports browser preview only.
              </span>
            </div>
          </button>

          {/* Card 2: Manual */}
          <button
            type="button"
            onClick={() => onSelectSource("manual")}
            className={`flex items-start gap-4 p-5 rounded-xl border-2 transition cursor-pointer text-left ${
              currentSource === "manual"
                ? "border-[#0B514B] bg-white ring-1 ring-[#0B514B]"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                currentSource === "manual"
                  ? "bg-[#E8F3F1] text-[#0B514B]"
                  : "bg-[#F0F3F4] text-[#17252B]"
              }`}
            >
              <Pencil size={20} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#17252B]">
                  Draw the space manually
                </span>
                <span
                  className={`size-5 rounded-full border-2 flex items-center justify-center ${
                    currentSource === "manual"
                      ? "border-[#0B514B] bg-white"
                      : "border-[#CBD5E1]"
                  }`}
                >
                  {currentSource === "manual" && (
                    <span className="size-2.5 rounded-full bg-[#0B514B]" />
                  )}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#647078]">
                Create a new floorplan using our built-in drawing tools.
              </p>
            </div>
          </button>
        </div>

        {/* Selected Source Section */}
        <div className="mt-8">
          {currentSource === "upload" ? (
            <div>
              <FloorplanDropzone
                currentFile={uploadedFile}
                onFileSelect={onFileSelect}
                onFileRemove={onFileRemove}
                selectionController={selectionController}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#E2E6E8] bg-[#F7F8F8] p-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white border border-[#E2E6E8] text-[#0B514B]">
                <Pencil size={22} strokeWidth={1.8} />
              </div>
              <div className="mt-3 text-sm font-bold text-[#17252B]">
                Blank drafting workspace
              </div>
              <p className="mt-1.5 text-xs text-[#647078] max-w-md mx-auto">
                Next step opens a blank coordinate drafting canvas. You can trace room boundary vertices directly and calibrate real-world dimensions.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E6E8] bg-white px-4 py-2.5 text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>Back to details</span>
          </button>

          <div className="flex items-center gap-3">
            {isPdfSelected && (
              <span className="text-xs text-amber-800">
                Visual drafting requires PNG, JPEG, or SVG. Replace PDF or switch to manual.
              </span>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={!canContinue}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                canContinue
                  ? "bg-[#0B514B] text-white shadow-xs hover:bg-[#073D38]"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <span>Continue to calibration & drafting</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
