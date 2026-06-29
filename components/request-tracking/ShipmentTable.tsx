"use client";

import { ReactNode } from "react";
import { MessageCircle, ExternalLink, Pencil, Trash2, Upload } from "lucide-react";
import { ExpeditionBadge, TypeReasonBadge, ShipmentStatusBadge, CopyButton, CheckResiButton, ProcessToggle } from "./DomainBadges";
import { cn } from "@/lib/utils";

interface TrackingItem {
  id: string;
  date: string;
  assigned_to: string;
  expedition: string;
  sender: string;
  receiver: string;
  weight: string;
  reason: string;
  type_reason?: string;
  sales_order?: string;
  link_tracking: string;
  request_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  tracking_number?: string;
  has_processed?: string;
}

interface ShipmentTableProps {
  items: TrackingItem[];
  canEdit: boolean;
  canUpload: boolean;
  currentUserName: string;
  copiedId: string | null;
  hasActiveSearch: boolean;
  searchQuery: string;
  onRowClick: (item: TrackingItem) => void;
  onCopy: (text: string, id: string) => void;
  onCheckResi: (resi: string) => void;
  onToggleProcessed: (item: TrackingItem) => void;
  onUpload: (item: TrackingItem) => void;
  onEdit: (item: TrackingItem) => void;
  onDelete: (item: TrackingItem) => void;
  getStatus: (item: TrackingItem) => "completed" | "pending";
  buildWhatsappLink: (item: TrackingItem) => string | null;
  highlightText: (text: string, query: string) => ReactNode;
}

const thClass = "px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
const tdClass = "px-2 py-1.5 text-[11px] text-gray-700";

