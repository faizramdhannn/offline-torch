"use client";

import { useEffect, useState } from "react";
import { ago } from "./types";

interface Row { device_id: string; store_name: string; kind: string; label: string; hours_online: number; drops: number; last_drop: string | null }

// Ringkasan 7 hari: jam online dan jumlah putus per perangkat (dari riwayat webhook).
export default function SummaryTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [days, setDays] = useState(7);
  useEffect(() => {
    fetch("/api/devices/summary", { cache: "no-store" }).then((r) => r.json()).then((d) => { setRows(d.devices || []); setDays(d.days || 7); }).catch(() => setRows([]));
  }, []);
  if (!rows) return <p className="text-xs text-gray-400">Memuat…</p>;
  if (!rows.length) return <p className="text-sm text-gray-400">Belum ada data.</p>;
  const total = days * 24;
  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-xs text-gray-500">{days} hari terakhir. Jam online dihitung dari riwayat online/offline (webhook Ably); data terisi setelah webhook aktif.</p>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-xs">
        {rows.map((r) => {
          const pct = Math.min(100, Math.round((r.hours_online / total) * 100));
          return (
            <li key={r.device_id} className="p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-gray-700">{r.store_name} <span className="font-normal text-gray-400">· {r.label || (r.kind === "tablet" ? "Tablet" : "PC")}</span></span>
                <span className="shrink-0 text-gray-500">{r.hours_online} jam ({pct}%)</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1.5 text-gray-400">{r.drops} kali putus{r.last_drop ? ` · terakhir ${ago(r.last_drop)}` : ""}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
