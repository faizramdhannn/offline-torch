"use client";

import { useEffect, useState } from "react";

interface Row { id: string; timestamp: string; user: string; method: string; activity_log: string }

// Siapa mengirim perintah/mengubah pengaturan apa, kapan (dari activity log).
export default function CommandLog() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch("/api/devices/commands", { cache: "no-store" }).then((r) => r.json()).then((d) => setRows(d.rows || [])).catch(() => setRows([]));
  }, []);
  if (!rows) return <p className="text-xs text-gray-400">Memuat…</p>;
  if (!rows.length) return <p className="text-xs text-gray-400">Belum ada perintah tercatat.</p>;
  return (
    <ul className="divide-y divide-gray-100 text-xs">
      {rows.map((r, i) => (
        <li key={`${r.id}-${i}`} className="py-2">
          <p className="break-words text-gray-700">{r.activity_log}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{r.user || "sistem"} · {r.timestamp}</p>
        </li>
      ))}
    </ul>
  );
}
