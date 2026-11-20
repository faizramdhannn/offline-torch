"use client";

import { UserCheck } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

export interface StoreAttendance { store: string; open: string; close: string }

const title = (s: string) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/** Status Capture Attendance tiap toko hari ini: Belum buka / Buka HH:MM / Tutup HH:MM. Merchant tidak ikut (tidak capture). */
export function AttendanceStatus({ rows, loading, className }: { rows: StoreAttendance[]; loading: boolean; className?: string }) {
  const opened = rows.filter((r) => r.open).length;
  return (
    <SectionCard title="Absensi Toko" subtitle={loading ? "" : `${opened}/${rows.length} sudah buka`} icon={UserCheck} accent="green" className={className}>
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
                    {state === "closed" ? `Tutup ${r.close}` : state === "open" ? `Buka ${r.open}` : "Belum buka"}
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
