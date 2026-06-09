"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

interface AttendanceGateState {
  showGate: boolean;
  storeName: string;
  dismissGate: () => void;
}

const EXEMPT_PATHS = ["/login", "/capture-attendance"];

/**
 * useAttendanceGate
 *
 * Gate logic (simple):
 * 1. Check store_list — if user_name matches a store_name, they are a store PIC.
 * 2. If they ARE a store PIC, check today's attendance for that store.
 *    → No open_timestamp yet → show gate.
 * 3. If user_name is NOT in store_list → no gate, free access.
 */
export function useAttendanceGate(): AttendanceGateState {
  const pathname = usePathname();
  const [showGate, setShowGate] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [checked, setChecked] = useState(false);

  const checkAttendance = useCallback(async () => {
    if (EXEMPT_PATHS.some((p) => pathname?.startsWith(p))) {
      setShowGate(false);
      return;
    }

    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;

      const user = JSON.parse(raw);

      // Only relevant for users with capture-attendance permission
      if (!user.attendance_store && !user.attendance_store_all) return;

      // ── Step 1: Is this user a store PIC? ─────────────────────────────────
     const storeRes = await fetch("/api/capture-attendance/meta?type=store_list",
  { cache: 'no-store' }
);

      const stores: { id: string; store_name: string }[] = await storeRes.json();

      const matchedStore = stores.find(
        (s) => s.store_name?.toLowerCase() === user.user_name?.toLowerCase()
      );

      // Not in store_list → free access, no gate
      if (!matchedStore) {
        setShowGate(false);
        setChecked(true);
        return;
      }

      setStoreName(matchedStore.store_name);

      // ── Step 2: Check today's attendance for this store ───────────────────
      const now = new Date();
      const wib = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
      const todayISO = `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, "0")}-${String(wib.getDate()).padStart(2, "0")}`;

      const attendRes = await fetch(
  `/api/capture-attendance/capture?store_name=${encodeURIComponent(matchedStore.store_name)}&date=${todayISO}`,
  { cache: 'no-store' }
);
      if (!attendRes.ok) return;

      const records: { open_timestamp?: string; close_timestamp?: string }[] = await attendRes.json();
      const record = Array.isArray(records) && records.length > 0 ? records[0] : null;

      // Gate hanya muncul jika belum open sama sekali.
      // Sudah open (dengan atau tanpa close) → bebas akses.
      const hasCheckedIn = !!record?.open_timestamp;

      setShowGate(!hasCheckedIn);
    } catch {
      // Silently fail — never block the user on network errors
    } finally {
      setChecked(true);
    }
  }, [pathname]);

  useEffect(() => {
    checkAttendance();
  }, [checkAttendance]);

  useEffect(() => {
    if (!EXEMPT_PATHS.some((p) => pathname?.startsWith(p))) {
      checkAttendance();
    } else {
      setShowGate(false);
    }
  }, [pathname]);

  const dismissGate = useCallback(() => {
    setShowGate(false);
  }, []);

  return { showGate: checked ? showGate : false, storeName, dismissGate };
}