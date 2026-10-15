"use client";

import React from "react";
import { useSafeSpaceStore } from "@/store/safespace-store";
import { MOBILITY_PROFILES } from "@/lib/spatial-model";
import { ChevronRight, ChevronLeft, Info } from "lucide-react";

// Line artwork icons matching 07-workspace-profile.png
function ProfileIcon({ id, className = "w-7 h-7 text-[#17252B]" }: { id: string; className?: string }) {
  if (id === "walker") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10" />
        <path d="M8 4l-2 17" />
        <path d="M16 4l2 17" />
        <path d="M7.5 11h9" />
        <path d="M6.5 17h11" />
      </svg>
    );
  }
  if (id === "cane") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10V8a4 4 0 0 1 8 0v13" />
        <path d="M14 21h4" />
      </svg>
    );
  }
  if (id === "wheelchair") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="2" />
        <path d="M12 7v5l4 3M10 13a5 5 0 1 0 5 5" />
        <path d="M16 19h3" />
      </svg>
    );
  }
  if (id === "independent") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13" cy="4" r="2" />
        <path d="M8 21l3-7 3 3 2 5" />
        <path d="M10 14l3-4 3 2 3-1" />
        <path d="M13 6l-1 4" />
      </svg>
    );
  }
  // limited-vision
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const PROFILE_SUBTITLES: Record<string, string> = {
  walker: "Requires additional stability and wider clearances.",
  cane: "Uses a cane for balance and support.",
  wheelchair: "Primary mobility device is a wheelchair.",
  independent: "No mobility aid required for typical movement.",
  "limited-vision": "May have reduced visibility and benefit from enhanced wayfinding.",
};

