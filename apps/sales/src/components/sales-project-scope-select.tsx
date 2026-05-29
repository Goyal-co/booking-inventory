"use client";

interface SalesProjectScopeSelectProps {
  projects: Array<{ id: string; name: string }>;
  scopeProjectId: string | null;
  onChange: (projectId: string | null) => void;
}

export function SalesProjectScopeSelect({
  projects,
  scopeProjectId,
  onChange,
}: SalesProjectScopeSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sales-project-scope" className="text-sm font-medium text-gray-600">
        Show
      </label>
      <select
        id="sales-project-scope"
        value={scopeProjectId ?? "all"}
        onChange={(e) => onChange(e.target.value === "all" ? null : e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="all">All my projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
