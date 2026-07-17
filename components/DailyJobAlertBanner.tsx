"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { useDailyJobRemaining } from "@/hooks/useDailyJobRemaining";

// Reappears on every page navigation (not permanently dismissible) per the
// product requirement "setiap buka menu" — dismissing only hides it for the
// current pathname, a nav to any other page (or back) re-evaluates and shows
// it again if remaining > 0.
export default function DailyJobAlertBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [eligible, setEligible] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw);
      // Only for users with daily_checklist (not _all, not neither).
      setEligible(!!user.daily_checklist && !user.daily_checklist_all);
      setUserName(user.user_name);
    } catch {
      // ignore
    }
  }, []);

  const { delivery_note, sales_order, stock_entry, totalRemaining, loading } = useDailyJobRemaining(
    eligible ? userName : undefined
  );

  if (!eligible || loading || totalRemaining <= 0) return null;
  if (dismissedFor === pathname) return null;

  const parts: string[] = [];
  if (delivery_note > 0) parts.push(`${delivery_note} laporan Delivery Note`);
  if (sales_order > 0) parts.push(`${sales_order} laporan Sales Order`);
  if (stock_entry > 0) parts.push(`${stock_entry} laporan Stock Entry`);

  return (
    <div className="sticky top-0 z-30 bg-amber-50 border-b border-amber-200 px-3 py-2 md:px-4">
      <div className="flex items-start gap-2 max-w-[1600px] mx-auto">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-xs text-amber-800">
            Lengkapi {parts.join(", ")} hari ini.
          </p>
          <div className="flex items-center gap-2">
            {delivery_note > 0 && (
              <button
                onClick={() => router.push("/daily-job/delivery-note")}
                className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-950"
              >
                Delivery Note
              </button>
            )}
            {sales_order > 0 && (
              <button
                onClick={() => router.push("/daily-job/sales-order")}
                className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-950"
              >
                Sales Order
              </button>
            )}
            {stock_entry > 0 && (
              <button
                onClick={() => router.push("/daily-job/stock-entry")}
                className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-950"
              >
                Stock Entry
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => setDismissedFor(pathname)}
          className="p-1 rounded hover:bg-amber-100 text-amber-500 shrink-0"
          title="Tutup untuk halaman ini"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