export function Stage2Profile() {
  const {
    activeProfileId,
    setProfile,
    activeProfile,
    updateProfile,
    setStage,
  } = useSafeSpaceStore();

  const minClearanceMm = activeProfile.minClearanceCm * 10;
  const turningSpaceMm = activeProfile.turningSpaceCm * 10;

  const minClearancePct = Math.max(0, Math.min(100, ((activeProfile.minClearanceCm - 60) / (150 - 60)) * 100));
  const turningSpacePct = Math.max(0, Math.min(100, ((activeProfile.turningSpaceCm - 100) / (200 - 100)) * 100));

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-[#F7F8F8] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto w-full bg-white rounded-2xl border border-[#E2E6E8] p-6 sm:p-8 shadow-xs space-y-7">
        {/* Header matching 07-workspace-profile.png */}
        <div>
          <span className="inline-block rounded-md bg-[#F0F3F4] px-2.5 py-1 text-xs font-semibold text-[#647078] mb-3">
            Step 2 of 5
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[#17252B]">
            Select mobility profile
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#647078] leading-relaxed">
            Choose the primary mobility profile for this assessment. These settings help us apply relevant accessibility criteria and identify potential risks.
          </p>
        </div>

        {/* 5 Profile Option Cards matching 07-workspace-profile.png */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {MOBILITY_PROFILES.map((p) => {
            const isSelected = p.id === activeProfileId;
            const subtitle = PROFILE_SUBTITLES[p.id] || p.description;

            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setProfile(p.id)}
                aria-pressed={isSelected}
                className={`p-4 rounded-xl text-left transition cursor-pointer flex flex-col justify-between min-h-[140px] relative ${
                  isSelected
                    ? "border-2 border-[#0B514B] bg-white shadow-2xs"
                    : "border border-[#E2E6E8] bg-white hover:border-slate-300"
                }`}
              >
                {/* Top row: Icon on left, Radio indicator on right */}
                <div className="flex items-start justify-between w-full">
                  <div className="p-0.5">
                    <ProfileIcon id={p.id} className="w-7 h-7 text-[#17252B]" />
                  </div>
                  <div
                    className={`size-5 rounded-full flex items-center justify-center border transition ${
                      isSelected
                        ? "border-[#0B514B]"
                        : "border-[#CBD5E1] bg-white"
                    }`}
                  >
                    {isSelected && (
                      <span className="size-2.5 rounded-full bg-[#0B514B]" />
                    )}
                  </div>
                </div>

                {/* Bottom title & description */}
                <div className="mt-3">
                  <h3 className="font-bold text-xs sm:text-sm text-[#17252B] leading-snug">
                    {p.name}
                  </h3>
                  <p className="text-[11px] text-[#647078] mt-1 line-clamp-2 leading-tight">
                    {subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Profile configuration section matching 07-workspace-profile.png */}
        <div className="rounded-xl border border-[#E2E6E8] p-5 sm:p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#17252B]">
              Profile configuration
            </h2>
            <p className="text-xs text-[#647078] mt-0.5">
              These are starting values based on the selected profile. Confirm and adjust for your specific space.
            </p>
          </div>

          {/* 2 Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Minimum clearance slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="min-clearance-slider" className="text-xs font-semibold text-[#17252B] cursor-pointer">
                    Minimum clearance
                  </label>
                  <Info className="w-3.5 h-3.5 text-[#647078]" />
                </div>
                <span className="text-sm font-bold text-[#17252B]">
                  {minClearanceMm.toLocaleString()} mm
                </span>
              </div>
              <p className="text-[11px] text-[#647078]">
                Minimum clear width for comfortable movement.
              </p>
              <input
                id="min-clearance-slider"
                type="range"
                min="60"
                max="150"
                step="5"
                aria-label="Minimum clearance in mm"
                value={activeProfile.minClearanceCm}
                onChange={(e) =>
                  updateProfile({ minClearanceCm: Number(e.target.value) })
                }
                style={{
                  background: `linear-gradient(to right, #0B514B ${minClearancePct}%, #E2E6E8 ${minClearancePct}%)`,
                }}
                className="safespace-slider w-full cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#647078]">
                <span>600 mm</span>
                <span>1,500 mm</span>
              </div>
            </div>

            {/* Turning space slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="turning-space-slider" className="text-xs font-semibold text-[#17252B] cursor-pointer">
                    Turning space
                  </label>
                  <Info className="w-3.5 h-3.5 text-[#647078]" />
                </div>
                <span className="text-sm font-bold text-[#17252B]">
                  {turningSpaceMm.toLocaleString()} mm
                </span>
              </div>
              <p className="text-[11px] text-[#647078]">
                Minimum turning diameter for safe manoeuvring.
              </p>
              <input
                id="turning-space-slider"
                type="range"
                min="100"
                max="200"
                step="5"
                aria-label="Turning space in mm"
                value={activeProfile.turningSpaceCm}
                onChange={(e) =>
                  updateProfile({ turningSpaceCm: Number(e.target.value) })
                }
                style={{
                  background: `linear-gradient(to right, #0B514B ${turningSpacePct}%, #E2E6E8 ${turningSpacePct}%)`,
                }}
                className="safespace-slider w-full cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#647078]">
                <span>1,000 mm</span>
                <span>2,000 mm</span>
              </div>
            </div>
          </div>

          {/* Additional needs (optional) toggles */}
          <div className="pt-2 border-t border-[#E2E6E8] space-y-3">
            <div>
              <h3 className="text-xs font-bold text-[#17252B]">
                Additional needs <span className="font-normal text-[#647078]">(optional)</span>
              </h3>
              <p className="text-[11px] text-[#647078] mt-0.5">
                Select any additional considerations for this profile.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Previous fall history */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={activeProfile.fallHistory}
                  onClick={() => updateProfile({ fallHistory: !activeProfile.fallHistory })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-0.5 ${
                    activeProfile.fallHistory ? "bg-[#0B514B]" : "bg-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      activeProfile.fallHistory ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <div>
                  <span className="text-xs font-semibold text-[#17252B] block">
                    Previous fall history
                  </span>
                  <p className="text-[11px] text-[#647078] leading-snug mt-0.5">
                    Increases attention to trip hazards and surface changes.
                  </p>
                </div>
              </div>

              {/* Requires support points */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={activeProfile.requiresSupport}
                  onClick={() => updateProfile({ requiresSupport: !activeProfile.requiresSupport })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-0.5 ${
                    activeProfile.requiresSupport ? "bg-[#0B514B]" : "bg-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      activeProfile.requiresSupport ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <div>
                  <span className="text-xs font-semibold text-[#17252B] block">
                    Requires support points
                  </span>
                  <p className="text-[11px] text-[#647078] leading-snug mt-0.5">
                    Identifies the need for handrails, grab bars, or stable surfaces.
                  </p>
                </div>
              </div>

              {/* Low-light sensitivity */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={activeProfile.lowLightSensitivity === "High"}
                  onClick={() =>
                    updateProfile({
                      lowLightSensitivity: activeProfile.lowLightSensitivity === "High" ? "Low" : "High",
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-0.5 ${
                    activeProfile.lowLightSensitivity === "High" ? "bg-[#0B514B]" : "bg-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      activeProfile.lowLightSensitivity === "High" ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <div>
                  <span className="text-xs font-semibold text-[#17252B] block">
                    Low-light sensitivity
                  </span>
                  <p className="text-[11px] text-[#647078] leading-snug mt-0.5">
                    Highlights areas that may need improved lighting and contrast.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer note alert box */}
          <div className="rounded-lg bg-[#F4F8FA] border border-[#E2E6E8] p-3.5 flex items-start gap-3 text-xs text-[#647078] leading-relaxed">
            <Info className="w-4 h-4 text-[#647078] shrink-0 mt-0.5" />
            <span>
              These values are starting points to help identify potential risks in this space. They should be confirmed and adjusted based on the specific needs of the individual and the actual environment. This is not a certification statement.
            </span>
          </div>
        </div>

        {/* Bottom Navigation Buttons matching 07-workspace-profile.png */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStage("layout")}
            className="py-2.5 px-4 rounded-lg border border-[#E2E6E8] bg-white hover:bg-[#F7F8F8] text-[#17252B] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to layout</span>
          </button>

          <button
            type="button"
            onClick={() => setStage("routes")}
            className="py-2.5 px-5 rounded-lg bg-[#0B514B] hover:bg-[#073D38] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <span>Continue to critical routes</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
