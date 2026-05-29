"use client";

import { cn } from "../lib/utils";
import { ProjectStatusBadge } from "../components/project-status-badge";

export interface ProjectSwitcherItem {
  id: string;
  name: string;
  lifecycleStatus?: "UPCOMING" | "LAUNCH_DAY" | "ONGOING";
  primaryColor?: string;
}

interface ProjectSwitcherProps {
  projects: ProjectSwitcherItem[];
  selectedId: string | null;
  onChange: (projectId: string) => void;
  className?: string;
}

export function ProjectSwitcher({
  projects,
  selectedId,
  onChange,
  className,
}: ProjectSwitcherProps) {
  if (projects.length <= 1) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label htmlFor="project-switcher" className="text-sm font-medium text-gray-600">
        Project
      </label>
      <select
        id="project-switcher"
        value={selectedId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {selectedId && projects.find((p) => p.id === selectedId)?.lifecycleStatus && (
        <ProjectStatusBadge
          status={projects.find((p) => p.id === selectedId)!.lifecycleStatus!}
        />
      )}
    </div>
  );
}
