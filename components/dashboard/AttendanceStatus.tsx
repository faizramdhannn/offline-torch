"use client";

import { UserCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

export interface StoreAttendance { store: string; open: string; close: string }

const title = (s: string) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const shift = (iso: string, d: number) => { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const dayLabel = (iso: string, today: string) =>
  iso === today ? "Hari ini" : iso === shift(today, -1) ? "Kemarin" : iso === shift(today, 1) ? "Besok"
    : new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`));

/** Status Capture Attendance tiap toko hari ini: Belum buka / Buka HH:MM / Tutup HH:MM. Merchant tidak ikut (tidak capture). */
export function AttendanceStatus({ rows, loading, className, date, today, onDateChange }: { rows: StoreAttendance[]; loading: boolean; className?: string; date: string; today: string; onDateChange: (iso: string) => void }) {
  const opened = rows.filter((r) => r.open).length;
  return (
    <SectionCard title="Absensi Toko" subtitle={loading ? "" : `${opened}/${rows.length} ${date > today ? "dijadwalkan" : "sudah buka"}`} icon={UserCheck} accent="green" className={className}
      toolbar={
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onDateChange(shift(date, -1))} aria-label="Hari sebelumnya" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => onDateChange(today)} disabled={date === today} title="Kembali ke hari ini" className="min-w-[4.5rem] rounded-md px-1.5 py-1 text-center text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:hover:bg-transparent">{dayLabel(date, today)}</button>
          <button type="button" onClick={() => onDateChange(shift(date, 1))} disabled={date >= shift(today, 1)} aria-label="Hari berikutnya" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight className="h-4 w-4" /></button>
        </div>
      }>
      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-gray-100" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={UserCheck} message="Belum ada data toko" />
      ) : (
        <ul className="max-h-72 space-y-2.5 overflow-auto pr-1">
          {rows.map((r) => {
            const state = r.close ? "closed" : r.open ? "open" : "none";
            return (
              <li key={r.store}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-gray-800">{title(r.store)}</span>
                  <span className={cn("flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    state === "closed" && "bg-sky-100 text-sky-700", state === "open" && "bg-emerald-100 text-emerald-700", state === "none" && "bg-gray-100 text-gray-500")}>
                    {state === "closed" ? `Tutup ${r.close}` : state === "open" ? `Buka ${r.open}` : date > today ? "—" : "Belum buka"}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className={cn("h-full rounded-full transition-all duration-700", state === "closed" ? "bg-sky-500" : state === "open" ? "bg-emerald-500" : "bg-gray-300")} style={{ width: state === "closed" ? "100%" : state === "open" ? "50%" : "0%" }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
