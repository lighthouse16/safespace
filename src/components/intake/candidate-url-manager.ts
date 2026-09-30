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
