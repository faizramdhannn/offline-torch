"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/utils";

interface BalanceEntry {
  id: string;
  type_balance: string;
  value: string;
  notes: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

interface BalanceTableProps {
  entries: BalanceEntry[];
  onEdit: (entry: BalanceEntry) => void;
  onDelete: (id: string) => void;
  formatRupiah: (value: string | number) => string;
  toTitleCase: (str: string) => string;
}

export function BalanceTable({ entries, onEdit, onDelete, formatRupiah, toTitleCase }: BalanceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {["Date", "Type", "Value", "Notes", "Update By", "Actions"].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry, index) => {
            const isCredit = (entry.type_balance || "").toLowerCase() === "credit";
            return (
              <tr key={index} className="transition-colors hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-500">
                  {entry.created_at ? new Date(entry.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={isCredit ? "success" : "error"}>{toTitleCase(entry.type_balance || "")}</Badge>
                </td>
                <td className={cn("px-3 py-2.5 text-xs font-medium tabular-nums", isCredit ? "text-green-600" : "text-red-600")}>
                  {isCredit ? "+" : "-"}
                  {formatRupiah(entry.value)}
                </td>
                <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-gray-600" title={entry.notes}>
                  {entry.notes || "-"}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{entry.update_by || "-"}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(entry)}
                      title="Edit"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(entry.id)}
                      title="Hapus"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
