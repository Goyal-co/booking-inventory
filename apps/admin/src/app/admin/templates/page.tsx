"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@booking/ui";
import { toast, Toaster } from "sonner";
import { useAdminProject } from "@/hooks/use-admin-project";
import { ProjectBookingFormTemplatePanel } from "@/components/project-booking-form-template";

type LibraryRow = {
  id: string;
  name: string;
  description: string | null;
  companyName: string | null;
  updatedAt: string;
};

/**
 * Side-menu "Form Templates" = same per-project booking form template editor.
 * One source of truth per project (customer form + printable download).
 */
export default function AdminTemplatesPage() {
  const { projects, selectedProjectId, setSelectedProjectId, loading: projectsLoading } =
    useAdminProject();
  const [library, setLibrary] = useState<LibraryRow[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const loadLibrary = useCallback(async () => {
    const res = await fetch("/api/templates");
    const data = await res.json().catch(() => ({}));
    setLibrary(data.templates ?? []);
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const applyLibrary = async (orgTemplateId: string) => {
    if (!selectedProjectId) {
      toast.error("Select a project first");
      return;
    }
    setAssigning(true);
    const res = await fetch(
      `/api/projects/${selectedProjectId}/booking-form-template/assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgTemplateId }),
      }
    );
    setAssigning(false);
    if (!res.ok) {
      toast.error("Failed to apply library template");
      return;
    }
    toast.success("Library template applied to this project");
    // Force remount of editor by briefly clearing selection
    const id = selectedProjectId;
    setSelectedProjectId(null);
    requestAnimationFrame(() => setSelectedProjectId(id));
  };

  return (
    <div className="p-4 sm:p-6">
      <Toaster position="top-right" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-600">Booking Form Template</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Same template for this project drives the customer booking form and the printable /
            downloadable filled form. Edit once here — both use it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600">
            Project{" "}
            <select
              className="ml-1 rounded-lg border px-3 py-2 text-sm"
              value={selectedProjectId ?? ""}
              disabled={projectsLoading}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowLibrary((v) => !v)}
          >
            {showLibrary ? "Hide library" : "Org library"}
          </Button>
        </div>
      </div>

      {showLibrary ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Org template library</CardTitle>
            <p className="text-xs text-gray-500">
              Optional starters. Applying copies into the selected project&apos;s template (does not
              create a second live template).
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {library.length === 0 ? (
              <p className="text-sm text-gray-500">
                No library entries yet. Use Example 1 / Example 2 on the project editor, or create
                presets from a project save.
              </p>
            ) : (
              library.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-navy-600">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.companyName || "—"}
                      {t.description ? ` · ${t.description}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!selectedProjectId || assigning}
                    onClick={() => applyLibrary(t.id)}
                  >
                    Apply to project
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {!selectedProjectId ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-gray-600">
              Select a project above to edit its booking form template.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Or open a project and use{" "}
              <Link href="/admin/projects" className="text-brand-600 underline">
                Projects
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <ProjectBookingFormTemplatePanel key={selectedProjectId} projectId={selectedProjectId} />
      )}
    </div>
  );
}
