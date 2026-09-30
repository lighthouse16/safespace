"use client";

import React, { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

export type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  ({ label, error, hint, optional, id, className = "", ...props }, ref) => {
    const fieldId = id ?? (props.name ? `field-${props.name}` : undefined);
    const errorId = error && fieldId ? `${fieldId}-error` : undefined;
    const hintId = hint && fieldId ? `${fieldId}-hint` : undefined;
    const describedBy = errorId ?? hintId;

    return (
      <label className="grid gap-1.5 text-xs font-semibold text-[#192329]" htmlFor={fieldId}>
        <div className="flex items-center justify-between">
          <span>{label}</span>
          {optional && <span className="text-[11px] font-normal text-[#94a3b8]">Optional</span>}
        </div>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`min-h-9 rounded-lg border bg-white px-3 text-xs text-[#192329] outline-none transition placeholder:text-[#94a3b8] focus:border-[#1e7168] focus:ring-2 focus:ring-[#1e7168]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#94a3b8] ${
            error ? "border-[#dc2626]" : "border-[#cbd5e1]"
          } ${className}`}
          {...props}
        />
        {error ? (
          <span id={errorId} className="text-[11px] font-normal text-[#dc2626]">
            {error}
          </span>
        ) : hint ? (
          <span id={hintId} className="text-[11px] font-normal text-[#64748b]">
            {hint}
          </span>
        ) : null}
      </label>
    );
  }
);

Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(({ label, error, hint, optional, id, className = "", children, ...props }, ref) => {
  const fieldId = id ?? (props.name ? `field-${props.name}` : undefined);
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;
  const hintId = hint && fieldId ? `${fieldId}-hint` : undefined;
  const describedBy = errorId ?? hintId;

  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#192329]" htmlFor={fieldId}>
      <div className="flex items-center justify-between">
        <span>{label}</span>
        {optional && <span className="text-[11px] font-normal text-[#94a3b8]">Optional</span>}
      </div>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`min-h-9 rounded-lg border bg-white px-3 text-xs text-[#192329] outline-none transition focus:border-[#1e7168] focus:ring-2 focus:ring-[#1e7168]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#94a3b8] ${
          error ? "border-[#dc2626]" : "border-[#cbd5e1]"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span id={errorId} className="text-[11px] font-normal text-[#dc2626]">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="text-[11px] font-normal text-[#64748b]">
          {hint}
        </span>
      ) : null}
    </label>
  );
});

Select.displayName = "Select";
