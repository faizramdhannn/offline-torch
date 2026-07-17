"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import { Button } from "@/components/shared/Button";
import { Pencil, Trash2, Save, X } from "lucide-react";

interface ChecklistRow {
  id: string;
  created_at: string;
  update_at: string;
  taft_by: string;
  role_taft: string;
  name: string;
  cleaning_store_checklist: string;
  vm_report_checklist: string;
  whatsapp_group_checklis: string;
  delivery_note_checklist: string;
  status_delivery_note: string;
  total_delivery_note: string;
  total_error_delivery_note: string;
  notes_delivery_note: string;
  sales_order_checklist: string;
  status_sales_order: string;
  total_sales_order: string;
  total_error_sales_order: string;
  notes_sales_order: string;
  stock_entry_checklist: string;
  status_stock_entry: string;
  total_stock_entry: string;
  total_error_stock_entry: string;
  stock_entry_notes: string;
}

const STATUS_OPTIONS = ["Clear", "Issue"];

interface FormState {
  taft_by: string;
  role_taft: string;
  cleaning_store_checklist: boolean;
  vm_report_checklist: boolean;
  whatsapp_group_checklis: boolean;
  delivery_note_checklist: boolean;
  status_delivery_note: string;
  total_delivery_note: string;
  total_error_delivery_note: string;
  notes_delivery_note: string;
  sales_order_checklist: boolean;
  status_sales_order: string;
  total_sales_order: string;
  total_error_sales_order: string;
  notes_sales_order: string;
  stock_entry_checklist: boolean;
  status_stock_entry: string;
  total_stock_entry: string;
  total_error_stock_entry: string;
  stock_entry_notes: string;
}

const emptyForm: FormState = {
  taft_by: "",
  role_taft: "",
  cleaning_store_checklist: false,
  vm_report_checklist: false,
  whatsapp_group_checklis: false,
  delivery_note_checklist: false,
  status_delivery_note: "",
  total_delivery_note: "",
  total_error_delivery_note: "0",
  notes_delivery_note: "",
  sales_order_checklist: false,
  status_sales_order: "",
  total_sales_order: "",
  total_error_sales_order: "0",
  notes_sales_order: "",
  stock_entry_checklist: false,
  status_stock_entry: "",
  total_stock_entry: "",
  total_error_stock_entry: "0",
  stock_entry_notes: "",
};

function boolStr(v: boolean): string {
  return v ? "TRUE" : "FALSE";
}
function strBool(v: string | undefined): boolean {
  return (v || "").toUpperCase() === "TRUE";
}

