"use client";

import { History, ExternalLink, Undo2 } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";

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

interface SnapshotModalProps {
  entry: HistoryEntry;
  onClose: () => void;
  canRestore: boolean;
  restoring: boolean;
  onRestore: () => void;
  formatRupiah: (value: string | number) => string;
  formatDateTime: (iso: string) => string;
}

export function SnapshotModal({ entry, onClose, canRestore, restoring, onRestore, formatRupiah, formatDateTime }: SnapshotModalProps) {
  let snap: Record<string, string> = {};
  try {
    snap = JSON.parse(entry.snapshot);
  } catch {}

  const rows: [string, string | undefined, boolean?][] = [
    ["Date", snap.date],
    ["Store", snap.store],
    ["Category", snap.category],
    ["Transfer", snap.transfer === "TRUE" ? "✓ Sudah" : "✗ Belum"],
    ["Description", snap.description, true],
    ["Dana Talang", snap.ket || "-", true],
    ["Value", snap.value ? formatRupiah(snap.value) : "-"],
    ["Update By", snap.update_by],
    ["Created At", snap.created_at ? formatDateTime(snap.created_at) : "-"],
    ["Updated At", snap.update_at ? formatDateTime(snap.update_at) : "-"],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      icon={History}
      title={`Entry #${entry.petty_cash_id}`}
      description={
        <span className="flex items-center gap-1.5">
          <Badge variant={ACTION_VARIANT[entry.action] ?? "neutral"}>{entry.action}</Badge>
          {formatDateTime(entry.action_at)}
        </span>
      }
      footer={
        <>
          {entry.action === "DELETE" && canRestore && (
            <Button variant="primary" icon={Undo2} onClick={onRestore} loading={restoring}>
              Restore Entry
            </Button>
          )}
          <Button variant="secondary" className="ml-auto justify-center" onClick={onClose}>
            Tutup
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          By <span className="font-semibold text-gray-700">{entry.action_by}</span>
        </p>
        {entry.notes && <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">{entry.notes}</div>}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {rows.map(([label, val, full]) => (
            <div key={label} className={full ? "col-span-2" : ""}>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="break-words text-xs font-medium text-gray-800">{val || "-"}</p>
            </div>
          ))}
        </div>

        {snap.link_url && (
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Receipt</p>
            <a href={snap.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              <ExternalLink className="h-3 w-3" />
              View file
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}
