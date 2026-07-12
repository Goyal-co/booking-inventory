"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Label,
  PageHeader,
  KpiGrid,
  StatCard,
  FilterBar,
  TablePagination,
  Badge,
  ClientDateTime,
} from "@booking/ui";
import { Megaphone, Calendar, FileText, Send, Plus, X } from "lucide-react";
import { toast, Toaster } from "sonner";

type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "EXPIRED";
type AnnouncementPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  audience: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
  createdBy: { name: string };
}

interface ProjectOption {
  id: string;
  name: string;
}

const PRIORITY_STYLES: Record<AnnouncementPriority, string> = {
  LOW: "bg-blue-50 text-blue-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-red-50 text-red-700",
  CRITICAL: "bg-red-100 text-red-800",
};

const STATUS_STYLES: Record<AnnouncementStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SCHEDULED: "bg-blue-50 text-blue-700 border border-blue-200",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

export default function CommunicationsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [stats, setStats] = useState({ active: 0, scheduled: 0, drafts: 0, sentToday: 0 });
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("MEDIUM");
  const [projectId, setProjectId] = useState("");
  const [publishNow, setPublishNow] = useState(true);

  const pageSize = 10;

  const load = async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (projectFilter) params.set("projectId", projectFilter);

    const res = await fetch(`/api/announcements?${params}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to load announcements");
      return;
    }
    setAnnouncements(data.announcements ?? []);
    setStats(data.stats ?? { active: 0, scheduled: 0, drafts: 0, sentToday: 0 });
    setTotal(data.total ?? 0);
  };

  useEffect(() => {
    load();
  }, [search, statusFilter, priorityFilter, projectFilter, page]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects((d.projects ?? []).map((p: ProjectOption) => ({ id: p.id, name: p.name }))));
  }, []);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setPriority("MEDIUM");
    setProjectId("");
    setPublishNow(true);
  };

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          priority,
          projectId: projectId || null,
          audience: projectId ? "PROJECT_SALES" : "ALL_SALES",
          publishNow,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (publishNow) {
          const count = data.notifiedCount ?? 0;
          if (count === 0) {
            toast.warning("Announcement published but no sales users were notified");
          } else {
            toast.success(`Announcement published to ${count} sales user${count === 1 ? "" : "s"}`);
          }
        } else {
          toast.success("Announcement saved");
        }
        setDrawerOpen(false);
        resetForm();
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to create announcement");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    const res = await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const count = data.notifiedCount ?? 0;
      if (count === 0) {
        toast.warning("Announcement published but no sales users were notified");
      } else {
        toast.success(`Published to ${count} sales user${count === 1 ? "" : "s"}`);
      }
      load();
    } else {
      toast.error(data.error ?? "Failed to publish");
    }
  };

  const audienceLabel = (a: Announcement) =>
    a.project ? `Project: ${a.project.name}` : "All Sales Users";

  const hasFilters = useMemo(
    () => search.trim() !== "" || statusFilter !== "" || priorityFilter !== "" || projectFilter !== "",
    [search, statusFilter, priorityFilter, projectFilter]
  );

  return (
    <div className="relative p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="Communications Center"
        description="Create, manage and track announcements and notifications for your sales team."
        actions={<Button onClick={() => setDrawerOpen(true)}><Plus className="mr-2 h-4 w-4" />New Announcement</Button>}
      />

      <KpiGrid className="mb-6">
        <StatCard label="Active Announcements" value={stats.active} subtitle="Currently live" icon={<Megaphone className="h-5 w-5" />} iconClassName="bg-blue-50 text-blue-600" />
        <StatCard label="Scheduled" value={stats.scheduled} subtitle="Upcoming" icon={<Calendar className="h-5 w-5" />} iconClassName="bg-emerald-50 text-emerald-600" />
        <StatCard label="Drafts" value={stats.drafts} subtitle="Not published" icon={<FileText className="h-5 w-5" />} iconClassName="bg-amber-50 text-amber-600" />
        <StatCard label="Sent Today" value={stats.sentToday} subtitle="Notifications" icon={<Send className="h-5 w-5" />} iconClassName="bg-purple-50 text-purple-600" />
      </KpiGrid>

      <div className="mb-4">
        <FilterBar
          filters={[]}
          values={{ status: statusFilter, priority: priorityFilter, projectId: projectFilter }}
          onChange={(key, value) => {
            if (key === "status") setStatusFilter(value);
            if (key === "priority") setPriorityFilter(value);
            if (key === "projectId") setProjectFilter(value);
          }}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search announcements by title..."
          extraSelects={[
            {
              key: "status",
              label: "All statuses",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "SCHEDULED", label: "Scheduled" },
                { value: "DRAFT", label: "Draft" },
                { value: "EXPIRED", label: "Expired" },
              ],
            },
            {
              key: "priority",
              label: "All priorities",
              options: [
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
                { value: "CRITICAL", label: "Critical" },
              ],
            },
            {
              key: "projectId",
              label: "All projects",
              options: projects.map((p) => ({ value: p.id, label: p.name })),
            },
          ]}
          onClearAll={
            hasFilters
              ? () => {
                  setSearch("");
                  setStatusFilter("");
                  setPriorityFilter("");
                  setProjectFilter("");
                }
              : undefined
          }
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Announcement</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {announcements.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{a.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{a.message}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{audienceLabel(a)}</td>
                <td className="px-4 py-3">
                  <Badge className={PRIORITY_STYLES[a.priority]}>{a.priority}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge className={STATUS_STYLES[a.status]}>{a.status}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {a.publishedAt ? <ClientDateTime value={a.publishedAt} /> : a.scheduledAt ? <ClientDateTime value={a.scheduledAt} /> : "—"}
                </td>
                <td className="px-4 py-3">
                  {(a.status === "DRAFT" || a.status === "SCHEDULED") && (
                    <Button size="sm" variant="outline" onClick={() => handlePublish(a.id)}>
                      Publish
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {announcements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No announcements yet. Create your first announcement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination className="mt-4" page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold">Create Announcement</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
              </div>
              <div>
                <Label>Message</Label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Write your announcement..."
                />
              </div>
              <div>
                <Label>Project (optional)</Label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">All sales users</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Priority</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${priority === p ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} className="rounded border-gray-300 text-brand-500" />
                Publish immediately and notify sales team
              </label>
            </div>
            <div className="flex gap-3 border-t border-gray-200 p-5">
              <Button variant="outline" className="flex-1" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={saving}>
                {publishNow ? "Publish Announcement" : "Save Draft"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
