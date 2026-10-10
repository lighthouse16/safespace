"use client";

import { useSafeSpaceStore } from "@/store/safespace-store";

export function AnalysisTransition() {
  const { isTransitioning } = useSafeSpaceStore();

  if (!isTransitioning) return null;

  return null;
}