function rowToForm(row: ChecklistRow): FormState {
  return {
    taft_by: row.taft_by || "",
    role_taft: row.role_taft || "",
    cleaning_store_checklist: strBool(row.cleaning_store_checklist),
    vm_report_checklist: strBool(row.vm_report_checklist),
    whatsapp_group_checklis: strBool(row.whatsapp_group_checklis),
    delivery_note_checklist: strBool(row.delivery_note_checklist),
    status_delivery_note: row.status_delivery_note || "",
    total_delivery_note: row.total_delivery_note || "",
    total_error_delivery_note: row.total_error_delivery_note || "0",
    notes_delivery_note: row.notes_delivery_note || "",
    sales_order_checklist: strBool(row.sales_order_checklist),
    status_sales_order: row.status_sales_order || "",
    total_sales_order: row.total_sales_order || "",
    total_error_sales_order: row.total_error_sales_order || "0",
    notes_sales_order: row.notes_sales_order || "",
    stock_entry_checklist: strBool(row.stock_entry_checklist),
    status_stock_entry: row.status_stock_entry || "",
    total_stock_entry: row.total_stock_entry || "",
    total_error_stock_entry: row.total_error_stock_entry || "0",
    stock_entry_notes: row.stock_entry_notes || "",
  };
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 py-2 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="text-xs text-gray-700 font-medium">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5.5 h-[22px] rounded-full transition-colors shrink-0 ${
          checked ? "bg-primary" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

export default function DailyChecklistPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [row, setRow] = useState<ChecklistRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [roleTaftOptions, setRoleTaftOptions] = useState<string[]>([]);
  const [taftOptions, setTaftOptions] = useState<string[]>([]);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showMessage = (msg: string, type: "success" | "error") => {
    setPopupMessage(msg);
    setPopupType(type);
    setShowPopup(true);
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.daily_checklist && !u.daily_checklist_all) { router.push("/dashboard"); return; }
    setUser(u);
  }, []);

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-job/dropdown");
      if (res.ok) {
        const j = await res.json();
        setRoleTaftOptions(j.role_taft || []);
      }
    } catch {}
  }, []);

  // Taft By: sama konsepnya seperti Employee Discount — resolve dari
  // master_traffic berdasarkan toko akun yang login (bukan free text).
  const fetchTaftOptions = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/employee-discount?resource=taft&userName=${encodeURIComponent(user.user_name || "")}`);
      if (res.ok) {
        const j = await res.json();
        setTaftOptions(j.taftsForStore || []);
      }
    } catch {}
  }, [user]);

  const fetchToday = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-job/checklist?userName=${encodeURIComponent(user.user_name)}&name=${encodeURIComponent(user.name || "")}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setRow(data || null);
        if (!data) {
          setForm(emptyForm);
          setEditing(true);
        } else {
          setEditing(false);
        }
      }
    } catch {
      showMessage("Gagal memuat data checklist", "error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchDropdowns();
    fetchTaftOptions();
    fetchToday();
  }, [user, fetchDropdowns, fetchTaftOptions, fetchToday]);

  const canEdit = !!user?.daily_checklist;

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.taft_by) {
      showMessage("Taft By wajib dipilih", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: row?.id,
        taft_by: form.taft_by,
        name: user.name,
        role_taft: form.role_taft,
        cleaning_store_checklist: boolStr(form.cleaning_store_checklist),
        vm_report_checklist: boolStr(form.vm_report_checklist),
        whatsapp_group_checklis: boolStr(form.whatsapp_group_checklis),
        delivery_note_checklist: boolStr(form.delivery_note_checklist),
        status_delivery_note: form.status_delivery_note,
        total_delivery_note: form.total_delivery_note,
        total_error_delivery_note: form.total_error_delivery_note,
        notes_delivery_note: form.notes_delivery_note,
        sales_order_checklist: boolStr(form.sales_order_checklist),
        status_sales_order: form.status_sales_order,
        total_sales_order: form.total_sales_order,
        total_error_sales_order: form.total_error_sales_order,
        notes_sales_order: form.notes_sales_order,
        stock_entry_checklist: boolStr(form.stock_entry_checklist),
        status_stock_entry: form.status_stock_entry,
        total_stock_entry: form.total_stock_entry,
        total_error_stock_entry: form.total_error_stock_entry,
        stock_entry_notes: form.stock_entry_notes,
      };

      const res = await fetch("/api/daily-job/checklist", {
        method: row ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      showMessage(row ? "Checklist berhasil diperbarui" : "Checklist berhasil dibuat", "success");
      await fetchToday();
    } catch {
      showMessage("Gagal menyimpan checklist", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!row) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/daily-job/checklist?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showMessage("Checklist berhasil dihapus", "success");
      setShowDeleteConfirm(false);
      setRow(null);
      setForm(emptyForm);
      setEditing(true);
    } catch {
      showMessage("Gagal menghapus checklist", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    if (row) setForm(rowToForm(row));
    setEditing(true);
  };

  if (!user) return null;

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto">
      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Daily Checklist</h1>
          <p className="text-xs text-gray-500">Checklist harian toko — {user.name}</p>
        </div>
        {row && !editing && canEdit && (
          <div className="flex gap-2">
            <Button icon={Pencil} size="sm" onClick={startEdit}>Edit</Button>
            <Button icon={Trash2} size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              Hapus
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400 text-sm">Memuat data...</div>
      ) : !editing && row ? (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="text-xs text-gray-500">
            Diisi: {row.created_at} {row.update_at && row.update_at !== row.created_at ? `(update: ${row.update_at})` : ""}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-gray-500">Taft By</span><p className="font-semibold">{row.taft_by || "-"}</p></div>
            <div><span className="text-gray-500">Role Taft</span><p className="font-semibold">{row.role_taft || "-"}</p></div>
          </div>

          <div className="border-t pt-3 space-y-1">
            <ReadRow label="Cleaning Store" value={strBool(row.cleaning_store_checklist)} />
            <ReadRow label="VM Report" value={strBool(row.vm_report_checklist)} />
            <ReadRow label="WhatsApp Group" value={strBool(row.whatsapp_group_checklis)} />
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-bold text-gray-700 mb-1">Delivery Note</p>
            <ReadRow label="Checklist" value={strBool(row.delivery_note_checklist)} />
            <ReadField label="Status" value={row.status_delivery_note} />
            <ReadField label="Total" value={row.total_delivery_note} />
            <ReadField label="Total Error" value={row.total_error_delivery_note} />
            <ReadField label="Notes" value={row.notes_delivery_note} />
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-bold text-gray-700 mb-1">Sales Order</p>
            <ReadRow label="Checklist" value={strBool(row.sales_order_checklist)} />
            <ReadField label="Status" value={row.status_sales_order} />
            <ReadField label="Total" value={row.total_sales_order} />
            <ReadField label="Total Error" value={row.total_error_sales_order} />
            <ReadField label="Notes" value={row.notes_sales_order} />
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-bold text-gray-700 mb-1">Stock Entry</p>
            <ReadRow label="Checklist" value={strBool(row.stock_entry_checklist)} />
            <ReadField label="Status" value={row.status_stock_entry} />
            <ReadField label="Total" value={row.total_stock_entry} />
            <ReadField label="Total Error" value={row.total_error_stock_entry} />
            <ReadField label="Notes" value={row.stock_entry_notes} />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500">Taft By</label>
            <select
              value={form.taft_by}
              onChange={(e) => setForm((p) => ({ ...p, taft_by: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >
              <option value="">-- Pilih Taft --</option>
              {taftOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Role Taft</label>
            <select
              value={form.role_taft}
              onChange={(e) => setForm((p) => ({ ...p, role_taft: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
            >
              <option value="">-- Pilih Role --</option>
              {roleTaftOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="border-t pt-3">
            <ToggleSwitch label="Cleaning Store" checked={form.cleaning_store_checklist} onChange={(v) => setForm((p) => ({ ...p, cleaning_store_checklist: v }))} />
            <ToggleSwitch label="VM Report" checked={form.vm_report_checklist} onChange={(v) => setForm((p) => ({ ...p, vm_report_checklist: v }))} />
            <ToggleSwitch label="WhatsApp Group" checked={form.whatsapp_group_checklis} onChange={(v) => setForm((p) => ({ ...p, whatsapp_group_checklis: v }))} />
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-700">Delivery Note</p>
            <ToggleSwitch label="Checklist selesai" checked={form.delivery_note_checklist} onChange={(v) => setForm((p) => ({ ...p, delivery_note_checklist: v }))} />
            <StatusSelect value={form.status_delivery_note} onChange={(v) => setForm((p) => ({ ...p, status_delivery_note: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Total" value={form.total_delivery_note} onChange={(v) => setForm((p) => ({ ...p, total_delivery_note: v }))} type="number" />
              <FormField label="Total Error" value={form.total_error_delivery_note} onChange={(v) => setForm((p) => ({ ...p, total_error_delivery_note: v }))} type="number" />
            </div>
            <FormField label="Notes" value={form.notes_delivery_note} onChange={(v) => setForm((p) => ({ ...p, notes_delivery_note: v }))} />
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-700">Sales Order</p>
            <ToggleSwitch label="Checklist selesai" checked={form.sales_order_checklist} onChange={(v) => setForm((p) => ({ ...p, sales_order_checklist: v }))} />
            <StatusSelect value={form.status_sales_order} onChange={(v) => setForm((p) => ({ ...p, status_sales_order: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Total" value={form.total_sales_order} onChange={(v) => setForm((p) => ({ ...p, total_sales_order: v }))} type="number" />
              <FormField label="Total Error" value={form.total_error_sales_order} onChange={(v) => setForm((p) => ({ ...p, total_error_sales_order: v }))} type="number" />
            </div>
            <FormField label="Notes" value={form.notes_sales_order} onChange={(v) => setForm((p) => ({ ...p, notes_sales_order: v }))} />
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-700">Stock Entry</p>
            <ToggleSwitch label="Checklist selesai" checked={form.stock_entry_checklist} onChange={(v) => setForm((p) => ({ ...p, stock_entry_checklist: v }))} />
            <StatusSelect value={form.status_stock_entry} onChange={(v) => setForm((p) => ({ ...p, status_stock_entry: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Total" value={form.total_stock_entry} onChange={(v) => setForm((p) => ({ ...p, total_stock_entry: v }))} type="number" />
              <FormField label="Total Error" value={form.total_error_stock_entry} onChange={(v) => setForm((p) => ({ ...p, total_error_stock_entry: v }))} type="number" />
            </div>
            <FormField label="Notes" value={form.stock_entry_notes} onChange={(v) => setForm((p) => ({ ...p, stock_entry_notes: v }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {row && (
              <Button variant="outline" icon={X} onClick={() => setEditing(false)}>Batal</Button>
            )}
            <Button icon={Save} onClick={handleSubmit} loading={saving}>Simpan</Button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Hapus Checklist?</h2>
            <p className="text-sm text-gray-500 mb-5">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Batal</Button>
              <Button variant="danger" onClick={handleDelete} loading={saving}>Hapus</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-gray-600">{label}</span>
      <span className={`px-2 py-0.5 rounded font-semibold ${value ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {value ? "Selesai" : "Belum"}
      </span>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value || "-"}</span>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] text-gray-500">Status</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm mt-0.5"
      >
        <option value="">-- Pilih Status --</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-gray-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm mt-0.5"
      />
    </div>
  );
}
