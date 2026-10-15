"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type UploadedFileInfo,
} from "./intake-view-types";
import {
  formatFileSize,
  validateFloorplanFile,
  verifyImageDecodable,
  type MockImageInstance,
} from "./intake-validation";
import { AsyncSelectionController } from "./candidate-url-manager";

export type FloorplanDropzoneProps = {
  currentFile: UploadedFileInfo | null;
  onFileSelect: (fileInfo: UploadedFileInfo) => void;
  onFileRemove: () => void;
  imageFactory?: () => MockImageInstance;
  revokeFn?: (url: string) => void;
  selectionController?: AsyncSelectionController;
};

export function FloorplanDropzone({
  currentFile,
  onFileSelect,
  onFileRemove,
  imageFactory,
  revokeFn,
  selectionController: externalController,
}: FloorplanDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [internalController] = useState(() => new AsyncSelectionController(revokeFn));
  const controller = externalController ?? internalController;

  useEffect(() => {
    const unsubscribe = controller.onInvalidate(() => {
      setValidationError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
    return () => {
      unsubscribe();
      controller.invalidate();
    };
  }, [controller]);

  const processFile = async (file: File) => {
    setValidationError(null);
    const validation = validateFloorplanFile(file);
    if (!validation.isValid) {
      controller.invalidate();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setValidationError(validation.error ?? "Invalid file selected.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const attemptId = controller.startAttempt(objectUrl);
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      const isDecodable = await verifyImageDecodable(objectUrl, imageFactory);
      if (!isDecodable) {
        const isCurrent = controller.rejectAttempt(attemptId, objectUrl);
        if (isCurrent) {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setValidationError(
            "This image could not be read. Choose a valid PNG, JPEG, or SVG file."
          );
        }
        return;
      }
    }

    const transferred = controller.transferUrl(attemptId, objectUrl);
    if (!transferred) {
      return;
    }

    const fileInfo: UploadedFileInfo = {
      file,
      name: file.name,
      size: file.size,
      type: file.type || (isPdf ? "application/pdf" : "image"),
      objectUrl,
      isPdf,
      previewAvailable: !isPdf,
    };

    onFileSelect(fileInfo);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleTriggerInput = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    controller.invalidate();
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onFileRemove();
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        id="floorplan-file-input"
        accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf"
        className="sr-only"
        onChange={handleInputChange}
        aria-label="Upload floorplan file"
      />

      {validationError && (
        <div
          role="alert"
          className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-xs text-[#991b1b]"
        >
          <div className="font-semibold">Unable to accept file</div>
          <div className="mt-0.5">{validationError}</div>
        </div>
      )}

      {!currentFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition ${
            dragOver
              ? "border-[#0B514B] bg-[#F7F8F8] ring-2 ring-[#0B514B]/20"
              : "border-[#CBD5E1] bg-white hover:bg-[#F7F8F8]"
          }`}
        >
          <div className="mx-auto flex size-12 items-center justify-center text-[#17252B]">
            <svg
              className="size-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="m9 15 3-3 3 3" />
            </svg>
          </div>

          <div className="mt-3 text-sm font-bold text-[#17252B]">
            Drag and drop your floorplan here
          </div>
          <p className="mt-1 text-xs text-[#647078]">
            Or select a file from your computer
          </p>

          <button
            type="button"
            onClick={handleTriggerInput}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-[#E2E6E8] bg-white px-4 py-2.5 text-xs font-semibold text-[#17252B] shadow-2xs hover:bg-[#F7F8F8] transition cursor-pointer"
          >
            Select floorplan file
          </button>

          <p className="mt-4 text-[11px] text-[#8C9BA5]">
            Supported formats: PNG, JPG, SVG (PDF preview only)
          </p>
          <p className="mt-0.5 text-[11px] text-[#8C9BA5]">
            Maximum file size: 25 MB
          </p>
          <p className="mt-1 text-[11px] text-[#647078]">
            Selected file stays on this device. No file is sent to external servers.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[#17252B] truncate max-w-sm">
                  {currentFile.name}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200 uppercase">
                  {currentFile.isPdf ? "PDF" : currentFile.name.split(".").pop()}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-[#647078]">
                {formatFileSize(currentFile.size)} · Kept on this device
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleTriggerInput}
              >
                Change file
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleRemove}
                className="text-[#dc2626] hover:text-[#b91c1c] hover:bg-red-50"
              >
                Remove
              </Button>
            </div>
          </div>

          {/* Local Preview */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {currentFile.previewAvailable ? (
              <div className="relative flex max-h-96 items-center justify-center p-2 bg-[#f8faf9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentFile.objectUrl}
                  alt={`Local floorplan preview of ${currentFile.name}`}
                  className="max-h-80 w-auto rounded object-contain border border-slate-200 bg-white shadow-2xs"
                />
              </div>
            ) : (
              <object
                data={currentFile.objectUrl}
                type="application/pdf"
                className="h-80 w-full rounded border border-slate-200 block"
                aria-label={`PDF preview of ${currentFile.name}`}
              >
                <div className="flex h-80 flex-col items-center justify-center p-6 text-center bg-slate-50">
                  <div className="mx-auto size-12 rounded-full bg-slate-100 border border-slate-200 grid place-items-center text-slate-500">
                    <svg
                      className="size-6 text-slate-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-[#17252B]">
                    {currentFile.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#647078]">
                    {formatFileSize(currentFile.size)} · PDF document
                  </div>
                  <p className="mt-2 text-[11px] text-[#647078] max-w-sm">
                    Embedded preview unavailable in this browser. File metadata recorded.
                  </p>
                </div>
              </object>
            )}
          </div>

          {currentFile.isPdf && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              <div className="font-semibold">Visual drafting requires PNG, JPEG, or SVG</div>
              <p className="mt-0.5 text-[11px] text-amber-800">
                In-browser scale calibration and boundary drafting require an image file. PDF documents cannot be visually traced on the canvas. Replace this file with an image or choose manual drawing.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
