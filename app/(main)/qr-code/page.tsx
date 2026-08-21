"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Plus, Search, Trash2, Pencil, QrCode as QrCodeIcon, Download, X, BarChart3 } from "lucide-react";
import Popup from "@/components/Popup";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { SearchShortcutHint } from "@/components/shared/SearchShortcutHint";

// Menu QR Code — sheet qr_code (kolom: uuid, name, url, created_at, update_at),
// digerbang oleh permission `dashboard` (bukan permission baru — dashboard
// yang sudah ada dipakai ulang sesuai instruksi). Konsep QR-nya sama seperti
// QR affiliate: render lewat QRCodeCanvas (qrcode.react), logo Torch di
// tengah (imageSettings + excavate), bisa didownload jadi PNG.
//
// QR-nya meng-encode LINK TRACKING (`/r/<uuid>`, lihat app/r/[uuid]/route.ts),
// bukan langsung URL tujuan — supaya tiap scan tercatat ke sheet
// qr_code_analytic (device, browser, negara/kota via geo-IP, dst) sebelum
// diredirect ke URL asli. Analitiknya ditampilkan lewat tombol "Analitik"
// per kartu, mengambil ringkasan dari app/api/qr-code/analytics/route.ts.
const TORCH_LOGO_URL = "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png";

interface QrCodeItem {
  uuid: string;
  name: string;
  url: string;
  created_at: string;
  update_at: string;
}

interface AnalyticsSummary {
  total_scans: number;
  by_device: Record<string, number>;
  by_country: Record<string, number>;
  by_browser: Record<string, number>;
  by_day: Record<string, number>;
  recent: { scanned_at: string; country: string; city: string; device_type: string; browser: string }[];
}

