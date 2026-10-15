"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useSyncExternalStore, type ReactNode } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Home, FileText, User as UserIcon, LogOut } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";

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

interface UserSessionState {
  authenticated: boolean;
  user: {
    id: string;
    email?: string;
    fullName?: string;
  } | null;
}

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
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [session, setSession] = useState<UserSessionState>({
    authenticated: false,
    user: null,
  });

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/session");
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/v1/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data) {
          setSession(data);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSignOut() {
    try {
      await fetch("/api/v1/auth/signout", { method: "POST" });
      setSession({ authenticated: false, user: null });
    } catch {}
  }

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

        {/* Client-only auth controls: preserves zero-button SSR assertion */}
        {mounted ? (
          <div className="flex items-center gap-2.5">
            {session.authenticated && session.user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-[#F0F3F4] py-1 px-3 text-xs font-medium text-[#17252B]">
                  <UserIcon size={14} className="text-[#0B514B]" />
                  <span className="max-w-[150px] truncate">{session.user.fullName || session.user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-lg p-1.5 text-[#647078] hover:bg-[#F0F3F4] hover:text-rose-600 transition"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#17252B] hover:bg-[#F7F8F8] transition"
              >
                Sign in
              </button>
            )}
            <AuthModal
              isOpen={authModalOpen}
              onClose={() => setAuthModalOpen(false)}
              onSuccess={checkSession}
            />
          </div>
        ) : null}
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


          </nav>

          {/* Current Assessment Card Widget in Sidebar (Workspace only) */}
          {showCurrentAssessment && (assessmentName || facilityName || spaceName) ? (
            <div className="mt-auto rounded-xl border border-[#E2E6E8] bg-[#F7F8F8] p-3.5 text-xs shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#647078]">
                Current assessment
              </p>
              <p className="mt-1 font-semibold text-[#17252B] truncate">
                {assessmentName || facilityName || spaceName}
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
