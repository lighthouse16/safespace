import React, { type HTMLAttributes, type ReactNode } from "react";

const badgeStyles = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]",
  warning: "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
  danger: "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]",
  info: "bg-[#f0f9ff] text-[#075985] border-[#bae6fd]",
  primary: "bg-[#e8f3f1] text-[#1e7168] border-[#b8d9d4]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof badgeStyles;
  size?: "sm" | "md";
}

export function Badge({
  tone = "neutral",
  size = "md",
  className = "",
  ...props
}: BadgeProps) {
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-md border font-semibold select-none ${sizeClass} ${badgeStyles[tone]} ${className}`}
      {...props}
    />
  );
}

export function Progress({
  value,
  label,
  max = 100,
  indicatorTone = "primary",
}: {
  value: number;
  label: string;
  max?: number;
  indicatorTone?: "primary" | "warning" | "danger" | "success";
}) {
  const safe = Math.max(0, Math.min(max, value));
  const percent = Math.round((safe / max) * 100);

  const barColor = {
    primary: "bg-[#1e7168]",
    warning: "bg-[#d97706]",
    danger: "bg-[#dc2626]",
    success: "bg-[#16a34a]",
  }[indicatorTone];

  return (
    <div className="grid gap-1.5 w-full">
      <div className="flex justify-between text-xs font-medium text-[#475569]">
        <span>{label}</span>
        <span className="font-mono text-[11px]">{percent}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={safe}
      >
        <div
          className={`h-full transition-all duration-300 ease-out ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200 ${className}`}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc]/50">
      {icon && <div className="mb-3 text-[#94a3b8]">{icon}</div>}
      <h3 className="text-sm font-semibold text-[#192329]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-[#64748b] leading-normal">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toast({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children?: ReactNode;
  tone?: keyof typeof badgeStyles;
}) {
  return (
    <div
      role="status"
      className="w-full max-w-sm rounded-xl border border-[#e2e8e4] bg-white p-3.5 shadow-lg"
    >
      <Badge tone={tone}>{title}</Badge>
      {children && <div className="mt-2 text-xs text-[#475569]">{children}</div>}
    </div>
  );
}
