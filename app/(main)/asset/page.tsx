"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Asset {
  id: string;
  type_asset: string;
  asset_name: string;
  link_url: string;
}

type CssVars = ReturnType<typeof buildCss>;

function buildCss(isDark: boolean) {
  return {
    pageBg: isDark ? "#0f1724" : "#eef2f7",
    cardBg: isDark ? "#1e293b" : "white",
    cardShadow: isDark ? "0 1px 4px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.07)",
    cardBorder: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
    textHeading: isDark ? "#e2e8f0" : "#1e3a5c",
    textValue: isDark ? "#f1f5f9" : "#1e293b",
    textSub: isDark ? "#94a3b8" : "#64748b",
    textMuted: isDark ? "#64748b" : "#94a3b8",
    divider: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
    dividerLine: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
    selectBg: isDark ? "#1e293b" : "white",
    selectColor: isDark ? "#e2e8f0" : "#374151",
    selectBorder: isDark ? "#334155" : "#cbd5e1",
    inputBg: isDark ? "#1e293b" : "white",
    inputBorder: isDark ? "#334155" : "#cbd5e1",
    inputColor: isDark ? "#e2e8f0" : "#1e293b",
    modalBg: isDark ? "#1e293b" : "white",
    modalOverlay: "rgba(0,0,0,0.5)",
    rowAlt: isDark ? "#243447" : "#f8fafc",
  };
}

function getTypeBadge(type: string, isDark: boolean) {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    SOP: { bg: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff", color: isDark ? "#93c5fd" : "#1d4ed8", dot: "#3b82f6" },
    Media: { bg: isDark ? "rgba(168,85,247,0.15)" : "#faf5ff", color: isDark ? "#d8b4fe" : "#7c3aed", dot: "#a855f7" },
  };
  return map[type] || { bg: isDark ? "rgba(100,116,139,0.15)" : "#f8fafc", color: isDark ? "#94a3b8" : "#475569", dot: "#64748b" };
}

