"use client";

import { useEffect, useState } from "react";

interface ActivityLogRow {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  activity_log: string;
  entity_type?: string;
  entity_id?: string;
}

interface ActivityHistoryProps {
  /** Stable identifier for this menu, e.g. "bundling", "voucher". Must match
   * the entity_type used by every write to /api/activity-log for this menu. */
  entityType: string;
  /** The record's own id. */
  entityId: string | undefined | null;
}

/**
 * "Riwayat Aktivitas" timeline — fetches /api/activity-log filtered by
 * entity_type + entity_id (exact match, done server-side against the
 * activity_log sheet's entity_type/entity_id columns), newest first.
 */
export function ActivityHistory({ entityType, entityId }: ActivityHistoryProps) {
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/activity-log?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId || "")}`
        );
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
  }, [entityType, entityId]);

  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Riwayat Aktivitas
      </label>
      {loading ? (
        <div className="text-xs text-gray-400 py-3">Memuat riwayat...</div>
      ) : logs.length === 0 ? (
        <div className="text-xs text-gray-400 py-3 bg-gray-50 rounded-lg text-center">
          Belum ada riwayat aktivitas
        </div>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {logs.map((log) => (
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
