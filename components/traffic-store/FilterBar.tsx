"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { cn } from "@/lib/utils";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { SearchShortcutHint } from "@/components/shared/SearchShortcutHint";

interface FilterBarProps {
  isStoreUser: boolean;
  allStores: string[];
  trafficSources: string[];
  productCategories: string[];
  reasonsNotBuy: string[];
  /** Semua filter di bawah ini multi-select — array kosong = "Semua" (tidak difilter). */
  filterStore: string[];
  onFilterStoreChange: (v: string[]) => void;
  filterTraffic: string[];
  onFilterTrafficChange: (v: string[]) => void;
  filterConvert: string[];
  onFilterConvertChange: (v: string[]) => void;
  filterCategory: string[];
  onFilterCategoryChange: (v: string[]) => void;
  filterReasonNotBuy: string[];
  onFilterReasonNotBuyChange: (v: string[]) => void;
  filterSearch: string;
  onFilterSearchChange: (v: string) => void;
  filterDateFrom: string;
  onFilterDateFromChange: (v: string) => void;
  filterDateTo: string;
  onFilterDateToChange: (v: string) => void;
  onReset: () => void;
  resultCount: number;
  toTitleCase: (s: string) => string;
  /** Kalau true, grid filter lengkap (Store/Traffic Source/dst) langsung
   *  terbuka tanpa perlu klik "Filter" — dipakai supaya filter Store & yang
   *  lain langsung terlihat/bisa dipilih saat lagi di tab Report. */
  defaultExpanded?: boolean;
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

// Dropdown checkbox multi-select — dipakai untuk Store/Traffic Source/Status
// Beli/Kategori/Alasan Tidak Beli, semuanya sekarang bisa pilih beberapa
// sekaligus (bukan cuma 1) sesuai permintaan user. Search box otomatis
// muncul kalau opsinya > 6, sama pola dengan FilterDropdown di menu Stock.
function MultiSelectField({
  label,
  options,
  selected,
  onToggle,
  formatLabel,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  formatLabel?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const display = (v: string) => (formatLabel ? formatLabel(v) : v);
  const filteredOptions = query.trim()
    ? options.filter((o) => display(o).toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(selectClass, "flex items-center justify-between text-left")}
      >
        <span className="truncate text-gray-700">
          {selected.length === 0 ? "Semua" : `${selected.length} dipilih`}
        </span>
        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {options.length > 6 && (
            <div className="border-b border-gray-100 p-1.5">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari..."
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 outline-none focus:border-primary/40 focus:bg-white focus:ring-1 focus:ring-primary/10"
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">Tidak ada hasil</p>
            ) : (
              filteredOptions.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => onToggle(opt)}
                    className="mr-2 accent-primary"
                  />
                  {display(opt)}
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  defaultExpanded = false,
}: FilterBarProps) {
  const [showMore, setShowMore] = useState(defaultExpanded);
  const { ref: searchRef, shortcutLabel } = useSearchShortcut();

  // Buka otomatis begitu defaultExpanded jadi true (mis. pindah ke tab
  // Report) — tapi jangan paksa TUTUP kalau user sudah buka manual lalu
  // defaultExpanded balik ke false (mis. pindah ke tab List), biar tidak
  // mengagetkan user yang sedang lihat filter itu.
  useEffect(() => {
    if (defaultExpanded) setShowMore(true);
  }, [defaultExpanded]);

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

  const toggleValue = (arr: string[], value: string, onChange: (v: string[]) => void) => {
    onChange(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const activeFilters: { key: string; label: string; onClear: () => void }[] = [];
  filterStore.forEach((v) =>
    activeFilters.push({ key: `store-${v}`, label: `Store: ${toTitleCase(v)}`, onClear: () => onFilterStoreChange(filterStore.filter((x) => x !== v)) })
  );
  filterTraffic.forEach((v) =>
    activeFilters.push({ key: `traffic-${v}`, label: `Source: ${v}`, onClear: () => onFilterTrafficChange(filterTraffic.filter((x) => x !== v)) })
  );
  filterConvert.forEach((v) =>
    activeFilters.push({ key: `convert-${v}`, label: `Status: ${v}`, onClear: () => onFilterConvertChange(filterConvert.filter((x) => x !== v)) })
  );
  filterCategory.forEach((v) =>
    activeFilters.push({ key: `category-${v}`, label: `Kategori: ${v}`, onClear: () => onFilterCategoryChange(filterCategory.filter((x) => x !== v)) })
  );
  filterReasonNotBuy.forEach((v) =>
    activeFilters.push({ key: `reason-${v}`, label: `Alasan: ${v}`, onClear: () => onFilterReasonNotBuyChange(filterReasonNotBuy.filter((x) => x !== v)) })
  );
  if (filterSearch.trim()) activeFilters.push({ key: "search", label: `"${filterSearch.trim()}"`, onClear: () => onFilterSearchChange("") });
  if (activePreset === "custom") activeFilters.push({ key: "date", label: `${filterDateFrom || "…"} – ${filterDateTo || "…"}`, onClear: () => { onFilterDateFromChange(""); onFilterDateToChange(""); } });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* ── Top row: search + date presets ── */}
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={filterSearch}
            onChange={(e) => onFilterSearchChange(e.target.value)}
            placeholder="Cari taft, produk, atau catatan..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-11 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
          <SearchShortcutHint label={shortcutLabel} />
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
            <MultiSelectField
              label="Store"
              options={allStores}
              selected={filterStore}
              onToggle={(v) => toggleValue(filterStore, v, onFilterStoreChange)}
              formatLabel={toTitleCase}
            />
          )}
          <MultiSelectField
            label="Traffic Source"
            options={trafficSources}
            selected={filterTraffic}
            onToggle={(v) => toggleValue(filterTraffic, v, onFilterTrafficChange)}
          />
          <MultiSelectField
            label="Status Beli"
            options={["Beli", "Tidak Beli"]}
            selected={filterConvert}
            onToggle={(v) => toggleValue(filterConvert, v, onFilterConvertChange)}
          />
          <MultiSelectField
            label="Kategori Produk"
            options={productCategories}
            selected={filterCategory}
            onToggle={(v) => toggleValue(filterCategory, v, onFilterCategoryChange)}
          />
          <MultiSelectField
            label="Alasan Tidak Beli"
            options={reasonsNotBuy}
            selected={filterReasonNotBuy}
            onToggle={(v) => toggleValue(filterReasonNotBuy, v, onFilterReasonNotBuyChange)}
          />
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
