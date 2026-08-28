"use client";

import { useEffect, useState } from "react";

interface ActivityLogRow {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  activity_log: string;
}

interface ActivityHistoryProps {
  /**
   * Terms used to match this record inside the free-text `activity_log`
   * column (case-insensitive substring match). Usually the record's
   * name/title field. Best-effort only — activity_log has no foreign key
   * to specific records.
   */
  matchTerms: (string | undefined | null)[];
}

/**
 * "Riwayat Aktivitas" timeline — fetches /api/activity-log and shows entries
 * whose free-text activity_log mentions this record (best-effort substring
 * match against matchTerms), newest first.
 */
export function ActivityHistory({ matchTerms }: ActivityHistoryProps) {
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/activity-log");
        const result = await res.json();
        if (!cancelled) setLogs(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error("Failed to fetch activity log:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const terms = matchTerms
    .filter((t): t is string => !!t && t.trim().length > 0)
    .map((t) => t.trim().toLowerCase());

  const matched = terms.length
    ? logs.filter((log) => {
        const text = (log.activity_log || "").toLowerCase();
        return terms.some((t) => text.includes(t));
      })
    : [];

  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Riwayat Aktivitas
      </label>
      {loading ? (
        <div className="text-xs text-gray-400 py-3">Memuat riwayat...</div>
      ) : matched.length === 0 ? (
        <div className="text-xs text-gray-400 py-3 bg-gray-50 rounded-lg text-center">
          Belum ada riwayat aktivitas
        </div>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {matched.map((log) => (
            <li
              key={log.id}
              className="border border-gray-100 rounded-lg px-3 py-2 bg-gray-50/60 text-xs"
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-semibold text-gray-700">{log.user}</span>
                <span className="text-[10px] text-gray-400">{log.timestamp}</span>
              </div>
              <p className="text-gray-600">{log.activity_log}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
