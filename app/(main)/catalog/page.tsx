"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { BookOpen, Download, ExternalLink, QrCode, X } from "lucide-react";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { Button } from "@/components/shared/Button";
import { GlassCard } from "@/components/shared/GlassCard";

// Menu Catalog — digerbang permission `canvasing` (sama seperti menu
// Canvasing). Tiap kartu = satu katalog publik; "Detail" dan "QR Code"
// membuka/meng-encode link publik (tanpa login) ke PDF A4-nya, lihat
// app/online-catalog/pdf/route.ts. QR memakai gaya yang sama dengan menu QR Code
// (qrcode.react, level H, logo Torch di tengah, download PNG).
const TORCH_LOGO_URL = "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png";

interface CatalogEntry {
  key: string;
  name: string;
  description: string;
  path: string;
}

const CATALOGS: CatalogEntry[] = [
  {
    key: "online",
    name: "Online Catalog",
    description: "Katalog A4: Backpack, Sling Bag, Waist Bag, Travel Pouch, Accessories — hanya produk yang ready.",
    path: "/online-catalog",
  },
];

export default function CatalogPage() {
  const router = useRouter();
  useSessionGuard();
  const [user, setUser] = useState<any>(null);
  const [qrEntry, setQrEntry] = useState<CatalogEntry | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const parsed = JSON.parse(userData);
    if (!parsed.canvasing) {
      router.push("/dashboard");
      return;
    }
    setUser(parsed);
  }, [router]);

  const publicLink = (entry: CatalogEntry) => `${window.location.origin}${entry.path}`;

  const handleDownloadQr = (entry: CatalogEntry) => {
    setDownloading(true);
    try {
      const qrCanvas = document.getElementById("catalog-qr-canvas") as HTMLCanvasElement | null;
      if (!qrCanvas) throw new Error("QR canvas not found");

      const width = 420;
      const height = 480;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      const qrSize = 340;
      ctx.drawImage(qrCanvas, (width - qrSize) / 2, 30, qrSize, qrSize);

      ctx.fillStyle = "#111827";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(entry.name, width / 2, qrSize + 60);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `QRCode_${entry.name.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download QR code:", err);
    } finally {
      setDownloading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto page-bg">
      <div className="mx-auto max-w-7xl p-4">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <BookOpen className="h-5 w-5 text-gray-700" strokeWidth={2.25} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Catalog</h1>
            <p className="text-xs text-gray-400">Katalog publik — siapa saja yang punya link/QR bisa membukanya</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOGS.map((entry) => (
            <GlassCard key={entry.key} padding="md" className="glass-card-elevated flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-purple-50">
                  <BookOpen className="h-5 w-5 text-purple-600" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{entry.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={ExternalLink}
                  className="flex-1"
                  onClick={() => window.open(publicLink(entry), "_blank", "noopener,noreferrer")}
                >
                  Detail
                </Button>
                <Button variant="outline" size="sm" icon={QrCode} className="flex-1" onClick={() => setQrEntry(entry)}>
                  QR Code
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {qrEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setQrEntry(null)}
        >
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">QR Code — {qrEntry.name}</h2>
              <button onClick={() => setQrEntry(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <QRCodeCanvas
                  id="catalog-qr-canvas"
                  value={publicLink(qrEntry)}
                  size={200}
                  level="H"
                  imageSettings={{ src: TORCH_LOGO_URL, height: 26, width: 78, excavate: true, crossOrigin: "anonymous" }}
                />
              </div>
              <p className="text-sm font-semibold text-gray-800">{qrEntry.name}</p>
              <Button icon={Download} variant="outline" loading={downloading} onClick={() => handleDownloadQr(qrEntry)} className="w-full">
                Download PNG
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
