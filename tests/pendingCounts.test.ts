import { describe, it, expect, vi, beforeEach } from "vitest";

const data: Record<string, any[]> = {};
vi.mock("@/lib/sheets", () => ({ getSheetData: async (name: string) => data[name] || [] }));
vi.mock("../lib/sheets", () => ({ getSheetData: async (name: string) => data[name] || [] }));

import { computePending } from "@/lib/pendingCounts";

const user = (flags: string[]) => Object.fromEntries(flags.map((f) => [f, "TRUE"])) as any;

beforeEach(() => {
  data.request_store = [
    { id: "1", status: "Pending" }, { id: "2", status: "pending " }, { id: "3", status: "Completed" },
  ];
  data.request_tracking = [
    { id: "a", has_processed: "FALSE" }, { id: "b", has_processed: "TRUE" }, { id: "c", has_processed: "" },
  ];
  data.material_issue = [
    // grup m1: dua baris, request belum disetujui → 1 grup pending
    { id: "m1", status_request: "Need Approval", status_issue: "Approved", has_processed: "TRUE" },
    { id: "m1", status_request: "Need Approval", status_issue: "Approved", has_processed: "TRUE" },
    // grup m2: tuntas
    { id: "m2", status_request: "Approved", status_issue: "Approved", has_processed: "TRUE" },
    // grup m3: disetujui tapi belum diproses → pending
    { id: "m3", status_request: "Approved", status_issue: "Approved", has_processed: "FALSE" },
  ];
  data.request_discount = [
    { id: "d1", status_request: "Need Approval" }, { id: "d1", status_request: "Need Approval" },
    { id: "d2", status_request: "Approved" },
  ];
});

describe("angka pending sidebar", () => {
  it("hanya menghitung menu yang boleh diubah statusnya oleh user itu", async () => {
    expect(await computePending(user([]))).toEqual({});
    expect(await computePending(user(["request", "material_issue", "employee_discount", "request_tracking"]))).toEqual({});
    expect(await computePending(user(["edit_request"]))).toEqual({ cancel_order: 2 });
    expect(await computePending(user(["tracking_edit"]))).toEqual({ shipment: 2 });
    expect(await computePending(user(["employee_discount_approval"]))).toEqual({ employee_discount: 1 });
    expect(await computePending(user(["material_issue_all"]))).toEqual({ material_issue: 2 });
  });

  it("Super Admin (semua flag) mendapat keempatnya; baris material issue dihitung per grup", async () => {
    const all = await computePending(user(["edit_request", "tracking_edit", "employee_discount_approval", "material_issue_all"]));
    expect(all).toEqual({ cancel_order: 2, shipment: 2, employee_discount: 1, material_issue: 2 });
  });
});
