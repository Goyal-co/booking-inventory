"use client";

import { useEffect, useState } from "react";
import { ClientDateTime, PageHeader, Card, CardContent, FilterBar, KpiGrid, StatCard, ActionBadge, DataTable, TablePagination } from "@booking/ui";
import { FileText, CheckCircle, XCircle, Users } from "lucide-react";

const AUDIT_ACTIONS = [
  "UNIT_BLOCKED", "UNIT_RELEASED", "UNIT_BOOKED", "USER_CREATED", "USER_UPDATED",
  "BOOKING_SUBMITTED", "BOOKING_APPROVED", "BOOKING_REJECTED", "INVENTORY_UPDATED",
];

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
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [auditStats, setAuditStats] = useState<{
    total: number;
    successful: number;
    failed: number;
    uniqueAdmins: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetch("/api/audit/stats")
      .then((r) => r.json())
      .then((d) => setAuditStats(d.stats ?? null));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (entityType.trim()) params.set("entityType", entityType.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const q = params.toString();
    fetch(`/api/audit${q ? `?${q}` : ""}`)
      .then((r) => r.json())
      .then((data) => setLogs(data.logs ?? []));
  }, [action, entityType, dateFrom, dateTo]);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Audit Log" description="Recent admin and system activity" />

      {auditStats && (
        <KpiGrid className="mb-6">
          <StatCard label="Total Activities" value={auditStats.total} subtitle="All time" icon={<FileText className="h-5 w-5" />} />
          <StatCard label="Successful Actions" value={auditStats.successful} subtitle={`${auditStats.total ? Math.round((auditStats.successful / auditStats.total) * 100) : 0}% of total`} icon={<CheckCircle className="h-5 w-5" />} iconClassName="bg-emerald-50 text-emerald-600" />
          <StatCard label="Blocked/Failed" value={auditStats.failed} icon={<XCircle className="h-5 w-5" />} iconClassName="bg-amber-50 text-amber-600" />
          <StatCard label="Unique Admins" value={auditStats.uniqueAdmins} subtitle="Active admins" icon={<Users className="h-5 w-5" />} iconClassName="bg-purple-50 text-purple-600" />
        </KpiGrid>
      )}

      <div className="mb-4">
        <FilterBar
          filters={[]}
          values={{ action, entityType }}
          onChange={(key, value) => {
            if (key === "action") setAction(value);
            if (key === "entityType") setEntityType(value);
          }}
          search={entityType}
          onSearchChange={setEntityType}
          searchPlaceholder="Filter by entity type..."
          extraSelects={[
            {
              key: "action",
              label: "All actions",
              options: AUDIT_ACTIONS.map((a) => ({ value: a, label: a.replace(/_/g, " ") })),
            },
          ]}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearAll={() => {
            setAction("");
            setEntityType("");
            setDateFrom("");
            setDateTo("");
          }}
        />
      </div>

      <DataTable
        className="hidden lg:block"
        data={logs.slice((page - 1) * pageSize, page * pageSize)}
        columns={[
          {
            key: "time",
            header: "Time",
            cell: (log) => <ClientDateTime value={log.createdAt} />,
          },
          {
            key: "user",
            header: "User",
            cell: (log) => log.user?.name ?? "System",
          },
          {
            key: "action",
            header: "Action",
            cell: (log) => <ActionBadge action={log.action} />,
          },
          {
            key: "entity",
            header: "Entity",
            cell: (log) => `${log.entityType}: ${log.entityId.slice(0, 12)}`,
          },
        ]}
      />

      <TablePagination
        className="mt-4 hidden lg:flex"
        page={page}
        pageSize={pageSize}
        total={logs.length}
        onPageChange={setPage}
      />

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
