"use client";

import { Search } from "lucide-react";
import { Input } from "./input";
import { filterDimensionToQueryKey, type FilterConfig } from "../lib/utils";

export interface ExtraFilterSelect {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  compact?: boolean;
  extraSelects?: ExtraFilterSelect[];
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  onClearAll?: () => void;
}

export function FilterBar({
  filters,
  values,
  onChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search unit, tower, size...",
  compact = false,
  extraSelects = [],
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearAll,
}: FilterBarProps) {
  const hasActive =
    search.trim() ||
    Object.values(values).some(Boolean) ||
    extraSelects.some((s) => values[s.key]) ||
    dateFrom ||
    dateTo;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        {!compact &&
          filters.map((filter) => {
            const queryKey = filterDimensionToQueryKey(filter.dimension);
            return (
              <select
                key={filter.dimension}
                value={values[queryKey] ?? ""}
                onChange={(e) => onChange(queryKey, e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-auto"
              >
                <option value="">{filter.label}</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            );
          })}
        {!compact &&
          extraSelects.map((sel) => (
            <select
              key={sel.key}
              value={values[sel.key] ?? ""}
              onChange={(e) => onChange(sel.key, e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-auto"
            >
              <option value="">{sel.label}</option>
              {sel.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
        {onDateFromChange && (
          <input
            type="date"
            value={dateFrom ?? ""}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm sm:w-auto"
            aria-label="From date"
          />
        )}
        {onDateToChange && (
          <input
            type="date"
            value={dateTo ?? ""}
            onChange={(e) => onDateToChange(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm sm:w-auto"
            aria-label="To date"
          />
        )}
        {onClearAll && hasActive && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm text-brand-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
