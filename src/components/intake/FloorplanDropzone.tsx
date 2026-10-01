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
};

export function FloorplanDropzone({
  currentFile,
  onFileSelect,
  onFileRemove,
  imageFactory,
  revokeFn,
}: FloorplanDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [controller] = useState(() => new AsyncSelectionController(revokeFn));

  useEffect(() => {
    return () => {
      controller.dispose();
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
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver
              ? "border-[#1e7168] bg-[#e8f3f1]"
              : "border-slate-300 bg-slate-50 hover:bg-slate-100/60"
          }`}
        >
          <div className="size-10 rounded-full bg-white border border-slate-200 grid place-items-center text-slate-500 shadow-2xs">
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div className="mt-3 text-sm font-semibold text-[#192329]">
            Drag and drop floorplan here, or browse
          </div>
          <p className="mt-1 text-xs text-[#64748b]">
            Supported formats: PNG, JPEG, SVG, PDF (up to 25 MB)
          </p>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleTriggerInput}
            className="mt-4"
          >
            Select floorplan file
          </Button>

          <div className="mt-4 text-[11px] text-[#94a3b8]">
            Selected file stays in your browser session only. No file is sent to any remote server.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[#192329] truncate max-w-sm">
                  {currentFile.name}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200 uppercase">
                  {currentFile.isPdf ? "PDF" : currentFile.name.split(".").pop()}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-[#64748b]">
                {formatFileSize(currentFile.size)} · In-browser session only
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
                  <div className="mt-2 text-xs font-semibold text-[#192329]">
                    {currentFile.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#64748b]">
                    {formatFileSize(currentFile.size)} · PDF document
                  </div>
                  <p className="mt-2 text-[11px] text-[#64748b] max-w-sm">
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
