"use client";

import { useCallback, useEffect, useState } from "react";
import { describeRule, RECURRENCE_LABEL, type AnnounceRule, type Recurrence } from "@/lib/announceSchedule";
import type { Group, Template } from "./localLists";
import { CalendarIcon, MegaphoneIcon, PencilIcon } from "./icons";
import { DAY_NAMES, hhmm, toMin } from "./types";

// Pengumuman terjadwal (khusus Super Admin): sekali, setiap hari, hari tertentu tiap minggu, atau tanggal tertentu tiap bulan.
// Jam dicek di perangkat toko (WIB) — perangkat harus sedang membuka aplikasi pada jamnya.
type Rule = AnnounceRule;
const blank = (): Rule => ({
  id: 0, name: "", text: "", seconds: 30, all_stores: true, user_names: [], recurrence: "daily", days: "1,2,3,4,5,6,0",
  day_of_month: 1, run_date: "", time_min: 20 * 60 + 45, start_date: "", end_date: "", active: true,
});
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export default function AnnounceSchedule({
  stores, groups, templates, standbyText, onStandby, onTest,
}: {
  stores: { user_name: string; name: string }[]; groups: Group[]; templates: Template[];
  standbyText: string; onStandby: (text: string) => void; onTest: (text: string, seconds: number, userName: string) => Promise<boolean>;
}) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [err, setErr] = useState("");
  const [testing, setTesting] = useState<{ id: number; user: string } | null>(null);
  const [sb, setSb] = useState(standbyText);
  useEffect(() => setSb(standbyText), [standbyText]);

  const load = useCallback(async () => {
    const r = await fetch("/api/announce-schedule", { cache: "no-store" });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Gagal memuat"); setRules([]); return; }
    const d = await r.json();
    setRules((d.rules || []).map((x: any) => ({ ...x, id: Number(x.id), user_names: x.user_names || [], day_of_month: x.day_of_month ?? null })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (method: string, body: object) => {
    const r = await fetch("/api/announce-schedule", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Gagal"); return false; }
    setErr("");
    await load();
    return true;
  };

  const target = (r: Rule) => (r.all_stores ? "Semua toko" : `${r.user_names.length} toko`);

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">Tampil otomatis di perangkat toko pada jam yang diatur (WIB). Perangkat harus sedang membuka aplikasi.</p>
        <button onClick={() => setEditing(blank())} className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white">+ Tambah</button>
      </div>
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
        <label className="mb-1 block text-xs font-medium text-gray-600">Teks layar standby tablet (opsional)</label>
        <p className="mb-2 text-[11px] text-gray-400">Tampil di layar standby tablet toko (setelah 3 menit tidak disentuh), mis. promo atau pesan semangat. Berlaku untuk semua toko.</p>
        <div className="flex gap-2">
          <input value={sb} onChange={(e) => setSb(e.target.value)} maxLength={200} placeholder="mis. Diskon 20% semua tas hingga akhir pekan" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <button onClick={() => onStandby(sb.trim())} disabled={sb.trim() === standbyText} className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40">Simpan</button>
        </div>
      </div>
      {err && <p className="mb-3 text-xs text-red-500">{err}</p>}
      {!rules ? <p className="text-xs text-gray-400">Memuat…</p> : rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">Belum ada pengumuman terjadwal.</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className={`rounded-xl border bg-white p-3 ${r.active ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-gray-400"><MegaphoneIcon /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{r.name || r.text}</p>
                  {r.name && <p className="truncate text-xs text-gray-500">{r.text}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
                    <span className="inline-flex items-center gap-1"><CalendarIcon width={11} height={11} />{describeRule(r)}</span>
                    <span>· {target(r)}</span><span>· {r.seconds} dtk</span>
                    {r.recurrence !== "once" && (r.start_date || r.end_date) && <span>· {r.start_date || "…"} s/d {r.end_date || "…"}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <label className="flex cursor-pointer items-center gap-1 text-[11px] text-gray-500">
                    <input type="checkbox" checked={r.active} onChange={(e) => call("PUT", { ...r, active: e.target.checked })} /> Aktif
                  </label>
                  <button onClick={() => setTesting(testing?.id === r.id ? null : { id: r.id, user: stores[0]?.user_name || "" })} className="rounded-md px-2 py-2 text-[11px] text-gray-400 hover:text-gray-700">Uji</button>
                  <button onClick={() => setEditing(r)} className="rounded-md p-2 text-gray-400 hover:text-gray-700" aria-label="Ubah"><PencilIcon /></button>
                  <button onClick={() => setEditing({ ...r, id: 0, name: r.name ? `${r.name} (salinan)` : "" })} className="rounded-md px-2 py-2 text-[11px] text-gray-400 hover:text-gray-700">Gandakan</button>
                  <button onClick={() => confirm("Hapus pengumuman terjadwal ini?") && call("DELETE", { id: r.id })} className="rounded-md px-2 py-2 text-[11px] text-red-400 hover:text-red-600">Hapus</button>
                </div>
              </div>
              {testing?.id === r.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs">
                  <span className="text-gray-500">Kirim sekarang ke:</span>
                  <select value={testing.user} onChange={(e) => setTesting({ id: r.id, user: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5">
                    {stores.map((s) => <option key={s.user_name} value={s.user_name}>{s.name}</option>)}
                  </select>
                  <button
                    onClick={async () => { if (await onTest(r.text, r.seconds, testing.user)) setTesting(null); }}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 font-medium text-white"
                  >Kirim uji</button>
                  <span className="text-[11px] text-gray-400">Hanya untuk melihat tampilannya; jadwal tidak berubah.</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Form
          initial={editing}
          stores={stores}
          groups={groups}
          templates={templates}
          onClose={() => setEditing(null)}
          onSave={async (r) => { if (await call(r.id ? "PUT" : "POST", r)) setEditing(null); }}
        />
      )}
    </div>
  );
}

function Form({ initial, stores, groups, templates, onSave, onClose }: {
  initial: Rule; stores: { user_name: string; name: string }[]; groups: Group[]; templates: Template[];
  onSave: (r: Rule) => Promise<void>; onClose: () => void;
}) {
  const [r, setR] = useState<Rule>(initial);
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<Rule>) => setR((x) => ({ ...x, ...p }));
  const field = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-medium text-gray-600";
  const toggleDay = (d: number) => {
    const set = new Set(r.days.split(",").filter(Boolean).map(Number));
    set.has(d) ? set.delete(d) : set.add(d);
    up({ days: [...set].sort().join(",") });
  };
  const toggleStore = (u: string) => up({ user_names: r.user_names.includes(u) ? r.user_names.filter((x) => x !== u) : [...r.user_names, u] });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-sm font-semibold text-gray-800">{r.id ? "Ubah" : "Tambah"} pengumuman terjadwal</h3>
        <div className="space-y-4">
          <div>
            <label className={label}>Nama (untuk Anda, opsional)</label>
            <input value={r.name} onChange={(e) => up({ name: e.target.value })} maxLength={60} placeholder="mis. Peringatan tutup toko" className={field} />
          </div>

          <div>
            <label className={label}>Isi pengumuman</label>
            {templates.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <button key={t.name} type="button" onClick={() => up({ text: t.text, seconds: t.seconds })} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">{t.name}</button>
                ))}
              </div>
            )}
            <textarea value={r.text} onChange={(e) => up({ text: e.target.value })} rows={3} maxLength={300} placeholder="Teks yang tampil di layar toko…" className={field} />
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">Tampil selama
              <input type="number" min={5} max={600} value={r.seconds} onChange={(e) => up({ seconds: Number(e.target.value) })} className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" /> detik
            </label>
          </div>

          <div>
            <label className={label}>Toko tujuan</label>
            <div className="mb-2 flex gap-2 text-xs">
              <button type="button" onClick={() => up({ all_stores: true })} className={`rounded-full border px-3 py-1.5 ${r.all_stores ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 text-gray-600"}`}>Semua toko</button>
              <button type="button" onClick={() => up({ all_stores: false })} className={`rounded-full border px-3 py-1.5 ${!r.all_stores ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 text-gray-600"}`}>Pilih toko</button>
            </div>
            {!r.all_stores && (
              <>
                {groups.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {groups.map((g) => (
                      <button key={g.name} type="button" onClick={() => up({ user_names: [...new Set([...r.user_names, ...g.users])] })} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">+ {g.name}</button>
                    ))}
                  </div>
                )}
                <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-gray-200 p-2 text-xs">
                  {stores.map((s) => (
                    <label key={s.user_name} className="flex items-center gap-2 py-1">
                      <input type="checkbox" checked={r.user_names.includes(s.user_name)} onChange={() => toggleStore(s.user_name)} />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <label className={label}>Kapan tampil</label>
            <select value={r.recurrence} onChange={(e) => up({ recurrence: e.target.value as Recurrence })} className={field}>
              {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((k) => <option key={k} value={k}>{RECURRENCE_LABEL[k]}</option>)}
            </select>

            {r.recurrence === "once" && (
              <div className="mt-2"><label className={label}>Tanggal</label>
                <input type="date" min={today()} value={r.run_date} onChange={(e) => up({ run_date: e.target.value })} className={field} /></div>
            )}
            {r.recurrence === "weekly" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DAY_NAMES.map((n, d) => (
                  <button key={d} type="button" onClick={() => toggleDay(d)} className={`rounded-lg px-3 py-2 text-xs ${r.days.split(",").includes(String(d)) ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}>{n}</button>
                ))}
              </div>
            )}
            {r.recurrence === "monthly" && (
              <div className="mt-2"><label className={label}>Tanggal tiap bulan (31 = hari terakhir jika bulan lebih pendek)</label>
                <input type="number" min={1} max={31} value={r.day_of_month ?? 1} onChange={(e) => up({ day_of_month: Number(e.target.value) })} className={field} /></div>
            )}

            <div className="mt-2"><label className={label}>Jam (WIB)</label>
              <input type="time" value={hhmm(r.time_min)} onChange={(e) => up({ time_min: toMin(e.target.value) })} className={field} /></div>

            {r.recurrence !== "once" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div><label className={label}>Berlaku mulai (opsional)</label><input type="date" value={r.start_date} onChange={(e) => up({ start_date: e.target.value })} className={field} /></div>
                <div><label className={label}>Sampai (opsional)</label><input type="date" value={r.end_date} onChange={(e) => up({ end_date: e.target.value })} className={field} /></div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={r.active} onChange={(e) => up({ active: e.target.checked })} /> Aktif</label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs text-gray-500 hover:bg-gray-100">Batal</button>
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onSave(r); } finally { setBusy(false); } }}
            className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-medium text-white disabled:opacity-50"
          >{busy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}
