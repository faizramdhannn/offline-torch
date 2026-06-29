"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  RefreshCw,
  FileText,
  Store,
  Calendar,
  Loader2,
} from "lucide-react";
import { RESULT_STATUS_OPTIONS, StatusFilterPill } from "./DomainBadges";

interface ToolbarProps {
  // Search
  searchQuery: string;
  onSearchChange: (v: string) => void;

  // Status filter
  statusFilter: string[];
  onStatusFilterChange: (statuses: string[]) => void;

  // Store filter (admin/non-owner only)
  isOwner: boolean;
  storeName: string;
  stores: string[];
  storeFilter: string[];
  onToggleStore: (store: string) => void;

  // Date range
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;

  // Actions
  activeFilterCount: number;
  onReset: () => void;
  canExportDoc: boolean;
  exporting: boolean;
  onExportDoc: () => void;

  // Misc
  showStoreDropdown: boolean;
  onToggleStoreDropdown: () => void;
  onCloseStoreDropdown: () => void;
  toTitleCase: (s: string) => string;
}

/**
 * Toolbar above the canvasing list table.
 * Contains: search, status filter pills, store/date filters, reset, export.
 * Purely presentational — all state and handlers come from the page.
 */
export function Toolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  isOwner,
  storeName,
  stores,
  storeFilter,
  onToggleStore,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  activeFilterCount,
  onReset,
  canExportDoc,
  exporting,
  onExportDoc,
  showStoreDropdown,
  onToggleStoreDropdown,
  onCloseStoreDropdown,
  toTitleCase,
}: ToolbarProps) {
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  const toggleStatus = (status: string) =>
    onStatusFilterChange(
      statusFilter.includes(status)
        ? statusFilter.filter((s) => s !== status)
        : [...statusFilter, status]
    );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* Row 1: search + status pills */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari nama, toko, canvasser..."
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {RESULT_STATUS_OPTIONS.map((status) => (
            <StatusFilterPill
              key={status}
              status={status}
              active={statusFilter.includes(status)}
              onClick={() => toggleStatus(status)}
            />
          ))}
        </div>
      </div>

      {/* Row 2: store, date, actions */}
      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-3">
        {/* Store filter */}
        {!isOwner && (
          <div className="relative" ref={storeDropdownRef}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Store
            </p>
            <button
              onClick={onToggleStoreDropdown}
              className="flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs text-gray-600 hover:bg-white"
            >
              <Store className="h-3.5 w-3.5 text-gray-400" />
              {storeFilter.length === 0
                ? "Semua toko"
                : `${storeFilter.length} toko`}
            </button>
            <AnimatePresence>
              {showStoreDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-20 mt-1 min-w-[180px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
                >
                  {stores.map((store) => (
                    <label
                      key={store}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={storeFilter.includes(store)}
                        onChange={() => onToggleStore(store)}
                        className="accent-primary"
                      />
                      {toTitleCase(store)}
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Date range */}
        <div className="flex items-end gap-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Visit dari
            </p>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-2 text-xs text-gray-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Sampai
            </p>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-2 text-xs text-gray-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-gray-500 hover:bg-gray-100"
            >
              <X className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          {canExportDoc && (
            <button
              onClick={onExportDoc}
              disabled={exporting}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Export DOC
            </button>
          )}
        </div>
      </div>
    </div>
  );
}