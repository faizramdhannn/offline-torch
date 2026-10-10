"use client";

import { useState } from "react";
import { DEFAULT_HOURS, type StoreHours } from "@/lib/storeHours";
import { hhmm, toMin } from "./types";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// Jam buka toko (WIB) + hari libur. Dipakai peringatan "tablet offline" dan (opsional) musik otomatis.
export default function HoursEditor({ title, initial, onSave, onClose }: {
  title: string; initial: StoreHours; onSave: (h: StoreHours) => Promise<void>; onClose: () => void;
}) {
  const [h, setH] = useState<StoreHours>(() => ({ ...initial, weekly: initial.weekly.map((d) => (d ? { ...d } : null)), closed_dates: [...initial.closed_dates] }));
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const setDay = (i: number, v: { open: number; close: number } | null) => setH((x) => ({ ...x, weekly: x.weekly.map((d, j) => (j === i ? v : d)) }));
  const input = "rounded-lg border border-gray-200 px-2 py-1.5 text-sm";
  const invalid = h.weekly.some((d) => d && d.close <= d.open);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Jam buka · {title}</h3>
        <p className="mb-4 text-xs text-gray-500">Waktu WIB. Peringatan "tablet offline" hanya dikirim saat toko buka.</p>

        <div className="space-y-2">
          {ORDER.map((i) => {
            const d = h.weekly[i];
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex w-24 items-center gap-2 text-gray-700">
                  <input type="checkbox" checked={!!d} onChange={(e) => setDay(i, e.target.checked ? { open: 9 * 60, close: 22 * 60 } : null)} />
                  {NAMES[i]}
                </label>
                {d ? (
                  <>
                    <input type="time" value={hhmm(d.open)} onChange={(e) => setDay(i, { ...d, open: toMin(e.target.value) })} className={input} />
                    <span className="text-gray-400">–</span>
                    <input type="time" value={hhmm(d.close >= 1440 ? 1439 : d.close)} onChange={(e) => setDay(i, { ...d, close: toMin(e.target.value) })} className={input} />
                    {d.close <= d.open && <span className="text-[11px] text-red-500">tutup harus setelah buka</span>}
                  </>
                ) : <span className="text-xs text-gray-400">Tutup</span>}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { const first = h.weekly[1] || h.weekly.find(Boolean) || null; setH((x) => ({ ...x, weekly: x.weekly.map(() => (first ? { ...first } : null)) })); }}
          className="mt-3 text-xs text-gray-500 underline"
        >Samakan semua hari dengan hari Senin</button>

        <div className="mt-5">
          <p className="mb-1 text-xs font-medium text-gray-600">Hari libur / tutup khusus</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {h.closed_dates.length === 0 && <span className="text-xs text-gray-400">Belum ada.</span>}
            {h.closed_dates.map((d) => (
              <span key={d} className="inline-flex items-center overflow-hidden rounded-full border border-gray-200 text-xs">
                <span className="px-3 py-1 text-gray-600">{d}</span>
                <button onClick={() => setH((x) => ({ ...x, closed_dates: x.closed_dates.filter((y) => y !== d) }))} className="border-l border-gray-200 px-2 py-1 text-gray-400 hover:text-red-500" aria-label={`Hapus ${d}`}>×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} min-w-0 flex-1`} />
            <button
              disabled={!date || h.closed_dates.includes(date)}
              onClick={() => { setH((x) => ({ ...x, closed_dates: [...x.closed_dates, date].sort() })); setDate(""); }}
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 disabled:opacity-40"
            >Tambah libur</button>
          </div>
        </div>

        <label className="mt-5 flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" className="mt-1" checked={h.follow} onChange={(e) => setH((x) => ({ ...x, follow: e.target.checked }))} />
          <span>Musik otomatis mengikuti jam buka
            <span className="block text-xs text-gray-400">Mulai (fade in) saat buka, berhenti saat tutup atau libur. Tidak berlaku jika toko punya jadwal musik sendiri.</span>
          </span>
        </label>

        {err && <p className="mt-3 text-xs text-red-500">{err}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs text-gray-500 hover:bg-gray-100">Batal</button>
          <button
            disabled={busy || invalid}
            onClick={async () => { setBusy(true); setErr(""); try { await onSave(h); } catch (e) { setErr((e as Error).message || "Gagal"); } finally { setBusy(false); } }}
            className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-medium text-white disabled:opacity-50"
          >{busy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_HOURS };
