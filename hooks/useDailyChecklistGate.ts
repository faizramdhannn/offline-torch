"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

interface DailyChecklistGateState {
  showGate: boolean;
  dismissGate: () => void;
}

// Same exemption pattern as useAttendanceGate. `/daily-job/checklist` itself
// must be exempt so the gate doesn't block the very page it sends the user
// to.
const EXEMPT_PATHS = ["/login", "/capture-attendance", "/daily-job/checklist"];

/**
 * useDailyChecklistGate
 *
 * Gate logic:
 * - `daily_checklist_all` users are exempt entirely (report viewers/admins,
 *   per explicit product decision — they never fill a checklist).
 * - Users without `daily_checklist` are unaffected (gate doesn't apply).
 * - Users with `daily_checklist`: gate shows whenever today's checklist row
 *   (`GET /api/daily-job/checklist?userName=...&name=...`) is null/empty.
 *
 * This hook does NOT know about the attendance gate — composition (attendance
 * gate takes priority, checklist gate only shows once attendance is
 * satisfied/not-applicable) happens in app/(main)/layout.tsx, which renders
 * this gate's modal only when the attendance gate isn't currently showing.
 */
export function useDailyChecklistGate(): DailyChecklistGateState {
  const pathname = usePathname();
  const [showGate, setShowGate] = useState(false);
  const [checked, setChecked] = useState(false);

  const checkChecklist = useCallback(async () => {
    if (EXEMPT_PATHS.some((p) => pathname?.startsWith(p))) {
      setShowGate(false);
      return;
    }

    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw);

      // daily_checklist_all users are exempt entirely.
      if (user.daily_checklist_all) {
        setShowGate(false);
        setChecked(true);
        return;
      }

      // Gate only applies to users with daily_checklist access.
      if (!user.daily_checklist) {
        setShowGate(false);
        setChecked(true);
        return;
      }

      const res = await fetch(
        `/api/daily-job/checklist?userName=${encodeURIComponent(user.user_name || "")}&name=${encodeURIComponent(user.name || "")}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setChecked(true);
        return;
      }
      const row = await res.json();
      setShowGate(!row);
    } catch {
      // Silently fail — never block the user on network errors
    } finally {
      setChecked(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!EXEMPT_PATHS.some((p) => pathname?.startsWith(p))) {
      checkChecklist();
    } else {
      setShowGate(false);
    }
  }, [pathname, checkChecklist]);

  const dismissGate = useCallback(() => {
    setShowGate(false);
  }, []);

  return { showGate: checked ? showGate : false, dismissGate };
}
