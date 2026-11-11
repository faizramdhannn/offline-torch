"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, ShoppingBag } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { normalizePhone } from "@/lib/profileRules";
import { netPrice, type BulkGroup, type BulkMaster, type BulkMasterItem } from "@/lib/bulkOrder";

interface Line { key: number; sku: string; qty: string; price: string; diskon: string } // diskon: persen per item // price: harga satuan gross (digit); default dari master, boleh diubah

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const baseCls = "h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20";
const inputCls = `${baseCls} w-full`;
const labelCls = "mb-1 block text-[11px] font-medium text-gray-600";

// Cari item dari master: ketik SKU atau nama produk, pilih dari daftar.
function ItemPicker({ master, value, onPick }: { master: BulkMaster; value: string; onPick: (sku: string) => void }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => { setQ(value); }, [value]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return master.items.slice(0, 30);
    return master.items.filter((i) => i.sku.toLowerCase().includes(s) || i.product_name.toLowerCase().includes(s)).slice(0, 30);
  }, [q, master.items]);
  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) onPick(""); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cari SKU atau nama produk"
        className={inputCls}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-[#ffffff] py-1 text-xs shadow-lg">
          {results.length === 0 && <li className="px-3 py-2 text-gray-400">Tidak ada yang cocok</li>}
          {results.map((i) => (
            <li key={i.sku}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); onPick(i.sku); setQ(i.sku); setOpen(false); }} className="block w-full px-3 py-1.5 text-left hover:bg-gray-100">
                <span className="font-semibold text-gray-800">{i.sku}</span>
                <span className="ml-1.5 text-gray-500">{i.product_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface BulkFormProps {
  open: boolean;
  onClose: () => void;
  master: BulkMaster;
  isAdmin: boolean;
  defaultStore: string;
  stores: string[];
  editing: BulkGroup | null;
  onSaved: (message: string) => void;
}

export function BulkFormModal({ open, onClose, master, isAdmin, defaultStore, stores, editing, onSaved }: BulkFormProps) {
  const keyRef = useRef(1);
  const newLine = (sku = "", qty = "", price = "", diskon = ""): Line => ({ key: keyRef.current++, sku, qty, price, diskon });
  const pctOf = (price: string, net: string) => { const p = parseInt(price, 10), n = parseInt(net, 10); return p > 0 && n >= 0 && n < p ? Math.round((1 - n / p) * 1000) / 10 : 0; };
  const [store, setStore] = useState("");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [phone, setPhone] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [reasonBuy, setReasonBuy] = useState("");
  const [reasonNotBuy, setReasonNotBuy] = useState("");
  const [salesOrder, setSalesOrder] = useState("");
  const [note, setNote] = useState("");
  const [diskonAll, setDiskonAll] = useState(""); // pintasan: menyalin persen ke semua item
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Isi ulang form setiap dibuka (tambah = kosong, edit = data input itu).
  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setStore(editing.source_store);
      setName(editing.customer_name);
      setInstitution(editing.customer_institution);
      setPhone(editing.customer_phone_number);
      // harga & diskon tiap item diturunkan dari data tersimpan (harga bisa beda dari master; diskon = gross vs net)
      setLines(editing.rows.map((r) => { const pct = pctOf(r.item_price, r.item_net); return newLine(r.item_code, r.item_qty, r.item_price, pct > 0 ? String(pct) : ""); }));
      setReasonBuy(editing.reason_buy);
      setReasonNotBuy(editing.reason_not_buy);
      setSalesOrder(editing.sales_order);
      setNote(editing.note);
      setDiskonAll("");
    } else {
      setStore(isAdmin ? "" : defaultStore);
      setName(""); setInstitution(""); setPhone("");
      setLines([newLine()]);
      setReasonBuy(""); setReasonNotBuy(""); setSalesOrder(""); setNote(""); setDiskonAll("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const bySku = useMemo(() => new Map(master.items.map((i) => [i.sku.toUpperCase(), i])), [master.items]);
  const picked = (l: Line): BulkMasterItem | undefined => bySku.get(l.sku.toUpperCase());
  const unit = (l: Line) => parseInt(l.price, 10) || picked(l)?.price || 0; // harga satuan yang berlaku
  const total = lines.reduce((n, l) => n + unit(l) * (parseInt(l.qty, 10) || 0), 0);
  const pctNum = (v: string) => Number(v.replace(",", ".")) || 0;
  const totalNet = lines.reduce((n, l) => n + netPrice(unit(l), pctNum(l.diskon)) * (parseInt(l.qty, 10) || 0), 0);
  const anyDiskon = lines.some((l) => pctNum(l.diskon) > 0);
  const phoneNorm = normalizePhone(phone);

  const submit = async () => {
    setError("");
    if (isAdmin && !store.trim()) return setError("Pilih toko sumber");
    if (!name.trim()) return setError("Nama customer wajib diisi");
    if (!phoneNorm || !/^62\d{9,13}$/.test(phoneNorm)) return setError("No. telepon customer tidak valid (contoh 0812xxxxxxxx)");
    if (lines.some((l) => !picked(l))) return setError("Pilih item dari daftar untuk setiap baris");
    if (lines.some((l) => !(parseInt(l.qty, 10) > 0))) return setError("Qty setiap item harus lebih dari 0");
    if (lines.some((l) => !(unit(l) > 0))) return setError("Harga setiap item harus lebih dari 0");
    if (!reasonBuy && !reasonNotBuy) return setError("Pilih Reason Buy atau Reason Not Buy");
    if (reasonBuy && !salesOrder.trim()) return setError("Sales Order wajib diisi bila Reason Buy dipilih");
    if (lines.some((l) => l.diskon.trim() && !(pctNum(l.diskon) >= 0 && pctNum(l.diskon) <= 100))) return setError("Diskon setiap item harus antara 0 dan 100 persen");
    setSaving(true);
    try {
      const res = await fetch("/api/bulk/orders", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          source_store: store, customer_name: name, customer_institution: institution, customer_phone: phone,
          reason_buy: reasonBuy, reason_not_buy: reasonNotBuy, sales_order: salesOrder, note,
          items: lines.map((l) => ({ item_code: l.sku, item_qty: l.qty, item_price: l.price, diskon: l.diskon })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setError(j.error || "Gagal menyimpan");
      onSaved(editing ? "Data Bulk diperbarui" : "Data Bulk tersimpan");
    } catch {
      setError("Gagal menyimpan, coba lagi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={ShoppingBag}
      title={editing ? "Edit Bulk" : "Tambah Bulk"}
      description="Satu input bisa berisi beberapa item"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="mr-auto text-xs text-gray-500">Gross <b className="text-gray-800">{rupiah(total)}</b>{anyDiskon && <> · Net <b className="text-gray-800">{rupiah(totalNet)}</b></>}</span>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={submit} loading={saving}>{editing ? "Simpan Perubahan" : "Simpan"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{error}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Toko (source)</label>
            {isAdmin ? (
              <select value={store} onChange={(e) => setStore(e.target.value)} className={inputCls}>
                <option value="">Pilih toko</option>
                {store && !stores.includes(store) && <option value={store}>{store}</option>}
                {stores.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input value={store} readOnly className={`${inputCls} bg-gray-50 text-gray-600`} />
            )}
          </div>
          <div>
            <label className={labelCls}>Nama customer *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Institusi / perusahaan</label>
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>No. telepon customer *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0812xxxxxxxx" className={inputCls} />
            {phone && <p className="mt-0.5 text-[10px] text-gray-400">Tersimpan sebagai <b>{phoneNorm || "—"}</b></p>}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Item</span>
            <button type="button" onClick={() => setLines((p) => [...p, newLine("", "", "", diskonAll)])} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"><Plus className="h-3 w-3" /> Tambah item</button>
          </div>
          <div className="space-y-2">
            {lines.map((l, idx) => {
              const m = picked(l);
              const qty = parseInt(l.qty, 10) || 0;
              return (
                <div key={l.key} className="rounded-xl border border-gray-200 p-2.5">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                      <ItemPicker master={master} value={l.sku} onPick={(sku) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, sku, price: sku ? String(bySku.get(sku.toUpperCase())?.price ?? "") : "" } : x)))} />
                    </div>
                    <input
                      value={l.qty}
                      onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, qty: e.target.value.replace(/[^\d]/g, "") } : x)))}
                      inputMode="numeric" placeholder="Qty" aria-label={`Qty item ${idx + 1}`}
                      className={`${baseCls} w-16 shrink-0 text-center sm:w-20`}
                    />
                    <input
                      value={l.price}
                      onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, price: e.target.value.replace(/[^\d]/g, "") } : x)))}
                      inputMode="numeric" placeholder="Harga" aria-label={`Harga item ${idx + 1}`} title="Harga satuan (gross) — default dari master, boleh diubah"
                      className={`${baseCls} w-24 shrink-0 text-right sm:w-28`}
                    />
                    <input
                      value={l.diskon}
                      onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, diskon: e.target.value.replace(/[^\d.,]/g, "") } : x)))}
                      inputMode="decimal" placeholder="Disk %" aria-label={`Diskon item ${idx + 1}`} title="Diskon item ini dalam persen (opsional)"
                      className={`${baseCls} w-16 shrink-0 text-right sm:w-20`}
                    />
                    <button type="button" onClick={() => setLines((p) => (p.length > 1 ? p.filter((x) => x.key !== l.key) : p))} disabled={lines.length === 1} aria-label={`Hapus item ${idx + 1}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {m && (
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      <b className="text-gray-700">{m.product_name}</b> · {m.category || "-"} · {rupiah(unit(l))}
                      {unit(l) !== m.price && <span className="text-amber-600"> (harga master {rupiah(m.price)})</span>}
                      {qty > 0 && <> · Subtotal <b className="text-gray-700">{rupiah(unit(l) * qty)}</b></>}
                      {pctNum(l.diskon) > 0 && <> · Net <b className="text-emerald-700">{rupiah(netPrice(unit(l), pctNum(l.diskon)) * qty)}</b> (diskon {pctNum(l.diskon)}%)</>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Reason buy</label>
            <select value={reasonBuy} onChange={(e) => { setReasonBuy(e.target.value); if (e.target.value) setReasonNotBuy(""); }} className={inputCls}>
              <option value="">—</option>
              {master.reasonBuy.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Reason not buy</label>
            <select value={reasonNotBuy} onChange={(e) => { setReasonNotBuy(e.target.value); if (e.target.value) { setReasonBuy(""); setSalesOrder(""); } }} className={inputCls}>
              <option value="">—</option>
              {master.reasonNotBuy.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {reasonBuy && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Sales order * (wajib karena Reason Buy dipilih)</label>
              <input value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)} className={inputCls} />
            </div>
          )}
          <div>
            <label className={labelCls}>Diskon semua item (%) — pintasan</label>
            <input
              value={diskonAll}
              onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, ""); setDiskonAll(v); setLines((p) => p.map((x) => ({ ...x, diskon: v }))); }}
              inputMode="decimal" placeholder="contoh 5" className={inputCls}
            />
            <p className="mt-0.5 text-[10px] text-gray-400">Menyalin persen ke semua item; diskon tiap item bisa diubah sendiri di kolom Disk %.</p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} h-auto resize-none py-2`} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
