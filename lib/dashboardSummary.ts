import type { UserRow } from "./users";
import { getSheetData } from "./sheets";
import { computePending, type PendingCounts } from "./pendingCounts";
import { parseIdDateTime } from "./idDate";
import { tsToISO, tsToTime, todayWIB } from "./attendanceTime";

// Ringkasan "Perlu tindakan" untuk dashboard. Semua dihitung dari sheet yang SUDAH ter-cache server (5 menit,
// sama dengan badge sidebar) → tidak menambah panggilan Google Sheets. Daftar pratinjau dibatasi 5 baris
// tertua (yang paling lama menunggu) supaya balasan kecil.
export interface PendingItem { id: string; title: string; sub: string; created_at: string }
// Capture Attendance (sheet attendance_store) hari ini: satu baris per toko yang sudah buka.
export interface CaptureToday { store: string; open: string; close: string }
export interface DashboardSummary {
  pending: PendingCounts;
  capture: CaptureToday[];
  lists: { cancel_order?: PendingItem[]; shipment?: PendingItem[] };
}

const isTrue = (v: unknown) => v === "TRUE";
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const oldestFirst = (a: PendingItem, b: PendingItem) => (parseIdDateTime(a.created_at) || 0) - (parseIdDateTime(b.created_at) || 0);

// Capture Attendance (attendance_store) pada tanggal tertentu (WIB, YYYY-MM-DD); baris terakhir per toko yang dipakai.
export async function computeCapture(date: string): Promise<CaptureToday[]> {
  const rows: any[] = await getSheetData("attendance_store");
  const byStore = new Map<string, CaptureToday>();
  for (const r of rows) {
    if (!r.store_name) continue;
    const openTs = String(r.open_timestamp || "");
    if (tsToISO(openTs) !== date && !String(r.created_at || "").startsWith(date) && tsToISO(String(r.created_at || "")) !== date) continue;
    byStore.set(String(r.store_name), { store: String(r.store_name), open: tsToTime(openTs), close: tsToTime(String(r.close_timestamp || "")) });
  }
  return [...byStore.values()];
}

export async function computeDashboardSummary(user: UserRow): Promise<DashboardSummary> {
  const lists: DashboardSummary["lists"] = {};
  const jobs: Promise<void>[] = [];

  if (isTrue(user.edit_request)) {
    jobs.push(
      getSheetData("request_store").then((rows: any[]) => {
        lists.cancel_order = rows
          .filter((r) => r.id && norm(r.status) === "pending")
          .map((r) => ({ id: String(r.id), title: String(r.requester || "-"), sub: String(r.reason_request || r.sales_order || ""), created_at: String(r.created_at || r.date || "") }))
          .sort(oldestFirst)
          .slice(0, 5);
      })
    );
  }
  if (isTrue(user.tracking_edit)) {
    jobs.push(
      getSheetData("request_tracking").then((rows: any[]) => {
        lists.shipment = rows
          .filter((r) => r.id && !String(r.link_tracking ?? "").trim())
          .map((r) => ({ id: String(r.id), title: String(r.receiver || r.request_by || "-"), sub: [r.expedition, r.reason].filter(Boolean).join(" · "), created_at: String(r.created_at || r.date || "") }))
          .sort(oldestFirst)
          .slice(0, 5);
      })
    );
  }
  // Absensi toko (capture) hari ini — semua toko, untuk pemegang izin dashboard (route ini sudah dibatasi izin itu).
  let capture: CaptureToday[] = [];
  jobs.push(computeCapture(todayWIB()).then((c) => { capture = c; }));
  const [pending] = await Promise.all([computePending(user), ...jobs]);
  return { pending, lists, capture };
}
