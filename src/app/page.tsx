import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import abstractFloorplan from "../../public/landing/abstract-floorplan@2x.png";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F8F8] text-[#17252B] flex items-center justify-center p-3 sm:p-6 lg:p-10">
      <main
        id="main-content"
        className="relative w-full max-w-[1240px] rounded-[24px] sm:rounded-[32px] border border-[#E2E6E8] bg-white p-6 sm:p-8 lg:p-10 xl:p-12 shadow-xs"
        role="main"
      >
        {/* Brand Logo & Wordmark - Top Left */}
        <div className="flex items-center">
          <Link
            href="/"
            aria-label="SafeSpace home"
            className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B514B]"
          >
            <span className="sr-only">SafeSpace</span>
            <BrandMark height={32} />
          </Link>
        </div>

        {/* Hero Section */}
        <section
          aria-labelledby="hero-title"
          className="mt-6 sm:mt-8 lg:mt-8 xl:mt-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8 xl:gap-12"
        >
          {/* Left Hero Content: Headline, Description & Single CTA */}
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col items-start z-10">
            <h1
              id="hero-title"
              className="text-3xl sm:text-5xl lg:text-4xl xl:text-[54px] font-bold tracking-tight leading-[1.08]"
            >
              <span className="block text-[#17252B]">Design safer</span>
              <span className="block text-[#0B514B] mt-1 whitespace-nowrap">movement paths</span>
            </h1>

            <p className="mt-5 sm:mt-6 text-base sm:text-lg leading-relaxed text-[#647078] max-w-[440px]">
              Review floorplans for accessibility and safety with clear, actionable spatial insight.
            </p>

            {/* Exactly one primary CTA */}
            <div className="mt-8 sm:mt-10">
              <Link
                href="/assessments/new"
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#0B514B] px-6 py-3.5 text-base font-semibold text-white shadow-xs hover:bg-[#073D38] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B514B]"
              >
                <span>Start assessment</span>
                <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Right Hero Preview: Abstract Architectural Floorplan Illustration */}
          <div className="lg:col-span-6 xl:col-span-7 flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-[580px] lg:max-w-none">
              <Image
                src={abstractFloorplan}
                alt="Abstract architectural floorplan illustration with movement paths"
                priority
                quality={95}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 58vw, 680px"
                className="w-full h-auto object-contain select-none pointer-events-none"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
