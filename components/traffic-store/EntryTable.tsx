"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/utils";

interface TrafficEntry {
  id: string;
  date: string;
  store_location: string;
  taft_name: string;
  customer_convert: string;
  traffic_source: string;
  wag_addition: string;
  eiger_addition: string;
  organic_addition: string;
  brand_competitor: string;
  intention: string;
  case: string;
  notes: string;
  sales_order: string;
  created_at: string;
  update_at: string;
  value_order?: string;
  discount_code?: string;
  // ── Revisi Survey ──
  customer_segment?: string;
  product_category?: string;
  product_detail?: string;
  reason_not_buy?: string;
  budget_range?: string;
  alt_purchase_channel?: string;
  reason_buy?: string;
}

interface EntryTableProps {
  items: TrafficEntry[];
  isStoreUser: boolean;
  canEdit: boolean;
  onEdit: (entry: TrafficEntry) => void;
  onDelete: (id: string) => void;
  formatDate: (v: string) => string;
  toTitleCase: (s: string) => string;
}

function getDetail(row: TrafficEntry): string {
  if (row.traffic_source === "Whatsapp Group") return row.wag_addition;
  if (row.traffic_source === "Dari Eiger") return row.eiger_addition;
  if (row.traffic_source === "Traffic Organic/Walk In") return row.organic_addition;
  return "";
}

const thClass = "px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
const tdClass = "px-2 py-1.5 text-[11px] leading-tight text-gray-700";