function trackingLink(uuid: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/r/${uuid}`;
}

export default function QrCodePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<QrCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { ref: searchRef, shortcutLabel } = useSearchShortcut();

  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState<{ uuid?: string; name: string; url: string }>({ name: "", url: "" });
  const [saving, setSaving] = useState(false);

  const [qrPreviewItem, setQrPreviewItem] = useState<QrCodeItem | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<QrCodeItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [analyticsItem, setAnalyticsItem] = useState<QrCodeItem | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  // ── Auth + permission gate ────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.dashboard) {
      router.push("/dashboard");
      return;
    }
    setUser(parsed);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qr-code");
      if (res.ok) setItems(await res.json());
      else showMessage("Gagal memuat data QR Code", "error");
    } catch {
      showMessage("Gagal memuat data QR Code", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => (i.name || "").toLowerCase().includes(q) || (i.url || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  // ── Add / Edit ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setFormMode("add");
    setFormData({ name: "", url: "" });
    setShowFormModal(true);
  };

  const openEdit = (item: QrCodeItem) => {
    setFormMode("edit");
    setFormData({ uuid: item.uuid, name: item.name, url: item.url });
    setShowFormModal(true);
  };

  // "Generate" sekaligus menyimpan (create/update) DAN membuka popup QR-nya.
  const handleGenerate = async () => {
    const name = formData.name.trim();
    const url = formData.url.trim();
    if (!name) return showMessage("Nama wajib diisi", "error");
    if (!url) return showMessage("URL wajib diisi", "error");

    setSaving(true);
    try {
      if (formMode === "edit" && formData.uuid) {
        const res = await fetch("/api/qr-code", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uuid: formData.uuid, name, url }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Gagal menyimpan");
        setShowFormModal(false);
        await fetchItems();
        setQrPreviewItem({ uuid: formData.uuid, name, url, created_at: "", update_at: "" });
        showMessage("QR Code berhasil diperbarui", "success");
      } else {
        const res = await fetch("/api/qr-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, url }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Gagal menyimpan");
        setShowFormModal(false);
        await fetchItems();
        setQrPreviewItem({ uuid: result.uuid, name, url, created_at: "", update_at: "" });
        showMessage("QR Code berhasil dibuat", "success");
      }
    } catch (err: any) {
      showMessage(err.message || "Gagal menyimpan QR Code", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/qr-code?uuid=${encodeURIComponent(deleteTarget.uuid)}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menghapus");
      setDeleteTarget(null);
      await fetchItems();
      showMessage("QR Code berhasil dihapus", "success");
    } catch (err: any) {
      showMessage(err.message || "Gagal menghapus QR Code", "error");
    } finally {
      setDeleting(false);
    }
  };

  // ── Download PNG (canvas QR + nama), sama pola dengan kartu QR affiliate ──
  const handleDownloadQr = (item: QrCodeItem, canvasId = "qr-code-preview-canvas") => {
    setDownloading(true);
    try {
      const qrCanvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
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

      // URL tujuan sengaja TIDAK ditulis di kartu — hanya nama yang tampil.
      ctx.fillStyle = "#111827";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item.name || "-", width / 2, qrSize + 60);

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `QRCode_${(item.name || "unknown").replace(/\s+/g, "_")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download QR code:", err);
    } finally {
      setDownloading(false);
    }
  };

  // ── Analitik ──────────────────────────────────────────────────────────────
  const openAnalytics = async (item: QrCodeItem) => {
    setAnalyticsItem(item);
    setAnalyticsData(null);
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/qr-code/analytics?qr_uuid=${encodeURIComponent(item.uuid)}`);
      if (res.ok) setAnalyticsData(await res.json());
      else showMessage("Gagal memuat analitik", "error");
    } catch {
      showMessage("Gagal memuat analitik", "error");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <SectionHeader
        icon={QrCodeIcon}
        title="QR Code"
        description="Buat dan kelola QR Code untuk link apa pun."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau URL..."
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
          {!search && <SearchShortcutHint label={shortcutLabel} />}
        </div>
        <Button icon={Plus} onClick={openAdd}>
          Tambah QR Code
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={QrCodeIcon}
          title="Belum ada QR Code"
          description="Klik 'Tambah QR Code' untuk membuat yang pertama."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.uuid}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <button
                type="button"
                onClick={() => setQrPreviewItem(item)}
                className="flex-shrink-0 rounded-lg border border-gray-100 p-1.5 hover:border-primary/30"
                title="Lihat QR Code"
              >
                <QRCodeCanvas
                  id={`qr-code-card-${item.uuid}`}
                  value={trackingLink(item.uuid)}
                  size={56}
                  level="H"
                  imageSettings={{
                    src: TORCH_LOGO_URL,
                    height: 8,
                    width: 24,
                    excavate: true,
                    crossOrigin: "anonymous",
                  }}
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{item.name}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  onClick={() => openAnalytics(item)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Analitik"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDownloadQr(item, `qr-code-card-${item.uuid}`)}
                  disabled={downloading}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                  title="Download QR Code"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openEdit(item)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  title="Hapus"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Add/Edit ─────────────────────────────────────────────────── */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowFormModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">
                {formMode === "edit" ? "Edit QR Code" : "Tambah QR Code"}
              </h2>
              <button
                onClick={() => setShowFormModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Nama</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nama QR Code"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">URL</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <Button
                icon={QrCodeIcon}
                loading={saving}
                onClick={handleGenerate}
                className="w-full"
              >
                Generate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup QR Code hasil generate/klik kartu ───────────────────────── */}
      {qrPreviewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setQrPreviewItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">QR Code</h2>
              <button
                onClick={() => setQrPreviewItem(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <QRCodeCanvas
                  id="qr-code-preview-canvas"
                  value={trackingLink(qrPreviewItem.uuid)}
                  size={200}
                  level="H"
                  imageSettings={{
                    src: TORCH_LOGO_URL,
                    height: 26,
                    width: 78,
                    excavate: true,
                    crossOrigin: "anonymous",
                  }}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">{qrPreviewItem.name}</p>
              </div>
              <Button
                icon={Download}
                variant="outline"
                loading={downloading}
                onClick={() => handleDownloadQr(qrPreviewItem)}
                className="w-full"
              >
                Download PNG
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Analitik ─────────────────────────────────────────────────── */}
      {analyticsItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAnalyticsItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Analitik — {analyticsItem.name}</h2>
                <p className="text-xs text-gray-400">Dihitung dari scan link tracking QR ini</p>
              </div>
              <button
                onClick={() => setAnalyticsItem(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {analyticsLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Memuat analitik...</div>
              ) : !analyticsData || analyticsData.total_scans === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Belum ada scan untuk QR ini.</div>
              ) : (
                <>
                  <div className="rounded-xl bg-primary/5 p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">{analyticsData.total_scans}</div>
                    <div className="text-xs text-gray-500">Total Scan</div>
                  </div>

                  <AnalyticsBreakdown title="Device" data={analyticsData.by_device} />
                  <AnalyticsBreakdown title="Browser" data={analyticsData.by_browser} />
                  <AnalyticsBreakdown title="Negara" data={analyticsData.by_country} />

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Scan Terbaru
                    </p>
                    <div className="space-y-1.5">
                      {analyticsData.recent.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"
                        >
                          <span className="text-gray-600">{r.scanned_at}</span>
                          <span className="text-gray-500">
                            {r.device_type} · {r.browser} · {r.city || r.country || "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Hapus QR Code ini?"
        description={deleteTarget ? `"${deleteTarget.name}" akan dihapus permanen.` : undefined}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}

// Breakdown sederhana (label + bar proporsional + jumlah), dipakai untuk
// Device/Browser/Negara di modal Analitik.
function AnalyticsBreakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = entries.length > 0 ? entries[0][1] : 1;
  if (entries.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="space-y-1.5">
        {entries.map(([label, count]) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 truncate text-gray-600">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-gray-500">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
