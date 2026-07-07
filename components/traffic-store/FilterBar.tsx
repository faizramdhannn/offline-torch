"use client";

import { useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  isStoreUser: boolean;
  allStores: string[];
  trafficSources: string[];
  productCategories: string[];
  reasonsNotBuy: string[];
  filterStore: string;
  onFilterStoreChange: (v: string) => void;
  filterTraffic: string;
  onFilterTrafficChange: (v: string) => void;
  filterConvert: string;
  onFilterConvertChange: (v: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (v: string) => void;
  filterReasonNotBuy: string;
  onFilterReasonNotBuyChange: (v: string) => void;
  filterSearch: string;
  onFilterSearchChange: (v: string) => void;
  filterDateFrom: string;
  onFilterDateFromChange: (v: string) => void;
  filterDateTo: string;
  onFilterDateToChange: (v: string) => void;
  onReset: () => void;
  resultCount: number;
  toTitleCase: (s: string) => string;
}

const selectClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10";

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Preset = "today" | "7d" | "30d" | "all" | "custom";

export function FilterBar({
  isStoreUser,
  allStores,
  trafficSources,
  productCategories,
  reasonsNotBuy,
  filterStore,
  onFilterStoreChange,
  filterTraffic,
  onFilterTrafficChange,
  filterConvert,
  onFilterConvertChange,
  filterCategory,
  onFilterCategoryChange,
  filterReasonNotBuy,
  onFilterReasonNotBuyChange,
  filterSearch,
  onFilterSearchChange,
  filterDateFrom,
  onFilterDateFromChange,
  filterDateTo,
  onFilterDateToChange,
  onReset,
  resultCount,
  toTitleCase,
}: FilterBarProps) {
  const [showMore, setShowMore] = useState(false);

  const activePreset: Preset = (() => {
    if (!filterDateFrom && !filterDateTo) return "all";
    if (filterDateFrom === todayStr() && filterDateTo === todayStr()) return "today";
    if (filterDateFrom === todayStr(-6) && filterDateTo === todayStr()) return "7d";
    if (filterDateFrom === todayStr(-29) && filterDateTo === todayStr()) return "30d";
    return "custom";
  })();

  const applyPreset = (p: Preset) => {
    if (p === "today") { onFilterDateFromChange(todayStr()); onFilterDateToChange(todayStr()); }
    else if (p === "7d") { onFilterDateFromChange(todayStr(-6)); onFilterDateToChange(todayStr()); }
    else if (p === "30d") { onFilterDateFromChange(todayStr(-29)); onFilterDateToChange(todayStr()); }
    else if (p === "all") { onFilterDateFromChange(""); onFilterDateToChange(""); }
  };

  const activeFilters: { key: string; label: string; onClear: () => void }[] = [];
  if (filterStore !== "all") activeFilters.push({ key: "store", label: `Store: ${toTitleCase(filterStore)}`, onClear: () => onFilterStoreChange("all") });
  if (filterTraffic !== "all") activeFilters.push({ key: "traffic", label: `Source: ${filterTraffic}`, onClear: () => onFilterTrafficChange("all") });
  if (filterConvert !== "all") activeFilters.push({ key: "convert", label: `Status: ${filterConvert}`, onClear: () => onFilterConvertChange("all") });
  if (filterCategory !== "all") activeFilters.push({ key: "category", label: `Kategori: ${filterCategory}`, onClear: () => onFilterCategoryChange("all") });
  if (filterReasonNotBuy !== "all") activeFilters.push({ key: "reason", label: `Alasan: ${filterReasonNotBuy}`, onClear: () => onFilterReasonNotBuyChange("all") });
  if (filterSearch.trim()) activeFilters.push({ key: "search", label: `"${filterSearch.trim()}"`, onClear: () => onFilterSearchChange("") });
  if (activePreset === "custom") activeFilters.push({ key: "date", label: `${filterDateFrom || "…"} – ${filterDateTo || "…"}`, onClear: () => { onFilterDateFromChange(""); onFilterDateToChange(""); } });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* ── Top row: search + date presets ── */}
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => onFilterSearchChange(e.target.value)}
            placeholder="Cari taft, produk, atau catatan..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ["today", "Hari Ini"],
            ["7d", "7 Hari"],
            ["30d", "30 Hari"],
            ["all", "Semua"],
          ] as [Preset, string][]).map(([p, label]) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors duration-150",
                activePreset === p
                  ? "bg-primary text-white"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors duration-150",
              showMore ? "bg-primary/10 text-primary" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filter
          </button>
        </div>
      </div>

      {/* ── Expandable filter grid ── */}
      {showMore && (
        <div className="grid grid-cols-2 gap-3 border-b border-gray-100 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {!isStoreUser && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Store</label>
              <select value={filterStore} onChange={(e) => onFilterStoreChange(e.target.value)} className={selectClass}>
                <option value="all">Semua Store</option>
                {allStores.map((s) => (
                  <option key={s} value={s}>{toTitleCase(s)}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Traffic Source</label>
            <select value={filterTraffic} onChange={(e) => onFilterTrafficChange(e.target.value)} className={selectClass}>
              <option value="all">Semua</option>
              {trafficSources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Status Beli</label>
            <select value={filterConvert} onChange={(e) => onFilterConvertChange(e.target.value)} className={selectClass}>
              <option value="all">Semua</option>
              <option value="Beli">Beli</option>
              <option value="Tidak Beli">Tidak Beli</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Kategori Produk</label>
            <select value={filterCategory} onChange={(e) => onFilterCategoryChange(e.target.value)} className={selectClass}>
              <option value="all">Semua</option>
              {productCategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Alasan Tidak Beli</label>
            <select value={filterReasonNotBuy} onChange={(e) => onFilterReasonNotBuyChange(e.target.value)} className={selectClass}>
              <option value="all">Semua</option>
              {reasonsNotBuy.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Dari</label>
              <input type="date" value={filterDateFrom} onChange={(e) => onFilterDateFromChange(e.target.value)} className={selectClass} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Sampai</label>
              <input type="date" value={filterDateTo} onChange={(e) => onFilterDateToChange(e.target.value)} className={selectClass} />
            </div>
          </div>
        </div>
      )}

      {/* ── Active filter chips + result count ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-[11px] font-medium text-gray-400">
          {resultCount.toLocaleString()} data
        </span>
        {activeFilters.length > 0 && (
          <span className="h-3 w-px bg-gray-200" />
        )}
        {activeFilters.map((f) => (
          <span
            key={f.key}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
          >
            {f.label}
            <button type="button" onClick={f.onClear} className="rounded-full hover:bg-primary/20">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {activeFilters.length > 0 && (
          <Button variant="outline" size="sm" icon={RotateCcw} onClick={onReset} className="ml-auto">
            Reset Semua
          </Button>
        )}
      </div>
    </div>
  );
}