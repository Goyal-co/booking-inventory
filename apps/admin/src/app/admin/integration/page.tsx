"use client";

import { useEffect, useState } from "react";
import { Button, PageHeader } from "@booking/ui";
import { toast, Toaster } from "sonner";

interface SyncLog {
  id: string;
  system: string;
  entityType: string;
  entityId: string;
  status: string;
  error: string | null;
  createdAt: string;
}

export default function IntegrationPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);

  const load = () => {
    fetch("/api/integration/sync-logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
  };

  useEffect(() => { load(); }, []);

  const retry = async (logId: string) => {
    const res = await fetch(`/api/integration/retry/${logId}`, { method: "POST" });
    if (res.ok) {
      toast.success("Retry queued");
      load();
    } else toast.error("Retry failed");
  };

  return (
    <div className="p-6">
      <Toaster richColors />
      <PageHeader title="Integration Sync Logs" description="Titan CRM and Post CRM sync history" />
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">System</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Error</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3">{l.system}</td>
                <td className="px-4 py-3">{l.entityType} / {l.entityId.slice(0, 8)}</td>
                <td className="px-4 py-3">{l.status}</td>
                <td className="px-4 py-3 text-red-600">{l.error ?? "—"}</td>
                <td className="px-4 py-3">
                  {l.status === "FAILED" && (
                    <Button size="sm" variant="outline" onClick={() => retry(l.id)}>Retry</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
