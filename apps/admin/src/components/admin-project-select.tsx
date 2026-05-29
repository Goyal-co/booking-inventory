"use client";

interface AdminProjectSelectProps {
  projects: Array<{ id: string; name: string }>;
  selectedProjectId: string | null;
  onChange: (projectId: string | null) => void;
  showAllOption?: boolean;
}

export function AdminProjectSelect({
  projects,
  selectedProjectId,
  onChange,
  showAllOption = true,
}: AdminProjectSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="admin-project-select" className="text-sm font-medium text-gray-600">
        Project
      </label>
      <select
        id="admin-project-select"
        value={selectedProjectId ?? "all"}
        onChange={(e) => onChange(e.target.value === "all" ? null : e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {showAllOption && <option value="all">All Projects</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
