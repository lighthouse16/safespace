import Image from "next/image";
import Link from "next/link";
import floorplanPreview from "../../../public/landing/hero-floorplan-preview.png";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  AlertTriangle,
  ArrowRight,
  MoreHorizontal,
  Route as RouteIcon,
  Ruler,
} from "lucide-react";

export function HeroPreviewCard() {
  return (
    <div
      className="relative mx-auto w-full max-w-[840px] rounded-[24px] sm:rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.09)] overflow-hidden"
      role="region"
      aria-label="SafeSpace Workspace Preview"
    >
      {/* Window Top Bar / Header */}
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-2 border-b border-[#EEF2F5] px-4 py-2 sm:h-14 sm:px-6 sm:py-0">
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
            <span className="text-[#8C9BA5] cursor-default hidden sm:inline">Issues</span>
            <span className="text-[#8C9BA5] cursor-default hidden sm:inline">Report</span>
          </nav>
        </div>
        <span className="text-[10px] sm:text-xs font-semibold text-[#52636B] text-right">
          Illustrative sample · Not an assessment
        </span>
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
              src={floorplanPreview}
              alt="Illustrative floorplan with an example route overlay; not a completed assessment"
              width={450}
              height={366}
              priority
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* The landing example must not imply a completed, measured safety review. */}
        <aside className="w-full shrink-0 border-t border-[#EEF2F5] bg-white p-4 sm:p-5 md:w-[260px] md:border-l md:border-t-0 lg:w-[275px]"
          aria-label="Illustrative route insights">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold tracking-tight text-[#17252B]">Route insights</h3>
            <span className="rounded-full bg-[#F0F3F4] px-2 py-1 text-[10px] font-semibold text-[#52636B]">
              Sample only
            </span>
          </div>
          <div className="mt-4 rounded-xl border border-[#DCE7E5] bg-[#F5FAF8] p-4">
            <p className="text-sm font-semibold text-[#0B514B]">Not evaluated</p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#52636B]">
              Measurements appear after you calibrate a floorplan, set a mobility profile,
              and evaluate a route.
            </p>
          </div>
          <p className="mt-5 text-xs font-semibold text-[#17252B]">
            A real assessment can show
          </p>
          <ul className="mt-2.5 space-y-2.5 text-xs leading-relaxed text-[#52636B]">
            <li className="flex items-start gap-2">
              <RouteIcon size={15} className="mt-0.5 shrink-0 text-[#0B514B]" aria-hidden="true" />
              Computed path and feasibility
            </li>
            <li className="flex items-start gap-2">
              <Ruler size={15} className="mt-0.5 shrink-0 text-[#0B514B]" aria-hidden="true" />
              Modeled route clearance
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#0B514B]" aria-hidden="true" />
              Identified obstacles and unassessed scope
            </li>
          </ul>
          <p className="mt-5 border-t border-[#EEF2F5] pt-3 text-[11px] leading-relaxed text-[#7B8990]">
            No clinical safety or turning-maneuver compliance is verified by this preview.
          </p>
          <Link
            href="/assessments/new"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B514B] hover:underline"
          >
            Create an assessment <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
