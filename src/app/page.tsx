import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import abstractFloorplan from "../../public/landing/abstract-floorplan@2x.webp";
import decorArc from "../../public/landing/decor-arc-bottom-left.png";

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full bg-white text-[#17252B] overflow-x-hidden flex flex-col justify-between">
      {/* Decorative ambient bottom-left architectural arc */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-[220px] sm:w-[300px] select-none z-0">
        <Image
          src={decorArc}
          alt=""
          priority
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Top Header with Brand Logo */}
      <header className="w-full px-6 pt-8 sm:px-12 sm:pt-10 lg:px-16 lg:pt-12 z-20">
        <div className="max-w-7xl mx-auto flex items-center">
          <Link
            href="/"
            aria-label="SafeSpace home"
            className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B514B]"
          >
            <span className="sr-only">SafeSpace</span>
            <BrandMark height={34} />
          </Link>
        </div>
      </header>

      {/* Main Hero Section */}
      <main
        id="main-content"
        className="w-full flex-1 flex items-center px-6 sm:px-12 lg:px-16 py-6 sm:py-10 z-10"
        role="main"
      >
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Headline, Description & Single Primary CTA */}
          <div className="lg:col-span-5 flex flex-col items-start z-10">
            <h1
              id="hero-title"
              className="text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.08]"
            >
              <span className="block text-[#17252B]">Design safer</span>
              <span className="block text-[#0B514B] mt-1 whitespace-nowrap">movement paths</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg leading-relaxed text-[#647078] max-w-md">
              Review floorplans for accessibility and safety with clear, actionable spatial insight.
            </p>

            {/* Exactly one primary CTA */}
            <div className="mt-8 sm:mt-10">
              <Link
                href="/assessments/new"
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#0B514B] px-7 py-3.5 text-base font-semibold text-white shadow-xs hover:bg-[#073D38] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B514B]"
              >
                <span>Start assessment</span>
                <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Right Column: Abstract Architectural Floorplan Illustration */}
          <div className="lg:col-span-7 flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-[640px] lg:max-w-none">
              <Image
                src={abstractFloorplan}
                alt="Abstract architectural floorplan illustration with movement paths"
                priority
                quality={95}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 58vw, 740px"
                className="w-full h-auto object-contain select-none pointer-events-none"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Subtle bottom spacing buffer to balance composition */}
      <div className="h-6 sm:h-10 lg:h-12 pointer-events-none" />
    </div>
  );
}