function FileIcon({ url, size = 36 }: { url: string; size?: number }) {
  const isPresentation = url.includes("presentation") || url.includes("slides");
  if (isPresentation) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="8" fill="#f59e0b" />
        <rect x="8" y="10" width="32" height="24" rx="2" fill="white" fillOpacity="0.2" />
        <rect x="8" y="10" width="32" height="7" fill="white" fillOpacity="0.3" />
        <circle cx="24" cy="28" r="5" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="2" />
        <line x1="22" y1="38" x2="24" y2="34" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="26" y1="38" x2="24" y2="34" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#ef4444" />
      <rect x="10" y="8" width="20" height="28" rx="2" fill="white" fillOpacity="0.2" />
      <path d="M30 8l8 8h-8V8z" fill="white" fillOpacity="0.3" />
      <text x="11" y="42" fontSize="9" fontWeight="800" fill="white" fillOpacity="0.85" fontFamily="sans-serif">PDF</text>
      <rect x="14" y="18" width="12" height="2" rx="1" fill="white" fillOpacity="0.5" />
      <rect x="14" y="22" width="16" height="2" rx="1" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

// ─── Card Item ────────────────────────────────────────────────────────────────

function AssetCardItem({
  asset, css, isDark, canEdit, onEdit, onDelete,
}: {
  asset: Asset; css: CssVars; isDark: boolean;
  canEdit: boolean; onEdit: (a: Asset) => void; onDelete: (a: Asset) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const badge = getTypeBadge(asset.type_asset, isDark);

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${hovered ? "#3b82f6" : css.cardBorder}`,
        background: hovered ? (isDark ? "#243447" : "#f0f7ff") : css.cardBg,
        boxShadow: hovered ? "0 4px 16px rgba(59,130,246,0.15)" : css.cardShadow,
        transition: "all 0.15s ease",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <a
        href={asset.link_url} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 12px 12px", gap: 10, textDecoration: "none" }}
      >
        <FileIcon url={asset.link_url} size={40} />
        <div style={{ textAlign: "center", width: "100%", minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: css.textValue, margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {asset.asset_name}
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 600, color: badge.color, background: badge.bg, borderRadius: 20, padding: "2px 7px" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.dot, flexShrink: 0 }} />
              {asset.type_asset}
            </span>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={hovered ? "#3b82f6" : css.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.15s", flexShrink: 0 }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
      {canEdit && (
        <div style={{ display: "flex", borderTop: `1px solid ${css.dividerLine}`, background: isDark ? "rgba(0,0,0,0.1)" : "#f8fafc" }}>
          <button onClick={() => onEdit(asset)} style={{ flex: 1, padding: "6px 0", background: "none", border: "none", borderRight: `1px solid ${css.dividerLine}`, fontSize: 10, color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Edit
          </button>
          <button onClick={() => onDelete(asset)} style={{ flex: 1, padding: "6px 0", background: "none", border: "none", fontSize: 10, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
            Hapus
          </button>
        </div>
      )}
    </div>
  );
}

// ─── List Item ────────────────────────────────────────────────────────────────

function AssetListItem({
  asset, css, isDark, index, canEdit, onEdit, onDelete,
}: {
  asset: Asset; css: CssVars; isDark: boolean; index: number;
  canEdit: boolean; onEdit: (a: Asset) => void; onDelete: (a: Asset) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const badge = getTypeBadge(asset.type_asset, isDark);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        gap: 12,
        padding: "9px 14px",
        borderRadius: 0,
        background: isDark
          ? hovered ? "#243447" : index % 2 === 0 ? "#1e293b" : "transparent"
          : hovered ? "#f0f7ff" : index % 2 === 0 ? "#f8fafc" : "white",
        borderLeft: `2px solid ${hovered ? "#3b82f6" : "transparent"}`,
        transition: "all 0.12s ease",
      }}
    >
      {/* Icon */}
      <FileIcon url={asset.link_url} size={28} />

      {/* Name + badge */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: css.textValue, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {asset.asset_name}
        </p>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 600, color: badge.color, background: badge.bg, borderRadius: 20, padding: "1px 6px", marginTop: 3 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: badge.dot }} />
          {asset.type_asset}
        </span>
      </div>

      {/* Edit/delete actions */}
      {canEdit && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onEdit(asset)} style={{ padding: "4px 8px", background: "none", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 5, fontSize: 10, color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Edit
          </button>
          <button onClick={() => onDelete(asset)} style={{ padding: "4px 8px", background: "none", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 5, fontSize: 10, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
            Hapus
          </button>
        </div>
      )}

      {/* Open link arrow */}
      <a href={asset.link_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hovered ? "#3b82f6" : isDark ? "#475569" : "#cbd5e1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.12s" }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  );
}

// ─── Asset Modal ──────────────────────────────────────────────────────────────

function AssetModal({
  mode, asset, css, isDark, onClose, onSave, saving,
}: {
  mode: "add" | "edit"; asset: Partial<Asset>; css: CssVars; isDark: boolean;
  onClose: () => void; onSave: (d: Partial<Asset>) => void; saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Asset>>(asset);
  const inputSty: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${css.inputBorder}`, background: css.inputBg, color: css.inputColor, fontSize: 12, outline: "none", boxSizing: "border-box" };
  const labelSty: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: css.textSub, marginBottom: 4, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: css.modalOverlay, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: css.modalBg, borderRadius: 12, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${css.dividerLine}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: css.textHeading }}>{mode === "add" ? "Tambah Asset" : "Edit Asset"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: css.textMuted, cursor: "pointer", padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelSty}>Tipe Asset</label>
            <select value={form.type_asset || ""} onChange={e => setForm({ ...form, type_asset: e.target.value })} style={inputSty}>
              <option value="">-- Pilih Tipe --</option>
              <option value="SOP">SOP</option>
              <option value="Media">Media</option>
            </select>
          </div>
          <div>
            <label style={labelSty}>Nama Asset</label>
            <input type="text" value={form.asset_name || ""} onChange={e => setForm({ ...form, asset_name: e.target.value })} placeholder="Contoh: Opening Store" style={inputSty} />
          </div>
          <div>
            <label style={labelSty}>Link URL</label>
            <input type="url" value={form.link_url || ""} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="https://drive.google.com/..." style={inputSty} />
          </div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${css.dividerLine}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${css.inputBorder}`, background: "none", color: css.textSub, fontSize: 12, cursor: "pointer" }}>Batal</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.type_asset || !form.asset_name || !form.link_url}
            style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: saving ? "#94a3b8" : "#1e3a5c", color: "white", fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: !form.type_asset || !form.asset_name || !form.link_url ? 0.5 : 1 }}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

function ConfirmDelete({
  asset, css, isDark, onClose, onConfirm, deleting,
}: {
  asset: Asset; css: CssVars; isDark: boolean;
  onClose: () => void; onConfirm: () => void; deleting: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: css.modalOverlay, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: css.modalBg, borderRadius: 12, width: "100%", maxWidth: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 16px 16px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: isDark ? "rgba(239,68,68,0.15)" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: css.textHeading, margin: "0 0 6px" }}>Hapus Asset?</p>
          <p style={{ fontSize: 11, color: css.textSub, margin: 0, lineHeight: 1.5 }}>
            <strong>{asset.asset_name}</strong> akan dihapus permanen.
          </p>
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${css.dividerLine}`, display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1px solid ${css.inputBorder}`, background: "none", color: css.textSub, fontSize: 12, cursor: "pointer" }}>Batal</button>
          <button onClick={onConfirm} disabled={deleting} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", background: deleting ? "#94a3b8" : "#ef4444", color: "white", fontSize: 12, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer" }}>
            {deleting ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssetPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [modalAsset, setModalAsset] = useState<Partial<Asset>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const css = useMemo(() => buildCss(isDark), [isDark]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    if (!parsed.asset_store) { router.push("/dashboard"); return; }
    setUser(parsed);
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/asset");
      if (res.ok) setAssets(await res.json());
      else showToast("Gagal memuat data asset", "error");
    } catch { showToast("Gagal memuat data asset", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchAssets(); }, [user]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const availableTypes = useMemo(() =>
    [...new Set(assets.map(a => a.type_asset).filter(Boolean))].sort(),
    [assets]);

  const filtered = useMemo(() =>
    assets.filter(a => {
      if (filterType !== "all" && a.type_asset !== filterType) return false;
      if (search && !a.asset_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }), [assets, filterType, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Asset[]>();
    filtered.forEach(a => {
      const k = a.type_asset || "Lainnya";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const canEdit = user?.user_setting === true || user?.user_setting === "true";

  const handleSave = async (form: Partial<Asset>) => {
    if (!form.type_asset || !form.asset_name || !form.link_url) return;
    setSaving(true);
    try {
      const method = modalMode === "add" ? "POST" : "PUT";
      const res = await fetch("/api/asset", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          modalMode === "add"
            ? { type_asset: form.type_asset, asset_name: form.asset_name, link_url: form.link_url }
            : { id: form.id, type_asset: form.type_asset, asset_name: form.asset_name, link_url: form.link_url }
        ),
      });
      if (res.ok) {
        showToast(modalMode === "add" ? "Asset berhasil ditambahkan" : "Asset berhasil diupdate", "success");
        setShowModal(false);
        fetchAssets();
      } else showToast("Gagal menyimpan asset", "error");
    } catch { showToast("Gagal menyimpan asset", "error"); }
    finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/asset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (res.ok) {
        showToast("Asset berhasil dihapus", "success");
        setDeleteTarget(null);
        fetchAssets();
      } else showToast("Gagal menghapus asset", "error");
    } catch { showToast("Gagal menghapus asset", "error"); }
    finally { setDeleting(false); }
  };

  if (!user) return null;

  const selSty: React.CSSProperties = {
    padding: "4px 8px",
    border: `1px solid ${css.selectBorder}`,
    borderRadius: 6,
    fontSize: 11,
    background: css.selectBg,
    color: css.selectColor,
    outline: "none",
    cursor: "pointer",
  };

  const iconBtn = (active: boolean): React.CSSProperties => ({
    padding: "5px 8px",
    border: `1px solid ${active ? "#3b82f6" : isDark ? "#334155" : "#e2e8f0"}`,
    borderRadius: 6,
    background: active ? (isDark ? "#1e3a5c" : "#eff6ff") : "transparent",
    color: active ? "#3b82f6" : isDark ? "#64748b" : "#94a3b8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.12s",
  });

  return (
    <div className="flex-1 overflow-auto" style={{ background: css.pageBg, width: "100%", minWidth: 0, transition: "background 0.2s" }}>
      <div style={{ padding: "16px 18px", width: "100%", boxSizing: "border-box" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: css.textHeading, margin: 0, letterSpacing: "-0.02em" }}>Asset</h1>
            <p style={{ fontSize: 10, color: css.textMuted, margin: 0 }}>Dokumen SOP &amp; Media</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={fetchAssets} style={{ padding: "4px 12px", background: "#1e3a5c", color: "white", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
              Refresh
            </button>
            {canEdit && (
              <button
                onClick={() => { setModalMode("add"); setModalAsset({}); setShowModal(true); }}
                style={{ padding: "4px 14px", background: "#1e3a5c", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Tambah
              </button>
            )}
          </div>
        </div>

        {/* Toolbar: filters + view toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={css.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text" placeholder="Cari asset..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...selSty, paddingLeft: 26, width: 150 }}
              />
            </div>
            {/* Type filter */}
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selSty}>
              <option value="all">Semua Tipe</option>
              {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ fontSize: 11, color: css.textMuted }}>{filtered.length} asset</span>
          </div>

          {/* View toggle — same as stock opname */}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setViewMode("card")} style={iconBtn(viewMode === "card")} title="Card view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button onClick={() => setViewMode("list")} style={iconBtn(viewMode === "list")} title="List view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
            <p style={{ color: css.textMuted, fontSize: 13 }}>Loading...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: isDark ? "#475569" : "#94a3b8" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Tidak ada asset</p>
            <p style={{ fontSize: 11, margin: "4px 0 0" }}>
              {search || filterType !== "all" ? "Coba ubah filter pencarian" : canEdit ? "Klik Tambah untuk menambahkan asset baru" : "Belum ada asset tersedia"}
            </p>
          </div>
        )}

        {/* ── CARD VIEW — grouped by type ── */}
        {!loading && filtered.length > 0 && viewMode === "card" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {grouped.map(([groupKey, items]) => {
              const badge = getTypeBadge(groupKey, isDark);
              return (
                <div key={groupKey}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#64748b" : "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {groupKey}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                    {items.map(a => (
                      <AssetCardItem
                        key={a.id} asset={a} css={css} isDark={isDark} canEdit={canEdit}
                        onEdit={asset => { setModalMode("edit"); setModalAsset({ ...asset }); setShowModal(true); }}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {!loading && filtered.length > 0 && viewMode === "list" && (
          <div style={{ background: css.cardBg, borderRadius: 10, border: `1px solid ${css.cardBorder}`, overflow: "hidden", boxShadow: css.cardShadow }}>
            {/* List header */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", padding: "8px 14px", borderBottom: `1px solid ${css.dividerLine}`, background: isDark ? "rgba(0,0,0,0.2)" : "#f8fafc" }}>
              <span style={{ width: 40 }}>&nbsp;</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nama Asset</span>
              {canEdit && <span style={{ fontSize: 9.5, fontWeight: 700, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Aksi</span>}
              <span style={{ width: 20 }}>&nbsp;</span>
            </div>
            {/* Group rows by type */}
            {grouped.map(([groupKey, items]) => (
              <div key={groupKey}>
                {/* Group divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px 4px", background: isDark ? "rgba(0,0,0,0.15)" : "#f1f5f9" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: getTypeBadge(groupKey, isDark).dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: css.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{groupKey}</span>
                  <span style={{ fontSize: 10, color: css.textMuted }}>({items.length})</span>
                </div>
                {items.map((a, i) => (
                  <AssetListItem
                    key={a.id} asset={a} css={css} isDark={isDark} index={i} canEdit={canEdit}
                    onEdit={asset => { setModalMode("edit"); setModalAsset({ ...asset }); setShowModal(true); }}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <AssetModal mode={modalMode} asset={modalAsset} css={css} isDark={isDark}
          onClose={() => setShowModal(false)} onSave={handleSave} saving={saving} />
      )}
      {deleteTarget && (
        <ConfirmDelete asset={deleteTarget} css={css} isDark={isDark}
          onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} deleting={deleting} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 2000, background: toast.type === "success" ? "#22c55e" : "#ef4444", color: "white", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}