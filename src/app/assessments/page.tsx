"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell";
import {
  loadPersistedAssessment,
  clearPersistedAssessment,
  saveActiveWorkspace,
  type PersistedAssessmentState,
} from "@/lib/storage/persistence";
import { useSafeSpaceStore, type WorkflowStage } from "@/store/safespace-store";

export default function AssessmentsPage() {
  const { hydrateFromStorage, resetToDemo } = useSafeSpaceStore();
  const [savedAssessment, setSavedAssessment] = useState<PersistedAssessmentState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const res = loadPersistedAssessment();
      if (res.success && res.data.assessmentType === "user") {
        setSavedAssessment(res.data);
      } else {
        setSavedAssessment(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenUserAssessment = (e: React.MouseEvent) => {
    setOpenError(null);
    const ok = saveActiveWorkspace("user");
    if (!ok) {
      e.preventDefault();
      setOpenError("Failed to persist active workspace selection to browser storage.");
      return;
    }
    hydrateFromStorage();
  };

  const handleOpenDemoAssessment = (e: React.MouseEvent, stage: WorkflowStage = "layout") => {
    setOpenError(null);
    const ok = saveActiveWorkspace("demo");
    if (!ok) {
      e.preventDefault();
      setOpenError("Failed to switch workspace: storage write failed. Your saved assessment remains safe.");
      return;
    }
    resetToDemo(stage);
  };

  const handleConfirmDelete = () => {
    setDeleteError(null);
    const res = clearPersistedAssessment();
    if (!res.success) {
      setDeleteError(res.error || "Failed to clear storage");
      return;
    }
    saveActiveWorkspace("demo");
    setSavedAssessment(null);
    setShowDeleteConfirm(false);
  };

  return (
    <AppShell
      activePath="/assessments"
      facilityName={savedAssessment?.metadata?.facilityName ?? null}
      workspaceLabel="SafeSpace workspace"
      storageLabel={savedAssessment ? "Saved on this device" : "Storage not connected"}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                SafeSpace Workspace
              </p>
              {savedAssessment && (
                <span
                  role="status"
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium border bg-emerald-50 text-emerald-800 border-emerald-200"
                >
                  Saved on this device
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#192329] sm:text-3xl">
              Assessments & Spaces
            </h1>
            <p className="mt-1.5 text-xs text-[#64748b]">
              Evaluate environmental fall risks, calibrate floorplans, and audit critical routes across living and care environments.
            </p>
          </div>

          <Link
            href="/assessments/new"
            className="inline-flex items-center justify-center rounded-lg bg-[#1e7168] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#175b54] transition cursor-pointer shrink-0"
          >
            + New assessment
          </Link>
        </header>

        {/* Real User Assessment or Empty State */}
        {savedAssessment ? (
          <section aria-labelledby="saved-assessment-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="saved-assessment-heading"
                className="text-xs font-semibold uppercase tracking-wider text-[#1e7168]"
              >
                Confirmed User Assessment
              </h2>
              <span className="text-[11px] text-emerald-700 font-medium">
                Saved on this device
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-xs">
              <div className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#192329]">
                      {savedAssessment.metadata?.facilityName || "Custom Facility"}
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                      Saved Assessment
                    </span>
                    <span className="text-slate-400 text-xs">·</span>
                    <span className="text-xs font-medium text-slate-600">
                      {savedAssessment.metadata?.spaceName || "Room"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Room perimeter: {savedAssessment.canonicalBoundary?.length ?? 0} boundary points · Calibrated ({savedAssessment.calibration?.pixelsPerCm.toFixed(1)} px/cm)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Saved: {savedAssessment.metadata?.updatedAt ? new Date(savedAssessment.metadata.updatedAt).toLocaleString() : "Recently"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setDeleteError(null);
                      setShowDeleteConfirm(true);
                    }}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                  >
                    Delete
                  </button>
                  <Link
                    href="/"
                    onClick={handleOpenUserAssessment}
                    className="rounded-lg bg-[#1e7168] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#175b54] transition cursor-pointer"
                  >
                    Open in workspace &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {openError && (
              <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {openError}
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowDeleteConfirm(false);
                }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
              >
                <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
                  <h3 id="delete-dialog-title" className="text-base font-bold text-slate-900">
                    Delete Saved Assessment?
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This will permanently delete this room assessment from your device. This action cannot be undone.
                  </p>
                  {deleteError && (
                    <div role="alert" className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                      {deleteError}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      autoFocus
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1e7168]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                    >
                      Delete Assessment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
            <div className="mx-auto size-11 rounded-full bg-slate-100 border border-slate-200 grid place-items-center text-slate-500">
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
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-[#192329]">
              No custom assessments saved yet
            </h2>
            <p className="mt-1 text-xs text-[#64748b] max-w-md mx-auto">
              Draft assessments stay in memory until finalized. Start a new assessment to measure your space and save it to this device.
            </p>
            <div className="mt-4">
              <Link
                href="/assessments/new"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Start an assessment
              </Link>
            </div>
          </div>
        )}

        {/* Labelled Example Clinic Section */}
        <section aria-labelledby="demo-fixtures-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="demo-fixtures-heading"
              className="text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Example Clinic Scenario
            </h2>
            <span className="text-[11px] text-slate-500">
              Explore a sample room layout and clearance audit
            </span>
          </div>

          {openError && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {openError}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#192329]">
                    Queen Care Clinic
                  </span>
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 border border-teal-200">
                    Example Clinic
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Waiting Area & Consultation Corridor · Pre-scripted baseline floorplan
                </p>
                <p className="text-[11px] text-slate-400">
                  Critical Route: Entrance &rarr; Reception &rarr; Waiting Seat &rarr; Consultation Room
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/"
                  onClick={(e) => handleOpenDemoAssessment(e, "analysis")}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  View sample analysis
                </Link>
                <Link
                  href="/"
                  onClick={(e) => handleOpenDemoAssessment(e, "layout")}
                  className="rounded-lg bg-[#1e7168] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#175b54] transition cursor-pointer"
                >
                  Open example clinic &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
