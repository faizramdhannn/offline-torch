"use client";

import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { FieldLabel } from "@/components/shared/FormField";
import { cn } from "@/lib/utils";

// Alasan tidak beli yang berkaitan dengan harga — hanya ini yang membuka budget_range
export const PRICE_REASONS = ["Harga Di Atas Budget", "Harga Lebih Murah Online", "Menunggu Promo Lebih Besar"];

export interface TrafficFormData {
  date: string;
  taft_name: string;
  customer_convert: string;
  traffic_source: string;
  wag_addition: string;
  eiger_addition: string;
  organic_addition: string;
  brand_competitor: string;
  brand_custom: string;
  intention: string;
  case: string;
  notes: string;
  sales_order: string;
  // ── Revisi Survey ──
  customer_segment: string;
  product_category: string;
  product_detail: string;
  reason_not_buy: string;
  budget_range: string;
  alt_purchase_channel: string;
  reason_buy: string;
}

interface EntryFormModalProps {
  mode: "add" | "edit";
  open: boolean;
  onClose: () => void;
  form: TrafficFormData;
  onChange: (form: TrafficFormData) => void;
  storeLabel?: string;
  taftsForStore: string[];
  trafficSources: string[];
  wagAdditions: string[];
  eigerAdditions: string[];
  organicAdditions: string[];
  brandCompetitors: string[];
  intentions: string[];
  casesForIntention: string[];
  customerSegments: string[];
  productCategories: string[];
  reasonsNotBuy: string[];
  budgetRanges: string[];
  altPurchaseChannels: string[];
  reasonsBuy: string[];
  saving: boolean;
  onSubmit: () => void;
  toTitleCase: (s: string) => string;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 outline-none transition-colors duration-200 hover:bg-white focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10";

export function EntryFormModal({
  mode,
  open,
  onClose,
  form,
  onChange,
  storeLabel,
  taftsForStore,
  trafficSources,
  wagAdditions,
  eigerAdditions,
  organicAdditions,
  brandCompetitors,
  intentions,
  casesForIntention,
  customerSegments,
  productCategories,
  reasonsNotBuy,
  budgetRanges,
  altPurchaseChannels,
  reasonsBuy,
  saving,
  onSubmit,
  toTitleCase,
}: EntryFormModalProps) {
  const salesOrderInvalid = form.sales_order.trim() && !/^#\d+$/.test(form.sales_order.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={mode === "add" ? Plus : Pencil}
      title={mode === "add" ? "Tambah Data Traffic" : "Edit Data Traffic"}
      footer={
        <>
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button className="flex-1 justify-center" onClick={onSubmit} loading={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {storeLabel && (
          <div>
            <FieldLabel>Store</FieldLabel>
            <input type="text" value={toTitleCase(storeLabel)} disabled className={cn(inputClass, "bg-gray-100 text-gray-500")} />
          </div>
        )}

        <div>
          <FieldLabel required>Tanggal</FieldLabel>
          <input type="date" value={form.date} onChange={(e) => onChange({ ...form, date: e.target.value })} className={inputClass} />
        </div>

        <div>
          <FieldLabel required>Taft</FieldLabel>
          <select value={form.taft_name} onChange={(e) => onChange({ ...form, taft_name: e.target.value })} className={inputClass}>
            <option value="">-- Pilih Taft --</option>
            {taftsForStore.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel required>Apakah customer membeli?</FieldLabel>
          <div className="flex gap-2">
            {["Beli", "Tidak Beli"].map((opt) => {
              const isSelected = form.customer_convert === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange({ ...form, customer_convert: opt, sales_order: opt === "Tidak Beli" ? "" : form.sales_order })}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-200",
                    isSelected
                      ? opt === "Beli"
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-red-500 bg-red-500 text-white"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {form.customer_convert === "Beli" && (
          <div className="border-l-2 border-green-300 pl-3">
            <FieldLabel required>Sales Order</FieldLabel>
            <input
              type="text"
              value={form.sales_order}
              onChange={(e) => onChange({ ...form, sales_order: e.target.value })}
              placeholder="Contoh: #4098769"
              autoFocus
              className={cn(
                "w-full rounded-lg border bg-green-50 px-3 py-2 font-mono text-xs outline-none transition-colors focus:ring-2",
                salesOrderInvalid ? "border-red-400 focus:ring-red-100" : "border-green-300 focus:ring-green-100"
              )}
            />
            {salesOrderInvalid ? (
              <p className="mt-1 text-[11px] text-red-500">Format tidak valid. Gunakan format #angka, contoh: #409876</p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400">Wajib diisi dengan format #angka, contoh: #409876</p>
            )}
          </div>
        )}

        {form.customer_convert === "Beli" && (
          <div className="border-l-2 border-green-300 pl-3">
            <FieldLabel required>Apa yang membuat customer memutuskan beli?</FieldLabel>
            <select
              value={form.reason_buy}
              onChange={(e) => onChange({ ...form, reason_buy: e.target.value })}
              className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-green-100"
            >
              <option value="">-- Pilih Alasan Beli --</option>
              {reasonsBuy.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <FieldLabel required>Segment Customer</FieldLabel>
          <select
            value={form.customer_segment}
            onChange={(e) => onChange({ ...form, customer_segment: e.target.value })}
            className={inputClass}
          >
            <option value="">-- Pilih Segment --</option>
            {customerSegments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel required>Kategori Produk yang Dicari</FieldLabel>
          <select
            value={form.product_category}
            onChange={(e) => onChange({ ...form, product_category: e.target.value })}
            className={inputClass}
          >
            <option value="">-- Pilih Kategori --</option>
            {productCategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Produk Spesifik (SKU / Deskripsi)</FieldLabel>
          <input
            type="text"
            value={form.product_detail}
            onChange={(e) => onChange({ ...form, product_detail: e.target.value })}
            placeholder='Contoh: "Arrafa Black size 42"'
            className={inputClass}
          />
        </div>

        {form.customer_convert === "Tidak Beli" && (
          <div className="border-l-2 border-red-300 pl-3 space-y-3">
            <div>
              <FieldLabel required>Alasan Tidak Beli</FieldLabel>
              <select
                value={form.reason_not_buy}
                onChange={(e) =>
                  onChange({
                    ...form,
                    reason_not_buy: e.target.value,
                    budget_range: PRICE_REASONS.includes(e.target.value) ? form.budget_range : "",
                  })
                }
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-red-100"
              >
                <option value="">-- Pilih Alasan --</option>
                {reasonsNotBuy.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {PRICE_REASONS.includes(form.reason_not_buy) && (
              <div>
                <FieldLabel required>Budget Range</FieldLabel>
                <select
                  value={form.budget_range}
                  onChange={(e) => onChange({ ...form, budget_range: e.target.value })}
                  className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-red-100"
                >
                  <option value="">-- Pilih Budget --</option>
                  {budgetRanges.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <FieldLabel>Akan Beli Di Mana</FieldLabel>
              <select
                value={form.alt_purchase_channel}
                onChange={(e) => onChange({ ...form, alt_purchase_channel: e.target.value })}
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-red-100"
              >
                <option value="">-- Pilih Channel --</option>
                {altPurchaseChannels.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <FieldLabel required>Traffic Source</FieldLabel>
          <select
            value={form.traffic_source}
            onChange={(e) => onChange({ ...form, traffic_source: e.target.value, wag_addition: "", eiger_addition: "", organic_addition: "" })}
            className={inputClass}
          >
            <option value="">-- Pilih Traffic Source --</option>
            {trafficSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {form.traffic_source === "Whatsapp Group" && (
          <div className="border-l-2 border-blue-200 pl-3">
            <FieldLabel required>Karena apa?</FieldLabel>
            <select
              value={form.wag_addition}
              onChange={(e) => onChange({ ...form, wag_addition: e.target.value })}
              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-blue-100"
            >
              <option value="">-- Pilih WAG --</option>
              {wagAdditions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.traffic_source === "Dari Eiger" && (
          <div className="border-l-2 border-purple-200 pl-3">
            <FieldLabel required>Karena Apa?</FieldLabel>
            <select
              value={form.eiger_addition}
              onChange={(e) => onChange({ ...form, eiger_addition: e.target.value })}
              className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-purple-100"
            >
              <option value="">-- Pilih Eiger --</option>
              {eigerAdditions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.traffic_source === "Traffic Organic/Walk In" && (
          <div className="border-l-2 border-green-200 pl-3">
            <FieldLabel required>Karena Apa?</FieldLabel>
            <select
              value={form.organic_addition}
              onChange={(e) => onChange({ ...form, organic_addition: e.target.value })}
              className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-green-100"
            >
              <option value="">-- Pilih Organic --</option>
              {organicAdditions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <FieldLabel>Pernah beli tas di Brand apa?</FieldLabel>
          <select
            value={form.brand_competitor}
            onChange={(e) => onChange({ ...form, brand_competitor: e.target.value, brand_custom: "" })}
            className={inputClass}
          >
            <option value="">-- Pilih Brand --</option>
            {brandCompetitors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Lainnya">Lainnya</option>
          </select>
          {form.brand_competitor === "Lainnya" && (
            <input
              type="text"
              value={form.brand_custom}
              onChange={(e) => onChange({ ...form, brand_custom: e.target.value })}
              placeholder="Tulis nama brand..."
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-amber-100"
            />
          )}
        </div>

        <div>
          <FieldLabel required>Intensi</FieldLabel>
          <select
            value={form.intention}
            onChange={(e) => onChange({ ...form, intention: e.target.value, case: "" })}
            className={inputClass}
          >
            <option value="">-- Pilih Intensi --</option>
            {intentions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel required>Case</FieldLabel>
          <select
            value={form.case}
            onChange={(e) => onChange({ ...form, case: e.target.value })}
            disabled={!form.intention}
            className={cn(inputClass, !form.intention && "cursor-not-allowed bg-gray-100 text-gray-400")}
          >
            <option value="">{!form.intention ? "Pilih Intensi terlebih dahulu" : "-- Pilih Case --"}</option>
            {casesForIntention.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>
            Catatan Tambahan
            <span className="ml-1 text-[10px] font-normal text-gray-400">(opsional)</span>
          </FieldLabel>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="Info tambahan yang tidak tertangkap dropdown di atas..."
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>
    </Modal>
  );
}