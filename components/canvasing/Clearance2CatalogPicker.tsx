"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, PackageSearch } from "lucide-react";
import { Button } from "@/components/shared/Button";

interface ClearanceProduct {
  sku: string;
  item_name: string;
  category: string;
  image_url: string;
  price: string;
  price_promo: string;
  stock_all: number;
}

type SortMode = "sheet" | "category" | "stock";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "sheet", label: "Sesuai List di Sheet" },
  { value: "category", label: "Sesuai Category" },
  { value: "stock", label: "Stock Paling Banyak" },
];

interface Props {
  onClose: () => void;
}

export function Clearance2CatalogPicker({ onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<ClearanceProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("sheet");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/canvasing/ecatalog-clearance-2/generate");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Gagal memuat daftar produk");
        const list: ClearanceProduct[] = json.products || [];
        setProducts(list);
        setSelected(new Set(list.map((p) => p.sku)));
      } catch (e: any) {
        setError(e?.message || "Gagal memuat daftar produk");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

// API mengembalikan urutan asli sheet (stock 0 sudah dibuang) — pengurutan
  // category/stock diterapkan di sini sesuai pilihan user.
  const sortedProducts = useMemo(() => {
    if (sortMode === "category") {
      return [...products].sort((a, b) => a.category.localeCompare(b.category, "id"));
    }
    if (sortMode === "stock") {
      return [...products].sort((a, b) => b.stock_all - a.stock_all);
    }
    return products;
  }, [products, sortMode]);

  // Grouping per category cuma masuk akal untuk mode "category" — mode
  // "sheet"/"stock" ditampilkan sebagai satu list flat supaya urutannya
  // (urutan sheet asli / ranking stock global) tidak pecah oleh kategori.
  const grouped = useMemo(() => {
    if (sortMode !== "category") return null;
    const map = new Map<string, ClearanceProduct[]>();
    for (const p of sortedProducts) {
      const arr = map.get(p.category) || [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries());
  }, [sortedProducts, sortMode]);

  const toggle = (sku: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const toggleCategory = (items: ClearanceProduct[]) => {
    const allSelected = items.every((p) => selected.has(p.sku));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of items) {
        if (allSelected) next.delete(p.sku);
        else next.add(p.sku);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(products.map((p) => p.sku)));
  const selectNone = () => setSelected(new Set());

  const handleGenerate = async () => {
    if (selected.size === 0) {
      alert("Pilih minimal 1 produk");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/canvasing/ecatalog-clearance-2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skus: Array.from(selected), sortMode }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Clearance_Catalog_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        onClose();
      } else {
        alert("Gagal generate clearance e-catalog");
      }
    } catch {
      alert("Gagal generate clearance e-catalog");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="glass-card flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">
              Pilih Produk Clearance Catalog
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 hover:text-gray-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center py-16 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-gray-200 px-5 py-2.5 dark:border-gray-700">
              {SORT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="sortMode"
                    checked={sortMode === opt.value}
                    onChange={() => setSortMode(opt.value)}
                    className="h-3.5 w-3.5 border-gray-300"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-5 py-2.5 dark:border-gray-700">
              <span className="text-xs text-gray-500">
                {selected.size} dari {products.length} produk dipilih
              </span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs font-medium text-primary hover:underline">
                  Pilih Semua
                </button>
                <button onClick={selectNone} className="text-xs font-medium text-gray-500 hover:underline">
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {grouped ? (
                grouped.map(([category, items]) => {
                  const allSelected = items.every((p) => selected.has(p.sku));
                  return (
                    <div key={category} className="mb-4">
                      <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-900">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleCategory(items)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {category}
                        <span className="font-normal text-gray-400">({items.length})</span>
                      </label>
                      <div className="space-y-1 pl-6">
                        {items.map((p) => (
                          <label
                            key={p.sku}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-black/5"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={selected.has(p.sku)}
                                onChange={() => toggle(p.sku)}
                                className="h-4 w-4 shrink-0 rounded border-gray-300"
                              />
                              <span className="truncate text-sm text-gray-800">{p.item_name}</span>
                            </span>
                            <span className="shrink-0 text-xs font-medium text-gray-500">
                              Stock: {p.stock_all}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="space-y-1">
                  {sortedProducts.map((p) => (
                    <label
                      key={p.sku}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-black/5"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={selected.has(p.sku)}
                          onChange={() => toggle(p.sku)}
                          className="h-4 w-4 shrink-0 rounded border-gray-300"
                        />
                        <span className="truncate text-sm text-gray-800">{p.item_name}</span>
                        <span className="shrink-0 text-xs text-gray-400">{p.category}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-gray-500">
                        Stock: {p.stock_all}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
              <Button variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? "Membuat PDF..." : "Generate PDF"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
