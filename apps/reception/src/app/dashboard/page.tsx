"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@booking/ui";
import { toast, Toaster } from "sonner";

interface Lead {
  id: string;
  leadId: string;
  customerName: string;
  customerPhone: string;
  source: string;
  project?: { name: string } | null;
}

export default function ReceptionDashboard() {
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sales, setSales] = useState<Array<{ id: string; name: string }>>([]);
  const [visits, setVisits] = useState<unknown[]>([]);
  const [walkIn, setWalkIn] = useState({ customerName: "", customerPhone: "", customerEmail: "" });

  const search = async () => {
    const res = await fetch(`/api/leads/search?q=${encodeURIComponent(query)}`);
    const d = await res.json();
    setLeads(d.leads ?? []);
  };

  useEffect(() => {
    fetch("/api/salespersons/available").then((r) => r.json()).then((d) => setSales(d.sales ?? []));
    fetch("/api/visits/today").then((r) => r.json()).then((d) => setVisits(d.visits ?? []));
  }, []);

  const registerWalkIn = async () => {
    const res = await fetch("/api/leads/walkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(walkIn),
    });
    const d = await res.json();
    if (res.ok) {
      toast.success(`Walk-in registered: ${d.lead.leadId}`);
      setWalkIn({ customerName: "", customerPhone: "", customerEmail: "" });
    } else toast.error("Registration failed");
  };

  const assign = async (leadId: string, salesUserId: string) => {
    const res = await fetch(`/api/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesUserId }),
    });
    if (res.ok) {
      toast.success("Lead assigned");
      search();
    } else toast.error("Assign failed");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster richColors />
      <h1 className="mb-6 text-2xl font-bold text-navy-600">Reception Dashboard</h1>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Search Lead</h2>
          <div className="flex gap-2">
            <Input placeholder="Lead ID or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button onClick={search}>Search</Button>
          </div>
          <div className="mt-4 space-y-3">
            {leads.map((l) => (
              <div key={l.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{l.customerName} — {l.leadId}</p>
                <p className="text-gray-500">{l.customerPhone} · {l.source}</p>
                <select
                  className="mt-2 w-full rounded border px-2 py-1 text-sm"
                  defaultValue=""
                  onChange={(e) => e.target.value && assign(l.id, e.target.value)}
                >
                  <option value="">Assign to salesperson...</option>
                  {sales.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Register Direct Walk-in</h2>
          <Input className="mb-2" placeholder="Name" value={walkIn.customerName} onChange={(e) => setWalkIn({ ...walkIn, customerName: e.target.value })} />
          <Input className="mb-2" placeholder="Phone" value={walkIn.customerPhone} onChange={(e) => setWalkIn({ ...walkIn, customerPhone: e.target.value })} />
          <Input className="mb-3" placeholder="Email (optional)" value={walkIn.customerEmail} onChange={(e) => setWalkIn({ ...walkIn, customerEmail: e.target.value })} />
          <Button onClick={registerWalkIn}>Register Walk-in</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Today&apos;s Site Visits</h2>
        <pre className="text-xs text-gray-600">{JSON.stringify(visits, null, 2)}</pre>
      </div>
    </div>
  );
}
