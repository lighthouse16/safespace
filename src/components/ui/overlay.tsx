"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./button";

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      className={`w-[min(92vw,36rem)] ${maxWidth} rounded-xl border border-[#cbd5e1] bg-white p-0 text-[#192329] shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs`}
    >
      <div className="flex items-start justify-between border-b border-[#e2e8e4] p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold text-[#192329]">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-[#64748b] leading-normal">{description}</p>
          )}
        </div>
        <IconButton
          aria-label="Close dialog"
          size="sm"
          onClick={onClose}
          className="text-[#64748b] hover:text-[#192329]"
        >
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </dialog>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
  width = "w-[min(28rem,90vw)]",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity ${
        open ? "opacity-100" : "pointer-events-none opacity-0 invisible"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 right-0 ${width} border-l border-[#e2e8e4] bg-white p-5 shadow-2xl transition-transform duration-200 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between border-b border-[#e2e8e4] pb-3 shrink-0">
          <h2 className="text-sm font-bold text-[#192329]">{title}</h2>
          <IconButton
            size="sm"
            aria-label="Close drawer"
            onClick={onClose}
            className="text-[#64748b] hover:text-[#192329]"
          >
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
