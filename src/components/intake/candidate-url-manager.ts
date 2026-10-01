import type { UploadedFileInfo, SourceType } from "./intake-view-types";

export type PendingSourceChange =
  | { type: "switch_source"; targetSource: SourceType }
  | { type: "replace_file"; candidateFile: UploadedFileInfo }
  | { type: "remove_file" };

export type CandidateUrlState = {
  activeUrl: string | null;
  candidateUrl: string | null;
};

/**
 * Registers a new candidate object URL, revoking any abandoned candidate URL.
 */
export function registerCandidateUrl(
  state: CandidateUrlState,
  newCandidateUrl: string,
  revokeFn: (url: string) => void = (url) => URL.revokeObjectURL(url)
): CandidateUrlState {
  if (state.candidateUrl && state.candidateUrl !== newCandidateUrl) {
    revokeFn(state.candidateUrl);
  }
  return {
    activeUrl: state.activeUrl,
    candidateUrl: newCandidateUrl,
  };
}

/**
 * Cancels a candidate replacement, revoking the candidate URL while leaving active URL intact.
 */
export function cancelCandidateUrl(
  state: CandidateUrlState,
  revokeFn: (url: string) => void = (url) => URL.revokeObjectURL(url)
): CandidateUrlState {
  if (state.candidateUrl) {
    revokeFn(state.candidateUrl);
  }
  return {
    activeUrl: state.activeUrl,
    candidateUrl: null,
  };
}

/**
 * Confirms a candidate replacement, revoking the previous active URL and adopting candidate as active.
 */
export function confirmCandidateUrl(
  state: CandidateUrlState,
  revokeFn: (url: string) => void = (url) => URL.revokeObjectURL(url)
): CandidateUrlState {
  if (state.activeUrl && state.activeUrl !== state.candidateUrl) {
    revokeFn(state.activeUrl);
  }
  return {
    activeUrl: state.candidateUrl,
    candidateUrl: null,
  };
}

/**
 * Disposes any active candidate URL when superseding with a non-replacement action.
 */
export function disposeCandidateUrl(
  state: CandidateUrlState,
  revokeFn: (url: string) => void = (url) => URL.revokeObjectURL(url)
): CandidateUrlState {
  if (state.candidateUrl) {
    revokeFn(state.candidateUrl);
  }
  return {
    activeUrl: state.activeUrl,
    candidateUrl: null,
  };
}

/**
 * Confirms remove_file action, revoking both the active URL and any candidate URL.
 */
export function confirmRemoveUrl(
  state: CandidateUrlState,
  revokeFn: (url: string) => void = (url) => URL.revokeObjectURL(url)
): CandidateUrlState {
  if (state.candidateUrl) {
    revokeFn(state.candidateUrl);
  }
  if (state.activeUrl && state.activeUrl !== state.candidateUrl) {
    revokeFn(state.activeUrl);
  }
  return {
    activeUrl: null,
    candidateUrl: null,
  };
}

/**
 * Controller for tracking asynchronous file selection attempts in FloorplanDropzone.
 * Guarantees that only the latest valid attempt can transfer object URLs or mutate visible state.
 */
export class AsyncSelectionController {
  private currentAttemptId = 0;
  private pendingUrls = new Set<string>();
  private revokeFn: (url: string) => void;
  private onInvalidateCallbacks = new Set<() => void>();

  constructor(revokeFn: (url: string) => void = (url) => URL.revokeObjectURL(url)) {
    this.revokeFn = revokeFn;
  }

  onInvalidate(cb: () => void): () => void {
    this.onInvalidateCallbacks.add(cb);
    return () => {
      this.onInvalidateCallbacks.delete(cb);
    };
  }

  startAttempt(objectUrl?: string): number {
    this.currentAttemptId += 1;
    this.revokePending();
    if (objectUrl) {
      this.pendingUrls.add(objectUrl);
    }
    return this.currentAttemptId;
  }

  isCurrent(attemptId: number): boolean {
    return attemptId === this.currentAttemptId;
  }

  transferUrl(attemptId: number, objectUrl: string): boolean {
    if (attemptId !== this.currentAttemptId) {
      if (this.pendingUrls.has(objectUrl)) {
        this.revokeFn(objectUrl);
        this.pendingUrls.delete(objectUrl);
      }
      return false;
    }
    // Transferred to parent state; no longer owned by dropzone
    this.pendingUrls.delete(objectUrl);
    return true;
  }

  rejectAttempt(attemptId: number, objectUrl?: string): boolean {
    if (objectUrl && this.pendingUrls.has(objectUrl)) {
      this.revokeFn(objectUrl);
      this.pendingUrls.delete(objectUrl);
    }
    return attemptId === this.currentAttemptId;
  }

  invalidate(): void {
    this.currentAttemptId += 1;
    this.revokePending();
    for (const cb of Array.from(this.onInvalidateCallbacks)) {
      try {
        cb();
      } catch {
        // Suppress subscriber errors during invalidation
      }
    }
  }

  private revokePending(): void {
    for (const url of this.pendingUrls) {
      this.revokeFn(url);
    }
    this.pendingUrls.clear();
  }

  dispose(): void {
    this.invalidate();
    this.onInvalidateCallbacks.clear();
  }

  getPendingUrls(): string[] {
    return Array.from(this.pendingUrls);
  }
}

/**
 * Cleans up all managed URLs on unmount idempotently.
 */
export function cleanupAllUrls(
  state: CandidateUrlState,
  revokeFn: (url: string) => void = (url) => URL.revokeObjectURL(url)
): CandidateUrlState {
  if (state.candidateUrl) {
    revokeFn(state.candidateUrl);
  }
  if (state.activeUrl && state.activeUrl !== state.candidateUrl) {
    revokeFn(state.activeUrl);
  }
  return {
    activeUrl: null,
    candidateUrl: null,
  };
}
