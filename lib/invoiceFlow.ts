// Alur dokumen Invoice/Quotation ala ERP — murni (tanpa DB) supaya bisa dipakai server, UI, dan tes.
//
//   Draft ──submit──► Need Approval ──approve──► Approved ──void──► Void
//     ▲                    │
//     └──── reject / recall┘            (Draft yang dihapus → Deleted, tersembunyi)
export type InvoiceStatus = "draft" | "submitted" | "approved" | "void" | "deleted";
export type InvoiceAction = "submit" | "recall" | "approve" | "reject" | "void" | "delete";

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Need Approval",
  approved: "Approved",
  void: "Void",
  deleted: "Deleted",
};

export interface Actor {
  userName: string;
  isApprover: boolean; // izin invoice_approval
  canCreate: boolean;  // invoice_create
  canEdit: boolean;    // invoice_edit
  canDelete: boolean;  // invoice_delete
}
export interface DocLike { status: string; created_by: string }

// Tanpa izin approval, user hanya melihat dokumen buatannya sendiri.
export function canView(doc: DocLike, a: Actor): boolean {
  return a.isApprover || (!!doc.created_by && doc.created_by === a.userName);
}

// Dokumen lama (migrasi) tidak punya pembuat → hanya approver yang mengurusnya.
const isOwner = (doc: DocLike, a: Actor) => !!doc.created_by && doc.created_by === a.userName;

export function canEditDoc(doc: DocLike, a: Actor): boolean {
  if (doc.status !== "draft") return false;
  if (a.isApprover) return true;
  return isOwner(doc, a) && (a.canCreate || a.canEdit);
}

export type Transition = { ok: true; to: InvoiceStatus } | { ok: false; error: string };

export function transition(doc: DocLike, action: InvoiceAction, a: Actor, note = ""): Transition {
  const st = doc.status;
  const owner = isOwner(doc, a);
  const deny = (error: string): Transition => ({ ok: false, error });
  switch (action) {
    case "submit":
      if (st !== "draft") return deny("Hanya dokumen Draft yang bisa diajukan");
      if (!(owner && (a.canCreate || a.canEdit)) && !a.isApprover) return deny("Hanya pembuat dokumen yang bisa mengajukan");
      return { ok: true, to: "submitted" };
    case "recall":
      if (st !== "submitted") return deny("Hanya dokumen Need Approval yang bisa ditarik kembali");
      if (!owner) return deny("Hanya pembuat dokumen yang bisa menarik kembali");
      return { ok: true, to: "draft" };
    case "approve":
      if (st !== "submitted") return deny("Hanya dokumen Need Approval yang bisa di-approve");
      if (!a.isApprover) return deny("Anda tidak punya izin approval");
      return { ok: true, to: "approved" };
    case "reject":
      if (st !== "submitted") return deny("Hanya dokumen Need Approval yang bisa di-reject");
      if (!a.isApprover) return deny("Anda tidak punya izin approval");
      if (!note.trim()) return deny("Alasan reject wajib diisi");
      return { ok: true, to: "draft" };
    case "void":
      if (st !== "approved") return deny("Hanya dokumen Approved yang bisa di-void");
      if (!a.isApprover) return deny("Anda tidak punya izin approval");
      if (!note.trim()) return deny("Alasan void wajib diisi");
      return { ok: true, to: "void" };
    case "delete":
      if (st !== "draft") return deny("Hanya dokumen Draft yang bisa dihapus (dokumen lain: gunakan Void)");
      if (!a.isApprover && !(owner && a.canDelete)) return deny("Anda tidak punya izin menghapus dokumen ini");
      return { ok: true, to: "deleted" };
  }
}

// Aksi yang tersedia untuk dokumen ini bagi user ini (dipakai UI untuk menampilkan tombol; server tetap memeriksa ulang).
export function availableActions(doc: DocLike, a: Actor): InvoiceAction[] {
  const all: InvoiceAction[] = ["submit", "recall", "approve", "reject", "void", "delete"];
  return all.filter((x) => transition(doc, x, a, "x").ok);
}
