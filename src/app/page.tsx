import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileUp,
  Footprints,
  SlidersHorizontal,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { HeroPreviewCard } from "@/components/landing/HeroPreviewCard";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F8F8] text-[#17252B]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-[#E2E6E8] bg-white">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" aria-label="SafeSpace home">
            <BrandMark />
          </Link>

          {/* Center Navigation Links */}
          <nav aria-label="Public navigation" className="hidden items-center gap-8 text-sm font-medium text-[#647078] md:flex">
            <div className="flex items-center gap-1 hover:text-[#17252B] cursor-pointer">
              <span>Product</span>
              <ChevronDown size={14} className="text-[#647078]" />
            </div>
            <div className="flex items-center gap-1 hover:text-[#17252B] cursor-pointer">
              <span>Use cases</span>
              <ChevronDown size={14} className="text-[#647078]" />
            </div>
            <div className="flex items-center gap-1 hover:text-[#17252B] cursor-pointer">
              <span>Resources</span>
              <ChevronDown size={14} className="text-[#647078]" />
            </div>
            <Link href="#pricing" className="hover:text-[#17252B]">
              Pricing
            </Link>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/assessments/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0B514B] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#073D38] transition-colors"
            >
              <span>Start assessment</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* Hero Section */}
        <section aria-labelledby="hero-title" className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Hero Content */}
            <div className="lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#647078]">
                ACCESSIBILITY INSIGHTS FOR SAFER SPACES
              </p>
              <h1
                id="hero-title"
                className="mt-4 text-4xl font-extrabold tracking-tight text-[#17252B] sm:text-5xl lg:text-6xl lg:leading-[1.1]"
              >
                Check your space <br />
                for safer movement
              </h1>
              <p className="mt-6 text-base leading-relaxed text-[#647078] sm:text-lg">
                SafeSpace helps teams review room layouts, walking routes, and accessibility risks using a floorplan-based workflow.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/assessments/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0B514B] px-6 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-[#073D38] transition-colors"
                >
                  <span>Start assessment</span>
                  <ArrowRight size={16} />
                </Link>
              </div>

              {/* Checklist */}
              <div className="mt-8 flex flex-wrap items-center gap-6 text-xs font-medium text-[#17252B]">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-[#0B514B]" strokeWidth={2.5} />
                  <span>Floorplan-based workflow</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-[#0B514B]" strokeWidth={2.5} />
                  <span>Built for teams</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-[#0B514B]" strokeWidth={2.5} />
                  <span>Actionable insights</span>
                </div>
              </div>
            </div>

            {/* Right Hero Preview Card (Floating 2D Workspace Mockup matching 01-landing.png) */}
            <div className="lg:col-span-7">
              <HeroPreviewCard />
            </div>
          </div>
        </section>

        {/* 3 Process Steps Section with Connected Arrows */}
        <section aria-labelledby="process-heading" className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <h2 id="process-heading" className="sr-only">How SafeSpace Works</h2>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Step 1 */}
            <div className="flex-1 rounded-2xl border border-[#E2E6E8] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-4">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#F0F3F4] text-xs font-bold text-[#17252B]">
                  1
                </span>
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#E6F0EE] text-[#0B514B]">
                  <FileUp size={20} strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-[#17252B]">Import a floorplan</h3>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[#647078]">
                Upload your existing floorplan (PDF, PNG or DWG) and get started in seconds.
              </p>
            </div>

            <ArrowRight size={20} className="hidden md:block text-[#647078] shrink-0" aria-hidden="true" />

            {/* Step 2 */}
            <div className="flex-1 rounded-2xl border border-[#E2E6E8] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-4">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#F0F3F4] text-xs font-bold text-[#17252B]">
                  2
                </span>
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#E6F0EE] text-[#0B514B]">
                  <Footprints size={20} strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-[#17252B]">Review movement routes</h3>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[#647078]">
                Map walking routes, check accessibility and identify potential risks.
              </p>
            </div>

            <ArrowRight size={20} className="hidden md:block text-[#647078] shrink-0" aria-hidden="true" />

            {/* Step 3 */}
            <div className="flex-1 rounded-2xl border border-[#E2E6E8] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-4">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#F0F3F4] text-xs font-bold text-[#17252B]">
                  3
                </span>
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#E6F0EE] text-[#0B514B]">
                  <SlidersHorizontal size={20} strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-[#17252B]">Improve the layout</h3>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[#647078]">
                Make informed changes and export a clear report for your team.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-[#E2E6E8] bg-white py-6 text-center text-xs text-[#647078]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8">
          <span>© {new Date().getFullYear()} SafeSpace</span>
          <span>Spatial clarity for more accessible spaces.</span>
        </div>
      </footer>
    </div>
  );
}
