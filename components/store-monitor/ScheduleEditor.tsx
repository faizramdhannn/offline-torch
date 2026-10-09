"use client";

import { useState } from "react";
import { DAY_NAMES, hhmm, toMin, type Playlist, type Rule } from "./types";

// Jadwal musik per toko (WIB). Di luar jendela jadwal musik berhenti. Bisa diterapkan ke banyak toko sekaligus.
export default function ScheduleEditor({
  title, initial, playlists, onSave, onClose,
}: {
  title: string;
  initial: Rule[];
  playlists: Playlist[];
  onSave: (rules: Rule[]) => Promise<void>;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<Rule[]>(initial.length ? initial : []);
  const [busy, setBusy] = useState(false);
  const upd = (i: number, p: Partial<Rule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const toggleDay = (i: number, d: number) => {
    const set = new Set(rules[i].days.split(",").filter(Boolean).map(Number));
    set.has(d) ? set.delete(d) : set.add(d);
    upd(i, { days: [...set].sort().join(",") });
  };
  const save = async () => {
    setBusy(true);
    try { await onSave(rules); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Jadwal musik · {title}</h3>
        <p className="mb-4 text-xs text-gray-500">Waktu WIB. Di luar jam yang diatur, musik berhenti. Tanpa aturan = musik mengikuti kontrol manual saja.</p>
        <div className="space-y-3">
          {rules.map((r, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex flex-wrap gap-1">
                {DAY_NAMES.map((n, d) => (
                  <button key={d} type="button" onClick={() => toggleDay(i, d)}
                    className={`rounded-md px-2 py-1 text-[11px] ${r.days.split(",").includes(String(d)) ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}>{n}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input type="time" value={hhmm(r.start_min)} onChange={(e) => upd(i, { start_min: toMin(e.target.value) })} className="rounded border border-gray-200 px-2 py-1" />
                <span className="text-gray-400">–</span>
                <input type="time" value={hhmm(r.end_min >= 1440 ? 1439 : r.end_min)} onChange={(e) => upd(i, { end_min: toMin(e.target.value) })} className="rounded border border-gray-200 px-2 py-1" />
                <select value={r.playlist_id ?? ""} onChange={(e) => upd(i, { playlist_id: e.target.value ? Number(e.target.value) : null })} className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1">
                  <option value="">— pilih playlist —</option>
                  {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <label className="flex items-center gap-1 text-gray-500">Vol
                  <input type="number" min={0} max={100} value={r.volume} onChange={(e) => upd(i, { volume: Number(e.target.value) })} className="w-14 rounded border border-gray-200 px-1 py-1" />
                </label>
                <button type="button" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} className="text-red-500">Hapus</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRules((rs) => [...rs, { days: "0,1,2,3,4,5,6", start_min: 600, end_min: 1260, playlist_id: playlists[0]?.id ?? null, volume: 40 }])}
          className="mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">+ Tambah jadwal</button>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100">Batal</button>
          <button onClick={save} disabled={busy} className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}
