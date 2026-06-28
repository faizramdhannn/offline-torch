"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/shared/Button";

interface FilterBarProps {
  isStoreUser: boolean;
  allStores: string[];
  trafficSources: string[];
  filterStore: string;
  onFilterStoreChange: (v: string) => void;
  filterTraffic: string;
  onFilterTrafficChange: (v: string) => void;
  filterConvert: string;
  onFilterConvertChange: (v: string) => void;
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

export function FilterBar({
  isStoreUser,
  allStores,
  trafficSources,
  filterStore,
  onFilterStoreChange,
  filterTraffic,
  onFilterTrafficChange,
  filterConvert,
  onFilterConvertChange,
  filterDateFrom,
  onFilterDateFromChange,
  filterDateTo,
  onFilterDateToChange,
  onReset,
  resultCount,
  toTitleCase,
}: FilterBarProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {!isStoreUser && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Store</label>
            <select value={filterStore} onChange={(e) => onFilterStoreChange(e.target.value)} className={selectClass}>
              <option value="all">Semua Store</option>
              {allStores.map((s) => (
                <option key={s} value={s}>
                  {toTitleCase(s)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Traffic Source</label>
          <select value={filterTraffic} onChange={(e) => onFilterTrafficChange(e.target.value)} className={selectClass}>
            <option value="all">Semua</option>
            {trafficSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
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
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Dari</label>
          <input type="date" value={filterDateFrom} onChange={(e) => onFilterDateFromChange(e.target.value)} className={selectClass} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Sampai</label>
          <input type="date" value={filterDateTo} onChange={(e) => onFilterDateToChange(e.target.value)} className={selectClass} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" icon={RotateCcw} onClick={onReset} className="w-full justify-center">
            Reset
          </Button>
        </div>
      </div>
      <p className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-gray-400">{resultCount} data ditemukan</p>
    </div>
  );
}
