"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./input";

interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

interface TrendPoint {
  date: string;
  count: number;
  revenue: number;
}

interface TowerBar {
  name: string;
  available: number;
  blocked: number;
  booked: number;
}

interface NamedCount {
  name: string;
  count: number;
}

interface LeaderRow {
  name: string;
  blocks: number;
  bookings: number;
  conversion: number;
}

export function InventoryStatusChart({ data }: { data: StatusSlice[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No inventory data</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BookingsTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No bookings in this period</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="count" stroke="#2563eb" name="Bookings" strokeWidth={2} />
        <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TowerBreakdownChart({ data }: { data: TowerBar[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No tower data</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="available" stackId="a" fill="#10b981" name="Available" />
        <Bar dataKey="blocked" stackId="a" fill="#f59e0b" name="Blocked" />
        <Bar dataKey="booked" stackId="a" fill="#ef4444" name="Booked" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BhkBreakdownChart({ data }: { data: NamedCount[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No BHK data</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#6366f1" name="Units" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SalesLeaderboardTable({ data }: { data: LeaderRow[] }) {
  if (data.length === 0) {
    return <p className="py-4 text-sm text-gray-500">No sales activity in this period</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-2 pr-4 font-medium">Salesperson</th>
            <th className="pb-2 pr-4 font-medium">Blocks</th>
            <th className="pb-2 pr-4 font-medium">Bookings</th>
            <th className="pb-2 font-medium">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name} className="border-b border-gray-50">
              <td className="py-2 pr-4 font-medium">{row.name}</td>
              <td className="py-2 pr-4">{row.blocks}</td>
              <td className="py-2 pr-4">{row.bookings}</td>
              <td className="py-2">{row.conversion}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardRangeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm"
    >
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
    </select>
  );
}

export function AnalyticsChartGrid({
  inventoryByStatus,
  bookingsTrend,
  byTower,
  byBhk,
  salesLeaderboard,
  expiringBlocks24h,
  avgApprovalHours,
}: {
  inventoryByStatus: StatusSlice[];
  bookingsTrend: TrendPoint[];
  byTower: TowerBar[];
  byBhk: NamedCount[];
  salesLeaderboard: LeaderRow[];
  expiringBlocks24h: number;
  avgApprovalHours: number | null;
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-xl border border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Blocks expiring in 24h</p>
            <p className="text-2xl font-bold text-amber-700">{expiringBlocks24h}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Avg approval time</p>
            <p className="text-2xl font-bold text-blue-700">
              {avgApprovalHours !== null ? `${avgApprovalHours}h` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory by status</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryStatusChart data={inventoryByStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings trend</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingsTrendChart data={bookingsTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By tower</CardTitle>
          </CardHeader>
          <CardContent>
            <TowerBreakdownChart data={byTower} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By BHK type</CardTitle>
          </CardHeader>
          <CardContent>
            <BhkBreakdownChart data={byBhk} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales team leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesLeaderboardTable data={salesLeaderboard} />
        </CardContent>
      </Card>
    </div>
  );
}