export function ShipmentTable({
  items,
  canEdit,
  canUpload,
  currentUserName,
  copiedId,
  hasActiveSearch,
  searchQuery,
  onRowClick,
  onCopy,
  onCheckResi,
  onToggleProcessed,
  onUpload,
  onEdit,
  onDelete,
  getStatus,
  buildWhatsappLink,
  highlightText,
}: ShipmentTableProps) {
  return (
    <>
      {/* ── Desktop table ──────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
              <th className={thClass}>Tanggal</th>
              <th className={thClass}>Assigned To</th>
              <th className={thClass}>Ekspedisi</th>
              <th className={thClass}>Pengirim</th>
              <th className={cn(thClass, "text-right")}>Berat</th>
              <th className={thClass}>Penerima</th>
              <th className={thClass}>No. Resi</th>
              <th className={thClass}>Tipe</th>
              <th className={thClass}>Sales Order</th>
              {canEdit && <th className={thClass}>Request By</th>}
              <th className={thClass}>Status</th>
              {(canEdit || canUpload) && <th className={cn(thClass, "text-center")}>Proses</th>}
              <th className={cn(thClass, "text-center")}>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => {
              const status = getStatus(item);
              const waLink = item.link_tracking ? buildWhatsappLink(item) : null;
              const isProcessed = item.has_processed === "TRUE";
              const canMutate = canEdit && !canUpload && item.request_by === currentUserName && status === "pending";

              return (
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
                  <td className={cn(tdClass, "max-w-[80px] truncate font-medium")}>{item.assigned_to}</td>
                  <td className={tdClass}>
                    <ExpeditionBadge expedition={item.expedition} />
                  </td>
                  <td className={cn(tdClass, "max-w-[90px] truncate")}>{item.sender}</td>
                  <td className={cn(tdClass, "text-right tabular-nums text-gray-500")}>{item.weight}kg</td>

                  {/* Penerima */}
                  <td className={cn(tdClass, "max-w-[110px]")}>
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={item.receiver}>
                        {hasActiveSearch ? highlightText(item.receiver.split("\n")[0], searchQuery) : item.receiver.split("\n")[0]}
                      </span>
                      {canUpload && item.receiver && (
                        <span onClick={(e) => e.stopPropagation()}>
                          <CopyButton text={item.receiver} id={item.id} copiedId={copiedId} onCopy={onCopy} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* No. Resi */}
                  <td className={cn(tdClass, "max-w-[120px]")} onClick={(e) => e.stopPropagation()}>
                    {item.tracking_number ? (
                      <div className="flex items-center gap-0.5">
                        <span className="truncate font-mono text-[10px] font-semibold text-blue-700" title={item.tracking_number}>
                          {hasActiveSearch ? highlightText(item.tracking_number, searchQuery) : item.tracking_number}
                        </span>
                        <CopyButton text={item.tracking_number} id={`resi-${item.id}`} copiedId={copiedId} onCopy={onCopy} />
                        <CheckResiButton trackingNumber={item.tracking_number} onCheck={onCheckResi} />
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Tipe */}
                  <td className={tdClass}>
                    <TypeReasonBadge typeReason={item.type_reason} />
                  </td>

                  {/* Sales Order */}
                  <td className={cn(tdClass, "max-w-[80px] truncate")}>
                    {item.sales_order ? (
                      <span className="font-mono text-[10px] text-gray-600">
                        {hasActiveSearch ? highlightText(item.sales_order, searchQuery) : item.sales_order}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Request By */}
                  {canEdit && <td className={cn(tdClass, "max-w-[70px] truncate text-gray-500")}>{item.request_by}</td>}

                  {/* Status */}
                  <td className={tdClass}>
                    <ShipmentStatusBadge status={status} />
                  </td>

                  {/* Proses toggle */}
                  {(canEdit || canUpload) && (
                    <td className={cn(tdClass, "text-center")} onClick={(e) => e.stopPropagation()}>
                      <ProcessToggle isProcessed={isProcessed} onToggle={() => onToggleProcessed(item)} />
                    </td>
                  )}

                  {/* Aksi */}
                  <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-0.5">
                      {canUpload && status === "pending" && (
                        <button
                          onClick={() => onUpload(item)}
                          title="Upload resi"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                        >
                          <Upload className="h-3 w-3" />
                        </button>
                      )}
                      {status === "completed" && waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Kirim via WhatsApp"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-green-50 text-green-600 transition-colors hover:bg-green-100"
                        >
                          <MessageCircle className="h-3 w-3" />
                        </a>
                      )}
                      {item.link_tracking && (
                        <a
                          href={item.link_tracking}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Lihat resi"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {canMutate && (
                        <>
                          <button
                            onClick={() => onEdit(item)}
                            title="Edit"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 transition-colors hover:bg-yellow-100"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => onDelete(item)}
                            title="Hapus"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile / tablet card list ─────────────────────────────────── */}
      <div className="divide-y divide-gray-100 lg:hidden">
        {items.map((item) => {
          const status = getStatus(item);
          const waLink = item.link_tracking ? buildWhatsappLink(item) : null;
          const isProcessed = item.has_processed === "TRUE";
          const canMutate = canEdit && !canUpload && item.request_by === currentUserName && status === "pending";

          return (
            <div key={item.id} onClick={() => onRowClick(item)} className="cursor-pointer p-4 transition-colors active:bg-gray-50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ExpeditionBadge expedition={item.expedition} />
                  <span className="text-xs font-medium text-gray-800">{item.assigned_to}</span>
                </div>
                <ShipmentStatusBadge status={status} />
              </div>

              <p className="mt-2 truncate text-xs text-gray-600" title={item.receiver}>
                {item.receiver.split("\n")[0]}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TypeReasonBadge typeReason={item.type_reason} />
                {item.sales_order && <span className="font-mono text-[11px] text-gray-500">{item.sales_order}</span>}
                <span className="text-[11px] text-gray-400">{item.date}</span>
                <span className="text-[11px] text-gray-400">· {item.weight} kg</span>
              </div>

              {item.tracking_number && (
                <div
                  className="mt-2 flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="flex-1 truncate font-mono text-[11px] font-semibold text-blue-700">{item.tracking_number}</span>
                  <CopyButton text={item.tracking_number} id={`resi-m-${item.id}`} copiedId={copiedId} onCopy={onCopy} />
                  <CheckResiButton trackingNumber={item.tracking_number} onCheck={onCheckResi} />
                </div>
              )}

              <div className="mt-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  {(canEdit || canUpload) && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      <ProcessToggle isProcessed={isProcessed} onToggle={() => onToggleProcessed(item)} />
                      {isProcessed ? "Diproses" : "Belum diproses"}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {canUpload && status === "pending" && (
                    <button
                      onClick={() => onUpload(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600"
                    >
                      <Upload className="h-3 w-3" />
                      Upload
                    </button>
                  )}
                  {status === "completed" && waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-600"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WA
                    </a>
                  )}
                  {canMutate && (
                    <>
                      <button onClick={() => onEdit(item)} className="rounded-lg bg-yellow-50 p-1.5 text-yellow-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onDelete(item)} className="rounded-lg bg-red-50 p-1.5 text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}