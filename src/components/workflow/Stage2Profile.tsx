"use client";

import React from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { MOBILITY_PROFILES } from "@/lib/spatial-model";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sliders,
} from "lucide-react";

export function Stage2Profile() {
  const {
    activeProfileId,
    setProfile,
    activeProfile,
    updateProfile,
    setStage,
  } = useSafeSpaceStore();

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-y-auto bg-[#f7f8f6] p-6 lg:p-8">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="border-b border-[#e2e8e4] pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1e7168]">
            Mobility Profile
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-0.5">
            <h1 className="text-xl font-bold text-[#192329] tracking-tight">
              Select Mobility Profile
            </h1>
            <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              Starting clearance values · Confirm for your space (Not statutory certification)
            </span>
          </div>
        </div>

        {/* Profile Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {MOBILITY_PROFILES.map((p) => {
            const isSelected = p.id === activeProfileId;

            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setProfile(p.id)}
                aria-pressed={isSelected}
                className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between min-h-[90px] ${
                  isSelected
                    ? "border-[#1e7168] bg-[#f0f7f5] ring-1 ring-[#1e7168]"
                    : "border-[#e2e8e4] bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-semibold text-xs text-[#192329] leading-snug">
                    {p.name}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1e7168] shrink-0" />
                  )}
                </div>

                <div className="text-[11px] font-mono text-slate-500 pt-2">
                  <span>{p.minClearanceCm} cm clear</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Concise Profile Adjustment Panel */}
        <div className="bg-white rounded-xl border border-[#e2e8e4] p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1e7168]" />
              <h2 className="font-semibold text-xs text-slate-900 uppercase tracking-wide">
                Clearance Targets · {activeProfile.name}
              </h2>
            </div>
            <span className="text-[10px] text-slate-500">
              Configured target for clearance calculations
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Minimum preferred clearance */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="min-clearance-slider" className="font-medium text-slate-700 cursor-pointer">
                  Minimum Clearance
                </label>
                <span className="font-mono font-bold text-[#1e7168]">
                  {activeProfile.minClearanceCm} cm
                </span>
              </div>
              <input
                id="min-clearance-slider"
                type="range"
                min="60"
                max="140"
                step="5"
                aria-label="Minimum clearance in cm"
                aria-valuemin={60}
                aria-valuemax={140}
                aria-valuenow={activeProfile.minClearanceCm}
                value={activeProfile.minClearanceCm}
                onChange={(e) =>
                  updateProfile({ minClearanceCm: Number(e.target.value) })
                }
                className="w-full accent-[#1e7168] cursor-pointer"
              />
            </div>

            {/* Turning space */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="turning-space-slider" className="font-medium text-slate-700 cursor-pointer">
                  Turning Space
                </label>
                <span className="font-mono font-bold text-[#1e7168]">
                  {activeProfile.turningSpaceCm} cm
                </span>
              </div>
              <input
                id="turning-space-slider"
                type="range"
                min="90"
                max="200"
                step="5"
                aria-label="Turning space in cm"
                aria-valuemin={90}
                aria-valuemax={200}
                aria-valuenow={activeProfile.turningSpaceCm}
                value={activeProfile.turningSpaceCm}
                onChange={(e) =>
                  updateProfile({ turningSpaceCm: Number(e.target.value) })
                }
                className="w-full accent-[#1e7168] cursor-pointer"
              />
            </div>

            {/* Previous fall history */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span id="fall-history-label" className="text-xs font-medium text-slate-700">
                Previous Fall History
              </span>
              <div
                role="radiogroup"
                aria-labelledby="fall-history-label"
                className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-200"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeProfile.fallHistory}
                  onClick={() => updateProfile({ fallHistory: true })}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    activeProfile.fallHistory
                      ? "bg-[#1e7168] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!activeProfile.fallHistory}
                  onClick={() => updateProfile({ fallHistory: false })}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    !activeProfile.fallHistory
                      ? "bg-[#1e7168] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {/* Requires stable support points */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span id="support-points-label" className="text-xs font-medium text-slate-700">
                Requires Support Points
              </span>
              <div
                role="radiogroup"
                aria-labelledby="support-points-label"
                className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-200"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeProfile.requiresSupport}
                  onClick={() => updateProfile({ requiresSupport: true })}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    activeProfile.requiresSupport
                      ? "bg-[#1e7168] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!activeProfile.requiresSupport}
                  onClick={() => updateProfile({ requiresSupport: false })}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    !activeProfile.requiresSupport
                      ? "bg-[#1e7168] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {/* Low-light sensitivity */}
            <div className="sm:col-span-2 flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span id="low-light-label" className="text-xs font-medium text-slate-700">
                Low-Light Sensitivity
              </span>
              <div
                role="radiogroup"
                aria-labelledby="low-light-label"
                className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-200"
              >
                {(["Low", "Moderate", "High"] as const).map((lvl) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={activeProfile.lowLightSensitivity === lvl}
                    key={lvl}
                    onClick={() => updateProfile({ lowLightSensitivity: lvl })}
                    className={`px-3 py-1 rounded text-xs font-medium transition cursor-pointer ${
                      activeProfile.lowLightSensitivity === lvl
                        ? "bg-[#1e7168] text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStage("layout")}
            className="py-2 px-3.5 rounded-lg border border-[#e2e8e4] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to Layout</span>
          </button>

          <button
            type="button"
            onClick={() => setStage("routes")}
            className="py-2 px-4 rounded-lg bg-[#1e7168] hover:bg-[#185e56] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <span>Continue to Critical Routes</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
