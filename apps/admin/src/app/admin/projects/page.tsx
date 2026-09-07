"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Modal,
  ProjectStatusBadge,
  formatBlockDuration,
  canBlockUnits,
  FilterBar,
  PageHeader,
  TablePagination,
  ClientDateTime,
} from "@booking/ui";
import { Building2, Layers, Clock, MoreHorizontal } from "lucide-react";
import { toast, Toaster } from "sonner";
import { useAdminSession } from "@/hooks/use-admin-session";
import { slugifyProjectSlug } from "@booking/validators";

interface Project {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  lifecycleStatus: "UPCOMING" | "LAUNCH_DAY" | "ONGOING";
  blockDurationMs: number;
  maxBlocksPerUser: number;
  _count: { towers: number; floorPlanTypes: number };
}

function firstApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
    const fromForm = flat.formErrors?.find(Boolean);
    if (fromForm) return fromForm;
    const fromField = Object.values(flat.fieldErrors ?? {})
      .flat()
      .find(Boolean);
    if (fromField) return fromField;
  }
  const details = (data as { details?: { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] } })
    .details;
  if (details) {
    const fromForm = details.formErrors?.find(Boolean);
    if (fromForm) return fromForm;
    const fromField = Object.values(details.fieldErrors ?? {})
      .flat()
      .find(Boolean);
    if (fromField) return fromField;
  }
  return fallback;
}

export default function ProjectsPage() {
  const { isSuperAdmin } = useAdminSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (lifecycleFilter) params.set("lifecycleStatus", lifecycleFilter);
    if (publishedFilter) params.set("isPublished", publishedFilter);
    const q = params.toString();
    const res = await fetch(`/api/projects${q ? `?${q}` : ""}`);
    const data = await res.json();
    setProjects(data.projects ?? []);
  };

  useEffect(() => {
    load();
  }, [search, lifecycleFilter, publishedFilter]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const finalSlug = slugifyProjectSlug(slug || trimmedName);
    if (trimmedName.length < 2) {
      toast.error("Project name must be at least 2 characters");
      return;
    }
    if (finalSlug.length < 2) {
      toast.error("Slug must be at least 2 characters (letters/numbers)");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, slug: finalSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Project created");
        setShowCreate(false);
        setName("");
        setSlug("");
        setSlugTouched(false);
        load();
      } else {
        toast.error(firstApiError(data, "Failed to create project"));
      }
    } finally {
      setCreating(false);
    }
  };

  const blockSummary = (p: Project) => {
    if (!canBlockUnits(p.lifecycleStatus)) return "No blocking";
    return `${formatBlockDuration(p.blockDurationMs)} blocks`;
  };

  const paged = projects.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="Projects"
        description="Manage all your projects and their lifecycle."
        actions={
          isSuperAdmin ? (
            <Button onClick={() => setShowCreate(true)}>+ New Project</Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <FilterBar
          filters={[]}
          values={{ lifecycleStatus: lifecycleFilter, isPublished: publishedFilter }}
          onChange={(key, value) => {
            if (key === "lifecycleStatus") setLifecycleFilter(value);
            if (key === "isPublished") setPublishedFilter(value);
          }}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search projects..."
          extraSelects={[
            {
              key: "lifecycleStatus",
              label: "All lifecycle",
              options: [
                { value: "UPCOMING", label: "Upcoming" },
                { value: "LAUNCH_DAY", label: "Launch day" },
                { value: "ONGOING", label: "Ongoing" },
              ],
            },
            {
              key: "isPublished",
              label: "All visibility",
              options: [
                { value: "true", label: "Published" },
                { value: "false", label: "Draft" },
              ],
            },
          ]}
          onClearAll={() => {
            setSearch("");
            setLifecycleFilter("");
            setPublishedFilter("");
          }}
        />
      </div>

      <div className="space-y-4">
        {paged.map((p) => (
          <Card key={p.id} className="overflow-hidden transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col gap-4 p-0 sm:flex-row">
              <Link href={`/admin/projects/${p.id}`} className="relative shrink-0 sm:w-48">
                <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 sm:h-full sm:min-h-[140px]">
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-12 w-12 text-gray-400" />
                  )}
                </div>
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/admin/projects/${p.id}`} className="text-lg font-bold text-gray-900 hover:text-brand-600">
                      {p.name}
                    </Link>
                    <p className="text-sm text-gray-500">{p.slug}</p>
                  </div>
                  <ProjectStatusBadge status={p.lifecycleStatus} />
                </div>
                <div className="mt-3 flex flex-wrap gap-6 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    {p._count.towers} Towers
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-gray-400" />
                    {p._count.floorPlanTypes} Floor Plans
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {blockSummary(p)}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${p.isPublished ? "bg-emerald-500" : "bg-gray-300"}`} />
                      {p.isPublished ? "Published" : "Draft"}
                    </span>
                    <span>
                      Created on <ClientDateTime value={p.createdAt} />
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                    <Link href={`/admin/projects/${p.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <TablePagination
        className="mt-6"
        page={page}
        pageSize={pageSize}
        total={projects.length}
        onPageChange={setPage}
      />

      <Modal open={showCreate} onOpenChange={setShowCreate} title="Create Project">
        <div className="space-y-4">
          <div>
            <Label>Project Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                const next = e.target.value;
                setName(next);
                if (!slugTouched) setSlug(slugifyProjectSlug(next));
              }}
              placeholder="Skyline Heights"
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugifyProjectSlug(e.target.value));
              }}
              placeholder="skyline-heights"
            />
            <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only.</p>
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={creating || name.trim().length < 2}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
