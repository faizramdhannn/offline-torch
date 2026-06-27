"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, RefreshCw, MapPinned, Phone, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

interface StoreAddress {
  id: string;
  store_location: string;
  phone_number: string;
  address: string;
}

interface StoreTableProps {
  stores: StoreAddress[];
  onCopy: (store: StoreAddress) => void;
  copiedId: string | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

/**
 * Presentational table for Store Location. Search/filter here is
 * purely client-side display filtering — it does not touch the
 * original fetchStoreAddresses logic or storeAddresses state.
 */
export function StoreTable({
  stores,
  onCopy,
  copiedId,
  onRefresh,
  isRefreshing = false,
}: StoreTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return stores;
    const q = query.toLowerCase();
    return stores.filter(
      (s) =>
        s.store_location?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.phone_number?.toLowerCase().includes(q)
    );
  }, [stores, query]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari store atau alamat..."
            className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <button
          onClick={onRefresh}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Refresh
        </button>
        <span className="text-xs text-gray-400">
          {filtered.length} dari {stores.length} store
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={MapPinned} message="Tidak ada store yang cocok" />
      ) : (
        <div className="max-h-[360px] overflow-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Store</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Kontak</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((store, index) => (
                <motion.tr
                  key={store.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: index * 0.02 }}
                  className={cn(
                    "border-b border-gray-50 transition-colors hover:bg-gray-50",
                    index % 2 === 1 && "bg-gray-50/40"
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <MapPinned className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-800">
                          {store.store_location}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-gray-400">
                          {store.address}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-gray-400" />
                      {store.phone_number}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => onCopy(store)}
                      className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary"
                      aria-label="Copy alamat"
                    >
                      {copiedId === store.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}