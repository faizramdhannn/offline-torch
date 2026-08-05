"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, Keyboard, ScanLine } from "lucide-react";

interface StockItem {
  sku: string;
  item_name: string;
  category: string;
  grade: string;
  tier_product: string;
  tier_phase: string;
  hpj: string;
  discount?: string;
  link_url?: string;
  image_url?: string;
}

// html5-qrcode kadang membiarkan kamera pakai fixed-focus (khususnya sebagian
// device Android) — kadang tajam, kadang tidak, tergantung jarak awal saat
// kamera nyala. Paksa continuous autofocus lewat raw MediaTrackConstraints
// kalau device/browser-nya support; gagal diam-diam kalau tidak (mis. iOS
// Safari belum support constraint ini). Dipanggil sekali saat kamera start,
// dan bisa dipanggil ulang manual lewat tombol "Fokus Ulang".
async function forceContinuousFocus(qr: any) {
  try {
    await qr.applyVideoConstraints({ advanced: [{ focusMode: "continuous" }] });
  } catch {}
}

interface CekHargaModalProps {
  items: StockItem[];
  onClose: () => void;
  toProperCase: (s: string) => string;
  parseDiscount: (v: string | undefined | null) => number;
  parseHarga: (v: string | undefined | null) => number;
  formatRupiah: (v: number) => string;
}

