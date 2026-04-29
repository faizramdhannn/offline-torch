"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";

interface TrackingItem {
  id: string;
  date: string;
  assigned_to: string;
  expedition: string;
  sender: string;
  receiver: string;
  weight: string;
  reason: string;
  link_tracking: string;
  request_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  tracking_number?: string;
}

interface StoreAddress {
  id: string;
  store_location: string;
  phone_number: string;
  address: string;
}

interface DropdownData {
  requesters: string[];
  assignees: { label: string; value: string }[];
  reasons: string[];
}

const EXPEDITIONS = ["SiCepat", "Lion"];

const EXPEDITION_LOGO: Record<string, string> = {
  SiCepat: "/Logo Sicepat.png",
  Lion: "/Logo Lion.png",
};

function formatStoreAddress(s: StoreAddress): string {
  return [s.store_location, s.phone_number, s.address].filter(Boolean).join("\n");
}

function isValidIndonesianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  const withPrefixPattern = /^(\+?628|08)[0-9]{7,11}$/;
  const barePattern = /^8[0-9]{7,11}$/;
  return withPrefixPattern.test(cleaned) || barePattern.test(cleaned);
}

function extractValidPhone(text: string): string | null {
  const tokens = text.split(/[\s,;]+/);
  for (const token of tokens) {
    const cleaned = token.replace(/[\-().]/g, "");
    if (isValidIndonesianPhone(cleaned)) return cleaned;
  }
  return null;
}

function validateReceiver(val: string): string {
  if (!val.trim()) return "Receiver wajib diisi";
  const validPhone = extractValidPhone(val);
  if (!validPhone) return "Sertakan nomor telepon yang valid (08xx, +628xx, atau 628xx)";
  const postalPattern = /(?<![0-9])\d{5}(?![0-9])/;
  if (!postalPattern.test(val)) return "Sertakan kode pos 5 digit (contoh: 40123)";
  if (val.trim().length < 20) return "Terlalu pendek — sertakan nama, nomor telepon, alamat, dan kode pos";
  return "";
}

