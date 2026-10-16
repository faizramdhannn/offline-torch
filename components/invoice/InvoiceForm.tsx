"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { taxBreakdown } from "@/lib/invoiceTax";
import { TORCH_STORES, rupiah, type InvoiceLine, type MasterInvoice, type MasterItem } from "./shared";

export interface InvoiceFormValues {
  doc_type: "invoice" | "quotation";
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_address: string;
  tax_percent: number;
  use_signature: boolean;
  signature_store: string;
  signature_pic: string;
  items: InvoiceLine[];
}

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const blankLine = (): InvoiceLine => ({ product_name: "", qty: 1, unit_price: 0 });
const num = (v: string) => (v === "" ? 0 : Number(v.replace(/[^0-9.]/g, "")) || 0);

// Pencarian produk dari master item (nama/SKU); memilih produk mengisi harga jual (HPJ), tetap bisa diubah.
function ProductPicker({ value, items, onChange, onPick }: { value: string; items: MasterItem[]; onChange: (v: string) => void; onPick: (m: MasterItem) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const q = value.toLowerCase().trim();
  const list = useMemo(
    () => (q ? items.filter((m) => (m.Product_name || "").toLowerCase().includes(q) || (m.SKU || "").toLowerCase().includes(q)) : items).slice(0, 30),
    [items, q]
  );
  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Cari produk / SKU, atau ketik manual"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      {open && list.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {list.map((m) => (
            <li key={m.SKU}>
              <button type="button" onClick={() => { onPick(m); setOpen(false); }} className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-gray-50">
                <span className="min-w-0"><span className="block truncate font-medium text-gray-800">{m.Product_name}</span><span className="text-gray-400">{m.SKU}</span></span>
                {m.HPJ && <span className="shrink-0 text-gray-600">{rupiah(m.HPJ.replace(/[^0-9]/g, ""))}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function InvoiceForm({
  mode, initial, master, masterItems, saving, error, lockedStore, onSave, onCancel,
}: {
  mode: "create" | "edit";
  initial?: Partial<InvoiceFormValues>;
  master: MasterInvoice;
  masterItems: MasterItem[];
  saving: boolean;
  error?: string;
  lockedStore?: string; // akun Store/Merchant: toko penanda tangan dikunci ke toko akunnya
  onSave: (v: InvoiceFormValues) => void;
  onCancel: () => void;
}) {
  const ppnRate = Number(master.ppn_percentage) || 11;
  const [docType, setDocType] = useState<"invoice" | "quotation">(initial?.doc_type || "invoice");
  const [number, setNumber] = useState(initial?.invoice_number || "");
  const [date, setDate] = useState(initial?.invoice_date || today());
  const [customer, setCustomer] = useState(initial?.customer_name || "");
  const [address, setAddress] = useState(initial?.customer_address || "");
  const [usePPN, setUsePPN] = useState(initial ? (initial.tax_percent || 0) > 0 : !!master.default_use_ppn);
  const [useSign, setUseSign] = useState(initial ? !!initial.use_signature : !!master.default_use_signature);
  const [signStore, setSignStore] = useState(lockedStore || initial?.signature_store || "");
  const [signPic, setSignPic] = useState(initial?.signature_pic || "");
  useEffect(() => { if (lockedStore) setSignStore(lockedStore); }, [lockedStore]);
  const [picMap, setPicMap] = useState<Record<string, string[]>>({});
  const [picManual, setPicManual] = useState(false);
  useEffect(() => {
    fetch("/api/invoice/pic").then((r) => r.json()).then((d) => setPicMap(d.pics || {})).catch(() => {});
  }, []);
  // "Torch Lembong" → kunci "lembong" (store_location di master Survey Store)
  const picOptions = picMap[signStore.replace(/^torch\s+/i, "").trim().toLowerCase()] || [];
  const picInList = !signPic || picOptions.includes(signPic);
  const [lines, setLines] = useState<InvoiceLine[]>(initial?.items?.length ? initial.items.map((l) => ({ ...l })) : [blankLine()]);

  // Harga barang sudah termasuk PPN: dengan PPN dicentang, dokumen menampilkan harga tanpa PPN (DPP) + PPN; total tetap.
  const bd = taxBreakdown(lines, usePPN ? ppnRate : 0);
  const subtotal = bd.total;
  const setLine = (i: number, p: Partial<InvoiceLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const values = (): InvoiceFormValues => ({
    doc_type: docType, invoice_number: number.trim(), invoice_date: date, customer_name: customer.trim(), customer_address: address.trim(),
    tax_percent: usePPN ? ppnRate : 0, use_signature: useSign, signature_store: useSign ? signStore : "", signature_pic: useSign ? signPic : "",
    items: lines.filter((l) => l.product_name.trim() || l.unit_price > 0).map((l) => ({ ...l, product_name: l.product_name.trim() })),
  });

  const card = "rounded-xl border border-gray-200 bg-white p-4 md:p-5";
  const label = "mb-1 block text-xs font-medium text-gray-600";
  const input = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";

  return (
    <div className="grid gap-4 pb-28 lg:grid-cols-3 lg:pb-0">
      <div className="space-y-4 lg:col-span-2">
        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Dokumen</h2>
          <div className="mb-3 inline-flex rounded-lg bg-gray-100 p-1 text-xs">
            {(["invoice", "quotation"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setDocType(t)} className={`rounded-md px-4 py-1.5 ${docType === t ? "bg-white font-medium text-gray-800 shadow-sm" : "text-gray-500"}`}>
                {t === "invoice" ? "Invoice" : "Quotation"}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {docType === "invoice" && (
              <div>
                <label className={label}>Nomor invoice <span className="text-red-500">*</span></label>
                <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="mis. 471090" className={input} />
              </div>
            )}
            <div>
              <label className={label}>Tanggal <span className="text-red-500">*</span></label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Customer</h2>
          <div className="space-y-3">
            <div>
              <label className={label}>Nama customer <span className="text-red-500">*</span></label>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Alamat</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={input} />
            </div>
          </div>
        </section>

        <section className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Item</h2>
            <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">+ Tambah item</button>
          </div>
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Item {i + 1}</span>
                  {lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">Hapus</button>}
                </div>
                <ProductPicker
                  value={l.product_name}
                  items={masterItems}
                  onChange={(v) => setLine(i, { product_name: v })}
                  onPick={(m) => setLine(i, { product_name: m.Product_name, unit_price: Number(String(m.HPJ || "").replace(/[^0-9]/g, "")) || 0 })}
                />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-gray-500">Qty</label>
                    <input inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: num(e.target.value) })} className={input} />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-gray-500">Harga satuan (sudah termasuk PPN)</label>
                    <input inputMode="numeric" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: num(e.target.value) })} className={input} />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-gray-500">Total</label>
                    <p className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-800">{rupiah(Math.round((Number(l.qty) || 0) * (Number(l.unit_price) || 0)))}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Pajak & tanda tangan</h2>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={usePPN} onChange={(e) => setUsePPN(e.target.checked)} />
            <span>Tampilkan PPN {ppnRate}%<span className="block text-xs text-gray-400">Harga barang sudah termasuk PPN. Jika dicentang, dokumen menampilkan harga tanpa PPN, lalu PPN {ppnRate}%; total pembayaran tetap sama.</span></span>
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={useSign} onChange={(e) => setUseSign(e.target.checked)} /> Gunakan tanda tangan
          </label>
          {useSign && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Toko penanda tangan</label>
                <select value={signStore} onChange={(e) => { setSignStore(e.target.value); setSignPic(""); setPicManual(false); }} disabled={!!lockedStore} className={`${input} disabled:bg-gray-50 disabled:text-gray-500`}>
                  <option value="">— pilih toko —</option>
                  {(lockedStore && !TORCH_STORES.includes(lockedStore) ? [lockedStore, ...TORCH_STORES] : TORCH_STORES).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {lockedStore && <p className="mt-1 text-[11px] text-gray-400">Dikunci ke toko akun Anda.</p>}
              </div>
              <div>
                <label className={label}>Nama PIC</label>
                {picManual || !picInList || picOptions.length === 0 ? (
                  <>
                    <input value={signPic} onChange={(e) => setSignPic(e.target.value)} placeholder={picOptions.length ? "Ketik nama PIC" : signStore ? "Belum ada daftar PIC toko ini, ketik manual" : "Pilih toko dulu"} className={input} />
                    {picOptions.length > 0 && <button type="button" onClick={() => { setPicManual(false); setSignPic(""); }} className="mt-1 text-[11px] text-gray-500 underline">Pilih dari daftar</button>}
                  </>
                ) : (
                  <select value={signPic} onChange={(e) => (e.target.value === "__manual__" ? (setPicManual(true), setSignPic("")) : setSignPic(e.target.value))} className={input}>
                    <option value="">— pilih PIC —</option>
                    {picOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value="__manual__">Lainnya (ketik manual)…</option>
                  </select>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Ringkasan + aksi (kanan di desktop, bar bawah di HP) */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-800">Ringkasan</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">{usePPN ? "Subtotal (tanpa PPN)" : "Subtotal"}</dt><dd>{rupiah(bd.dpp)}</dd></div>
            {usePPN && <div className="flex justify-between"><dt className="text-gray-500">PPN {ppnRate}%</dt><dd>{rupiah(bd.ppn)}</dd></div>}
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold"><dt>Total</dt><dd>{rupiah(subtotal)}</dd></div>
          </dl>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <button type="button" disabled={saving} onClick={() => onSave(values())} className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {saving ? "Menyimpan…" : mode === "create" ? "Simpan sebagai Draft" : "Simpan perubahan"}
          </button>
          <p className="text-[11px] leading-relaxed text-gray-400">Setelah tersimpan, buka dokumen lalu tekan <b>Ajukan</b> untuk meminta approval.</p>
          <button type="button" onClick={onCancel} className="w-full py-1.5 text-xs text-gray-500 hover:underline">Batal</button>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}
        <div className="mb-2 flex items-center justify-between text-sm"><span className="text-gray-500">Total</span><span className="font-semibold">{rupiah(subtotal)}</span></div>
        <button type="button" disabled={saving} onClick={() => onSave(values())} className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {saving ? "Menyimpan…" : mode === "create" ? "Simpan sebagai Draft" : "Simpan perubahan"}
        </button>
      </div>
    </div>
  );
}
