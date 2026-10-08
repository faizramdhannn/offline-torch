import type { UserRow } from "./users";
import { getSheetData } from "./sheets";

// Jumlah permintaan yang MENUNGGU tindakan, hanya untuk menu yang boleh diubah statusnya oleh user itu
// (flag yang sama dengan yang membuka tombol ubah status di halamannya). Dihitung dari data sheet yang
// sudah ter-cache server (5 menit), jadi tidak menambah panggilan Google Sheets.
export interface PendingCounts {
  cancel_order?: number;
  material_issue?: number;
  employee_discount?: number;
  shipment?: number;
}

const isTrue = (v: unknown) => v === "TRUE";
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export async function computePending(user: UserRow): Promise<PendingCounts> {
  const out: PendingCounts = {};
  const jobs: Promise<void>[] = [];

  // Cancel Order: status "Pending" — untuk yang boleh mengubah status (edit_request).
  if (isTrue(user.edit_request)) {
    jobs.push(
      getSheetData("request_store").then((rows: any[]) => {
        out.cancel_order = rows.filter((r) => r.id && norm(r.status) === "pending").length;
      })
    );
  }

  // Shipment: belum diproses (has_processed bukan TRUE) — untuk tracking_edit.
  if (isTrue(user.tracking_edit)) {
    jobs.push(
      getSheetData("request_tracking").then((rows: any[]) => {
        out.shipment = rows.filter((r) => r.id && norm(r.has_processed) !== "true").length;
      })
    );
  }

  // Material Issue: grup (id) yang belum tuntas — persetujuan request/issue atau belum diproses (material_issue_all).
  if (isTrue(user.material_issue_all)) {
    jobs.push(
      getSheetData("material_issue").then((rows: any[]) => {
        const pending = new Set<string>();
        for (const r of rows) {
          if (!r.id) continue;
          if (norm(r.status_request) !== "approved" || norm(r.status_issue) !== "approved" || norm(r.has_processed) !== "true") {
            pending.add(String(r.id));
          }
        }
        out.material_issue = pending.size;
      })
    );
  }

  // Employee Discount: menunggu persetujuan (employee_discount_approval).
  if (isTrue(user.employee_discount_approval)) {
    jobs.push(
      getSheetData("request_discount").then((rows: any[]) => {
        const pending = new Set<string>();
        for (const r of rows) {
          if (r.id && (norm(r.status_request) === "need approval" || norm(r.status_request) === "")) pending.add(String(r.id));
        }
        out.employee_discount = pending.size;
      })
    );
  }

  await Promise.all(jobs);
  return out;
}
