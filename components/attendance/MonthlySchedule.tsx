"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Clock3, Flame, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { DateEntry, ScheduleRow, TaftEntry } from "./types";
import { CODE_COLORS, DAYS, DAY_LABELS, MONTH_SHORT_ID } from "./constants";
import { codeHours, dateRangeDates, fmtISO, monthsCovered, toTitleCase, totalHours, totalOvertime, visibleMonths, weekSlotOf } from "./utils";

// Jadwal sebulan penuh: baris = TAFT per toko, kolom = tanggal. Kode jadwal diambil dari jadwal mingguan
// (sheet schedule_taft, satu baris per TAFT per minggu) dan dipetakan ke tanggal lewat date_list.
// Jam kerja & lembur terjadwal dihitung dari kode (lihat constants.ts) — hanya tanggal yang jatuh di bulan terpilih.

interface Props {
  user: any;
  isStoreUser: boolean;
  myStoreName: string;
}

const fmtShort = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_SHORT_ID[m - 1]} ${y}`;
};
const monthBounds = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return { from: fmtISO(new Date(y, mo - 1, 1)), to: fmtISO(new Date(y, mo, 0)) };
};

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

const Chip = ({ code }: { code: string }) =>
  code ? (
    <span className={`inline-flex min-w-[22px] items-center justify-center rounded-md px-1 py-0.5 text-[10px] font-bold leading-none ${CODE_COLORS[code.toUpperCase()] || "bg-gray-100 text-gray-700"}`}>{code}</span>
  ) : (
    <span className="text-[10px] text-gray-300">·</span>
  );

export function MonthlySchedule({ isStoreUser, myStoreName }: Props) {
  const [dateList, setDateList] = useState<DateEntry[]>([]);
  const [allTaftList, setAllTaftList] = useState<TaftEntry[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [from, setFrom] = useState(""); // rentang tampil (YYYY-MM-DD); pilihan bulan hanya jalan pintas untuk mengisinya
  const [to, setTo] = useState("");
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);

  const months = useMemo(() => visibleMonths(monthsCovered(dateList)), [dateList]); // bulan > 2 bulan lalu disembunyikan dari filter
  const allStores = useMemo(() => [...new Set(allTaftList.map((t) => t.store_name))], [allTaftList]);

  useEffect(() => {
    fetch("/api/attendance/meta?type=all")
      .then((r) => r.json())
      .then((d) => {
        const dl: DateEntry[] = Array.isArray(d.dateList) ? d.dateList : [];
        setDateList(dl);
        setAllTaftList(Array.isArray(d.taftList) ? d.taftList : []);
        const cov = monthsCovered(dl);
        const now = new Date();
        const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const b = monthBounds(cov.includes(cur) ? cur : cov[0] || cur);
        setFrom(b.from);
        setTo(b.to);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isStoreUser && myStoreName) setSelectedStore(myStoreName);
  }, [isStoreUser, myStoreName]);

  const days = useMemo(() => dateRangeDates(from, to), [from, to]);
  const slots = useMemo(() => days.map((d) => weekSlotOf(d, dateList)), [days, dateList]);

  // Ambil jadwal semua minggu yang menyentuh bulan ini sekaligus (satu permintaan).
  useEffect(() => {
    const ranges = [...new Set(slots.filter(Boolean).map((s) => s!.dateRange))];
    if (!from || ranges.length === 0) { setSchedules([]); return; }
    let cancelled = false;
    setLoading(true);
    const qs = ranges.map((r) => `date_range=${encodeURIComponent(r)}`).join("&");
    const store = selectedStore ? `&store_name=${encodeURIComponent(selectedStore)}` : "";
    fetch(`/api/attendance/schedule?${qs}${store}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { if (!cancelled) setSchedules(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setSchedules([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, selectedStore, slots]);

  const byKey = useMemo(() => {
    const m = new Map<string, ScheduleRow>();
    schedules.forEach((r) => m.set(`${r.store_name}__${r.taft_name}__${r.date_range}`, r));
    return m;
  }, [schedules]);

  const tafts = selectedStore ? allTaftList.filter((t) => t.store_name?.toLowerCase() === selectedStore.toLowerCase()) : allTaftList;

  const people = useMemo(
    () =>
      tafts.map((t) => {
        const codes = slots.map((s) => {
          if (!s) return "";
          const row = byKey.get(`${t.store_name}__${t.taft_name}__${s.dateRange}`);
          return ((row?.[DAYS[s.dayIndex] as keyof ScheduleRow] as string) || "").trim();
        });
        return {
          taft: t,
          codes,
          workDays: codes.filter((c) => codeHours(c, t.store_name) > 0).length,
          jam: totalHours(codes, t.store_name),
          lembur: totalOvertime(codes, t.store_name),
        };
      }),
    [tafts, slots, byKey]
  );

  const groups = useMemo(() => {
    const g: { storeName: string; items: typeof people }[] = [];
    people.forEach((p) => {
      let grp = g.find((x) => x.storeName === p.taft.store_name);
      if (!grp) { grp = { storeName: p.taft.store_name, items: [] }; g.push(grp); }
      grp.items.push(p);
    });
    return g;
  }, [people]);

  const totals = useMemo(
    () => ({ n: people.length, jam: people.reduce((a, p) => a + p.jam, 0), lembur: people.reduce((a, p) => a + p.lembur, 0) }),
    [people]
  );

  const todayISO = fmtISO(new Date());
  // Pilihan bulan aktif hanya bila rentang persis satu bulan penuh; selain itu "Rentang kustom".
  const selMonth = months.find((m) => { const b = monthBounds(m); return b.from === from && b.to === to; }) ?? "custom";
  const idx = months.indexOf(selMonth);
  const applyMonth = (m: string) => { const b = monthBounds(m); setFrom(b.from); setTo(b.to); };
  const go = (delta: number) => { const n = months[idx + delta]; if (n) applyMonth(n); }; // months terbaru dulu: idx+1 = bulan lebih lama
  // Jalan pintas periode 26 – 25: dari tanggal 26 bulan sebelumnya sampai tanggal 25 bulan terpilih.
  const cutoff = () => {
    const base = selMonth !== "custom" ? selMonth : (to || from).slice(0, 7);
    const [y, mo] = base.split("-").map(Number);
    if (!y || !mo) return;
    setFrom(fmtISO(new Date(y, mo - 2, 26)));
    setTo(fmtISO(new Date(y, mo - 1, 25)));
  };
  const rangeText = from && to ? `${fmtShort(days[0] ? fmtISO(days[0]) : from)} – ${fmtShort(days.length ? fmtISO(days[days.length - 1]) : to)}` : "";
  const dayIdxOf = (d: Date) => (d.getDay() + 6) % 7; // Senin = 0
  const hasAnyCode = people.some((p) => p.codes.some(Boolean));

  const fieldCls = "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20";

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1">
          <button onClick={() => go(1)} disabled={idx < 0 || idx >= months.length - 1} aria-label="Bulan sebelumnya" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select value={selMonth} onChange={(e) => e.target.value !== "custom" && applyMonth(e.target.value)} className={`${fieldCls} min-w-[150px] font-semibold`} aria-label="Bulan">
            {months.length === 0 && <option value="">Memuat…</option>}
            {selMonth === "custom" && <option value="custom">Rentang kustom</option>}
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button onClick={() => go(-1)} disabled={idx <= 0} aria-label="Bulan berikutnya" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <label className="whitespace-nowrap text-[11px] font-medium text-gray-500" htmlFor="ms-from">Tanggal</label>
          <input id="ms-from" type="date" value={from} max={to || undefined} onChange={(e) => e.target.value && setFrom(e.target.value)} className={fieldCls} />
          <span className="text-[11px] text-gray-400">s.d.</span>
          <input id="ms-to" type="date" value={to} min={from || undefined} onChange={(e) => e.target.value && setTo(e.target.value)} className={fieldCls} aria-label="Sampai tanggal" />
          <button onClick={cutoff} title="Dari tanggal 26 bulan sebelumnya sampai tanggal 25 bulan ini" className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:border-primary hover:text-primary">Periode 26–25</button>
        </div>

        {isStoreUser ? (
          <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">{toTitleCase(myStoreName)}</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Store</label>
            <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className={fieldCls}>
              <option value="">Semua Store</option>
              {allStores.map((s) => <option key={s} value={s}>{toTitleCase(s)}</option>)}
            </select>
          </div>
        )}
        {loading && <span className="text-[11px] text-gray-400">Memuat jadwal…</span>}
        {rangeText && !loading && <span className="ml-auto rounded-md bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary">{rangeText} · {days.length} hari</span>}
      </div>

      {/* Ringkasan */}
      {from && people.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users, label: "TAFT", value: totals.n, unit: "orang", cls: "text-primary bg-primary/10" },
            { icon: Clock3, label: "Total jam kerja", value: totals.jam.toLocaleString("id-ID"), unit: "jam", cls: "text-blue-600 bg-blue-50" },
            { icon: Flame, label: "Total lembur", value: totals.lembur.toLocaleString("id-ID"), unit: "jam", cls: "text-orange-600 bg-orange-50" },
          ].map((k) => (
            <div key={k.label} className="flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${k.cls}`}><k.icon className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-gray-400">{k.label}</p>
                <p className="text-base font-bold leading-tight text-gray-900">{k.value} <span className="text-[10px] font-medium text-gray-400">{k.unit}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!from ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><EmptyState icon={CalendarX2} title="Memuat periode…" /></div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><EmptyState icon={CalendarX2} title="Tidak ada data taft" /></div>
      ) : !hasAnyCode && !loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <EmptyState icon={CalendarDays} title={`Belum ada jadwal ${rangeText}`} description="Isi jadwal per minggu di tab Weekly, lalu tampil di sini." />
        </div>
      ) : (
        <>
          {/* Desktop: tabel kalender */}
          <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table data-stack="off" className="w-full border-separate border-spacing-0 text-[11px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 min-w-[150px] border-b border-r border-gray-200 bg-[#f9fafb] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Nama TAFT</th>
                    {days.map((d, i) => {
                      const wi = dayIdxOf(d);
                      const weekend = wi >= 5;
                      const isToday = fmtISO(d) === todayISO;
                      return (
                        <th key={d.getTime()} className={`min-w-[30px] border-b border-gray-200 px-0 py-1.5 text-center ${isToday ? "bg-[#dbeafe] text-blue-700" : weekend ? "bg-[#fff1f2] text-rose-500" : "bg-[#f9fafb] text-gray-500"}`}>
                          <div className="text-[12px] font-bold leading-none">{d.getDate()}</div>
                          <div className="mt-0.5 text-[8px] font-medium uppercase leading-none">{DAY_LABELS[wi]}</div>
                          {(i === 0 || d.getDate() === 1) && <div className="mt-0.5 text-[8px] font-bold uppercase leading-none text-primary">{MONTH_SHORT_ID[d.getMonth()]}</div>}
                        </th>
                      );
                    })}
                    <th style={{ right: 128 }} className="sticky z-20 w-16 min-w-[64px] border-b border-l border-gray-200 bg-[#f9fafb] px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">Hari</th>
                    <th style={{ right: 64 }} className="sticky z-20 w-16 min-w-[64px] border-b border-gray-200 bg-[#f9fafb] px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">Jam</th>
                    <th style={{ right: 0 }} className="sticky z-20 w-16 min-w-[64px] border-b border-gray-200 bg-[#f9fafb] px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-orange-600">Lembur</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(({ storeName, items }) => (
                    <React.Fragment key={storeName}>
                      <tr>
                        <td colSpan={days.length + 4} className="sticky left-0 border-b border-primary/10 bg-[#eef5f7] px-3 py-1.5">
                          <span className="text-[11px] font-bold text-primary">{toTitleCase(storeName)}</span>
                          <span className="ml-2 text-[10px] text-gray-500">{items.length} taft</span>
                        </td>
                      </tr>
                      {items.map((p, ri) => {
                        const zebra = ri % 2 ? "bg-[#f7f8f9]" : "bg-[#ffffff]"; // solid: kolom sticky tidak boleh tembus pandang (bg-white global bersifat transparan)
                        return (
                          <tr key={`${p.taft.store_name}__${p.taft.taft_name}`} className="group">
                            <td className={`sticky left-0 z-10 border-b border-r border-gray-100 px-3 py-1.5 font-medium text-gray-800 ${zebra}`}>
                              <span className="block max-w-[150px] truncate" title={p.taft.taft_name}>{p.taft.taft_name}</span>
                            </td>
                            {p.codes.map((c, i) => {
                              const wi = dayIdxOf(days[i]);
                              const isToday = fmtISO(days[i]) === todayISO;
                              return (
                                <td key={i} className={`border-b border-gray-100 px-0 py-1 text-center ${isToday ? "bg-[#eff6ff]" : wi >= 5 ? "bg-[#fff7f8]" : zebra}`}>
                                  <Chip code={c} />
                                </td>
                              );
                            })}
                            <td style={{ right: 128 }} className={`sticky z-10 border-b border-l border-gray-100 px-1 py-1.5 text-center font-semibold text-gray-700 ${zebra}`}>{p.workDays}</td>
                            <td style={{ right: 64 }} className={`sticky z-10 border-b border-gray-100 px-1 py-1.5 text-center font-bold text-gray-900 ${zebra}`}>{p.jam || <span className="font-normal text-gray-300">—</span>}</td>
                            <td style={{ right: 0 }} className={`sticky z-10 border-b border-gray-100 px-1 py-1.5 text-center font-bold text-orange-600 ${zebra}`}>{p.lembur || <span className="font-normal text-gray-300">—</span>}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Legend />
          </div>

          {/* HP: kartu per TAFT dengan kalender mini */}
          <div className="space-y-4 md:hidden">
            {groups.map(({ storeName, items }) => (
              <div key={storeName} className="space-y-2">
                <p className="px-1 text-xs font-bold text-primary">{toTitleCase(storeName)} <span className="font-normal text-gray-400">· {items.length} taft</span></p>
                {items.map((p) => (
                  <div key={`${p.taft.store_name}__${p.taft.taft_name}`} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-gray-900">{p.taft.taft_name}</p>
                      <div className="flex flex-none gap-1 text-[10px] font-bold">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{p.workDays} hari</span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{p.jam} jam</span>
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-600">{p.lembur} lembur</span>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                      {DAY_LABELS.map((l, i) => <span key={l} className={`text-[9px] font-semibold uppercase ${i >= 5 ? "text-rose-500" : "text-gray-400"}`}>{l}</span>)}
                      {Array.from({ length: dayIdxOf(days[0]) }).map((_, i) => <span key={`b${i}`} />)}
                      {p.codes.map((c, i) => {
                        const isToday = fmtISO(days[i]) === todayISO;
                        return (
                          <div key={i} className={`flex flex-col items-center gap-0.5 rounded-lg py-1 ${isToday ? "bg-blue-50 ring-1 ring-blue-300" : dayIdxOf(days[i]) >= 5 ? "bg-rose-50/50" : ""}`}>
                            <span className="text-[9px] leading-none text-gray-400">{days[i].getDate()}{(i === 0 || days[i].getDate() === 1) ? `/${days[i].getMonth() + 1}` : ""}</span>
                            <Chip code={c} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <Legend />
          </div>
        </>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2 md:rounded-b-2xl">
      {Object.entries(CODE_COLORS).map(([code, cls]) => (
        <span key={code} className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${cls}`}>{code}</span>
      ))}
      <span className="text-[9px] text-gray-500 md:ml-auto">
        Jam: P/S/M 8 · MF 10 · F 12 (Karawang, Purwokerto, Jogja 13) · O, C, +, I, A 0 | Lembur: MF 2 · F 4 (Karawang, Purwokerto, Jogja 5)
      </span>
    </div>
  );
}
