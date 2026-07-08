"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { OrderReport } from "@/types";
import { CHART_PALETTE as PALETTE, chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";

interface ReportChartsProps {
  data: OrderReport[];
  parseOrderDate: (dateString: string) => Date;
}

function parseValueAmount(v: string): number {
  const n = parseFloat((v || "0").toString().replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function ReportCharts({ data, parseOrderDate }: ReportChartsProps) {
  const trendData = useMemo(() => {
    const byDate = new Map<string, { date: string; orders: number; value: number }>();
    for (const item of data) {
      const d = parseOrderDate(item.order_date);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = byDate.get(key) || { date: label, orders: 0, value: 0 };
      entry.orders += 1;
      entry.value += parseValueAmount(item.value_amount);
      byDate.set(key, entry);
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([, v]) => v)
      .slice(-30);
  }, [data, parseOrderDate]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data) {
      const key = item.status || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const warehouseData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data) {
      const key = item.warehouse || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, orders]) => ({ name, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);
  }, [data]);

  const channelData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data) {
      const key = item.channel_name || item.sales_channel || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, orders]) => ({ name, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold text-gray-700">Order Trend (30 hari terakhir)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
            <XAxis dataKey="date" tick={chartAxisTick} />
            <YAxis tick={chartAxisTick} allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Line type="monotone" dataKey="orders" name="Orders" stroke="#0d334d" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold text-gray-700">Orders by Status</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {statusData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold text-gray-700">Top Warehouse (by Orders)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={warehouseData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
            <XAxis dataKey="name" tick={{ ...chartAxisTick, fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={chartAxisTick} allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Bar dataKey="orders" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold text-gray-700">Top Sales Channel (by Orders)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={channelData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
            <XAxis dataKey="name" tick={{ ...chartAxisTick, fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={chartAxisTick} allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Bar dataKey="orders" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
