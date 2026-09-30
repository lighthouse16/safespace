import React from "react";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneStyles: Record<StatusTone, { badge: string; dot: string; text: string }> = {
  neutral: {
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    text: "text-slate-700",
  },
  success: {
    badge: "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]",
    dot: "bg-[#16a34a]",
    text: "text-[#065f46]",
  },
  warning: {
    badge: "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
    dot: "bg-[#d97706]",
    text: "text-[#92400e]",
  },
  danger: {
    badge: "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]",
    dot: "bg-[#dc2626]",
    text: "text-[#991b1b]",
  },
  info: {
    badge: "bg-[#f0f9ff] text-[#075985] border-[#bae6fd]",
    dot: "bg-[#0284c7]",
    text: "text-[#075985]",
  },
};

export interface StatusIndicatorProps {
  tone?: StatusTone;
  label: React.ReactNode;
  showDot?: boolean;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}

export function StatusIndicator({
  tone = "neutral",
  label,
  showDot = true,
  size = "md",
  className = "",
  title,
}: StatusIndicatorProps) {
  const styles = toneStyles[tone];
  return (
    <span
      role="status"
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium select-none ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs"
      } ${styles.badge} ${className}`}
    >
      {showDot && (
        <span
          className={`shrink-0 rounded-full ${styles.dot} ${
            size === "sm" ? "size-1.5" : "size-2"
          }`}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
}
