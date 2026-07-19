"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

interface AttendanceGateState {
  showGate: boolean;
  storeName: string;
  dismissGate: () => void;
  /** True once the attendance check has resolved (success or failure). Used
   *  by useDailyChecklistGate's composition in layout.tsx to make sure it
   *  never shows before attendance status is confirmed — otherwise the
   *  faster daily-job-checklist fetch could flash the wrong gate first. */
  checked: boolean;
}

const EXEMPT_PATHS = ["/login", "/capture-attendance"];

// This hook lives in app/(main)/layout.tsx, so it re-fires on EVERY
// client-side navigation across the whole app — without a cache that's two
// GET requests (store_list meta + today's attendance) per page visit, for
// every store-PIC login, all day (a real Fluid CPU cost driver — same issue
// the daily-job checklist gate had). Cache the result in module scope for
// CACHE_TTL_MS so rapid navigation reuses the same answer instead of
// re-fetching; invalidated early when leaving /capture-attendance (the user
// likely just checked in).
const CACHE_TTL_MS = 60_000;
let cache: { userKey: string; showGate: boolean; storeName: string; ts: number } | null = null;

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
  const prevPathRef = useRef<string | null>(null);

  const checkAttendance = useCallback(async (forceRefresh: boolean) => {
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

      const userKey = user.user_name || "";
      const now0 = Date.now();
      if (!forceRefresh && cache && cache.userKey === userKey && now0 - cache.ts < CACHE_TTL_MS) {
        setShowGate(cache.showGate);
        setStoreName(cache.storeName);
        setChecked(true);
        return;
      }

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
        cache = { userKey, showGate: false, storeName: "", ts: now0 };
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

      cache = { userKey, showGate: !hasCheckedIn, storeName: matchedStore.store_name, ts: now0 };
      setShowGate(!hasCheckedIn);
    } catch {
      // Silently fail — never block the user on network errors
    } finally {
      setChecked(true);
    }
  }, [pathname]);

  useEffect(() => {
  const isExempt = EXEMPT_PATHS.some((p) => pathname?.startsWith(p));
  // Leaving /capture-attendance likely means the user just checked in —
  // force a fresh check instead of trusting the cache.
  const leftAttendancePage = !!prevPathRef.current?.startsWith("/capture-attendance") && !pathname?.startsWith("/capture-attendance");
  prevPathRef.current = pathname;

  if (!isExempt) {
    checkAttendance(leftAttendancePage);
  } else {
    setShowGate(false);
  }
}, [pathname, checkAttendance]);

  const dismissGate = useCallback(() => {
    setShowGate(false);
  }, []);

  return { showGate: checked ? showGate : false, storeName, dismissGate, checked };
}