export function EntryTable({ items, isStoreUser, canEdit, onEdit, onDelete, formatDate, toTitleCase }: EntryTableProps) {
  return (
    <>
      {/* ── Desktop table ──────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
              <th className={thClass}>Tanggal</th>
              {!isStoreUser && <th className={thClass}>Store</th>}
              <th className={thClass}>Taft</th>
              <th className={thClass}>Beli?</th>
              <th className={thClass}>Sales Order</th>
              <th className={thClass}>Traffic Source</th>
              <th className={thClass}>Detail</th>
              <th className={thClass}>Brand</th>
              <th className={thClass}>Intensi</th>
              <th className={thClass}>Case</th>
              <th className={thClass}>Notes</th>
              <th className={thClass}>Segment</th>
              <th className={thClass}>Kategori</th>
              <th className={thClass}>Produk Spesifik</th>
              <th className={thClass}>Alasan Tidak Beli</th>
              <th className={thClass}>Budget</th>
              <th className={thClass}>Akan Beli Di Mana</th>
              <th className={thClass}>Alasan Beli</th>
              {canEdit && <th className={cn(thClass, "text-center")}>Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((row, idx) => {
              const detail = getDetail(row);
              return (
                <tr key={row.id || idx} className={cn("transition-colors duration-150", idx % 2 === 1 ? "bg-gray-50/40" : "bg-white", "hover:bg-primary/[0.04]")}>
                  <td className={cn(tdClass, "whitespace-nowrap text-gray-500")}>{formatDate(row.date)}</td>
                  {!isStoreUser && <td className={cn(tdClass, "whitespace-nowrap font-medium")}>{toTitleCase(row.store_location)}</td>}
                  <td className={cn(tdClass, "whitespace-nowrap")}>{row.taft_name}</td>
                  <td className={tdClass}>
                    <Badge variant={row.customer_convert === "Beli" ? "success" : row.customer_convert === "Tidak Beli" ? "error" : "neutral"}>
                      {row.customer_convert || "-"}
                    </Badge>
                  </td>
                  <td className={cn(tdClass, "whitespace-nowrap font-mono text-[10px] text-gray-500")}>{row.sales_order || "-"}</td>
                  <td className={tdClass}>
                    <Badge variant="info">{row.traffic_source}</Badge>
                  </td>
                  <td className={cn(tdClass, "max-w-[110px] truncate text-gray-500")} title={detail}>{detail || "-"}</td>
                  <td className={cn(tdClass, "max-w-[90px] truncate text-gray-500")} title={row.brand_competitor}>{row.brand_competitor || "-"}</td>
                  <td className={cn(tdClass, "max-w-[100px] truncate text-gray-600")} title={row.intention}>{row.intention || "-"}</td>
                  <td className={cn(tdClass, "max-w-[110px] truncate text-gray-600")} title={row.case}>{row.case || "-"}</td>
                  <td className={cn(tdClass, "max-w-[130px] truncate text-gray-500")} title={row.notes}>{row.notes || "-"}</td>
                  <td className={cn(tdClass, "max-w-[90px] truncate text-gray-500")} title={row.customer_segment}>{row.customer_segment || "-"}</td>
                  <td className={cn(tdClass, "max-w-[100px] truncate text-gray-500")} title={row.product_category}>{row.product_category || "-"}</td>
                  <td className={cn(tdClass, "max-w-[130px] truncate text-gray-500")} title={row.product_detail}>{row.product_detail || "-"}</td>
                  <td className={cn(tdClass, "max-w-[130px] truncate text-red-500")} title={row.reason_not_buy}>{row.reason_not_buy || "-"}</td>
                  <td className={cn(tdClass, "whitespace-nowrap text-gray-500")}>{row.budget_range || "-"}</td>
                  <td className={cn(tdClass, "max-w-[100px] truncate text-gray-500")} title={row.alt_purchase_channel}>{row.alt_purchase_channel || "-"}</td>
                  <td className={cn(tdClass, "max-w-[110px] truncate text-green-600")} title={row.reason_buy}>{row.reason_buy || "-"}</td>
                  {canEdit && (
                    <td className={tdClass}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEdit(row)}
                          title="Edit"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 transition-colors hover:bg-yellow-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onDelete(row.id)}
                          title="Hapus"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile / tablet card list ─────────────────────────────────── */}
      <div className="divide-y divide-gray-100 lg:hidden">
        {items.map((row, idx) => {
          const detail = getDetail(row);
          return (
            <div key={row.id || idx} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-gray-800">{row.taft_name}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {formatDate(row.date)}
                    {!isStoreUser && <> · {toTitleCase(row.store_location)}</>}
                  </p>
                </div>
                <Badge variant={row.customer_convert === "Beli" ? "success" : row.customer_convert === "Tidak Beli" ? "error" : "neutral"}>
                  {row.customer_convert || "-"}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="info">{row.traffic_source}</Badge>
                {detail && <span className="text-[11px] text-gray-500">{detail}</span>}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-500">
                {row.sales_order && (
                  <p>
                    SO: <span className="font-mono text-gray-700">{row.sales_order}</span>
                  </p>
                )}
                {row.brand_competitor && <p>Brand: {row.brand_competitor}</p>}
                {row.intention && <p>Intensi: {row.intention}</p>}
                {row.case && <p>Case: {row.case}</p>}
                {row.customer_segment && <p>Segment: {row.customer_segment}</p>}
                {row.product_category && <p>Kategori: {row.product_category}</p>}
                {row.reason_not_buy && <p className="text-red-500">Alasan: {row.reason_not_buy}</p>}
                {row.budget_range && <p>Budget: {row.budget_range}</p>}
                {row.alt_purchase_channel && <p>Ke: {row.alt_purchase_channel}</p>}
                {row.reason_buy && <p className="text-green-600">Beli krn: {row.reason_buy}</p>}
              </div>

              {row.product_detail && <p className="mt-2 text-[11px] font-medium text-gray-600">{row.product_detail}</p>}
              {row.notes && <p className="mt-1 text-[11px] text-gray-500">{row.notes}</p>}

              {canEdit && (
                <div className="mt-3 flex items-center justify-end gap-1.5">
                  <button onClick={() => onEdit(row)} className="rounded-lg bg-yellow-50 p-1.5 text-yellow-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(row.id)} className="rounded-lg bg-red-50 p-1.5 text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}