import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import abstractFloorplan from "../../public/landing/abstract-floorplan@2x.webp";
import decorArc from "../../public/landing/decor-arc-bottom-left.png";

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full bg-white text-[#17252B] overflow-x-hidden flex flex-col justify-between">
      {/* Decorative ambient bottom-left architectural arc and dimension line */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-[280px] sm:w-[360px] lg:w-[440px] select-none z-0">
        <Image
          src={decorArc}
          alt=""
          priority
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Top Header with Brand Logo */}
      <header className="w-full px-8 sm:px-14 lg:px-20 xl:px-28 2xl:px-32 pt-10 sm:pt-12 lg:pt-14 z-20">
        <div className="w-full flex items-center">
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
        className="w-full flex-1 flex flex-col lg:flex-row items-center justify-between px-8 sm:px-14 lg:pl-20 xl:pl-28 2xl:pl-32 lg:pr-0 py-6 sm:py-8 lg:py-0 z-10"
        role="main"
      >
        {/* Left Column: Headline, Description & Single Primary CTA */}
        <div className="w-full lg:w-[46%] xl:w-[42%] flex flex-col items-start z-10 py-6 lg:py-12">
          <h1
            id="hero-title"
            className="text-4xl sm:text-5xl lg:text-5xl xl:text-[56px] font-bold tracking-tight leading-[1.08]"
          >
            <span className="block text-[#17252B]">Design safer</span>
            <span className="block text-[#0B514B] mt-1 whitespace-nowrap">movement paths</span>
          </h1>

          <p className="mt-5 sm:mt-6 text-base sm:text-lg leading-relaxed text-[#647078] max-w-md">
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

        {/* Right Column: Isometric Architectural Floorplan Illustration */}
        <div className="w-full lg:w-[54%] xl:w-[58%] flex items-center justify-end overflow-visible">
          <div className="relative w-full max-w-[620px] lg:max-w-none flex justify-end">
            <Image
              src={abstractFloorplan}
              alt="Abstract architectural floorplan illustration with movement paths"
              priority
              quality={95}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 54vw, 58vw"
              className="w-full h-auto max-h-[88vh] object-contain object-right select-none pointer-events-none"
            />
          </div>
        </div>
      </main>

      {/* Subtle bottom spacing buffer to balance composition */}
      <div className="h-6 sm:h-10 lg:h-12 pointer-events-none" />
    </div>
  );
}
