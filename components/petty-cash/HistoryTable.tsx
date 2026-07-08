"use client";

import { Eye, Undo2 } from "lucide-react";
import { Badge } from "@/components/shared/Badge";

interface HistoryEntry {
  history_id: string;
  petty_cash_id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  action_by: string;
  action_at: string;
  snapshot: string;
  notes: string;
}

const ACTION_VARIANT: Record<string, "success" | "info" | "error" | "purple"> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "error",
  RESTORE: "purple",
};

interface HistoryTableProps {
  items: HistoryEntry[];
  canRestore: boolean;
  restoringId: string | null;
  onViewSnapshot: (entry: HistoryEntry) => void;
  onRestore: (entry: HistoryEntry) => void;
  formatDateTime: (iso: string) => string;
  toTitleCase: (str: string) => string;
}

export function HistoryTable({ items, canRestore, restoringId, onViewSnapshot, onRestore, formatDateTime, toTitleCase }: HistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Time</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Action</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Entry ID</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">By</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Notes / Changes</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Snapshot</th>
            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            let snap: Record<string, string> = {};
            try {
              snap = JSON.parse(item.snapshot);
            } catch {}
            return (
              <tr key={item.history_id} className="transition-colors hover:bg-gray-50">
                <td className="whitespace-nowrap px-2 py-1 text-[11px] text-gray-500">{formatDateTime(item.action_at)}</td>
                <td className="px-2 py-1">
                  <Badge variant={ACTION_VARIANT[item.action] ?? "neutral"}>{item.action}</Badge>
                </td>
                <td className="px-2 py-1 font-mono text-[11px] text-gray-700">{item.petty_cash_id}</td>
                <td className="px-2 py-1 text-[11px] font-medium text-gray-700">{item.action_by}</td>
                <td className="max-w-[200px] px-2 py-1">
                  <p className="truncate text-[11px] text-gray-600" title={item.notes}>
                    {item.notes || "-"}
                  </p>
                  {snap.description && (
                    <p className="truncate text-[10px] text-gray-400">
                      {toTitleCase(snap.description)} · {snap.category} · {snap.store}
                    </p>
                  )}
                </td>
                <td className="px-2 py-1">
                  <button
                    onClick={() => onViewSnapshot(item)}
                    className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-1.5 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    <Eye className="h-3 w-3" />
                    Detail
                  </button>
                </td>
                <td className="px-2 py-1">
                  {item.action === "DELETE" && canRestore && (
                    <button
                      onClick={() => onRestore(item)}
                      disabled={restoringId === item.history_id}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-purple-50 px-1.5 py-1 text-[10px] font-medium text-purple-600 transition-colors hover:bg-purple-100 disabled:opacity-50"
                    >
                      <Undo2 className="h-3 w-3" />
                      {restoringId === item.history_id ? "..." : "Restore"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}