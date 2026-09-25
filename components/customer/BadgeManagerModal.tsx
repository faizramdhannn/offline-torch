"use client";

import { useEffect, useRef, useState } from "react";
import { CustomerBadge } from "@/types";

interface BadgeRow extends CustomerBadge {
  id: number;
  sku_list: string[];
}

interface BadgeManagerModalProps {
  onClose: () => void;
  onChanged: () => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function badgeLogic(badge: BadgeRow): string {
  switch (badge.key) {
    case "new_customer":
      return "Otomatis diberikan ke customer dengan tepat 1 sales order.";
    case "potential_loyalist":
      return "Otomatis diberikan ke customer dengan 2–5 sales order.";
    case "champion":
      return "Otomatis diberikan ke customer dengan lebih dari 5 sales order.";
    case "bulk_order":
      return "Otomatis diberikan jika ada minimal 1 sales order dengan total qty item lebih dari 5.";
    default:
      return "Otomatis diberikan jika salah satu order customer mengandung SKU yang ada di daftar SKU di bawah.";
  }
}

export function BadgeManagerModal({ onClose, onChanged }: BadgeManagerModalProps) {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newSkus, setNewSkus] = useState("");
  const [newLogoDataUrl, setNewLogoDataUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const logoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const newLogoInputRef = useRef<HTMLInputElement | null>(null);

  const handleNewLogoFile = async (file: File) => {
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      alert("Logo hanya boleh PNG atau JPG");
      return;
    }
    setNewLogoDataUrl(await fileToDataUrl(file));
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/badges");
      const result = await res.json();
      setBadges(result.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleLogoUpload = async (id: number, file: File) => {
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      alert("Logo hanya boleh PNG atau JPG");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setSavingId(id);
    try {
      await fetch("/api/customer/badges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, logo_url: dataUrl }),
      });
      await load();
      onChanged();
    } finally {
      setSavingId(null);
    }
  };

  const handleLogoRemove = async (id: number) => {
    if (!confirm("Hapus gambar badge ini?")) return;
    setSavingId(id);
    try {
      await fetch("/api/customer/badges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, remove_logo: true }),
      });
      await load();
      onChanged();
    } finally {
      setSavingId(null);
    }
  };

