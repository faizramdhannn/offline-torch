"use client";

import { Search, Loader2 } from "lucide-react";
import { AttendanceRecord, StoreEntry } from "./types";
import { AttendanceTable } from "./AttendanceTable";

export function HistoryTab({
  isAll,
  isStoreUser,
  myStoreName,
  storeList,
  historyStore,
  setHistoryStore,
  historyDate,
  setHistoryDate,
  onSearch,
  historyLoading,
  records,
}: {
  isAll: boolean;
  isStoreUser: boolean;
  myStoreName: string;
  storeList: StoreEntry[];
  historyStore: string;
  setHistoryStore: (v: string) => void;
  historyDate: string;
  setHistoryDate: (v: string) => void;
  onSearch: () => void;
  historyLoading: boolean;
  records: AttendanceRecord[];
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">Riwayat Absensi</h2>
        {records.length > 0 && <span className="text-[11px] text-gray-400">{records.length} data</span>}
      </div>

      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {isAll && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Toko</label>
                <select
                  value={historyStore}
                  onChange={(e) => setHistoryStore(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Semua Toko</option>
                  {storeList.map((s) => (
                    <option key={s.id} value={s.store_name}>
                      {s.store_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="h-4 w-px bg-gray-200" />
            </>
          )}
          {!isAll && isStoreUser && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Toko</label>
                <span className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-medium capitalize text-gray-700">
                  {myStoreName}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-200" />
            </>
          )}
          <div className="flex items-center gap-1.5">
            <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Tanggal</label>
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={onSearch}
            disabled={historyLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {historyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Cari
          </button>
        </div>
      </div>

      {historyLoading ? (
        <div className="py-12 text-center text-sm text-gray-500">Memuat data...</div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">Tidak ada data absensi</p>
        </div>
      ) : (
        <AttendanceTable records={records} isAll={isAll} />
      )}
    </div>
  );
}