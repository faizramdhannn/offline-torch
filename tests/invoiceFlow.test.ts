import { describe, it, expect } from "vitest";
import { availableActions, canEditDoc, canView, transition, type Actor } from "@/lib/invoiceFlow";
import { normalizeInput } from "@/lib/invoices";
import { terbilang } from "@/lib/terbilang";

const store: Actor = { userName: "cirebon", isApprover: false, canCreate: true, canEdit: true, canDelete: true };
const other: Actor = { userName: "jogja", isApprover: false, canCreate: true, canEdit: true, canDelete: true };
const approver: Actor = { userName: "faiz", isApprover: true, canCreate: false, canEdit: false, canDelete: false };
const doc = (status: string, created_by = "cirebon") => ({ status, created_by });

describe("visibilitas", () => {
  it("tanpa izin approval hanya dokumen buatan sendiri; approver melihat semua", () => {
    expect(canView(doc("draft"), store)).toBe(true);
    expect(canView(doc("draft"), other)).toBe(false);
    expect(canView(doc("approved"), approver)).toBe(true);
  });
  it("dokumen lama tanpa pembuat hanya terlihat approver", () => {
    expect(canView(doc("approved", ""), store)).toBe(false);
    expect(canView(doc("approved", ""), approver)).toBe(true);
  });
});

describe("alur Draft → Need Approval → Approved", () => {
  it("pembuat mengajukan Draft miliknya; orang lain tidak bisa", () => {
    expect(transition(doc("draft"), "submit", store)).toEqual({ ok: true, to: "submitted" });
    expect(transition(doc("draft"), "submit", other).ok).toBe(false);
  });
  it("hanya approver yang approve, dan hanya dari Need Approval", () => {
    expect(transition(doc("submitted"), "approve", approver)).toEqual({ ok: true, to: "approved" });
    expect(transition(doc("submitted"), "approve", store).ok).toBe(false);
    expect(transition(doc("draft"), "approve", approver).ok).toBe(false);
  });
  it("reject & void wajib alasan", () => {
    expect(transition(doc("submitted"), "reject", approver, "").ok).toBe(false);
    expect(transition(doc("submitted"), "reject", approver, "harga salah")).toEqual({ ok: true, to: "draft" });
    expect(transition(doc("approved"), "void", approver, "").ok).toBe(false);
    expect(transition(doc("approved"), "void", approver, "salah customer")).toEqual({ ok: true, to: "void" });
    expect(transition(doc("approved"), "void", store, "x").ok).toBe(false);
  });
  it("restore: Void → Approved hanya Super Admin dengan alasan", () => {
    const sa = { ...approver, isSuperAdmin: true };
    expect(transition(doc("void"), "restore", sa, "salah void")).toEqual({ ok: true, to: "approved" });
    expect(transition(doc("void"), "restore", sa, "").ok).toBe(false);
    expect(transition(doc("void"), "restore", approver, "x").ok).toBe(false);
    expect(transition(doc("approved"), "restore", sa, "x").ok).toBe(false);
  });
  it("tarik kembali hanya oleh pembuat saat Need Approval", () => {
    expect(transition(doc("submitted"), "recall", store)).toEqual({ ok: true, to: "draft" });
    expect(transition(doc("submitted"), "recall", other).ok).toBe(false);
  });
  it("hapus hanya Draft; dokumen lain harus di-void", () => {
    expect(transition(doc("draft"), "delete", store)).toEqual({ ok: true, to: "deleted" });
    expect(transition(doc("submitted"), "delete", approver).ok).toBe(false);
    expect(transition(doc("approved"), "delete", approver).ok).toBe(false);
    expect(transition(doc("draft"), "delete", { ...store, canDelete: false }).ok).toBe(false);
  });
  it("edit: tim toko hanya Draft miliknya; approver semua status kecuali Void/Deleted", () => {
    expect(canEditDoc(doc("draft"), store)).toBe(true);
    expect(canEditDoc(doc("submitted"), store)).toBe(false);
    expect(canEditDoc(doc("draft"), other)).toBe(false);
    expect(canEditDoc(doc("draft", "cirebon"), approver)).toBe(true);
    expect(canEditDoc(doc("submitted"), approver)).toBe(true);
    expect(canEditDoc(doc("approved"), approver)).toBe(true);
    expect(canEditDoc(doc("void"), approver)).toBe(false);
    expect(canEditDoc(doc("void"), { ...approver, isSuperAdmin: true })).toBe(true); // Super Admin boleh mengubah Void
    expect(canEditDoc(doc("deleted"), { ...approver, isSuperAdmin: true })).toBe(false);
  });
  it("availableActions untuk tampilan tombol", () => {
    expect(availableActions(doc("submitted"), approver).sort()).toEqual(["approve", "reject"]);
    expect(availableActions(doc("approved"), approver)).toEqual(["void"]);
    expect(availableActions(doc("draft"), store).sort()).toEqual(["delete", "submit"]);
  });
});

describe("normalisasi input", () => {
  const base = { doc_type: "invoice", invoice_number: "INV-1", invoice_date: "2026-10-16", customer_name: "PT A", items: [{ product_name: "Tas", qty: 2, unit_price: 100000 }] };
  it("harga sudah termasuk PPN: subtotal = DPP, PPN = total − DPP, total tetap", () => {
    const r = normalizeInput({ ...base, tax_percent: 11 } as any);
    expect(r.ok && r.v.grand_total).toBe(200000);
    expect(r.ok && r.v.subtotal).toBe(180180);   // 200.000 × 100/111
    expect(r.ok && r.v.tax_amount).toBe(19820);
    expect(r.ok && r.v.subtotal + r.v.tax_amount).toBe(200000);
    expect(r.ok && r.v.amount_in_words).toBe("Dua Ratus Ribu Rupiah");
  });
  it("tanpa PPN: subtotal = total", () => {
    const r = normalizeInput({ ...base, tax_percent: 0 } as any);
    expect(r.ok && r.v.subtotal).toBe(200000);
    expect(r.ok && r.v.tax_amount).toBe(0);
  });
  it("menolak data tidak valid", () => {
    expect(normalizeInput({ ...base, invoice_number: "" } as any).ok).toBe(false);
    expect(normalizeInput({ ...base, doc_type: "quotation", invoice_number: "" } as any).ok).toBe(true);
    expect(normalizeInput({ ...base, items: [] } as any).ok).toBe(false);
    expect(normalizeInput({ ...base, items: [{ product_name: "x", qty: 0, unit_price: 1 }] } as any).ok).toBe(false);
    expect(normalizeInput({ ...base, invoice_date: "besok" } as any).ok).toBe(false);
  });
});

describe("terbilang", () => {
  it("angka umum", () => {
    expect(terbilang(0)).toBe("Nol Rupiah");
    expect(terbilang(1500)).toBe("Seribu Lima Ratus Rupiah");
    expect(terbilang(5055200)).toBe("Lima Juta Lima Puluh Lima Ribu Dua Ratus Rupiah");
    expect(terbilang(111)).toBe("Seratus Sebelas Rupiah");
  });
});
