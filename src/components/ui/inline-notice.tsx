import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export type NoticeTone = "info" | "warning" | "danger" | "success" | "neutral";

const toneMap: Record<
  NoticeTone,
  { container: string; icon: React.ReactNode; titleColor: string }
> = {
  info: {
    container: "bg-[#f0f9ff] border-[#bae6fd] text-[#0c4a6e]",
    icon: <Info className="size-4 shrink-0 text-[#0284c7]" />,
    titleColor: "text-[#0369a1]",
  },
  warning: {
    container: "bg-[#fef3c7]/60 border-[#fde68a] text-[#78350f]",
    icon: <AlertTriangle className="size-4 shrink-0 text-[#d97706]" />,
    titleColor: "text-[#92400e]",
  },
  danger: {
    container: "bg-[#fef2f2] border-[#fecaca] text-[#7f1d1d]",
    icon: <AlertCircle className="size-4 shrink-0 text-[#dc2626]" />,
    titleColor: "text-[#991b1b]",
  },
  success: {
    container: "bg-[#ecfdf5] border-[#a7f3d0] text-[#064e3b]",
    icon: <CheckCircle2 className="size-4 shrink-0 text-[#16a34a]" />,
    titleColor: "text-[#065f46]",
  },
  neutral: {
    container: "bg-[#f8fafc] border-[#e2e8f0] text-slate-700",
    icon: <Info className="size-4 shrink-0 text-slate-500" />,
    titleColor: "text-slate-900",
  },
};

export interface InlineNoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function InlineNotice({
  tone = "neutral",
  title,
  children,
  action,
  className = "",
}: InlineNoticeProps) {
  const config = toneMap[tone];
  return (
    <div
      role="region"
      aria-label={title || "Notice"}
      className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-relaxed ${config.container} ${className}`}
    >
      <div className="mt-0.5">{config.icon}</div>
      <div className="flex-1 space-y-0.5">
        {title && <p className={`font-semibold ${config.titleColor}`}>{title}</p>}
        <div>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
