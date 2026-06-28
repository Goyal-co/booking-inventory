"use client";

import { cn } from "../lib/utils";

export interface SegmentedTab {
  id: string;
  label: string;
  count?: number;
}

export function SegmentedTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: SegmentedTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1 border-b border-gray-200", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            active === tab.id
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-gray-400">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
