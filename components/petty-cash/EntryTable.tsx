"use client";

import { ExternalLink, Pencil, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PettyCash {
  id: string;
  date: string;
  description: string;
  category: string;
  value: string;
  store: string;
  ket: string;
  transfer: string;
  link_url: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

interface EntryTableProps {
  items: PettyCash[];
  canExport: boolean;
  updatingTransfer: string | null;
  onRowClick: (item: PettyCash) => void;
  onToggleTransfer: (item: PettyCash) => void;
  onEdit: (item: PettyCash) => void;
  onDelete: (id: string) => void;
  canEditDelete: (item: PettyCash) => boolean;
  formatRupiah: (value: string | number) => string;
  totalValue: number;
}

const thClass = "px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
const tdClass = "px-2 py-1.5 text-[11px] text-gray-700";

export function EntryTable({
  items,
  canExport,
  updatingTransfer,
  onRowClick,
  onToggleTransfer,
  onEdit,
  onDelete,
  canEditDelete,
  formatRupiah,
  totalValue,
}: EntryTableProps) {
  return (
    <>
      {/* ── Desktop table ──────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
              <th className={thClass}>Date</th>
              <th className={thClass}>Description</th>
              <th className={thClass}>Category</th>
              <th className={cn(thClass, "text-right")}>Value</th>
              <th className={thClass}>Store</th>
              <th className={thClass}>Dana Talang</th>
              <th className={cn(thClass, "text-center")}>Transfer</th>
              <th className={cn(thClass, "text-center")}>Link</th>
              <th className={cn(thClass, "text-center")}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr
                key={item.id}
                onClick={() => onRowClick(item)}
                className={cn(
                  "cursor-pointer transition-colors duration-150",
                  idx % 2 === 1 ? "bg-gray-50/40" : "bg-white",
                  "hover:bg-primary/[0.04]"
                )}
              >
                <td className={cn(tdClass, "whitespace-nowrap text-gray-500")}>{item.date}</td>
                <td className={cn(tdClass, "max-w-[140px] truncate")} title={item.description}>
                  {item.description}
                </td>
                <td className={cn(tdClass, "max-w-[90px] truncate")}>{item.category}</td>
                <td className={cn(tdClass, "text-right tabular-nums font-medium")}>{formatRupiah(item.value)}</td>
                <td className={cn(tdClass, "max-w-[80px] truncate")}>{item.store}</td>
                <td className={cn(tdClass, "max-w-[110px] truncate text-gray-500")}>{item.ket || "-"}</td>
                <td className={cn(tdClass, "text-center")} onClick={(e) => e.stopPropagation()}>
                  {canExport ? (
                    <button
                      onClick={() => onToggleTransfer(item)}
                      disabled={updatingTransfer === item.id}
                      className={cn(
                        "mx-auto flex h-4 w-4 items-center justify-center rounded-md border-2 transition-colors duration-200",
                        item.transfer === "TRUE" ? "border-green-500 bg-green-500" : "border-gray-300 bg-white hover:border-green-400",
                        updatingTransfer === item.id ? "cursor-wait opacity-50" : "cursor-pointer"
                      )}
                    >
                      {item.transfer === "TRUE" && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </button>
                  ) : (
                    <span className="text-gray-400">{item.transfer === "TRUE" ? <Check className="mx-auto h-3 w-3 text-green-600" /> : "-"}</span>
                  )}
                </td>
                <td className={cn(tdClass, "text-center")} onClick={(e) => e.stopPropagation()}>
                  {item.link_url ? (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  {canEditDelete(item) && (
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        onClick={() => onEdit(item)}
                        title="Edit"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 transition-colors hover:bg-yellow-100"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        title="Hapus"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
              <td colSpan={3} className="px-2 py-2 text-right text-[11px] text-gray-600">
                Total:
              </td>
              <td className="px-2 py-2 text-right text-[11px] tabular-nums text-gray-900">{formatRupiah(totalValue)}</td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Mobile / tablet card list ─────────────────────────────────── */}
      <div className="divide-y divide-gray-100 lg:hidden">
        {items.map((item) => (
          <div key={item.id} onClick={() => onRowClick(item)} className="cursor-pointer p-4 transition-colors active:bg-gray-50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="truncate text-xs font-medium text-gray-800" title={item.description}>
                  {item.description}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {item.date} · {item.category}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{formatRupiah(item.value)}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span>{item.store}</span>
              {item.ket && <span>· {item.ket}</span>}
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  item.transfer === "TRUE" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
                )}
              >
                {item.transfer === "TRUE" ? "Sudah transfer" : "Belum transfer"}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5">
                {canExport && (
                  <button
                    onClick={() => onToggleTransfer(item)}
                    disabled={updatingTransfer === item.id}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors duration-200",
                      item.transfer === "TRUE" ? "border-green-500 bg-green-500" : "border-gray-300 bg-white",
                      updatingTransfer === item.id && "opacity-50"
                    )}
                  >
                    {item.transfer === "TRUE" && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </button>
                )}
                {item.link_url && (
                  <a
                    href={item.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Lihat
                  </a>
                )}
              </div>
              {canEditDelete(item) && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onEdit(item)} className="rounded-lg bg-yellow-50 p-1.5 text-yellow-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(item.id)} className="rounded-lg bg-red-50 p-1.5 text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
          <span className="text-xs font-medium text-gray-500">Total</span>
          <span className="text-sm font-semibold text-gray-900">{formatRupiah(totalValue)}</span>
        </div>
      </div>
    </>
  );
}