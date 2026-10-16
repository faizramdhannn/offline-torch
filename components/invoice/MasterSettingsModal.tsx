"use client";

import { useState } from "react";
import type { MasterInvoice } from "./shared";

// Pengaturan master dokumen (kop, perusahaan, tanda tangan, PPN) — izin invoice_master.
export default function MasterSettingsModal({ initial, onSave, onClose }: { initial: MasterInvoice; onSave: (m: MasterInvoice) => Promise<void>; onClose: () => void }) {
  const [m, setM] = useState<MasterInvoice>({ ...initial });
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<MasterInvoice>) => setM((x) => ({ ...x, ...p }));
  const field = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-medium text-gray-600";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-sm font-semibold text-gray-800">Pengaturan master dokumen</h3>
        <div className="space-y-3">
          <div><label className={label}>Nama perusahaan</label><input value={m.company_name || ""} onChange={(e) => up({ company_name: e.target.value })} className={field} /></div>
          <div><label className={label}>Alamat</label><textarea rows={2} value={m.company_address || ""} onChange={(e) => up({ company_address: e.target.value })} className={field} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Telepon</label><input value={m.company_phone || ""} onChange={(e) => up({ company_phone: e.target.value })} className={field} /></div>
            <div><label className={label}>Email</label><input value={m.company_email || ""} onChange={(e) => up({ company_email: e.target.value })} className={field} /></div>
          </div>
          <div><label className={label}>URL gambar kop</label><input value={m.header_image_url || ""} onChange={(e) => up({ header_image_url: e.target.value })} className={field} /></div>
          <div><label className={label}>URL gambar tanda tangan</label><input value={m.signature_image_url || ""} onChange={(e) => up({ signature_image_url: e.target.value })} className={field} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>PPN (%)</label><input type="number" min={0} max={100} value={m.ppn_percentage ?? 11} onChange={(e) => up({ ppn_percentage: Number(e.target.value) })} className={field} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!m.default_use_signature} onChange={(e) => up({ default_use_signature: e.target.checked })} /> Tanda tangan aktif secara bawaan</label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!m.default_use_ppn} onChange={(e) => up({ default_use_ppn: e.target.checked })} /> Tampilkan PPN secara bawaan</label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs text-gray-500 hover:bg-gray-100">Batal</button>
          <button disabled={busy} onClick={async () => { setBusy(true); try { await onSave(m); } finally { setBusy(false); } }} className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-medium text-white disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}
