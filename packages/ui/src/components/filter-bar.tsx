"use client";

import { Search } from "lucide-react";
import { Input } from "./input";
import { filterDimensionToQueryKey, type FilterConfig } from "../lib/utils";

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  compact?: boolean;
}

export function FilterBar({
  filters,
  values,
  onChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search unit, tower, size...",
  compact = false,
}: FilterBarProps) {
  return (
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
    </div>
  );
}
