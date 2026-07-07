"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, Columns3, RotateCcw } from "lucide-react";
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

// ─── Column registry ──────────────────────────────────────────────────────────
// `essential: true` columns are always shown and can't be hidden (identity of the row).
// Everything else can be toggled on/off via the "Kolom" picker.
interface ColumnDef {
  key: string;
  label: string;
  essential?: boolean;
  defaultVisible: boolean;
  storeOnly?: boolean; // only relevant/shown when NOT isStoreUser
  render: (row: TrafficEntry, ctx: { formatDate: (v: string) => string; toTitleCase: (s: string) => string }) => React.ReactNode;
  cellClass?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "date", label: "Tanggal", essential: true, defaultVisible: true,
    cellClass: "whitespace-nowrap text-gray-500",
    render: (row, { formatDate }) => formatDate(row.date) },
  { key: "store", label: "Store", essential: true, defaultVisible: true, storeOnly: true,
    cellClass: "whitespace-nowrap font-medium",
    render: (row, { toTitleCase }) => toTitleCase(row.store_location) },
  { key: "taft", label: "Taft", essential: true, defaultVisible: true,
    cellClass: "whitespace-nowrap",
    render: (row) => row.taft_name },
  { key: "convert", label: "Beli?", essential: true, defaultVisible: true,
    render: (row) => (
      <Badge variant={row.customer_convert === "Beli" ? "success" : row.customer_convert === "Tidak Beli" ? "error" : "neutral"}>
        {row.customer_convert || "-"}
      </Badge>
    ) },
  { key: "sales_order", label: "Sales Order", defaultVisible: true,
    cellClass: "whitespace-nowrap font-mono text-[10px] text-gray-500",
    render: (row) => row.sales_order || "-" },
  { key: "traffic_source", label: "Traffic Source", defaultVisible: true,
    render: (row) => <Badge variant="info">{row.traffic_source}</Badge> },
  { key: "source_detail", label: "Detail", defaultVisible: true,
    cellClass: "max-w-[110px] truncate text-gray-500",
    render: (row) => getDetail(row) || "-" },
  { key: "brand_competitor", label: "Brand", defaultVisible: true,
    cellClass: "max-w-[90px] truncate text-gray-500",
    render: (row) => row.brand_competitor || "-" },
  { key: "intention", label: "Intensi", defaultVisible: false,
    cellClass: "max-w-[100px] truncate text-gray-600",
    render: (row) => row.intention || "-" },
  { key: "case", label: "Case", defaultVisible: false,
    cellClass: "max-w-[110px] truncate text-gray-600",
    render: (row) => row.case || "-" },
  { key: "notes", label: "Notes", defaultVisible: true,
    cellClass: "max-w-[130px] truncate text-gray-500",
    render: (row) => row.notes || "-" },
  { key: "customer_segment", label: "Segment", defaultVisible: true,
    cellClass: "max-w-[90px] truncate text-gray-500",
    render: (row) => row.customer_segment || "-" },
  { key: "product_category", label: "Kategori", defaultVisible: true,
    cellClass: "max-w-[100px] truncate text-gray-500",
    render: (row) => row.product_category || "-" },
  { key: "product_detail", label: "Produk Spesifik", defaultVisible: true,
    cellClass: "max-w-[130px] truncate text-gray-500",
    render: (row) => row.product_detail || "-" },
  { key: "reason_not_buy", label: "Alasan Tidak Beli", defaultVisible: true,
    cellClass: "max-w-[130px] truncate text-red-500",
    render: (row) => row.reason_not_buy || "-" },
  { key: "budget_range", label: "Budget", defaultVisible: false,
    cellClass: "whitespace-nowrap text-gray-500",
    render: (row) => row.budget_range || "-" },
  { key: "alt_purchase_channel", label: "Akan Beli Di Mana", defaultVisible: false,
    cellClass: "max-w-[100px] truncate text-gray-500",
    render: (row) => row.alt_purchase_channel || "-" },
  { key: "reason_buy", label: "Alasan Beli", defaultVisible: true,
    cellClass: "max-w-[110px] truncate text-green-600",
    render: (row) => row.reason_buy || "-" },
];

const STORAGE_KEY = "traffic_store_visible_columns_v1";

function loadVisibleColumns(): Record<string, boolean> {
  const defaults = Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultVisible]));
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

// ─── Column picker dropdown ───────────────────────────────────────────────────
function ColumnPicker({
  columns, visible, onToggle, onReset,
}: {
  columns: ColumnDef[];
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggleableCount = columns.filter((c) => !c.essential).length;
  const visibleToggleableCount = columns.filter((c) => !c.essential && visible[c.key]).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
          open ? "border-primary/40 bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        )}
      >
        <Columns3 className="h-3.5 w-3.5" />
        Kolom
        <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500">
          {visibleToggleableCount}/{toggleableCount}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tampilkan Kolom</span>
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Reset
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {columns.filter((c) => !c.essential).map((c) => (
              <label
                key={c.key}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={!!visible[c.key]}
                  onChange={() => onToggle(c.key)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
                />
                {c.label}
              </label>
            ))}
          </div>
          <p className="mt-1 border-t border-gray-100 px-1.5 pt-1.5 text-[10px] text-gray-400">
            Tanggal, Store, Taft &amp; Beli? selalu tampil
          </p>
        </div>
      )}
    </div>
  );
}

export function EntryTable({ items, isStoreUser, canEdit, onEdit, onDelete, formatDate, toTitleCase }: EntryTableProps) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() => loadVisibleColumns());

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visible)); } catch {}
  }, [visible]);

  const toggleColumn = (key: string) => setVisible((v) => ({ ...v, [key]: !v[key] }));
  const resetColumns = () => setVisible(Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultVisible])));

  const activeColumns = useMemo(
    () => COLUMNS.filter((c) => {
      if (c.storeOnly && isStoreUser) return false;
      if (c.essential) return true;
      return !!visible[c.key];
    }),
    [visible, isStoreUser]
  );

  return (
    <>
      {/* ── Column picker toolbar ── */}
      <div className="hidden items-center justify-end border-b border-gray-100 px-3 py-2 lg:flex">
        <ColumnPicker columns={COLUMNS} visible={visible} onToggle={toggleColumn} onReset={resetColumns} />
      </div>

      {/* ── Desktop table ──────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
              {activeColumns.map((c) => (
                <th key={c.key} className={thClass}>{c.label}</th>
              ))}
              {canEdit && <th className={cn(thClass, "text-center")}>Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((row, idx) => (
              <tr key={row.id || idx} className={cn("transition-colors duration-150", idx % 2 === 1 ? "bg-gray-50/40" : "bg-white", "hover:bg-primary/[0.04]")}>
                {activeColumns.map((c) => {
                  const content = c.render(row, { formatDate, toTitleCase });
                  const titleAttr = typeof content === "string" ? content : undefined;
                  return (
                    <td key={c.key} className={cn(tdClass, c.cellClass)} title={titleAttr}>
                      {content}
                    </td>
                  );
                })}
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
            ))}
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