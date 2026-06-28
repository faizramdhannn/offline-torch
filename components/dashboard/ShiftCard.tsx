"use client";

import { motion } from "framer-motion";
import { Store, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftTaft {
  name: string;
  code: string;
}

interface ShiftCardProps {
  store: string;
  tafts: ShiftTaft[];
  toTitleCase: (s: string) => string;
  truncateName: (s: string, max?: number) => string;
  codeColors: Record<string, string>;
  maxVisible?: number;
  delay?: number;
}

/**
 * Renders one store as a card for the "Today's Shift" section.
 * Pure presentation — `tafts` (with codes already resolved) comes
 * straight from the existing fetchTodaySchedule logic.
 */
export function ShiftCard({
  store,
  tafts,
  toTitleCase,
  truncateName,
  codeColors,
  maxVisible = 5,
  delay = 0,
}: ShiftCardProps) {
  const visible = tafts.slice(0, maxVisible);
  const remaining = tafts.length - visible.length;
  const assignedCount = tafts.filter((t) => t.code).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
      whileHover={{ y: -2 }}
      className="min-w-[210px] flex-shrink-0 snap-start rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-sm transition-shadow duration-200 hover:shadow-lg sm:min-w-0"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Store className="h-3.5 w-3.5 text-primary" />
          </div>
          <span
            className="truncate text-xs font-semibold text-gray-900"
            title={store}
          >
            {toTitleCase(store)}
          </span>
        </div>
        <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          <Users className="h-3 w-3" />
          {assignedCount}/{tafts.length}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {visible.map((taft) => (
          <div
            key={taft.name}
            className="flex items-center justify-between gap-2 rounded-lg bg-gray-50/80 px-2 py-1.5"
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold text-gray-600">
                {taft.name?.charAt(0).toUpperCase() || "?"}
              </span>
              <span
                className="truncate text-[11px]"
                title={taft.name}
              >
                {truncateName(taft.name, 13)}
              </span>
            </div>
            {taft.code ? (
              <span
                className={cn(
                  "flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold",
                  codeColors[taft.code] || "bg-gray-100 text-gray-700"
                )}
              >
                {taft.code}
              </span>
            ) : (
              <span className="flex-shrink-0 text-[9px] text-gray-300">—</span>
            )}
          </div>
        ))}

        {tafts.length === 0 && (
          <div className="py-3 text-center text-[10px] text-gray-300">
            Belum ada staff
          </div>
        )}

        {remaining > 0 && (
          <div className="pt-0.5 text-center text-[10px] font-medium text-primary">
            +{remaining} more
          </div>
        )}
      </div>
    </motion.div>
  );
}