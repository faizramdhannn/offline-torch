"use client";

import { RefObject } from "react";
import { RotateCcw, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { Button } from "@/components/shared/Button";

interface FilterBarProps {
  viewMode: "list" | "report";
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;

  categories: string[];
  selectedCategories: string[];
  onToggleCategory: (v: string) => void;
  onSelectAllCategories: () => void;
  showCategoryDropdown: boolean;
  onCategoryDropdownChange: (v: boolean) => void;
  categoryDropdownRef: RefObject<HTMLDivElement | null>;

  stores: string[];
  selectedStores: string[];
  onToggleStore: (v: string) => void;
  onSelectAllStores: () => void;
  showStoreDropdown: boolean;
  onStoreDropdownChange: (v: boolean) => void;
  storeDropdownRef: RefObject<HTMLDivElement | null>;

  transferFilter: string;
  onTransferFilterChange: (v: string) => void;
  reportTransferFilter: "false" | "true";
  onReportTransferFilterChange: (v: "false" | "true") => void;

  onReset: () => void;
  canExport: boolean;
  onExportExcel: () => void;
  onExportDoc?: () => void;
  exportingDoc?: boolean;
  onExportDoc2?: () => void;
  exportingDoc2?: boolean;
}

export function FilterBar({
  viewMode,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  categories,
  selectedCategories,
  onToggleCategory,
  onSelectAllCategories,
  showCategoryDropdown,
  onCategoryDropdownChange,
  categoryDropdownRef,
  stores,
  selectedStores,
  onToggleStore,
  onSelectAllStores,
  showStoreDropdown,
  onStoreDropdownChange,
  storeDropdownRef,
  transferFilter,
  onTransferFilterChange,
  reportTransferFilter,
  onReportTransferFilterChange,
  onReset,
  canExport,
  onExportExcel,
  onExportDoc,
  exportingDoc,
  onExportDoc2,
  exportingDoc2,
}: FilterBarProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {viewMode === "list" ? (
          <>
            <MultiSelectDropdown
              label="Category"
              options={categories}
              selected={selectedCategories}
              onToggle={onToggleCategory}
              onSelectAll={onSelectAllCategories}
              open={showCategoryDropdown}
              onOpenChange={onCategoryDropdownChange}
              containerRef={categoryDropdownRef}
            />
            <MultiSelectDropdown
              label="Store"
              options={stores}
              selected={selectedStores}
              onToggle={onToggleStore}
              onSelectAll={onSelectAllStores}
              open={showStoreDropdown}
              onOpenChange={onStoreDropdownChange}
              containerRef={storeDropdownRef}
            />
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Transfer</label>
              <select
                value={transferFilter}
                onChange={(e) => onTransferFilterChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
              >
                <option value="all">All</option>
                <option value="false">Belum</option>
                <option value="true">Sudah</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <MultiSelectDropdown
              label="Store"
              options={stores}
              selected={selectedStores}
              onToggle={onToggleStore}
              onSelectAll={onSelectAllStores}
              open={showStoreDropdown}
              onOpenChange={onStoreDropdownChange}
              containerRef={storeDropdownRef}
              placeholder="All stores..."
            />
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Transfer Status</label>
              <select
                value={reportTransferFilter}
                onChange={(e) => onReportTransferFilterChange(e.target.value as "false" | "true")}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
              >
                <option value="false">Belum Transfer</option>
                <option value="true">Sudah Transfer</option>
              </select>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <Button variant="outline" size="sm" icon={RotateCcw} onClick={onReset}>
          Reset
        </Button>
        {canExport && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {viewMode === "list" ? (
              <>
                <Button variant="outline" size="sm" icon={FileSpreadsheet} onClick={onExportExcel}>
                  Export XLSX
                </Button>
                {onExportDoc && (
                  <Button variant="outline" size="sm" icon={exportingDoc ? Loader2 : FileText} onClick={onExportDoc} disabled={exportingDoc}>
                    {exportingDoc ? "Exporting..." : "Export DOC"}
                  </Button>
                )}
                {onExportDoc2 && (
                  <Button variant="outline" size="sm" icon={exportingDoc2 ? Loader2 : FileText} onClick={onExportDoc2} disabled={exportingDoc2}>
                    {exportingDoc2 ? "Exporting..." : "Export DOC 2"}
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" size="sm" icon={FileSpreadsheet} onClick={onExportExcel}>
                Export Report XLSX
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
