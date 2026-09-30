"use client";

import React, { useId, useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  badge?: ReactNode;
  icon?: ReactNode;
  content: ReactNode;
}

export function Tabs({
  tabs,
  initialId,
  onChange,
}: {
  tabs: readonly TabItem[];
  initialId?: string;
  onChange?: (id: string) => void;
}) {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);
  const prefix = useId();

  const handleSelect = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex gap-1 border-b border-[#e2e8e4] px-1"
      >
        {tabs.map((tab) => {
          const isSelected = active === tab.id;
          return (
            <button
              key={tab.id}
              id={`${prefix}-${tab.id}-tab`}
              role="tab"
              type="button"
              aria-selected={isSelected}
              aria-controls={`${prefix}-${tab.id}-panel`}
              onClick={() => handleSelect(tab.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1e7168] ${
                isSelected
                  ? "border-[#1e7168] text-[#1e7168] font-semibold"
                  : "border-transparent text-[#64748b] hover:border-slate-300 hover:text-[#192329]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && <span className="ml-1">{tab.badge}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map(
        (tab) =>
          active === tab.id && (
            <div
              key={tab.id}
              id={`${prefix}-${tab.id}-panel`}
              role="tabpanel"
              aria-labelledby={`${prefix}-${tab.id}-tab`}
              tabIndex={0}
              className="pt-3 focus-visible:outline-none"
            >
              {tab.content}
            </div>
          )
      )}
    </div>
  );
}

export function Tooltip({
  label,
  children,
  position = "top",
}: {
  label: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  }[position];

  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 hidden whitespace-nowrap rounded-md bg-[#192329] px-2 py-1 text-[11px] font-medium text-white shadow-md group-hover:block group-focus-within:block ${positionClasses}`}
      >
        {label}
      </span>
    </span>
  );
}
