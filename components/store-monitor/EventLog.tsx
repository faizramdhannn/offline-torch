"use client";

import { useEffect, useState } from "react";
import { ago, type DeviceEvent } from "./types";

// Riwayat kejadian perangkat; deviceId kosong = terbaru dari semua perangkat.
export default function EventLog({ deviceId }: { deviceId?: string }) {
  const [rows, setRows] = useState<DeviceEvent[] | null>(null);
  useEffect(() => {
    fetch(`/api/devices/events${deviceId ? `?device_id=${deviceId}` : ""}`, { cache: "no-store" })
      .then((r) => r.json()).then((d) => setRows(d.events || [])).catch(() => setRows([]));
  }, [deviceId]);
  if (!rows) return <p className="text-xs text-gray-400">Memuat…</p>;
  if (!rows.length) return <p className="text-xs text-gray-400">Belum ada riwayat. Riwayat online/offline terisi setelah webhook Ably diaktifkan.</p>;
  return (
    <ul className="divide-y divide-gray-100 text-xs">
      {rows.map((e, i) => (
        <li key={i} className="flex items-center gap-2 py-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${e.event === "online" ? "bg-emerald-500" : e.event === "offline" ? "bg-red-400" : "bg-gray-300"}`} />
          <span className="font-medium text-gray-700">{e.event}</span>
          {!deviceId && <span className="truncate text-gray-500">{e.store_name} · {e.label || (e.kind === "tablet" ? "Tablet" : "PC")}</span>}
          {e.detail && <span className="truncate text-gray-400">{e.detail}</span>}
          <span className="ml-auto shrink-0 text-gray-400" title={new Date(e.at).toLocaleString("id-ID")}>{ago(e.at)}</span>
        </li>
      ))}
    </ul>
  );
}
