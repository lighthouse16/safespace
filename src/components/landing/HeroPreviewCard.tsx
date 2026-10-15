import Image from "next/image";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  AlertTriangle,
  Check,
  MoreHorizontal,
  Route as RouteIcon,
  Ruler,
  X,
  Accessibility,
} from "lucide-react";

export function HeroPreviewCard() {
  return (
    <div
      className="relative mx-auto w-full max-w-[840px] rounded-[24px] sm:rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.09)] overflow-hidden"
      role="region"
      aria-label="SafeSpace Workspace Preview"
    >
      {/* Window Top Bar / Header */}
      <div className="flex h-14 items-center justify-between border-b border-[#EEF2F5] px-4 sm:px-6">
        <div className="flex items-center gap-6 sm:gap-8">
          <BrandMark height={22} className="shrink-0" />
          <nav
            aria-label="Preview navigation tabs"
            className="flex items-center gap-5 sm:gap-6 text-xs sm:text-sm font-medium"
          >
            <div className="relative py-4 font-semibold text-[#0B514B]">
              <span>Floorplan</span>
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-[#0B514B]" />
            </div>
            <span className="text-[#8C9BA5] cursor-default hidden sm:inline">Assessment</span>
            <span className="text-[#8C9BA5] cursor-default hidden sm:inline">Issues</span>
            <span className="text-[#8C9BA5] cursor-default hidden sm:inline">Report</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-[#073D38] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0B514B] cursor-default"
          >
            Export report
          </button>
          <div
            aria-hidden="true"
            className="flex size-7.5 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#718096] cursor-default"
          >
            <span className="font-bold tracking-widest text-xs leading-none">···</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex flex-col md:flex-row bg-[#FAFBFB]">
        {/* Left Tool Rail */}
        <div className="hidden md:flex w-[68px] shrink-0 flex-col items-center border-r border-[#EEF2F5] bg-white py-4 gap-3 text-[10px]">
          {/* Select Tool (Active) */}
          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#E8F2EE] text-[#073D38] shadow-2xs">
            <svg
              className="size-4 -rotate-12 translate-x-0.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M4 2L20 10L12 12L10 20L4 2Z" />
            </svg>
            <span className="text-[10px] font-bold mt-0.5">Select</span>
          </div>

          {/* Routes Tool */}
          <div className="flex flex-col items-center justify-center w-12 h-11 text-[#718096] gap-1 hover:text-[#17252B] transition-colors cursor-default">
            <RouteIcon size={16} strokeWidth={2} />
            <span className="text-[10px] font-medium">Routes</span>
          </div>

          {/* Issues Tool */}
          <div className="flex flex-col items-center justify-center w-12 h-11 text-[#718096] gap-1 hover:text-[#17252B] transition-colors cursor-default">
            <AlertTriangle size={16} strokeWidth={2} />
            <span className="text-[10px] font-medium">Issues</span>
          </div>

          {/* Measure Tool */}
          <div className="flex flex-col items-center justify-center w-12 h-11 text-[#718096] gap-1 hover:text-[#17252B] transition-colors cursor-default">
            <Ruler size={16} strokeWidth={2} />
            <span className="text-[10px] font-medium">Measure</span>
          </div>

          {/* More Tool (Pinned Bottom) */}
          <div className="mt-auto flex flex-col items-center justify-center w-12 h-11 text-[#718096] gap-1 hover:text-[#17252B] transition-colors cursor-default">
            <MoreHorizontal size={16} strokeWidth={2} />
            <span className="text-[10px] font-medium">More</span>
          </div>
        </div>

        {/* Center Canvas Area */}
        <div className="flex-1 p-2.5 sm:p-3 flex items-center justify-center overflow-hidden">
          <div className="relative w-full max-w-[460px] aspect-[450/366] rounded-xl sm:rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
            <Image
              src="/landing/hero-floorplan-preview.png"
              alt="SafeSpace Floorplan Accessibility Evaluation and Movement Route Map"
              width={450}
              height={366}
              priority
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Right Inspection Sidebar */}
        <div className="w-full md:w-[260px] lg:w-[275px] shrink-0 border-t md:border-t-0 md:border-l border-[#EEF2F5] bg-white p-4 sm:p-5 flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <span className="font-bold text-[#111827] text-sm tracking-tight">Movement route</span>
              <X size={15} className="text-[#9CA3AF] cursor-default" />
            </div>

            {/* Route 1 Card */}
            <div className="rounded-xl border border-[#E5E9EB] bg-white p-3 flex items-center gap-3 shadow-2xs">
              <div className="size-9 shrink-0 rounded-xl bg-[#E6F0EE] flex items-center justify-center text-[#0B514B]">
                <Accessibility size={18} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs text-[#111827] leading-tight">Route 1</p>
                <p className="text-[11px] text-[#6B7280] leading-tight mt-0.5">Accessible route</p>
              </div>
            </div>

            {/* Metrics Dual Card */}
            <div className="grid grid-cols-2 rounded-xl border border-[#E5E9EB] bg-white divide-x divide-[#E5E9EB] p-2.5 sm:p-3 text-left shadow-2xs">
              <div className="pr-2">
                <p className="text-sm sm:text-base font-bold text-[#111827] leading-none">32 m</p>
                <p className="text-[10px] text-[#6B7280] mt-1 leading-tight">Route length</p>
              </div>
              <div className="pl-3">
                <p className="text-sm sm:text-base font-bold text-[#111827] leading-none">1.2 m</p>
                <p className="text-[10px] text-[#6B7280] mt-1 leading-tight">Min. width</p>
              </div>
            </div>

            {/* Compliance Checklist */}
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center gap-2.5 text-[#374151]">
                <div className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[#3B8A61] text-white">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span className="font-medium text-[12px]">Step free</span>
              </div>
              <div className="flex items-center gap-2.5 text-[#374151]">
                <div className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[#3B8A61] text-white">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span className="font-medium text-[12px]">Compliant width</span>
              </div>
              <div className="flex items-center gap-2.5 text-[#374151]">
                <div className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[#3B8A61] text-white">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span className="font-medium text-[12px]">Clear turning space</span>
              </div>
              <div className="flex items-center gap-2.5 text-[#374151]">
                <div className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[#3B8A61] text-white">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span className="font-medium text-[12px]">No major obstructions</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