// ── Drag & Drop Upload Zone ───────────────────────────────────────────────
function DropZone({
  file,
  onFile,
  inputRef,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);
  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isImage = file && file.type.startsWith("image/");

  useEffect(() => {
    if (!file || !isImage) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleInputChange}
        className="hidden"
      />
      {file ? (
        <div className="flex items-center gap-2 p-2 rounded border border-green-300 bg-green-50">
          {preview ? (
            <img
              src={preview}
              alt="preview"
              className="w-10 h-10 object-cover rounded border border-green-200 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded border border-green-200 bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-green-800 truncate">{file.name}</p>
            <p className="text-[10px] text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button type="button" onClick={handleRemove}
            className="p-1 rounded hover:bg-green-200 text-green-700 shrink-0" title="Hapus file">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`cursor-pointer rounded border-2 border-dashed transition-all select-none
            flex flex-col items-center justify-center gap-1 py-4 px-3
            ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"}`}
        >
          <svg className={`w-6 h-6 transition-colors ${dragging ? "text-blue-500" : "text-gray-400"}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className={`text-[11px] font-medium transition-colors ${dragging ? "text-blue-600" : "text-gray-600"}`}>
            {dragging ? "Lepaskan file di sini" : "Drag & drop atau klik untuk pilih"}
          </p>
          <p className="text-[10px] text-gray-400">Gambar atau PDF</p>
        </div>
      )}
    </div>
  );
}

// ── ExpeditionToggle ──────────────────────────────────────────────────────
function ExpeditionToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Ekspedisi <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        {EXPEDITIONS.map((exp) => {
          const isSelected = value === exp;
          return (
            <button key={exp} type="button" onClick={() => onChange(exp)}
              className={`flex-1 flex items-center justify-center py-2 px-3 rounded border-2 transition-all ${
                isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-gray-400 bg-white"}`}>
              <img src={EXPEDITION_LOGO[exp]} alt={exp} className="h-7 w-auto object-contain" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── ExpeditionBadge ───────────────────────────────────────────────────────
function ExpeditionBadge({ expedition }: { expedition: string }) {
  const logo = EXPEDITION_LOGO[expedition];
  if (logo) return <img src={logo} alt={expedition} className="h-5 w-auto object-contain" title={expedition} />;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">{expedition}</span>;
}

// ── SenderSelect ──────────────────────────────────────────────────────────
function SenderSelect({ value, onChange, details, storeAddresses }: {
  value: string; onChange: (v: string) => void;
  details: StoreAddress | null; storeAddresses: StoreAddress[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Pengirim (Store) <span className="text-red-500">*</span>
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
        <option value="">Pilih store pengirim</option>
        {storeAddresses.map((s) => <option key={s.id} value={s.store_location}>{s.store_location}</option>)}
      </select>
      {details && (
        <div className="mt-1.5 p-2 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-800 space-y-0.5">
          <div>{details.phone_number}</div>
          <div>{details.address}</div>
        </div>
      )}
    </div>
  );
}

// ── ReceiverField ─────────────────────────────────────────────────────────
function ReceiverField({ mode, onModeChange, storeValue, onStoreChange, customValue, onCustomChange, error, onBlur, storeAddresses }: {
  mode: "dropdown" | "custom"; onModeChange: (m: "dropdown" | "custom") => void;
  storeValue: string; onStoreChange: (v: string) => void;
  customValue: string; onCustomChange: (v: string) => void;
  error: string; onBlur: () => void; storeAddresses: StoreAddress[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-700">Penerima <span className="text-red-500">*</span></label>
        <div className="flex gap-1 bg-gray-100 rounded p-0.5">
          <button type="button" onClick={() => { onModeChange("dropdown"); onCustomChange(""); }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${mode === "dropdown" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Store
          </button>
          <button type="button" onClick={() => { onModeChange("custom"); onStoreChange(""); onCustomChange(""); }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${mode === "custom" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Custom
          </button>
        </div>
      </div>
      {mode === "dropdown" ? (
        <>
          <select value={storeValue} onChange={(e) => onStoreChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Pilih store penerima</option>
            {storeAddresses.map((s) => <option key={s.id} value={s.store_location}>{s.store_location}</option>)}
          </select>
          {customValue && (
            <div className="mt-1.5 p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-700 font-mono whitespace-pre-line">
              {customValue}
            </div>
          )}
        </>
      ) : (
        <>
          <textarea value={customValue} onChange={(e) => onCustomChange(e.target.value)} onBlur={onBlur} rows={4}
            placeholder={"Nama Penerima\n08xxxxxxxxxx\nJl. Contoh No. 1, Kota, Provinsi\n12345"}
            className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 resize-none font-mono ${error ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-primary"}`} />
          {error
            ? <p className="text-[10px] text-red-500 mt-1">⚠ {error}</p>
            : <p className="text-[10px] text-gray-400 mt-1">Wajib: nama · nomor HP (08xx/+628xx) · alamat · kode pos 5 digit</p>}
        </>
      )}
    </div>
  );
}

// ── CopyButton ────────────────────────────────────────────────────────────
function CopyButton({ text, id, copiedId, onCopy }: {
  text: string; id: string; copiedId: string | null; onCopy: (text: string, id: string) => void;
}) {
  return (
    <button type="button" onClick={() => onCopy(text, id)} title="Copy"
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors shrink-0">
      {copiedId === id ? (
        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

// ── CheckResiButton ───────────────────────────────────────────────────────
// Klik → pindah ke tab "Cek Resi" dan kirim nomor resi via postMessage ke iframe
function CheckResiButton({ trackingNumber, onCheck }: {
  trackingNumber: string; onCheck: (resi: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCheck(trackingNumber)}
      title="Cek resi"
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-blue-100 transition-colors shrink-0"
    >
      <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    </button>
  );
}

// ── Google Drive URL converter ────────────────────────────────────────────
function getEmbedUrl(url: string): string {
  if (!url) return url;
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
  return url;
}

function getDownloadUrl(url: string): string {
  if (!url) return url;
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  return url;
}

// ── Detail Popup ──────────────────────────────────────────────────────────
function DetailPopup({ item, onClose, copiedId, onCopy }: {
  item: TrackingItem; onClose: () => void;
  copiedId: string | null; onCopy: (text: string, id: string) => void;
}) {
  const status = item.link_tracking ? "completed" : "pending";
  const isDriveUrl = item.link_tracking?.includes("drive.google.com");
  const embedUrl = getEmbedUrl(item.link_tracking || "");
  const downloadUrl = getDownloadUrl(item.link_tracking || "");
  const isPdf = isDriveUrl
    ? true
    : item.link_tracking?.toLowerCase().includes(".pdf") ||
      item.link_tracking?.toLowerCase().includes("application/pdf") ||
      (item.link_tracking && !item.link_tracking?.match(/\.(png|jpg|jpeg|gif|webp)/i));

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={handleBackdrop}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-800">Detail Shipment</h2>
            <span className="font-mono text-[11px] text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{item.id}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
              {status === "completed" ? "Selesai" : "Pending"}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: File viewer */}
          <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden border-r">
            {item.link_tracking ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 bg-white border-b">
                  <span className="text-[11px] text-gray-500 font-medium">{isPdf ? "File PDF" : "Bukti Gambar"}</span>
                  <a href={downloadUrl} download target="_blank" rel="noopener noreferrer" title="Download file"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary text-white rounded text-[10px] font-medium hover:bg-primary/90 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </a>
                </div>
                <div className="flex-1 overflow-auto flex items-center justify-center p-3">
                  {isPdf ? (
                    <iframe src={embedUrl} className="w-full h-full rounded border border-gray-200 bg-white" title="Resi PDF" />
                  ) : (
                    <img src={embedUrl} alt="Bukti Resi" className="max-w-full max-h-full object-contain rounded border border-gray-200 shadow-sm" />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
                <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs text-gray-400">Belum ada resi diupload</p>
              </div>
            )}
          </div>

          {/* Right: Detail info */}
          <div className="w-64 flex flex-col overflow-y-auto bg-white">
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Ekspedisi</p>
                {EXPEDITION_LOGO[item.expedition]
                  ? <img src={EXPEDITION_LOGO[item.expedition]} alt={item.expedition} className="h-6 w-auto object-contain" />
                  : <p className="text-xs font-medium text-gray-800">{item.expedition}</p>}
              </div>

              {/* No. Resi — tampil jika ada tracking_number, teks bisa di-select-all */}
              {item.tracking_number && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">No. Resi</p>
                  <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded p-2">
                    <p className="text-xs font-mono font-bold text-blue-900 flex-1 break-all select-all">
                      {item.tracking_number}
                    </p>
                    <CopyButton text={item.tracking_number} id={`resi-detail-${item.id}`} copiedId={copiedId} onCopy={onCopy} />
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Tanggal</p>
                <p className="text-xs text-gray-800">{item.date}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Assigned To</p>
                <p className="text-xs text-gray-800">{item.assigned_to}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Pengirim</p>
                <p className="text-xs text-gray-800">{item.sender}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Penerima</p>
                  {item.receiver && (
                    <CopyButton text={item.receiver} id={`detail-${item.id}`} copiedId={copiedId} onCopy={onCopy} />
                  )}
                </div>
                {/* select-all agar Ctrl+A bisa copy di dalam box ini */}
                <p className="text-xs text-gray-800 font-mono whitespace-pre-line leading-relaxed bg-gray-50 rounded p-2 border border-gray-100 select-all">
                  {item.receiver || "-"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Berat</p>
                <p className="text-xs text-gray-800">{item.weight} kg</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Alasan</p>
                <p className="text-xs text-gray-800">{item.reason}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Request By</p>
                <p className="text-xs text-gray-800">{item.request_by}</p>
              </div>
              {item.update_by && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Update By</p>
                  <p className="text-xs text-gray-800">{item.update_by}</p>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100 space-y-1">
                {item.created_at && (
                  <p className="text-[10px] text-gray-400">Dibuat: {new Date(item.created_at).toLocaleString("id-ID")}</p>
                )}
                {item.update_at && (
                  <p className="text-[10px] text-gray-400">Diupdate: {new Date(item.update_at).toLocaleString("id-ID")}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═════════════════════════════════════════════════════════════════════════════
export default function RequestTrackingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<TrackingItem[]>([]);
  const [storeAddresses, setStoreAddresses] = useState<StoreAddress[]>([]);
  const [dropdownData, setDropdownData] = useState<DropdownData>({ requesters: [], assignees: [], reasons: [] });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrackingItem | null>(null);
  const [detailItem, setDetailItem] = useState<TrackingItem | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"table" | "tracking">("table");
  const [iframeUrl] = useState("https://offline-tracking.vercel.app/");
  const [searchReceiver, setSearchReceiver] = useState("");

  // ── Ref ke iframe Cek Resi ─────────────────────────────────────────────
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Simpan resi yang menunggu dikirim saat iframe selesai load
  const pendingResiRef = useRef<string | null>(null);

  const itemsPerPage = 25;
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedSenderDetails, setSelectedSenderDetails] = useState<StoreAddress | null>(null);
  const [editSenderDetails, setEditSenderDetails] = useState<StoreAddress | null>(null);
  const [addReceiverMode, setAddReceiverMode] = useState<"dropdown" | "custom">("dropdown");
  const [editReceiverMode, setEditReceiverMode] = useState<"dropdown" | "custom">("dropdown");
  const [addReceiverStore, setAddReceiverStore] = useState<string>("");
  const [editReceiverStore, setEditReceiverStore] = useState<string>("");
  const [receiverError, setReceiverError] = useState("");

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    assigned_to: "", expedition: "", sender: "", receiver: "", weight: "", reason: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.request_tracking && !parsedUser.tracking_edit) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchStoreAddresses();
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Kirim postMessage saat iframe selesai load ─────────────────────────
  const handleIframeLoad = useCallback(() => {
    if (pendingResiRef.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "CHECK_RESI", resi: pendingResiRef.current },
        "https://offline-tracking.vercel.app"
      );
      pendingResiRef.current = null;
    }
  }, []);

  // ── Klik ikon cek: pindah tab → kirim postMessage ─────────────────────
  const handleCheckResi = useCallback((resi: string) => {
    pendingResiRef.current = resi;
    setActiveTab("tracking");
    // Jika iframe sudah ada di DOM (sudah load sebelumnya), kirim langsung
    setTimeout(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: "CHECK_RESI", resi },
          "https://offline-tracking.vercel.app"
        );
        pendingResiRef.current = null;
      }
    }, 400);
  }, []);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        username: user?.user_name || "",
        isTrackingEdit: String(!!user?.tracking_edit),
      });
      const res = await fetch(`/api/request-tracking?${params}`);
      if (res.ok) { setData(await res.json()); setLoading(false); }
    } catch {}
  };

  const fetchStoreAddresses = async () => {
    try {
      const res = await fetch("/api/store-address");
      if (res.ok) setStoreAddresses(await res.json());
    } catch {}
  };

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("/api/master-dropdown");
      if (res.ok) setDropdownData(await res.json());
    } catch {}
  };

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message); setPopupType(type); setShowPopup(true);
  };

  const logActivity = async (method: string, activity: string) => {
    if (!user) return;
    try {
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.user_name, method, activity_log: activity }),
      });
    } catch {}
  };

  const handleCopyReceiver = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSenderChange = (storeName: string, isEdit = false) => {
    const found = storeAddresses.find((s) => s.store_location === storeName) || null;
    if (isEdit) { setEditForm((prev) => ({ ...prev, sender: storeName })); setEditSenderDetails(found); }
    else { setForm((prev) => ({ ...prev, sender: storeName })); setSelectedSenderDetails(found); }
  };

  const handleReceiverStoreChange = (storeName: string, isEdit = false) => {
    const found = storeAddresses.find((s) => s.store_location === storeName) || null;
    const formatted = found ? formatStoreAddress(found) : "";
    if (isEdit) { setEditReceiverStore(storeName); setEditForm((prev) => ({ ...prev, receiver: formatted })); }
    else { setAddReceiverStore(storeName); setForm((prev) => ({ ...prev, receiver: formatted })); }
    setReceiverError("");
  };

  const handleAdd = async () => {
    if (!form.date || !form.assigned_to || !form.expedition || !form.sender || !form.receiver || !form.weight || !form.reason) {
      showMessage("Semua field wajib diisi", "error"); return;
    }
    const err = validateReceiver(form.receiver);
    if (err) { showMessage(err, "error"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/request-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, request_by: user.user_name }),
      });
      if (res.ok) {
        showMessage("Request berhasil dibuat", "success");
        setShowAddModal(false); resetAddForm();
        await logActivity("POST", `Created shipment request: ${form.expedition} → ${form.assigned_to}`);
        fetchData();
      } else { showMessage("Gagal membuat request", "error"); }
    } catch { showMessage("Gagal membuat request", "error"); }
    finally { setSubmitting(false); }
  };

  const resetAddForm = () => {
    setForm(emptyForm); setSelectedSenderDetails(null);
    setAddReceiverMode("dropdown"); setAddReceiverStore(""); setReceiverError("");
  };

  const openEdit = (item: TrackingItem) => {
    setSelectedItem(item);
    setEditForm({ date: item.date, assigned_to: item.assigned_to, expedition: item.expedition, sender: item.sender, receiver: item.receiver, weight: item.weight, reason: item.reason });
    setEditSenderDetails(storeAddresses.find((s) => s.store_location === item.sender) || null);
    const matchedStore = storeAddresses.find((s) => formatStoreAddress(s) === item.receiver);
    if (matchedStore) { setEditReceiverMode("dropdown"); setEditReceiverStore(matchedStore.store_location); }
    else { setEditReceiverMode("custom"); setEditReceiverStore(""); }
    setReceiverError(""); setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    const err = validateReceiver(editForm.receiver);
    if (err) { showMessage(err, "error"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/request-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, update_by: user.user_name, ...editForm }),
      });
      if (res.ok) {
        showMessage("Request berhasil diupdate", "success");
        setShowEditModal(false); setSelectedItem(null);
        await logActivity("PUT", `Updated shipment request ID: ${selectedItem.id}`);
        fetchData();
      } else { showMessage("Gagal update request", "error"); }
    } catch { showMessage("Gagal update request", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (item: TrackingItem) => {
    if (!confirm("Hapus request ini?")) return;
    try {
      const res = await fetch(`/api/request-tracking?id=${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setData((prev) => prev.filter((d) => d.id !== item.id));
        showMessage("Request dihapus", "success");
        await logActivity("DELETE", `Deleted shipment request ID: ${item.id}`);
      } else { showMessage("Gagal menghapus", "error"); }
    } catch { showMessage("Gagal menghapus", "error"); }
  };

  const openUpload = (item: TrackingItem) => {
    setSelectedItem(item); setUploadFile(null);
    if (uploadFileRef.current) uploadFileRef.current.value = "";
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (!selectedItem || !uploadFile) { showMessage("Pilih file terlebih dahulu", "error"); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("id", selectedItem.id);
      fd.append("update_by", user.user_name);
      fd.append("file", uploadFile);
      const res = await fetch("/api/request-tracking", { method: "PUT", body: fd });
      if (res.ok) {
        const result = await res.json();
        showMessage(
          result.tracking_number
            ? `Upload berhasil! No. Resi: ${result.tracking_number}`
            : "File berhasil diupload (nomor resi tidak terdeteksi)",
          "success"
        );
        setShowUploadModal(false); setSelectedItem(null); setUploadFile(null);
        await logActivity("PUT", `Uploaded tracking file for ID: ${selectedItem.id}`);
        fetchData();
      } else { showMessage("Gagal upload file", "error"); }
    } catch { showMessage("Gagal upload file", "error"); }
    finally { setSubmitting(false); }
  };

  const buildWhatsappLink = (item: TrackingItem) => {
    const store = storeAddresses.find((s) => s.store_location === item.sender);
    if (!store || !store.phone_number) return null;
    const phone = store.phone_number.replace(/\D/g, "");
    const message = encodeURIComponent(`Berikut resi untuk ${item.id}\n${item.link_tracking}`);
    return `https://wa.me/${phone}?text=${message}`;
  };

  const getStatus = (item: TrackingItem) => item.link_tracking ? "completed" : "pending";

  const filteredData = (() => {
    if (!searchReceiver.trim()) return data;
    const q = searchReceiver.trim().toLowerCase();
    return data.filter((d) =>
      (d.receiver || "").toLowerCase().includes(q) ||
      (d.tracking_number || "").toLowerCase().includes(q)
    );
  })();

  const hasActiveSearch = searchReceiver.trim().length > 0;
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text || "-";
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i === -1) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(i, i + query.length)}</mark>
        {text.slice(i + query.length)}
      </>
    );
  };

  if (!user) return null;

  const canEdit = user.request_tracking;
  const canUpload = user.tracking_edit;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-primary">Request Shipment</h1>
            {canEdit && (
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Request
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            {(["table", "tracking"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {tab === "table" ? "List" : "Cek Resi"}
              </button>
            ))}
          </div>

          {/* Tab: Table */}
          {activeTab === "table" && (
            <>
              {/* Search Bar */}
              <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input type="text" value={searchReceiver}
                    onChange={(e) => { setSearchReceiver(e.target.value); setCurrentPage(1); }}
                    placeholder="Cari penerima / no. resi..."
                    className="pl-6 pr-2 py-1 border border-gray-300 rounded text-[11px] w-56 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                {hasActiveSearch && (
                  <>
                    <button onClick={() => { setSearchReceiver(""); setCurrentPage(1); }}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 border border-gray-200 rounded text-[11px] hover:bg-gray-200 transition-colors">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear
                    </button>
                    <span className="text-[10px] text-gray-400">
                      {filteredData.length} result{filteredData.length !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>

              {/* Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] table-fixed">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[88px]">Tanggal</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[90px]">Assigned To</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[75px]">Ekspedisi</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[100px]">Pengirim</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[150px]">Penerima</th>
                            {/* Kolom No. Resi sedikit lebih lebar untuk akomodasi 2 ikon */}
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[155px]">No. Resi</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[50px]">Berat</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[110px]">Alasan</th>
                            {canUpload && <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[85px]">Request By</th>}
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-[60px]">Status</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[130px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentItems.map((item, idx) => {
                            const status = getStatus(item);
                            const waLink = item.link_tracking ? buildWhatsappLink(item) : null;
                            return (
                              <tr key={item.id}
                                className={`border-b cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                                onClick={() => setDetailItem(item)}>
                                <td className="px-2 py-1 text-gray-600">{item.date}</td>
                                <td className="px-2 py-1 text-gray-700 truncate">{item.assigned_to}</td>
                                <td className="px-2 py-1"><ExpeditionBadge expedition={item.expedition} /></td>
                                <td className="px-2 py-1 text-gray-700 truncate">{item.sender}</td>
                                <td className="px-2 py-1 text-gray-600">
                                  <div className="flex items-start gap-1">
                                    <div className="truncate flex-1" title={item.receiver}>
                                      {hasActiveSearch
                                        ? highlightText(item.receiver.split("\n")[0], searchReceiver)
                                        : item.receiver.split("\n")[0]}
                                    </div>
                                    {canUpload && item.receiver && (
                                      <span onClick={(e) => e.stopPropagation()}>
                                        <CopyButton text={item.receiver} id={item.id} copiedId={copiedId} onCopy={handleCopyReceiver} />
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* ── Kolom No. Resi: ikon copy + ikon cek resi ── */}
                                <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                  {item.tracking_number ? (
                                    <div className="flex items-center gap-1">
                                      <span
                                        className="font-mono text-[10px] font-semibold text-blue-700 truncate flex-1"
                                        title={item.tracking_number}
                                      >
                                        {hasActiveSearch
                                          ? highlightText(item.tracking_number, searchReceiver)
                                          : item.tracking_number}
                                      </span>
                                      {/* Ikon copy */}
                                      <CopyButton
                                        text={item.tracking_number}
                                        id={`resi-${item.id}`}
                                        copiedId={copiedId}
                                        onCopy={handleCopyReceiver}
                                      />
                                      {/* Ikon cek resi → pindah ke tab Cek Resi + postMessage */}
                                      <CheckResiButton
                                        trackingNumber={item.tracking_number}
                                        onCheck={handleCheckResi}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 text-[10px]">—</span>
                                  )}
                                </td>

                                <td className="px-2 py-1 text-gray-600">{item.weight} kg</td>
                                <td className="px-2 py-1 text-gray-600 truncate" title={item.reason}>{item.reason}</td>
                                {canUpload && <td className="px-2 py-1 text-gray-500">{item.request_by}</td>}
                                <td className="px-2 py-1 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                                    {status === "completed" ? "Selesai" : "Pending"}
                                  </span>
                                </td>
                                <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex flex-wrap gap-1">
                                    {canUpload && status === "pending" && (
                                      <button onClick={() => openUpload(item)}
                                        className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700">
                                        Upload
                                      </button>
                                    )}
                                    {status === "completed" && waLink && (
                                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                                        className="px-1.5 py-0.5 bg-green-500 text-white rounded text-[10px] hover:bg-green-600 inline-flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                        WA
                                      </a>
                                    )}
                                    {item.link_tracking && (
                                      <a href={item.link_tracking} target="_blank" rel="noopener noreferrer"
                                        className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] hover:bg-gray-300">
                                        Resi
                                      </a>
                                    )}
                                    {canEdit && !canUpload && item.request_by === user.user_name && status === "pending" && (
                                      <>
                                        <button onClick={() => openEdit(item)}
                                          className="px-1.5 py-0.5 bg-yellow-500 text-white rounded text-[10px] hover:bg-yellow-600">Edit</button>
                                        <button onClick={() => handleDelete(item)}
                                          className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] hover:bg-red-600">Hapus</button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredData.length === 0 && (
                        <div className="p-8 text-center text-gray-500 text-sm">
                          {hasActiveSearch ? "Tidak ada hasil yang sesuai pencarian" : "Belum ada request shipment"}
                        </div>
                      )}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex justify-between items-center px-4 py-2.5 border-t">
                        <div className="text-xs text-gray-500">
                          {indexOfFirst + 1}–{Math.min(indexOfLast, filteredData.length)} dari {filteredData.length} entri
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                            className="px-2.5 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                          {[...Array(totalPages)].map((_, i) => {
                            const page = i + 1;
                            if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                              return (
                                <button key={page} onClick={() => setCurrentPage(page)}
                                  className={`px-2.5 py-1 text-xs border rounded ${currentPage === page ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}>
                                  {page}
                                </button>
                              );
                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                              return <span key={page} className="px-1 text-xs text-gray-400 self-center">…</span>;
                            }
                            return null;
                          })}
                          <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                            className="px-2.5 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Tab: Cek Resi — iframe dengan ref untuk postMessage */}
{/* Tab: Cek Resi — iframe dengan ref untuk postMessage */}
{activeTab === "tracking" && (
  <div
    className="bg-white rounded-lg shadow overflow-hidden"
    style={{ height: "calc(100vh - 180px)" }}
  >
    <div
      style={{
        width: "142.86%",
        height: "142.86%",
        transform: "scale(0.7)",
        transformOrigin: "top left",
      }}
    >
      <iframe
        ref={iframeRef}
        key={iframeUrl}
        src={iframeUrl}
        className="w-full"
        style={{ height: "calc((100vh - 180px) / 0.7)" }}
        title="Tracking Pengiriman"
        onLoad={handleIframeLoad}
      />
    </div>
  </div>
)}
        </div>
      </div>

      {/* Detail Popup */}
      {detailItem && (
        <DetailPopup item={detailItem} onClose={() => setDetailItem(null)} copiedId={copiedId} onCopy={handleCopyReceiver} />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">Request Shipment Baru</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To <span className="text-red-500">*</span></label>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Pilih</option>
                  {dropdownData.assignees.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <ExpeditionToggle value={form.expedition} onChange={(v) => setForm({ ...form, expedition: v })} />
              <SenderSelect value={form.sender} onChange={(v) => handleSenderChange(v)} details={selectedSenderDetails} storeAddresses={storeAddresses} />
              <ReceiverField mode={addReceiverMode} onModeChange={(m) => setAddReceiverMode(m)}
                storeValue={addReceiverStore} onStoreChange={(v) => handleReceiverStoreChange(v, false)}
                customValue={form.receiver} onCustomChange={(v) => { setForm({ ...form, receiver: v }); setReceiverError(""); }}
                error={receiverError} onBlur={() => { if (addReceiverMode === "custom") setReceiverError(validateReceiver(form.receiver)); }}
                storeAddresses={storeAddresses} />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Berat (kg) <span className="text-red-500">*</span></label>
                <input type="number" min="0.1" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  placeholder="contoh: 1.5"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alasan / Keterangan <span className="text-red-500">*</span></label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2}
                  placeholder="Misal: Order WAG, Retur barang rusak..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Batal</button>
              <button onClick={handleAdd} disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">Edit Request Shipment</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal</label>
                <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
                <select value={editForm.assigned_to} onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Pilih</option>
                  {dropdownData.assignees.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <ExpeditionToggle value={editForm.expedition} onChange={(v) => setEditForm({ ...editForm, expedition: v })} />
              <SenderSelect value={editForm.sender} onChange={(v) => handleSenderChange(v, true)} details={editSenderDetails} storeAddresses={storeAddresses} />
              <ReceiverField mode={editReceiverMode} onModeChange={(m) => setEditReceiverMode(m)}
                storeValue={editReceiverStore} onStoreChange={(v) => handleReceiverStoreChange(v, true)}
                customValue={editForm.receiver} onCustomChange={(v) => { setEditForm({ ...editForm, receiver: v }); setReceiverError(""); }}
                error={receiverError} onBlur={() => { if (editReceiverMode === "custom") setReceiverError(validateReceiver(editForm.receiver)); }}
                storeAddresses={storeAddresses} />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Berat (kg)</label>
                <input type="number" min="0.1" step="0.1" value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alasan</label>
                <textarea value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} rows={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowEditModal(false); setSelectedItem(null); setReceiverError(""); }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Batal</button>
              <button onClick={handleEdit} disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-sm font-bold text-primary mb-3">Upload Resi</h2>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200 mb-3 text-[11px]">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-semibold text-gray-800 truncate">{selectedItem.id}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600 truncate">{selectedItem.assigned_to}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500">
                  {EXPEDITION_LOGO[selectedItem.expedition]
                    ? <img src={EXPEDITION_LOGO[selectedItem.expedition]} alt={selectedItem.expedition} className="h-3.5 w-auto object-contain" />
                    : <span>{selectedItem.expedition}</span>}
                  <span className="text-gray-400">·</span>
                  <span className="truncate">{selectedItem.sender}</span>
                  <span className="text-gray-400">·</span>
                  <span>{selectedItem.weight} kg</span>
                </div>
              </div>
              <CopyButton text={selectedItem.receiver} id={`upload-${selectedItem.id}`} copiedId={copiedId} onCopy={handleCopyReceiver} />
            </div>
            <div className="mb-3 px-2 py-1.5 bg-blue-50 border border-blue-100 rounded text-[10px] font-mono text-blue-800 whitespace-pre-line leading-relaxed">
              {selectedItem.receiver}
            </div>

            <div className="mb-3 flex items-start gap-1.5 p-2 bg-yellow-50 border border-yellow-200 rounded text-[10px] text-yellow-800">
              <svg className="w-3 h-3 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Nomor resi akan terbaca otomatis dari file yang diupload</span>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">File Resi / Bukti</label>
              <DropZone file={uploadFile} onFile={setUploadFile} inputRef={uploadFileRef} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowUploadModal(false); setSelectedItem(null); setUploadFile(null); }}
                className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 border border-gray-200">Batal</button>
              <button onClick={handleUpload} disabled={submitting || !uploadFile}
                className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-40 font-medium">
                {submitting ? "Mengupload..." : "Upload & Selesaikan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}