  const handleSkuListSave = async (id: number, sku_list: string[]) => {
    setSavingId(id);
    try {
      await fetch("/api/customer/badges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sku_list }),
      });
      await load();
      onChanged();
    } finally {
      setSavingId(null);
    }
  };

  const handleLabelSave = async (id: number, label: string) => {
    setSavingId(id);
    try {
      await fetch("/api/customer/badges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, label }),
      });
      await load();
      onChanged();
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus badge collection ini?")) return;
    await fetch(`/api/customer/badges?id=${id}`, { method: "DELETE" });
    await load();
    onChanged();
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const badge_key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const sku_list = newSkus
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/customer/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badge_key, label: newLabel.trim(), sku_list, logo_url: newLogoDataUrl }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || "Gagal menambah badge");
        return;
      }
      setNewLabel("");
      setNewSkus("");
      setNewLogoDataUrl(null);
      await load();
      onChanged();
    } finally {
      setCreating(false);
    }
  };

  const tierBadges = badges.filter((b) => b.type === "tier" || b.type === "bulk");
  const collectionBadges = badges.filter((b) => b.type === "collection");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Kelola Badge Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Memuat...</div>
        ) : (
          <>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Tier &amp; Bulk Order
            </h3>
            <div className="mb-5 flex flex-col gap-1.5">
              {tierBadges.map((b) => (
                <BadgeRowEditor
                  key={b.id}
                  badge={b}
                  saving={savingId === b.id}
                  expanded={expandedId === b.id}
                  onToggleExpand={() => setExpandedId(expandedId === b.id ? null : b.id)}
                  onLogoPick={() => logoInputRefs.current[b.id]?.click()}
                  onLogoFile={(f) => handleLogoUpload(b.id, f)}
                  onLogoRemove={() => handleLogoRemove(b.id)}
                  logoInputRef={(el) => (logoInputRefs.current[b.id] = el)}
                  editableSku={false}
                  onLabelSave={handleLabelSave}
                />
              ))}
            </div>

            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Collection (Gundam, Metro Ride, Watch, dst)
            </h3>
            <div className="mb-4 flex flex-col gap-1.5">
              {collectionBadges.map((b) => (
                <BadgeRowEditor
                  key={b.id}
                  badge={b}
                  saving={savingId === b.id}
                  expanded={expandedId === b.id}
                  onToggleExpand={() => setExpandedId(expandedId === b.id ? null : b.id)}
                  onLogoPick={() => logoInputRefs.current[b.id]?.click()}
                  onLogoFile={(f) => handleLogoUpload(b.id, f)}
                  onLogoRemove={() => handleLogoRemove(b.id)}
                  logoInputRef={(el) => (logoInputRefs.current[b.id] = el)}
                  editableSku
                  onSkuListSave={handleSkuListSave}
                  onLabelSave={handleLabelSave}
                  onDelete={() => handleDelete(b.id)}
                />
              ))}
              {collectionBadges.length === 0 && (
                <div className="text-[11px] text-gray-400">Belum ada collection badge.</div>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 p-3">
              <h4 className="mb-2 text-[11px] font-semibold text-gray-600">+ Tambah Collection Baru</h4>
              <div className="mb-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => newLogoInputRef.current?.click()}
                  className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 text-[9px] text-gray-400 hover:bg-gray-100"
                  title="Upload foto logo"
                >
                  {newLogoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={newLogoDataUrl} alt="Preview logo" className="h-full w-full object-cover" />
                  ) : (
                    "Logo"
                  )}
                </button>
                <input
                  ref={newLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleNewLogoFile(f);
                  }}
                />
                {newLogoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setNewLogoDataUrl(null)}
                    className="text-[10px] text-red-500 hover:text-red-700"
                  >
                    Hapus gambar
                  </button>
                )}
              </div>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nama collection, contoh: Gundam"
                className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-[11px]"
              />
              <textarea
                value={newSkus}
                onChange={(e) => setNewSkus(e.target.value)}
                placeholder="Daftar SKU, pisahkan dengan koma atau baris baru"
                rows={3}
                className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-[11px]"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newLabel.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {creating ? "Menyimpan..." : "Tambah"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BadgeRowEditor({
  badge,
  saving,
  expanded,
  onToggleExpand,
  onLogoPick,
  onLogoFile,
  onLogoRemove,
  logoInputRef,
  editableSku,
  onSkuListSave,
  onLabelSave,
  onDelete,
}: {
  badge: BadgeRow;
  saving: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onLogoPick: () => void;
  onLogoFile: (f: File) => void;
  onLogoRemove?: () => void;
  logoInputRef: (el: HTMLInputElement | null) => void;
  editableSku: boolean;
  onSkuListSave?: (id: number, sku_list: string[]) => void;
  onLabelSave: (id: number, label: string) => void;
  onDelete?: () => void;
}) {
  const [label, setLabel] = useState(badge.label);
  const [newSku, setNewSku] = useState("");

  const skuList = badge.sku_list || [];

  const addSku = () => {
    const v = newSku.trim();
    if (!v || skuList.includes(v)) {
      setNewSku("");
      return;
    }
    onSkuListSave?.(badge.id, [...skuList, v]);
    setNewSku("");
  };

  const removeSku = (sku: string) => {
    onSkuListSave?.(badge.id, skuList.filter((s) => s !== sku));
  };

  return (
    <div className="rounded-lg border border-gray-100">
      <div className="flex items-center gap-3 p-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLogoPick();
          }}
          className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 text-[9px] text-gray-400 hover:bg-gray-100"
          title="Upload foto logo"
        >
          {badge.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={badge.logo_url} alt={badge.label} className="h-full w-full object-cover" />
          ) : (
            "Logo"
          )}
        </button>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onLogoFile(f);
          }}
        />
        {badge.logo_url && onLogoRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLogoRemove();
            }}
            className="flex-none text-[9px] text-red-500 hover:text-red-700"
            title="Hapus gambar"
          >
            Hapus foto
          </button>
        )}
        <div className="flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2">
            <input
              value={label}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => label.trim() && label !== badge.label && onLabelSave(badge.id, label.trim())}
              className="flex-1 rounded border border-gray-200 px-2 py-1 text-[11px] font-medium"
            />
            {editableSku && (
              <span className="text-[10px] text-gray-400">{skuList.length} SKU</span>
            )}
            {saving && <span className="text-[10px] text-gray-400">menyimpan...</span>}
            <span className="text-[10px] text-gray-400">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="flex-none text-[10px] text-red-500 hover:text-red-700">
            Hapus
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-2.5">
          <p className="mb-2 text-[10px] italic text-gray-500">{badgeLogic(badge)}</p>

          {editableSku && (
            <>
              <div className="mb-2 flex flex-wrap gap-1">
                {skuList.length === 0 && (
                  <span className="text-[10px] text-gray-400">Belum ada SKU untuk collection ini.</span>
                )}
                {skuList.map((sku) => (
                  <span
                    key={sku}
                    className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-700"
                  >
                    {sku}
                    <button onClick={() => removeSku(sku)} className="text-gray-400 hover:text-red-600">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSku();
                    }
                  }}
                  placeholder="Tambah SKU lalu Enter"
                  className="flex-1 rounded border border-gray-200 px-2 py-1 text-[10px]"
                />
                <button
                  onClick={addSku}
                  className="rounded bg-gray-200 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-300"
                >
                  Tambah
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
