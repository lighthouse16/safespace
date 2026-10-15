import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  Home,
  FileText,
  Building2,
  Users,
  Settings,
} from "lucide-react";

export type AppShellProps = {
  children?: ReactNode;
  activePath?: string;
  facilityName?: string | null;
  assessmentName?: string | null;
  spaceName?: string | null;
  workspaceLabel?: string;
  storageLabel?: string;
  showCurrentAssessment?: boolean;
  fullHeight?: boolean;
};

export function AppShell({
  children,
  activePath = "/assessments",
  facilityName,
  assessmentName,
  spaceName,
  showCurrentAssessment = false,
  fullHeight = false,
}: AppShellProps) {
  const isAssessmentsActive = activePath.startsWith("/assessments");

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-[#F7F8F8] text-[#17252B]">
      {/* Top Application Header */}
      <header className="shrink-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#E2E6E8] bg-white px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="SafeSpace home" className="shrink-0">
            <BrandMark />
          </Link>
          {facilityName ? (
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="text-[#E2E6E8]" aria-hidden="true">/</span>
              <span className="font-medium text-[#17252B]">{facilityName}</span>
            </div>
          ) : null}
        </div>

        {/* Header Right Actions: Help & User Profile Avatar */}
        <div className="flex items-center gap-3">
          <a
            href="#help"
            aria-label="Help and support"
            className="flex size-8 items-center justify-center rounded-full border border-[#E2E6E8] text-xs font-semibold text-[#647078] hover:border-[#CBD5E1] hover:text-[#17252B] transition-colors"
          >
            ?
          </a>
          <a
            href="#profile"
            aria-label="User profile Jordan Diaz"
            className="flex items-center gap-2 rounded-full border border-[#E2E6E8] py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition-colors"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-[#E2E6E8] text-[11px] font-bold text-[#17252B]">
              JD
            </span>
            <span className="text-[9px] text-[#647078]" aria-hidden="true">
              ▼
            </span>
          </a>
        </div>
      </header>

      {/* Main Layout Body: Left Sidebar + Content Canvas */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Navigation Sidebar */}
        <aside
          aria-label="Workspace navigation"
          className="hidden w-52 shrink-0 flex-col justify-between border-r border-[#E2E6E8] bg-white p-3.5 md:flex h-full overflow-y-auto"
        >
          <nav className="space-y-1 text-[13px] font-medium">
            <Link
              href="/"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                activePath === "/"
                  ? "bg-[#F0F3F4] text-[#17252B] font-semibold"
                  : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
              }`}
            >
              <Home size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>Home</span>
            </Link>

            <Link
              href="/assessments"
              aria-current={isAssessmentsActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                isAssessmentsActive
                  ? "bg-[#F0F3F4] text-[#17252B] font-semibold"
                  : "text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B]"
              }`}
            >
              <FileText size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>Assessments</span>
            </Link>

            <Link
              href="#locations"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B] transition-colors"
            >
              <Building2 size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>Locations</span>
            </Link>

            <Link
              href="#team"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B] transition-colors"
            >
              <Users size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>Team</span>
            </Link>

            <Link
              href="#settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-[#647078] hover:bg-[#F7F8F8] hover:text-[#17252B] transition-colors"
            >
              <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>Settings</span>
            </Link>
          </nav>

          {/* Current Assessment Card Widget in Sidebar (Workspace only) */}
          {showCurrentAssessment && (assessmentName || facilityName || spaceName) ? (
            <div className="mt-auto rounded-xl border border-[#E2E6E8] bg-[#F7F8F8] p-3.5 text-xs shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#647078]">
                Current assessment
              </p>
              <p className="mt-1 font-semibold text-[#17252B] truncate">
                {assessmentName || "Unit A12 accessibility review"}
              </p>
              {facilityName ? (
                <p className="text-[#647078] truncate">{facilityName}</p>
              ) : null}
              {spaceName ? (
                <p className="text-[#647078] truncate">{spaceName}</p>
              ) : null}
              <Link
                href="/assessments"
                className="mt-3 inline-flex items-center gap-1 font-medium text-[#0B514B] hover:underline"
              >
                &larr; Back to assessments
              </Link>
            </div>
          ) : null}
        </aside>

        {/* Main Content Viewport */}
        <main
          id="main-content"
          className={`flex-1 min-h-0 ${
            fullHeight
              ? "overflow-hidden p-0 flex flex-col"
              : "overflow-y-auto px-4 py-6 sm:px-6 md:px-8"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
