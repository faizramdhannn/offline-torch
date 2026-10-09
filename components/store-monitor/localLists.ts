"use client";

import { useCallback, useEffect, useState } from "react";

// Preset suasana & grup toko disimpan di browser admin (localStorage): tanpa tabel/endpoint baru,
// jadi tidak menambah beban Vercel/Neon. Konsekuensinya hanya terlihat di browser yang membuatnya.
export interface Preset { name: string; playlist_id: number; volume: number; shuffle: boolean }
export interface Group { name: string; users: string[] }

export function useLocalList<T>(key: string): [T[], (next: T[]) => void] {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setList(JSON.parse(raw));
    } catch {}
  }, [key]);
  const save = useCallback((next: T[]) => {
    setList(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }, [key]);
  return [list, save];
}
