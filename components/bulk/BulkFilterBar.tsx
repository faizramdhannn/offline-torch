"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import {
  PERIOD_OPTIONS, activeFilterCount, emptyBulkFilters,
  type BulkFilterOptions, type BulkFilters, type BulkOption, type BulkPeriod,
} from "@/lib/bulkFilter";

const fieldCls = "h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-gray-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20";

// Dropdown pilih banyak (centang) dengan kotak cari bila pilihannya banyak.
function MultiSelect({ label, options, value, onChange }: { label: string; options: BulkOption[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const active = value.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQ(""); }}
        className={`${fieldCls} inline-flex items-center gap-1.5 ${active ? "border-primary/50 bg-primary/5 font-medium text-primary" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}{active && <span className="rounded-full bg-primary px-1.5 text-[10px] text-white">{value.length}</span>}
        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="modal-solid absolute left-0 top-9 z-40 w-64 max-w-[88vw] rounded-xl border border-gray-200 p-2 shadow-xl">
          {options.length > 7 && (
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cari ${label.toLowerCase()}…`} className={`${fieldCls} mb-1.5 w-full`} />
          )}
          <div className="mb-1 flex items-center justify-between px-1 text-[10px] text-gray-400">
            <span>{options.length} pilihan</span>
            {active && <button type="button" onClick={() => onChange([])} className="text-primary hover:underline">Kosongkan</button>}
          </div>
          <ul className="max-h-60 overflow-auto" role="listbox" aria-multiselectable>
            {shown.length === 0 && <li className="px-2 py-3 text-center text-[11px] text-gray-400">Tidak ada pilihan</li>}
            {shown.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[11px] text-gray-700 hover:bg-gray-100">
                  <input type="checkbox" className="mt-0.5" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
                  <span className="min-w-0 break-words">{o.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RangeInput({ label, min, max, onMin, onMax, unit }: { label: string; min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void; unit?: string }) {
  const cls = `${fieldCls} w-24`;
  return (
    <div className="flex items-center gap-1 text-[11px] text-gray-500">
      <span>{label}</span>
      <input inputMode="numeric" value={min} onChange={(e) => onMin(e.target.value.replace(/[^\d]/g, ""))} placeholder="Min" className={cls} aria-label={`${label} minimum`} />
      <span>–</span>
      <input inputMode="numeric" value={max} onChange={(e) => onMax(e.target.value.replace(/[^\d]/g, ""))} placeholder="Maks" className={cls} aria-label={`${label} maksimum`} />
      {unit && <span className="text-gray-400">{unit}</span>}
    </div>
  );
}

interface Props {
  filters: BulkFilters;
  onChange: (f: BulkFilters) => void;
  options: BulkFilterOptions;
  isAdmin: boolean; // toko & pembuat hanya berguna bagi Bulk All (store hanya melihat tokonya sendiri)
  showSearch?: boolean;
  defaultPeriod?: BulkPeriod; // dipakai tombol Reset
  extra?: React.ReactNode; // mis. "Semua riwayat", ringkasan di kanan
}

export function BulkFilterBar({ filters: f, onChange, options, isAdmin, showSearch = true, defaultPeriod = "all", extra }: Props) {
  const [more, setMore] = useState(false);
  const set = (patch: Partial<BulkFilters>) => onChange({ ...f, ...patch });
  const reset = emptyBulkFilters(defaultPeriod);
  const count = activeFilterCount(f) - (defaultPeriod !== "all" && f.period === defaultPeriod ? 1 : 0);
  const isDefault = JSON.stringify(f) === JSON.stringify(reset);
  // Filter lanjutan (qty/nilai/SO/pembuat/institusi) dilipat supaya baris utama tidak penuh di HP.
  const advancedCount = [f.hasSO, f.qtyMin || f.qtyMax, f.valueMin || f.valueMax, f.createdBy.length, f.institutions.length].filter(Boolean).length;

  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {showSearch && (
          <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input value={f.search} onChange={(e) => set({ search: e.target.value })} placeholder="Cari customer, SKU, SO, note…" className={`${fieldCls} w-full pl-8`} />
          </label>
        )}
        <select value={f.period} onChange={(e) => set({ period: e.target.value as BulkPeriod })} className={fieldCls} aria-label="Periode">
          {PERIOD_OPTIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {f.period === "custom" && (
          <span className="flex items-center gap-1 text-[11px] text-gray-500">
            <input type="date" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} className={fieldCls} aria-label="Dari tanggal" />
            –
            <input type="date" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} className={fieldCls} aria-label="Sampai tanggal" />
          </span>
        )}
        {isAdmin && <MultiSelect label="Toko" options={options.stores} value={f.stores} onChange={(v) => set({ stores: v })} />}
        <MultiSelect label="Item" options={options.items} value={f.items} onChange={(v) => set({ items: v })} />
        <MultiSelect label="Kategori" options={options.categories} value={f.categories} onChange={(v) => set({ categories: v })} />
        <MultiSelect label="Reason Buy" options={options.reasonBuy} value={f.reasonBuy} onChange={(v) => set({ reasonBuy: v })} />
        <MultiSelect label="Reason Not Buy" options={options.reasonNotBuy} value={f.reasonNotBuy} onChange={(v) => set({ reasonNotBuy: v })} />
        <select value={f.status} onChange={(e) => set({ status: e.target.value as BulkFilters["status"] })} className={fieldCls} aria-label="Status">
          <option value="">Semua status</option>
          <option value="buy">Beli (Reason buy / SO)</option>
          <option value="not_buy">Tidak beli</option>
          <option value="none">Belum ada alasan / SO</option>
        </select>
        <button type="button" onClick={() => setMore((m) => !m)} className={`${fieldCls} inline-flex items-center gap-1.5 ${advancedCount ? "border-primary/50 bg-primary/5 font-medium text-primary" : ""}`} aria-expanded={more}>
          <SlidersHorizontal className="h-3 w-3" /> Lainnya{advancedCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-white">{advancedCount}</span>}
        </button>
        {!isDefault && (
          <button type="button" onClick={() => onChange(reset)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            <RotateCcw className="h-3 w-3" /> Reset{count > 0 ? ` (${count})` : ""}
          </button>
        )}
        {extra}
      </div>
      {more && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-2">
          <select value={f.hasSO} onChange={(e) => set({ hasSO: e.target.value as BulkFilters["hasSO"] })} className={fieldCls} aria-label="Sales Order">
            <option value="">SO: semua</option>
            <option value="yes">Ada SO</option>
            <option value="no">Tanpa SO</option>
          </select>
          <MultiSelect label="Institusi" options={options.institutions} value={f.institutions} onChange={(v) => set({ institutions: v })} />
          {isAdmin && <MultiSelect label="Dibuat oleh" options={options.createdBy} value={f.createdBy} onChange={(v) => set({ createdBy: v })} />}
          <RangeInput label="Qty input" min={f.qtyMin} max={f.qtyMax} onMin={(v) => set({ qtyMin: v })} onMax={(v) => set({ qtyMax: v })} unit="pcs" />
          <RangeInput label="Nilai (gross)" min={f.valueMin} max={f.valueMax} onMin={(v) => set({ valueMin: v })} onMax={(v) => set({ valueMax: v })} unit="Rp" />
        </div>
      )}
    </div>
  );
}
