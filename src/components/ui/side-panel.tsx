import React from "react";

export interface SidePanelProps {
  children: React.ReactNode;
  className?: string;
  width?: string;
  ariaLabel?: string;
}

export function SidePanel({
  children,
  className = "",
  width = "w-80 sm:w-96 lg:w-[420px]",
  ariaLabel = "Side Panel",
}: SidePanelProps) {
  return (
    <aside
      aria-label={ariaLabel}
      className={`h-full shrink-0 border-l border-[#e2e8e4] bg-white flex flex-col justify-between select-none z-10 ${width} ${className}`}
    >
      {children}
    </aside>
  );
}

export function SidePanelHeader({
  title,
  subtitle,
  badge,
  action,
  className = "",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-4 border-b border-[#e2e8e4] shrink-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-[#192329] truncate">{title}</h2>
          {badge}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {subtitle && <p className="mt-1 text-xs text-[#64748b] leading-normal">{subtitle}</p>}
    </div>
  );
}

export function SidePanelBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${className}`}>
      {children}
    </div>
  );
}

export function SidePanelFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-3.5 border-t border-[#e2e8e4] bg-[#f8faf9] shrink-0 ${className}`}>
      {children}
    </div>
  );
}
