"use client";

import { useEffect, useState } from "react";
import { ClientDateTime, PageHeader, Card, CardContent } from "@booking/ui";

export default function AuditPage() {
  const [logs, setLogs] = useState<
    Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      createdAt: string;
      user: { name: string; email: string } | null;
      metadata: unknown;
    }>
  >([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/audit");
      const data = await res.json();
      setLogs(data.logs ?? []);
    }
    load();
  }, []);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Audit Log" description="Recent admin and system activity" />

      <div className="space-y-3 lg:hidden">
        {logs.map((log) => (
          <Card key={log.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                  {log.action.replace(/_/g, " ")}
                </span>
                <ClientDateTime value={log.createdAt} className="text-xs text-gray-400" />
              </div>
              <p className="text-sm">{log.user?.name ?? "System"}</p>
              <p className="text-xs text-gray-500">
                {log.entityType}: {log.entityId.slice(0, 8)}...
              </p>
            </CardContent>
          </Card>
        ))}
        {logs.length === 0 && <p className="text-gray-500">No audit entries yet.</p>}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Time</th>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-500">
                    <ClientDateTime value={log.createdAt} />
                  </td>
                  <td className="px-4 py-3">{log.user?.name ?? "System"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.entityType}: {log.entityId.slice(0, 8)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
