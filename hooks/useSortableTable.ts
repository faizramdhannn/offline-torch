"use client";

import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

function compareValues(a: unknown, b: unknown): number {
  const an = typeof a === "number" ? a : parseFloat(String(a ?? "").replace(/[^0-9.-]/g, ""));
  const bn = typeof b === "number" ? b : parseFloat(String(b ?? "").replace(/[^0-9.-]/g, ""));
  const looksNumeric = (v: unknown) => typeof v === "number" || (v !== null && v !== undefined && v !== "" && !isNaN(parseFloat(String(v).replace(/[^0-9.-]/g, ""))) && /[0-9]/.test(String(v)));
  if (looksNumeric(a) && looksNumeric(b) && !isNaN(an) && !isNaN(bn)) {
    return an - bn;
  }
  return String(a ?? "").localeCompare(String(b ?? ""), "id");
}

// Sort helper dipakai bareng SortableTh — klik header tabel untuk toggle
// asc/desc, dipakai konsisten di semua halaman list yang punya tabel.
export function useSortableTable<T extends Record<string, any>>(data: T[], defaultKey?: keyof T) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey ?? null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const cmp = compareValues(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: keyof T) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  };

  return { sorted, sortKey, sortDir, toggleSort };
}
