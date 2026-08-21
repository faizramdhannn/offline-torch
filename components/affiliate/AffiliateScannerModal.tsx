"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, Keyboard, ScanLine } from "lucide-react";

interface AffiliateScannerModalProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

// Scan QR code affiliate_code (kamera atau input manual). Pola scanner
// (html5-qrcode + fallback manual, start/stop + cleanup) meniru
// components/stock/CekHargaModal.tsx — di sini disederhanakan karena tidak
// perlu lookup/tampilkan detail item, cukup teruskan teks hasil scan ke
// pemanggil (form Order Affiliate) lalu tutup modal.
export function AffiliateScannerModal({ onScan, onClose }: AffiliateScannerModalProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualInput, setManualInput] = useState("");
  const [error, setError] = useState("");

  const html5QrRef = useRef<any>(null);
  const isScanningRef = useRef(false);
  const scanLockRef = useRef(false);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const handleDecoded = useCallback(
    (text: string) => {
      if (scanLockRef.current) return;
      const trimmed = (text || "").trim();
      if (!trimmed) return;
      scanLockRef.current = true;
      try { navigator.vibrate?.(80); } catch {}
      onScan(trimmed);
    },
    [onScan]
  );

  useEffect(() => {
    if (mode === "manual") {
      setTimeout(() => manualInputRef.current?.focus(), 50);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "camera") return;
    let cancelled = false;

    const startCamera = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        await new Promise((r) => setTimeout(r, 100));
        if (cancelled) return;

        const qr = new Html5Qrcode("affiliate-qr-reader");
        html5QrRef.current = qr;
        isScanningRef.current = false;

        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 130 } },
          (decodedText: string) => { if (!cancelled) handleDecoded(decodedText); },
          () => {}
        );
        isScanningRef.current = true;
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
  }, [mode, handleDecoded]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDecoded(manualInput);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <ScanLine className="h-4 w-4" /> Scan Kode Affiliate
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

        <div className="max-h-[75vh] overflow-y-auto p-4 space-y-3">
          {mode === "camera" ? (
            <div id="affiliate-qr-reader" className="overflow-hidden rounded-xl bg-gray-900" style={{ minHeight: 180 }} />
          ) : (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                ref={manualInputRef}
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Ketik atau scan kode affiliate..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
              <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90">
                Pakai
              </button>
            </form>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
