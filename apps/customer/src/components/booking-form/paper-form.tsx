"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

export const FORM_NAVY = "#1E3A5F";
export const FORM_TEAL = "#2BB8C8";
export const FORM_YELLOW = "#F5E000";

export function FieldTick({ done }: { done: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
        done ? "bg-emerald-500 text-white" : "bg-white text-transparent ring-1 ring-slate-300"
      }`}
      aria-label={done ? "Completed" : "Not completed"}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}

export function PaperFormShell({
  children,
  accentTeal = FORM_TEAL,
  className = "",
}: {
  children: ReactNode;
  accentTeal?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm bg-white shadow-[0_12px_40px_rgba(30,58,95,0.12)] ${className}`}
      style={{ borderRight: `6px solid ${accentTeal}` }}
    >
      <div
        className="absolute inset-y-0 left-0 w-5 sm:w-7"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg, ${FORM_NAVY} 0 5px, #152a45 5px 10px)`,
        }}
        aria-hidden
      />
      <div className="relative pl-7 sm:pl-10">{children}</div>
    </div>
  );
}

export function DetailsBanner({
  label = "DETAILS",
  accentTeal = FORM_TEAL,
}: {
  label?: string;
  accentTeal?: string;
}) {
  return (
    <div className="flex">
      <div
        className="w-10 shrink-0 sm:w-12"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg, ${accentTeal} 0 4px, ${FORM_NAVY} 4px 8px)`,
        }}
      />
      <div
        className="flex-1 px-4 py-3 text-2xl font-black tracking-wide text-navy-600 sm:px-6 sm:text-3xl"
        style={{ backgroundColor: accentTeal, color: FORM_NAVY }}
      >
        {label}
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-navy-600 sm:text-base">
      {children}
    </h2>
  );
}

export function UnderlineField({
  label,
  value,
  onChange,
  type = "text",
  optional,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  optional?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const done = value.trim().length > 0;
  return (
    <div className={`mb-4 ${className}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-navy-600">
          {label}
          {optional ? <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span> : null}
          <span className="ml-1">:</span>
        </label>
        <FieldTick done={done} />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-0 border-b-2 border-navy-600/40 bg-transparent px-0 py-1.5 text-sm text-navy-700 outline-none transition focus:border-navy-600"
      />
    </div>
  );
}

export function CheckboxRow({
  options,
  value,
  onChange,
  label,
  multi = false,
}: {
  label?: string;
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const done = selected.length > 0;

  const toggle = (opt: string) => {
    if (multi) {
      const next = selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt];
      onChange(next);
    } else {
      onChange(opt === value ? "" : opt);
    }
  };

  return (
    <div className="mb-4">
      {label ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-navy-600">{label}</p>
          <FieldTick done={done} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label key={opt} className="inline-flex cursor-pointer items-center gap-2 text-sm text-navy-700">
              <button
                type="button"
                onClick={() => toggle(opt)}
                className={`flex h-4 w-4 items-center justify-center border-2 border-navy-600 ${
                  checked ? "bg-navy-600 text-white" : "bg-white"
                }`}
                aria-pressed={checked}
              >
                {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </button>
              {opt}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ReadOnlyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 grid gap-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] sm:items-end sm:gap-3">
      <p className="text-sm font-medium text-navy-600">{label} :</p>
      <p className="border-b border-navy-600/30 pb-1 text-sm font-semibold text-navy-700">{value || "—"}</p>
    </div>
  );
}

export function TealCallout({
  children,
  accentTeal = FORM_TEAL,
}: {
  children: ReactNode;
  accentTeal?: string;
}) {
  return (
    <div className="rounded-sm px-4 py-4 text-sm leading-relaxed text-white" style={{ backgroundColor: accentTeal }}>
      {children}
    </div>
  );
}

export function YellowHighlight({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 font-bold text-navy-600" style={{ backgroundColor: FORM_YELLOW }}>
      {children}
    </span>
  );
}
