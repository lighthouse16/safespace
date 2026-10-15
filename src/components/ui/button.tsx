"use client";

import React, { forwardRef, type ButtonHTMLAttributes } from "react";

const buttonVariants = {
  primary:
    "bg-[#0B514B] text-white hover:bg-[#073D38] active:bg-[#073D38] border border-transparent shadow-xs focus-visible:outline-[#0B514B]",
  secondary:
    "border border-[#cbd5e1] bg-white text-[#17252B] hover:bg-[#f8fafc] active:bg-[#f1f5f9] shadow-xs focus-visible:outline-[#0B514B]",
  ghost:
    "text-[#475569] hover:bg-slate-100 active:bg-slate-200 hover:text-[#17252B] border border-transparent focus-visible:outline-[#0B514B]",
  danger:
    "bg-[#dc2626] text-white hover:bg-[#b91c1c] active:bg-[#991b1b] border border-transparent shadow-xs focus-visible:outline-[#dc2626]",
  outline:
    "border border-[#0B514B] bg-transparent text-[#0B514B] hover:bg-[#F7F8F8] active:bg-[#E2E6E8] focus-visible:outline-[#0B514B]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      icon,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: "min-h-7 px-2 text-[11px] gap-1 rounded",
      sm: "min-h-9 px-3 text-xs gap-1.5 rounded-md",
      md: "min-h-10 px-3.5 text-sm gap-2 rounded-lg",
      lg: "min-h-11 px-5 text-sm gap-2 rounded-lg font-semibold",
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center font-medium transition cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${sizeClasses} ${buttonVariants[variant]} ${className}`}
        {...props}
      >
        {loading ? (
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent shrink-0"
            aria-hidden="true"
          />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "ghost" | "secondary" | "primary";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      size = "md",
      variant = "ghost",
      className = "",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: "size-7 rounded text-xs",
      sm: "size-8 rounded-md text-xs",
      md: "size-9 rounded-lg text-sm",
      lg: "size-10 rounded-lg text-base",
    }[size];

    const variantClasses = {
      ghost: "text-[#647078] hover:bg-slate-100 hover:text-[#17252B]",
      secondary: "border border-[#cbd5e1] bg-white text-[#17252B] hover:bg-[#f8fafc]",
      primary: "bg-[#0B514B] text-white hover:bg-[#073D38]",
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-grid place-items-center transition cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B514B] ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