// Cek Harga — scan barcode SKU (kamera atau input manual) lalu tampilkan
// gambar, SKU, harga+diskon, category, tier product, tier phase, dan grade
// item tersebut. Pola scanner (html5-qrcode + fallback manual) meniru
// MaterialIssueScanner di app/(main)/material-issue/page.tsx.
export function CekHargaModal({
  items,
  onClose,
  toProperCase,
  parseDiscount,
  parseHarga,
  formatRupiah,
}: CekHargaModalProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [skuInput, setSkuInput] = useState("");
  const [error, setError] = useState("");
  const [found, setFound] = useState<StockItem | null>(null);
  const [imgError, setImgError] = useState(false);

  const html5QrRef = useRef<any>(null);
  const isScanningRef = useRef(false);
  const scanLockRef = useRef(false);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const lookupSku = useCallback(
    (sku: string) => {
      if (scanLockRef.current) return;
      const trimmed = sku.trim().toUpperCase();
      if (!trimmed) return;

      const match = items.find((i) => (i.sku || "").toUpperCase() === trimmed);
      if (!match) {
        setError(`SKU "${trimmed}" tidak ditemukan`);
        setFound(null);
        return;
      }

      scanLockRef.current = true;
      setError("");
      setImgError(false);
      setFound(match);
      // Beep singkat via getaran (kalau device support) sebagai konfirmasi scan.
      try { navigator.vibrate?.(80); } catch {}
      setTimeout(() => { scanLockRef.current = false; }, 800);
    },
    [items]
  );

  useEffect(() => {
    if (mode === "manual") {
      setTimeout(() => skuInputRef.current?.focus(), 50);
    }
  }, [mode]);

  // Begitu item ketemu, kamera dipersempit (lihat style di bawah) dan hasilnya
  // di-scroll ke posisi terlihat — sebelumnya di HP, area kamera yang tinggi
  // bikin kartu hasil kedorong jauh ke bawah, susah dilihat tanpa scroll manual.
  useEffect(() => {
    if (found) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }, [found]);

  useEffect(() => {
    if (mode !== "camera") return;
    let cancelled = false;

    const startCamera = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        await new Promise((r) => setTimeout(r, 100));
        if (cancelled) return;

        const qr = new Html5Qrcode("cek-harga-qr-reader");
        html5QrRef.current = qr;
        isScanningRef.current = false;

        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 130 } },
          (decodedText: string) => { if (!cancelled) lookupSku(decodedText); },
          () => {}
        );
        isScanningRef.current = true;
        await forceContinuousFocus(qr);
      } catch {
        if (!cancelled) setError("Kamera tidak dapat diakses");
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      if (html5QrRef.current && isScanningRef.current) {
        html5QrRef.current.stop().catch(() => {});
        isScanningRef.current = false;
      }
      html5QrRef.current = null;
    };
  }, [mode, lookupSku]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupSku(skuInput);
    setSkuInput("");
  };

  const discountPct = found ? parseDiscount(found.discount) : 0;
  const hpjVal = found ? parseHarga(found.hpj) : 0;
  const hargaDiskon = discountPct > 0 && hpjVal > 0 ? Math.round(hpjVal * (1 - discountPct / 100)) : 0;
  const imageUrl = found ? found.link_url || found.image_url || "" : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <ScanLine className="h-4 w-4" /> Cek Harga
          </h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-100 px-4 pt-2">
          <button
            onClick={() => { setMode("camera"); setError(""); }}
            className={`flex items-center gap-1 rounded-t-lg px-3 py-1.5 text-xs font-medium ${
              mode === "camera" ? "bg-primary/10 text-primary" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Camera className="h-3.5 w-3.5" /> Kamera
          </button>
          <button
            onClick={() => { setMode("manual"); setError(""); }}
            className={`flex items-center gap-1 rounded-t-lg px-3 py-1.5 text-xs font-medium ${
              mode === "manual" ? "bg-primary/10 text-primary" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" /> Manual
          </button>
        </div>

        <div ref={bodyRef} className="max-h-[75vh] overflow-y-auto p-4 space-y-3">
          {mode === "camera" ? (
            <div>
              <div
                id="cek-harga-qr-reader"
                className="overflow-hidden rounded-xl bg-gray-900 transition-[min-height] duration-200"
                style={{ minHeight: found ? 110 : 180 }}
              />
              {!found && (
                <button
                  type="button"
                  onClick={() => { if (html5QrRef.current) forceContinuousFocus(html5QrRef.current); }}
                  className="mt-2 w-full rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Fokus Ulang
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                ref={skuInputRef}
                type="text"
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                placeholder="Ketik atau scan SKU..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
              <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90">
                Cari
              </button>
            </form>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {found && (
            <div ref={resultRef} className="overflow-hidden rounded-xl border border-gray-200">
              {imageUrl && !imgError ? (
                <div className="flex h-36 items-center justify-center overflow-hidden border-b border-gray-100 bg-gray-50">
                  <img
                    src={imageUrl}
                    alt={found.sku}
                    className="max-h-36 max-w-full object-contain"
                    onError={() => setImgError(true)}
                  />
                </div>
              ) : (
                <div className="flex h-16 items-center justify-center border-b border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-400">Tidak ada gambar</span>
                </div>
              )}

              <div className="space-y-1.5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-gray-900">{found.sku}</span>
                  {found.hpj && (
                    discountPct > 0 ? (
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 line-through">{found.hpj}</div>
                        <div className="flex items-center gap-1">
                          <span className="rounded bg-red-500 px-1.5 py-px text-[10px] font-bold text-white">-{discountPct}%</span>
                          <span className="text-[13px] font-bold text-gray-900">{formatRupiah(hargaDiskon)}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[13px] font-bold text-gray-900">{found.hpj}</span>
                    )
                  )}
                </div>
                <p className="text-[11px] font-medium text-gray-700">{toProperCase(found.item_name)}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 text-[10.5px] text-gray-600">
                  <div><span className="text-gray-400">Category:</span> {toProperCase(found.category) || "-"}</div>
                  <div><span className="text-gray-400">Grade:</span> {toProperCase(found.grade) || "-"}</div>
                  <div><span className="text-gray-400">Tier Product:</span> {toProperCase(found.tier_product) || "-"}</div>
                  <div><span className="text-gray-400">Tier Phase:</span> {toProperCase(found.tier_phase) || "-"}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
