"use client";

import { useMemo, useState } from "react";
import { X, Plus, Trash2, Search } from "lucide-react";

interface StockItem {
  sku: string;
  item_name: string;
  hpj: string;
  link_url?: string;
  image_url?: string;
}

interface CalcRow {
  id: string;
  sku: string;
  item_name: string;
  hpj: number;
  qty: number;
  discountPct: number;
}

interface PriceCalculatorModalProps {
  items: StockItem[];
  onClose: () => void;
  toProperCase: (s: string) => string;
  parseHarga: (v: string | undefined | null) => number;
  formatRupiah: (v: number) => string;
}

// Kalkulator harga barang: cari SKU/nama item, tambah ke daftar, HPJ terisi
// otomatis dari data stock — plus kalkulator angka gaya iPhone (4-operasi
// dasar) di bawahnya untuk hitung cepat yang tidak terkait item tertentu.
// Sengaja pakai HPJ mentah (bukan yang sudah didiskon toko) sebagai basis,
// sama seperti perhitungan "Total Value" lain di halaman Stock — diskon
// tambahan di sini murni input manual milik kalkulator ini sendiri.
export function PriceCalculatorModal({ items, onClose, toProperCase, parseHarga, formatRupiah }: PriceCalculatorModalProps) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rows, setRows] = useState<CalcRow[]>([]);

  // Dedupe per SKU (data stock tab "store" punya baris per warehouse untuk
  // SKU yang sama) — HPJ/nama tidak beda antar warehouse jadi ambil satu saja.
  const uniqueItems = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const it of items) {
      if (it.sku && !map.has(it.sku)) map.set(it.sku, it);
    }
    return Array.from(map.values());
  }, [items]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return uniqueItems
      .filter((it) => (it.sku || "").toLowerCase().includes(q) || (it.item_name || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, uniqueItems]);

  const addItem = (it: StockItem) => {
    setRows((prev) => [
      ...prev,
      {
        id: `${it.sku}-${Date.now()}`,
        sku: it.sku,
        item_name: it.item_name,
        hpj: parseHarga(it.hpj),
        qty: 1,
        discountPct: 0,
      },
    ]);
    setQuery("");
    setShowSuggestions(false);
  };

  const updateRow = (id: string, patch: Partial<CalcRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const rowSubtotal = (r: CalcRow) => Math.round(r.hpj * r.qty * (1 - r.discountPct / 100));
  const grandTotal = rows.reduce((sum, r) => sum + rowSubtotal(r), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg max-h-[92vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Kalkulator</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* ── Kalkulator harga item ─────────────────────────────────── */}
          <div>
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Cari SKU atau nama item untuk ditambahkan..."
                  className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {suggestions.map((it) => (
                    <button
                      key={it.sku}
                      onClick={() => addItem(it)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-gray-800">{it.sku}</span>{" "}
                        <span className="text-gray-500">{toProperCase(it.item_name)}</span>
                      </span>
                      <span className="shrink-0 font-medium text-gray-600">{formatRupiah(parseHarga(it.hpj))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {rows.length > 0 && (
              <div className="mt-3 space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className="rounded-lg border border-gray-200 p-2.5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-800">{r.sku}</p>
                        <p className="truncate text-[11px] text-gray-500">{toProperCase(r.item_name)}</p>
                      </div>
                      <button onClick={() => removeRow(r.id)} className="shrink-0 rounded p-1 text-red-400 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400">Qty</label>
                        <input
                          type="number"
                          min={1}
                          value={r.qty}
                          onChange={(e) => updateRow(r.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400">HPJ</label>
                        <input
                          type="number"
                          min={0}
                          value={r.hpj}
                          onChange={(e) => updateRow(r.id, { hpj: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400">Diskon %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={r.discountPct}
                          onChange={(e) =>
                            updateRow(r.id, { discountPct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })
                          }
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                    <div className="mt-1.5 text-right text-xs font-semibold text-gray-700">
                      Subtotal: {formatRupiah(rowSubtotal(r))}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                  <span className="text-xs font-semibold text-gray-700">Grand Total</span>
                  <span className="text-sm font-bold text-primary">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Kalkulator angka (Liquid Glass) ──────────────────────── */}
          <NumberPad />
        </div>
      </div>
    </div>
  );
}

function calc(a: number, b: number, op: string): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? 0 : a / b;
    default:
      return b;
  }
}

function formatDisplay(value: number): string {
  if (!isFinite(value)) return "Error";
  const rounded = Math.round(value * 1e8) / 1e8;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 8, useGrouping: false });
}

function NumberPad() {
  const [display, setDisplay] = useState("0");
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecond, setWaitingForSecond] = useState(false);

  const inputDigit = (d: string) => {
    if (waitingForSecond) {
      setDisplay(d);
      setWaitingForSecond(false);
    } else {
      setDisplay(display === "0" ? d : display + d);
    }
  };

  const inputDecimal = () => {
    if (waitingForSecond) {
      setDisplay("0.");
      setWaitingForSecond(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  };

  const clearAll = () => {
    setDisplay("0");
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecond(false);
  };

  const toggleSign = () => setDisplay(formatDisplay(parseFloat(display) * -1));
  const inputPercent = () => setDisplay(formatDisplay(parseFloat(display) / 100));

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);
    if (firstOperand === null) {
      setFirstOperand(inputValue);
    } else if (operator && !waitingForSecond) {
      const result = calc(firstOperand, inputValue, operator);
      setDisplay(formatDisplay(result));
      setFirstOperand(result);
    }
    setWaitingForSecond(true);
    setOperator(nextOperator);
  };

  const handleEquals = () => {
    if (operator === null || firstOperand === null) return;
    const inputValue = parseFloat(display);
    const result = calc(firstOperand, inputValue, operator);
    setDisplay(formatDisplay(result));
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecond(false);
  };

  const btnBase =
    "select-none rounded-full text-lg font-medium transition-all active:scale-95 backdrop-blur-xl border border-white/20";

  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 45%, #9d174d 100%)",
      }}
    >
      <div className="mb-3 px-2 pt-1 text-right">
        <span className="break-all font-mono text-3xl font-light text-white">{display}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={clearAll}
          className={`${btnBase} h-12 bg-white/25 text-white hover:bg-white/35`}
        >
          AC
        </button>
        <button onClick={toggleSign} className={`${btnBase} h-12 bg-white/25 text-white hover:bg-white/35`}>
          +/-
        </button>
        <button onClick={inputPercent} className={`${btnBase} h-12 bg-white/25 text-white hover:bg-white/35`}>
          %
        </button>
        <button
          onClick={() => performOperation("÷")}
          className={`${btnBase} h-12 bg-orange-500/80 text-white hover:bg-orange-500/95 ${
            operator === "÷" && waitingForSecond ? "ring-2 ring-white" : ""
          }`}
        >
          ÷
        </button>

        {[7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => inputDigit(String(n))}
            className={`${btnBase} h-12 bg-white/15 text-white hover:bg-white/25`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => performOperation("×")}
          className={`${btnBase} h-12 bg-orange-500/80 text-white hover:bg-orange-500/95 ${
            operator === "×" && waitingForSecond ? "ring-2 ring-white" : ""
          }`}
        >
          ×
        </button>

        {[4, 5, 6].map((n) => (
          <button
            key={n}
            onClick={() => inputDigit(String(n))}
            className={`${btnBase} h-12 bg-white/15 text-white hover:bg-white/25`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => performOperation("-")}
          className={`${btnBase} h-12 bg-orange-500/80 text-white hover:bg-orange-500/95 ${
            operator === "-" && waitingForSecond ? "ring-2 ring-white" : ""
          }`}
        >
          −
        </button>

        {[1, 2, 3].map((n) => (
          <button
            key={n}
            onClick={() => inputDigit(String(n))}
            className={`${btnBase} h-12 bg-white/15 text-white hover:bg-white/25`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => performOperation("+")}
          className={`${btnBase} h-12 bg-orange-500/80 text-white hover:bg-orange-500/95 ${
            operator === "+" && waitingForSecond ? "ring-2 ring-white" : ""
          }`}
        >
          +
        </button>

        <button
          onClick={() => inputDigit("0")}
          className={`${btnBase} col-span-2 h-12 bg-white/15 text-left pl-5 text-white hover:bg-white/25`}
        >
          0
        </button>
        <button onClick={inputDecimal} className={`${btnBase} h-12 bg-white/15 text-white hover:bg-white/25`}>
          .
        </button>
        <button onClick={handleEquals} className={`${btnBase} h-12 bg-orange-500/80 text-white hover:bg-orange-500/95`}>
          =
        </button>
      </div>
    </div>
  );
}
