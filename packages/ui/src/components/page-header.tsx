"use client";

import { cn } from "../lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
