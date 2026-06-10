"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MIItem {
  id: string;
  name: string;
  user_name: string;
  item_sku: string;
  item_name: string;
  item_qty: string;
  item_hpj: string;
  request_by: string;
  request_number: string;
  issue_number: string;
  type_reason: string;
  reason: string;
  has_processed: string;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

interface MasterItem {
  SKU: string;
  Product_name: string;
  HPJ: string;
  [key: string]: string;
}

interface DropdownData {
  request_by: string[];
  type_reason: string[];
}

interface ScannedItem {
  sku: string;
  name: string;
  qty: number;
  hpj: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toCapitalEachWord(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function generateId(): string {
  return `MI-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function parseHpj(val: string | number): number {
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/^'/, "").replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function formatRupiah(val: string | number): string {
  const num = parseHpj(val as string);
  if (isNaN(num) || num === 0) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({
  text,
  id,
  copiedId,
  onCopy,
}: {
  text: string;
  id: string;
  copiedId: string | null;
  onCopy: (t: string, id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(text, id)}
      title="Copy"
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors shrink-0"
    >
      {copiedId === id ? (
        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

// ─── ProcessedBadge ───────────────────────────────────────────────────────────
function ProcessedBadge({ value }: { value: string }) {
  const isTrue = value === "TRUE";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${isTrue ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
      {isTrue ? "Selesai" : "Pending"}
    </span>
  );
}

// ─── Group Detail Popup ────────────────────────────────────────────────────────
function GroupDetailPopup({
  groupId,
  items,
  onClose,
  copiedId,
  onCopy,
}: {
  groupId: string;
  items: MIItem[];
  onClose: () => void;
  copiedId: string | null;
  onCopy: (t: string, id: string) => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const meta = items[0];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-gray-800 shrink-0">Detail Material Issue</h2>
            <span className="font-mono text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded truncate">
              {groupId}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Meta info */}
          <div className="space-y-2.5">
            {[
              { label: "Status", content: <ProcessedBadge value={meta.has_processed} /> },
              { label: "Request By", content: <span className="text-xs text-gray-800">{meta.request_by || "-"}</span> },
              {
                label: "No. Request",
                content: (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-gray-800">{meta.request_number || "-"}</span>
                    {meta.request_number && (
                      <CopyButton text={meta.request_number} id={`rn-${groupId}`} copiedId={copiedId} onCopy={onCopy} />
                    )}
                  </div>
                ),
              },
              {
                label: "No. Issue",
                content: (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-gray-800">{meta.issue_number || "-"}</span>
                    {meta.issue_number && (
                      <CopyButton text={meta.issue_number} id={`in-${groupId}`} copiedId={copiedId} onCopy={onCopy} />
                    )}
                  </div>
                ),
              },
              { label: "Tipe", content: <span className="text-xs text-gray-800">{meta.type_reason || "-"}</span> },
              { label: "Alasan", content: <span className="text-xs text-gray-800">{meta.reason || "-"}</span> },
              { label: "Created By", content: <span className="text-xs text-gray-800">{meta.created_by}</span> },
            ].map(({ label, content }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide shrink-0 w-24">{label}</span>
                <div className="flex-1 flex justify-end">{content}</div>
              </div>
            ))}
          </div>

          {/* Items list */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Item ({items.length})
            </p>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={`${item.item_sku}-${idx}`} className="flex items-center gap-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-900 truncate">{item.item_name}</p>
                    <p className="text-[10px] font-mono text-blue-600">{item.item_sku}</p>
                    <p className="text-[10px] text-green-700">{formatRupiah(item.item_hpj)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-blue-900">{item.item_qty}</span>
                    <p className="text-[10px] text-blue-500">pcs</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timestamps */}
          <div className="pt-2 border-t border-gray-100 space-y-1">
            {meta.created_at && <p className="text-[10px] text-gray-400">Dibuat: {meta.created_at}</p>}
            {meta.update_at && <p className="text-[10px] text-gray-400">Diupdate: {meta.update_at}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SKU Scanner Section ──────────────────────────────────────────────────────
function SkuScannerSection({
  masterItems,
  scannedItems,
  onItemsChange,
}: {
  masterItems: MasterItem[];
  scannedItems: ScannedItem[];
  onItemsChange: (items: ScannedItem[]) => void;
}) {
  const [scanMode, setScanMode] = useState<"manual" | "camera">("manual");
  const [skuInput, setSkuInput] = useState("");
  const [error, setError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);

  // ✅ Flash: ref for blocking logic, state for visual
  const [showFlash, setShowFlash] = useState(false);
  const scanFlashRef = useRef(false);

  const skuInputRef = useRef<HTMLInputElement>(null);
  const html5QrRef = useRef<any>(null);
  const isScanningRef = useRef(false);

  // Keep a ref of scannedItems so camera callback always reads latest value
  const scannedItemsRef = useRef<ScannedItem[]>(scannedItems);
  useEffect(() => {
    scannedItemsRef.current = scannedItems;
  }, [scannedItems]);

  useEffect(() => {
    if (scanMode === "manual") {
      setTimeout(() => skuInputRef.current?.focus(), 50);
    }
  }, [scanMode]);

  // Camera lifecycle
  useEffect(() => {
    if (scanMode !== "camera") return;
    let cancelled = false;

    const startCamera = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        await new Promise((r) => setTimeout(r, 100));
        if (cancelled) return;

        const qr = new Html5Qrcode("mi-qr-reader");
        html5QrRef.current = qr;
        isScanningRef.current = false;

        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 120 } },
          (decodedText: string) => { if (!cancelled) processSku(decodedText); },
          () => {}
        );
        isScanningRef.current = true;
        if (!cancelled) setCameraActive(true);
      } catch {
        if (!cancelled) setError("Kamera tidak dapat diakses");
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      setCameraActive(false);
      if (html5QrRef.current && isScanningRef.current) {
        html5QrRef.current.stop().catch(() => {});
        isScanningRef.current = false;
      }
      html5QrRef.current = null;
    };
  }, [scanMode]);

  // ✅ FIXED: scanFlashRef (not state) used for blocking — no re-render loop
  const processSku = useCallback(
    (sku: string) => {
      // Block if flash is active (cooldown period)
      if (scanFlashRef.current) return;

      const trimmed = sku.trim().toUpperCase();
      if (!trimmed) return;

      const found = masterItems.find((m) => (m.SKU || "").toUpperCase() === trimmed);
      if (!found) {
        setError(`SKU "${trimmed}" tidak ditemukan`);
        setTimeout(() => setError(""), 3000);
        return;
      }

      setError("");
      const itemName = toCapitalEachWord(found.Product_name || "");
      const hpj = (found.HPJ || "0").replace(/^'/, "");

      // Read from ref so camera callback always sees latest state
      const current = scannedItemsRef.current;
      const existing = current.find((i) => i.sku === trimmed);
      if (existing) {
        onItemsChange(current.map((i) => i.sku === trimmed ? { ...i, qty: i.qty + 1 } : i));
      } else {
        onItemsChange([...current, { sku: trimmed, name: itemName, qty: 1, hpj }]);
      }

      // ✅ Trigger flash: ref blocks next scan, state shows visual overlay
      scanFlashRef.current = true;
      setShowFlash(true);
      setTimeout(() => {
        scanFlashRef.current = false;
        setShowFlash(false);
      }, 1000);
    },
    [masterItems, onItemsChange]
  );

  const handleSkuSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (skuInput.trim().length >= 2) {
      processSku(skuInput);
      setSkuInput("");
      setTimeout(() => skuInputRef.current?.focus(), 30);
    }
  };

  const handleSkuKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSkuSubmit();
    }
  };

  const removeItem = (sku: string) => onItemsChange(scannedItems.filter((i) => i.sku !== sku));
  const adjustQty = (sku: string, delta: number) =>
    onItemsChange(scannedItems.map((i) => i.sku === sku ? { ...i, qty: Math.max(1, i.qty + delta) } : i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          Item <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          <button
            type="button"
            onClick={() => setScanMode("manual")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
              scanMode === "manual" ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 14v1M4 12h1m14 0h1m-2.636-7.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707" />
            </svg>
            Scanner
          </button>
          <button
            type="button"
            onClick={() => setScanMode("camera")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
              scanMode === "camera" ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            Kamera
          </button>
        </div>
      </div>

      {scanMode === "manual" && (
        <div className="flex gap-2">
          <input
            ref={skuInputRef}
            type="text"
            value={skuInput}
            onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
            onKeyDown={handleSkuKeyDown}
            placeholder="Scan barcode atau ketik SKU → Enter"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
          />
          <button
            type="button"
            onClick={() => handleSkuSubmit()}
            className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90"
          >
            Tambah
          </button>
        </div>
      )}

      {scanMode === "camera" && (
        <div className="rounded-lg overflow-hidden border border-gray-200 bg-black relative">
          <div id="mi-qr-reader" className="w-full" />

          {/* ✅ Green flash overlay — shown for 1 second after successful scan */}
          {showFlash && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{ backgroundColor: "rgba(74, 222, 128, 0.5)" }}
            />
          )}

          {!cameraActive && (
            <div className="flex items-center justify-center py-8 text-[11px] text-gray-400">
              Memuat kamera...
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-500 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}

      {scannedItems.length > 0 && (
        <div className="space-y-1.5">
          {scannedItems.map((item) => (
            <div key={item.sku} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-900 truncate">{item.name}</p>
                <p className="text-[10px] text-blue-600 font-mono">{item.sku}</p>
                <p className="text-[10px] text-green-700">{formatRupiah(item.hpj)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => adjustQty(item.sku, -1)}
                  className="w-6 h-6 rounded-full border border-blue-300 flex items-center justify-center text-blue-700 hover:bg-blue-100 text-xs font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-bold text-blue-900">{item.qty}</span>
                <button
                  type="button"
                  onClick={() => adjustQty(item.sku, 1)}
                  className="w-6 h-6 rounded-full border border-blue-300 flex items-center justify-center text-blue-700 hover:bg-blue-100 text-xs font-bold"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.sku)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 ml-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function MaterialIssuePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<MIItem[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [dropdownData, setDropdownData] = useState<DropdownData>({ request_by: [], type_reason: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MIItem | null>(null);

  useSessionGuard();

  const itemsPerPage = 25;

  const emptyForm = {
    request_by: "",
    request_number: "",
    issue_number: "",
    type_reason: "",
    reason: "",
    scannedItems: [] as ScannedItem[],
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    item_sku: "",
    item_name: "",
    item_qty: "",
    item_hpj: "",
    request_by: "",
    request_number: "",
    issue_number: "",
    type_reason: "",
    reason: "",
    has_processed: "FALSE",
  });

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.material_issue && !u.material_issue_all) { router.push("/dashboard"); return; }
    setUser(u);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();
    fetchMasterItems();
    fetchDropdowns();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `/api/material-issue?userName=${encodeURIComponent(user?.user_name || "")}&isAll=${!!user?.material_issue_all}`
      );
      if (res.ok) {
        const rows: MIItem[] = await res.json();
        setData(rows.filter((r) => r.id));
        setLoading(false);
      }
    } catch {}
  };

  const fetchMasterItems = async () => {
    try {
      const res = await fetch("/api/master-item?mode=invoice");
      if (res.ok) setMasterItems(await res.json());
    } catch {}
  };

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("/api/material-issue-dropdown");
      if (res.ok) setDropdownData(await res.json());
    } catch {}
  };

  const showMessage = (msg: string, type: "success" | "error") => {
    setPopupMessage(msg);
    setPopupType(type);
    setShowPopup(true);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Toggle processed ────────────────────────────────────────────────────────
  const handleToggleProcessed = async (groupId: string, currentValue: string) => {
    const newVal = currentValue === "TRUE" ? "FALSE" : "TRUE";
    setData((prev) => prev.map((d) => d.id === groupId ? { ...d, has_processed: newVal } : d));
    try {
      const groupItems = data.filter((d) => d.id === groupId);
      const results = await Promise.all(
        groupItems.map((item) =>
          fetch("/api/material-issue", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, update_by: user.user_name, has_processed: newVal }),
          })
        )
      );
      if (results.some((r) => !r.ok)) {
        setData((prev) => prev.map((d) => d.id === groupId ? { ...d, has_processed: currentValue } : d));
        showMessage("Gagal update status", "error");
      }
    } catch {
      setData((prev) => prev.map((d) => d.id === groupId ? { ...d, has_processed: currentValue } : d));
      showMessage("Gagal update status", "error");
    }
  };

  // ── Add ─────────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.request_by || !form.type_reason || !form.reason || form.scannedItems.length === 0) {
      showMessage("Semua field wajib diisi dan minimal 1 item di-scan", "error");
      return;
    }
    setSubmitting(true);
    try {
      const sharedId = generateId();
      const payload = form.scannedItems.map((si) => ({
        id: sharedId,
        name: user.name,
        user_name: user.user_name,
        item_sku: si.sku,
        item_name: si.name,
        item_qty: String(si.qty),
        item_hpj: si.hpj,
        request_by: form.request_by,
        request_number: form.request_number,
        issue_number: form.issue_number,
        type_reason: form.type_reason,
        reason: form.reason,
        created_by: user.user_name,
      }));

      const res = await fetch("/api/material-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showMessage("Material issue berhasil dibuat", "success");
        setShowAddModal(false);
        setForm(emptyForm);
        fetchData();
        try { new Audio("/add.mp3").play(); } catch {}
      } else {
        showMessage("Gagal membuat material issue", "error");
      }
    } catch {
      showMessage("Gagal membuat material issue", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEdit = (item: MIItem) => {
    setSelectedItem(item);
    setEditForm({
      item_sku: item.item_sku,
      item_name: item.item_name,
      item_qty: item.item_qty,
      item_hpj: item.item_hpj,
      request_by: item.request_by,
      request_number: item.request_number,
      issue_number: item.issue_number,
      type_reason: item.type_reason,
      reason: item.reason,
      has_processed: item.has_processed,
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/material-issue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, update_by: user.user_name, ...editForm }),
      });
      if (res.ok) {
        showMessage("Berhasil diupdate", "success");
        setShowEditModal(false);
        setSelectedItem(null);
        fetchData();
      } else {
        showMessage("Gagal update", "error");
      }
    } catch {
      showMessage("Gagal update", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (groupId: string) => {
    const groupItems = data.filter((d) => d.id === groupId);
    const label = groupItems.length > 1
      ? `Hapus semua ${groupItems.length} item dalam group ini?`
      : "Hapus item ini?";
    if (!confirm(label)) return;
    try {
      const results = await Promise.all(
        groupItems.map((item) =>
          fetch(`/api/material-issue?id=${item.id}&sku=${encodeURIComponent(item.item_sku)}`, { method: "DELETE" })
        )
      );
      if (results.every((r) => r.ok)) {
        setData((prev) => prev.filter((d) => d.id !== groupId));
        showMessage("Dihapus", "success");
        try { new Audio("/delete.mp3").play(); } catch {}
      } else {
        showMessage("Gagal menghapus sebagian item", "error");
        fetchData();
      }
    } catch {
      showMessage("Gagal menghapus", "error");
    }
  };

  // ── Helpers: group data by ID ───────────────────────────────────────────────
  const getGroupItems = (groupId: string): MIItem[] =>
    data.filter((d) => d.id === groupId);

  const getGroupedRows = (rows: MIItem[]): MIItem[] => {
    const seen = new Set<string>();
    return rows.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  };

  // ── Filter & pagination ─────────────────────────────────────────────────────
  const filteredData = (() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter(
      (d) =>
        (d.item_sku || "").toLowerCase().includes(q) ||
        (d.item_name || "").toLowerCase().includes(q) ||
        (d.request_number || "").toLowerCase().includes(q) ||
        (d.issue_number || "").toLowerCase().includes(q) ||
        (d.request_by || "").toLowerCase().includes(q)
    );
  })();

  const groupedRows = getGroupedRows(filteredData);

  const totalPages = Math.ceil(groupedRows.length / itemsPerPage);
  const indexOfFirst = (currentPage - 1) * itemsPerPage;
  const currentItems = groupedRows.slice(indexOfFirst, indexOfFirst + itemsPerPage);
  const hasSearch = search.trim().length > 0;

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

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-primary">Material Issue</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Issue
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Cari SKU / nama item / no. request / issue..."
              className="pl-6 pr-2 py-1 border border-gray-300 rounded text-[11px] w-72 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {hasSearch && (
            <>
              <button
                onClick={() => { setSearch(""); setCurrentPage(1); }}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 border border-gray-200 rounded text-[11px] hover:bg-gray-200"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
              <span className="text-[10px] text-gray-400">{groupedRows.length} result{groupedRows.length !== 1 ? "s" : ""}</span>
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
                <table className="w-full text-[10px] border-collapse" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[90px]">
                        <span className="text-[8px] uppercase tracking-wide">ID / Tgl</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[160px]">
                        <span className="text-[8px] uppercase tracking-wide">Item</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[40px]">
                        <span className="text-[8px] uppercase tracking-wide">Qty</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[70px]">
                        <span className="text-[8px] uppercase tracking-wide">Req By</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[80px]">
                        <span className="text-[8px] uppercase tracking-wide">No. Request</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[80px]">
                        <span className="text-[8px] uppercase tracking-wide">No. Issue</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[70px]">
                        <span className="text-[8px] uppercase tracking-wide">Tipe</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[70px]">
                        <span className="text-[8px] uppercase tracking-wide">Alasan</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[55px]">
                        <span className="text-[8px] uppercase tracking-wide">Status</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 border-r border-gray-200 w-[36px]">
                        <span className="text-[8px] uppercase tracking-wide">Proses</span>
                      </th>
                      <th className="px-1.5 py-1.5 text-center font-semibold text-gray-500 w-[50px]">
                        <span className="text-[8px] uppercase tracking-wide">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((item) => {
                      const groupItems = getGroupItems(item.id);
                      const totalQty = groupItems.reduce((sum, g) => sum + Number(g.item_qty || 0), 0);
                      const itemCount = groupItems.length;
                      const isProcessed = item.has_processed === "TRUE";

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setDetailGroupId(item.id)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${
                            isProcessed ? "bg-green-50 hover:bg-green-100" : "bg-red-50 hover:bg-red-100"
                          }`}
                        >
                          {/* ID + Date */}
                          <td className="px-1.5 py-1 border-r border-gray-200">
                            <div className="truncate font-mono text-[9px] text-gray-600 font-bold">{item.id}</div>
                            <div className="text-[8px] text-gray-400">{item.created_at?.split(" ")[0]}</div>
                          </td>

                          {/* Item summary */}
                          <td className="px-1.5 py-1 border-r border-gray-200">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-blue-100 text-blue-700 shrink-0">
                                {itemCount} item
                              </span>
                            </div>
                            <p className="text-[9px] text-gray-600 truncate leading-tight">
                              {hasSearch
                                ? highlightText(groupItems.map((g) => g.item_name).join(", "), search)
                                : groupItems.map((g) => g.item_name).join(", ")}
                            </p>
                          </td>

                          {/* Total qty */}
                          <td className="px-1.5 py-1 border-r border-gray-200 text-center font-bold text-gray-800">
                            {totalQty}
                          </td>

                          <td className="px-1.5 py-1 border-r border-gray-200 truncate text-gray-600">
                            {hasSearch ? highlightText(item.request_by, search) : item.request_by}
                          </td>
                          <td className="px-1.5 py-1 border-r border-gray-200" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-0.5">
                              <span className="font-mono text-[9px] truncate flex-1">
                                {hasSearch ? highlightText(item.request_number, search) : item.request_number}
                              </span>
                              {item.request_number && (
                                <CopyButton text={item.request_number} id={`rn-${item.id}`} copiedId={copiedId} onCopy={handleCopy} />
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 py-1 border-r border-gray-200" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-0.5">
                              <span className="font-mono text-[9px] truncate flex-1">
                                {hasSearch ? highlightText(item.issue_number, search) : item.issue_number}
                              </span>
                              {item.issue_number && (
                                <CopyButton text={item.issue_number} id={`in-${item.id}`} copiedId={copiedId} onCopy={handleCopy} />
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 py-1 border-r border-gray-200 truncate text-gray-600">{item.type_reason || "-"}</td>
                          <td className="px-1.5 py-1 border-r border-gray-200 truncate text-gray-600" title={item.reason}>{item.reason || "-"}</td>
                          <td className="px-1 py-1 border-r border-gray-200 text-center">
                            <ProcessedBadge value={item.has_processed} />
                          </td>
                          <td className="px-1 py-1 border-r border-gray-200 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleProcessed(item.id, item.has_processed)}
                              title={isProcessed ? "Tandai belum diproses" : "Tandai sudah diproses"}
                              className="inline-flex items-center justify-center w-4 h-4 rounded transition-colors hover:bg-white/50"
                            >
                              {isProcessed ? (
                                <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-gray-300 hover:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="9" strokeWidth={2} />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              <button
                                onClick={() => openEdit(item)}
                                className="px-1 py-0.5 bg-yellow-500 text-white rounded text-[9px] hover:bg-yellow-600"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-1 py-0.5 bg-red-500 text-white rounded text-[9px] hover:bg-red-600"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {groupedRows.length === 0 && (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    {hasSearch ? "Tidak ada hasil yang sesuai" : "Belum ada data material issue"}
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center px-4 py-2.5 border-t">
                  <div className="text-xs text-gray-500">
                    {indexOfFirst + 1}–{Math.min(indexOfFirst + itemsPerPage, groupedRows.length)} dari {groupedRows.length}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2.5 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">
                      Prev
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button key={page} onClick={() => setCurrentPage(page)} className={`px-2.5 py-1 text-xs border rounded ${currentPage === page ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}>
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-1 text-xs text-gray-400 self-center">…</span>;
                      }
                      return null;
                    })}
                    <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2.5 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Group Detail Popup ─────────────────────────────────────────────── */}
      {detailGroupId && (
        <GroupDetailPopup
          groupId={detailGroupId}
          items={getGroupItems(detailGroupId)}
          onClose={() => setDetailGroupId(null)}
          copiedId={copiedId}
          onCopy={handleCopy}
        />
      )}

      {/* ── Add Modal ─────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold text-gray-900">Material Issue Baru</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Scan item lalu isi form</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setForm(emptyForm); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <SkuScannerSection
                masterItems={masterItems}
                scannedItems={form.scannedItems}
                onItemsChange={(items) => setForm((prev) => ({ ...prev, scannedItems: items }))}
              />

              <div className="border-t border-dashed border-gray-200" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Request By <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.request_by}
                    onChange={(e) => setForm({ ...form, request_by: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  >
                    <option value="">Pilih</option>
                    {dropdownData.request_by.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Tipe Alasan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type_reason}
                    onChange={(e) => setForm({ ...form, type_reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  >
                    <option value="">Pilih</option>
                    {dropdownData.type_reason.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">No. Request</label>
                  <input
                    type="text"
                    value={form.request_number}
                    onChange={(e) => setForm({ ...form, request_number: e.target.value })}
                    placeholder="Opsional"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">No. Issue</label>
                  <input
                    type="text"
                    value={form.issue_number}
                    onChange={(e) => setForm({ ...form, issue_number: e.target.value })}
                    placeholder="Opsional"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Alasan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value.slice(0, 50) })}
                  rows={2}
                  maxLength={50}
                  placeholder="Maks 50 karakter"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-gray-50"
                />
                <p className={`text-[10px] mt-0.5 text-right ${form.reason.length >= 50 ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                  {form.reason.length}/50
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex gap-3">
              <button onClick={() => { setShowAddModal(false); setForm(emptyForm); }} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">
                Batal
              </button>
              <button onClick={handleAdd} disabled={submitting} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Material Issue</h2>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">{selectedItem.id}</p>
              </div>
              <button onClick={() => { setShowEditModal(false); setSelectedItem(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">SKU</label>
                  <input
                    type="text"
                    value={editForm.item_sku}
                    onChange={(e) => setEditForm({ ...editForm, item_sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.item_qty}
                    onChange={(e) => setEditForm({ ...editForm, item_qty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nama Item</label>
                <input
                  type="text"
                  value={editForm.item_name}
                  onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Request By</label>
                  <select
                    value={editForm.request_by}
                    onChange={(e) => setEditForm({ ...editForm, request_by: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  >
                    <option value="">Pilih</option>
                    {dropdownData.request_by.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipe Alasan</label>
                  <select
                    value={editForm.type_reason}
                    onChange={(e) => setEditForm({ ...editForm, type_reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  >
                    <option value="">Pilih</option>
                    {dropdownData.type_reason.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">No. Request</label>
                  <input
                    type="text"
                    value={editForm.request_number}
                    onChange={(e) => setEditForm({ ...editForm, request_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">No. Issue</label>
                  <input
                    type="text"
                    value={editForm.issue_number}
                    onChange={(e) => setEditForm({ ...editForm, issue_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alasan</label>
                <textarea
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value.slice(0, 50) })}
                  rows={2}
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-gray-50"
                />
                <p className={`text-[10px] mt-0.5 text-right ${editForm.reason.length >= 50 ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                  {editForm.reason.length}/50
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status Proses</label>
                <div className="flex gap-3">
                  {["FALSE", "TRUE"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, has_processed: v })}
                      className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                        editForm.has_processed === v
                          ? v === "TRUE" ? "border-green-500 bg-green-50 text-green-800" : "border-red-400 bg-red-50 text-red-800"
                          : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-white"
                      }`}
                    >
                      {v === "TRUE" ? "✓ Sudah Diproses" : "✗ Belum Diproses"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex gap-3">
              <button onClick={() => { setShowEditModal(false); setSelectedItem(null); }} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">
                Batal
              </button>
              <button onClick={handleEdit} disabled={submitting} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}