"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import {
  loadPersistedAssessment,
  savePersistedAssessment,
  saveActiveWorkspace,
  type PersistedAssessmentState,
} from "@/lib/storage/persistence";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { serverAssessmentService, type RemoteAssessmentSummary } from "@/lib/services/server-assessment-repository";
import { isCloudAccountsEnabled } from "@/lib/cloud-mode";

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return {
      push: (url: string) => {
        if (typeof window !== "undefined") {
          window.location.href = url;
        }
      },
    };
  }
}

export default function AssessmentsPage() {
  const router = useSafeRouter();
  const { hydrateFromStorage, clearUserAssessment, mediaCleanupWarning } = useSafeSpaceStore();
  const [savedAssessment, setSavedAssessment] = useState<PersistedAssessmentState | null>(null);
  const [remoteAssessments, setRemoteAssessments] = useState<RemoteAssessmentSummary[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletionWarning, setDeletionWarning] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    const res = loadPersistedAssessment();
    if (res.success && res.data.assessmentType === "user") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedAssessment(res.data);
    } else {
      setSavedAssessment(null);
    }

    if (isCloudAccountsEnabled()) serverAssessmentService.listAssessments().then((res) => {
      if (res.success && res.assessments) {
        setRemoteAssessments(res.assessments);
      }
    }).catch(() => {});
  }, []);

  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleOpenRemoteAssessment = async (id: string) => {
    setOpenError(null);
    const loadRes = await serverAssessmentService.getAssessment(id);
    if (loadRes.success) {
      savePersistedAssessment(loadRes.data);
      saveActiveWorkspace("user");
      hydrateFromStorage();
      router.push("/workspace");
    } else {
      setOpenError(loadRes.error || "Failed to load assessment from cloud storage.");
    }
  };


  const handleConfirmDelete = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      if (deleteTargetId) {
        const delRes = await serverAssessmentService.deleteAssessment(deleteTargetId);
        if (!delRes.success) {
          setDeleteError(delRes.error || "Failed to remove assessment from cloud.");
          setIsDeleting(false);
          return;
        }
        setRemoteAssessments((prev) => prev.filter((a) => a.id !== deleteTargetId));
      }

      if (!deleteTargetId || savedAssessment?.metadata?.id === deleteTargetId) {
        const res = await clearUserAssessment();
        if (!res.success && !deleteTargetId) {
          setDeleteError(res.error || "Failed to remove assessment data from this device.");
          setIsDeleting(false);
          return;
        }
        setSavedAssessment(null);
        if (res.warning) {
          setDeletionWarning(res.warning);
        }
      }

      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteError(`Deletion error: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <AppShell
      activePath="/assessments"
      facilityName={savedAssessment?.metadata?.facilityName ?? null}
      assessmentName={savedAssessment?.metadata?.name ?? null}
      spaceName={savedAssessment?.metadata?.spaceName ?? null}
      workspaceLabel="SafeSpace workspace"
      storageLabel={savedAssessment ? "Saved on this device" : "Local browser storage"}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#647078]">
                SafeSpace workspace
              </p>
              <span className="text-xs text-[#647078]">·</span>
              <span className="text-xs text-[#647078]">
                {savedAssessment ? "Saved on this device" : "Browser storage only"}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#17252B] sm:text-3xl">
              Assessments & Spaces
            </h1>
            <p className="mt-1.5 text-xs text-[#647078]">
              Evaluate pathway clearance, calibrate floorplans, and audit critical routes across living and care environments.
            </p>
          </div>

          <Link
            href="/assessments/new"
            className="inline-flex items-center justify-center rounded-lg bg-[#0B514B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#073D38] transition cursor-pointer shrink-0"
          >
            + New assessment
          </Link>
        </header>

        {/* Deletion Warning Banner */}
        {(deletionWarning || mediaCleanupWarning) && (
          <div
            role="status"
            aria-live="polite"
            data-testid="deletion-warning-banner"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Storage Notice: Media Absence Unverified
                </p>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {deletionWarning || mediaCleanupWarning}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletionWarning(null)}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                aria-label="Dismiss deletion warning"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Cloud Synced Assessments */}
        {remoteAssessments.length > 0 && (
          <section aria-labelledby="remote-assessments-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="remote-assessments-heading"
                className="text-xs font-semibold uppercase tracking-wider text-[#0B514B]"
              >
                Cloud Synced Assessments ({remoteAssessments.length})
              </h2>
              <span className="text-[11px] text-emerald-700 font-medium">
                Cloud Connected
              </span>
            </div>

            <div className="space-y-3">
              {remoteAssessments.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-xs p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-semibold text-sm text-[#17252B]">{item.name}</span>
                      <span className="text-xs text-slate-600">
                        {item.facilityName || "Custom Facility"} · {item.spaceName || "Room"} ({item.environmentType})
                      </span>
                    </div>
                    {item.notes && <p className="text-xs text-slate-600 line-clamp-1">{item.notes}</p>}
                    <p className="text-[11px] text-slate-400">
                      Updated: {new Date(item.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setDeleteTargetId(item.id);
                        setDeleteError(null);
                        setShowDeleteConfirm(true);
                      }}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleOpenRemoteAssessment(item.id)}
                      className="rounded-lg bg-[#0B514B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#073D38] transition cursor-pointer"
                    >
                      Open in workspace &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Real User Assessment or Empty State */}
        {savedAssessment && remoteAssessments.every((r) => r.id !== savedAssessment.metadata?.id) ? (
          <section aria-labelledby="saved-assessment-heading" className="space-y-3">

            <div className="flex items-center justify-between">
              <h2
                id="saved-assessment-heading"
                className="text-xs font-semibold uppercase tracking-wider text-[#0B514B]"
              >
                Saved assessment
              </h2>
              <span className="text-[11px] text-emerald-700 font-medium">
                Saved on this device
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-xs">
              <div className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-semibold text-sm text-[#17252B]">
                      {savedAssessment.metadata?.name || "Custom assessment"}
                    </span>
                    <span className="text-xs text-slate-600">
                      {savedAssessment.metadata?.facilityName || "Custom Facility"} · {savedAssessment.metadata?.spaceName || "Room"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Room perimeter: {savedAssessment.canonicalBoundary?.length ?? 0} boundary points · Calibrated ({savedAssessment.calibration?.realLength} {savedAssessment.calibration?.unit || "cm"} reference)
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
                    href="/workspace"
                    onClick={handleOpenUserAssessment}
                    className="rounded-lg bg-[#0B514B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#073D38] transition cursor-pointer"
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
                      disabled={isDeleting}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0B514B]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleConfirmDelete}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-xs font-semibold text-white transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                    >
                      {isDeleting ? "Deleting..." : deleteError ? "Retry Deletion" : "Delete Assessment"}
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
            <h2 className="mt-3 text-sm font-semibold text-[#17252B]">
              No custom assessments saved yet
            </h2>
            <p className="mt-1 text-xs text-[#647078] max-w-md mx-auto">
              No account is needed. Create an assessment to draft your space and save it in this browser. Data does not automatically transfer to other devices.
            </p>
            <div className="mt-4">
              <Link
                href="/assessments/new"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                + Start an assessment
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
