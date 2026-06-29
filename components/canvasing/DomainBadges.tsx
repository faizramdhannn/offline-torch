"use client";

import { cn } from "@/lib/utils";

// ── Status metadata ──────────────────────────────────────────────────────────

export const STATUS_META: Record<string, { color: string; badge: string; dot: string }> = {
  Interested:           { color: "#3B82F6", badge: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",      dot: "bg-blue-400" },
  "Document Submitted": { color: "#8B5CF6", badge: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200", dot: "bg-purple-400" },
  "Waiting Approval":   { color: "#F59E0B", badge: "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200", dot: "bg-yellow-400" },
  "Follow Up":          { color: "#06B6D4", badge: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200",       dot: "bg-cyan-400" },
  Deal:                 { color: "#10B981", badge: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200",    dot: "bg-green-400" },
  Reject:               { color: "#EF4444", badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",          dot: "bg-red-400" },
  Cancel:               { color: "#6B7280", badge: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",      dot: "bg-gray-400" },
};

export const RESULT_STATUS_OPTIONS = [
  "Interested",
  "Document Submitted",
  "Waiting Approval",
  "Follow Up",
  "Deal",
  "Reject",
  "Cancel",
] as const;

// ── StatusBadge ──────────────────────────────────────────────────────────────

/**
 * Inline pill for a canvasing result status.
 * Shows a coloured dot + label.
 */
export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  if (!meta) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        meta.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
      {status}
    </span>
  );
}

// ── StatusFilterPill ─────────────────────────────────────────────────────────

/**
 * Toggleable pill used in the list toolbar for status filtering.
 */
export function StatusFilterPill({
  status,
  active,
  onClick,
}: {
  status: string;
  active: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[status];
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ring-1 ring-inset",
        active
          ? meta?.badge
          : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
      )}
    >
      {active && meta && (
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      )}
      {status}
    </button>
  );
}

// ── StatusSelectButton ────────────────────────────────────────────────────────

/**
 * Button-style status selector for use inside the Add/Edit form.
 */
export function StatusSelectButton({
  status,
  selected,
  onClick,
}: {
  status: string;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
        selected
          ? meta?.badge
          : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
      )}
    >
      {selected && meta && (
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      )}
      {status}
    </button>
  );
}