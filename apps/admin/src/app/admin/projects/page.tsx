"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  ProjectStatusBadge,
  formatBlockDuration,
  canBlockUnits,
  FilterBar,
  PageHeader,
  TablePagination,
} from "@booking/ui";
import { toast, Toaster } from "sonner";
import { useAdminSession } from "@/hooks/use-admin-session";

interface Project {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  lifecycleStatus: "UPCOMING" | "LAUNCH_DAY" | "ONGOING";
  blockDurationMs: number;
  maxBlocksPerUser: number;
  statusAutoManage: boolean;
  _count: { towers: number; floorPlanTypes: number };
}

export default function ProjectsPage() {
  const { isSuperAdmin } = useAdminSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

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
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/\s+/g, "-") }),
    });
    if (res.ok) {
      toast.success("Project created");
      setShowCreate(false);
      setName("");
      setSlug("");
      load();
    } else {
      toast.error("Failed to create project");
    }
  };

  const blockSummary = (p: Project) => {
    if (!canBlockUnits(p.lifecycleStatus)) return "No blocking";
    return `${formatBlockDuration(p.blockDurationMs)} blocks`;
  };

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.slice((page - 1) * pageSize, page * pageSize).map((p) => (
          <Link key={p.id} href={`/admin/projects/${p.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{p.name}</CardTitle>
                  <ProjectStatusBadge status={p.lifecycleStatus} />
                </div>
                <p className="text-sm text-gray-500">{p.slug}</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>{p._count.towers} towers</span>
                  <span>{p._count.floorPlanTypes} floor plans</span>
                  <span>{blockSummary(p)}</span>
                  <span className={p.isPublished ? "text-emerald-600" : "text-gray-400"}>
                    {p.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
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
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Skyline Heights" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="skyline-heights" />
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={!name}>
            Create
          </Button>
        </div>
      </Modal>
    </div>
  );
}
