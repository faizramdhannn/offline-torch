"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  LayoutGrid,
  List as ListIcon,
  FileText,
  Image as ImageIcon,
  Presentation,
} from "lucide-react";
import Popup from "@/components/Popup";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { StatCard } from "@/components/shared/StatCard";

import { AssetCard } from "@/components/asset/AssetCard";
import { AssetListRow } from "@/components/asset/AssetListRow";
import { AssetFormModal } from "@/components/asset/AssetFormModal";
import { getTypeDotColor, type Asset } from "@/components/asset/types";

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

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  // ── Auth + permission gate ─────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.asset_store) {
      router.push("/dashboard");
      return;
    }
    setUser(parsed);
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/asset");
      if (res.ok) setAssets(await res.json());
      else showMessage("Gagal memuat data asset", "error");
    } catch {
      showMessage("Gagal memuat data asset", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchAssets();
  }, [user]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const availableTypes = useMemo(
    () => [...new Set(assets.map((a) => a.type_asset).filter(Boolean))].sort(),
    [assets]
  );

  const filtered = useMemo(
    () =>
      assets.filter((a) => {
        if (filterType !== "all" && a.type_asset !== filterType) return false;
        if (search && !a.asset_name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [assets, filterType, search]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Asset[]>();
    filtered.forEach((a) => {
      const k = a.type_asset || "Lainnya";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const stats = useMemo(() => {
    const count = (t: string) => assets.filter((a) => a.type_asset === t).length;
    return {
      total: assets.length,
      sop: count("SOP"),
      media: count("Media"),
      picture: count("Picture"),
    };
  }, [assets]);

  const canEdit = user?.user_setting === true || user?.user_setting === "true";

  // ── Save (add/edit) ─────────────────────────────────────────────────────────
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
            ? { type_asset: form.type_asset, asset_name: form.asset_name, link_url: form.link_url, actorName: user?.user_name }
            : { id: form.id, type_asset: form.type_asset, asset_name: form.asset_name, link_url: form.link_url }
        ),
      });
      if (res.ok) {
        showMessage(modalMode === "add" ? "Asset berhasil ditambahkan" : "Asset berhasil diupdate", "success");
        setShowModal(false);
        fetchAssets();
      } else {
        showMessage("Gagal menyimpan asset", "error");
      }
    } catch {
      showMessage("Gagal menyimpan asset", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/asset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id, actorName: user?.user_name, asset_name: deleteTarget.asset_name }),
      });
      if (res.ok) {
        showMessage("Asset berhasil dihapus", "success");
        setDeleteTarget(null);
        fetchAssets();
      } else {
        showMessage("Gagal menghapus asset", "error");
      }
    } catch {
      showMessage("Gagal menghapus asset", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="space-y-5 p-4">
        {/* Header */}
        <SectionHeader
          icon={FolderOpen}
          title="Asset"
          description="Dokumen SOP & Media"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" icon={RefreshCw} size="sm" onClick={fetchAssets}>
                Refresh
              </Button>
              {canEdit && (
                <Button
                  icon={Plus}
                  size="sm"
                  onClick={() => {
                    setModalMode("add");
                    setModalAsset({});
                    setShowModal(true);
                  }}
                >
                  Tambah
                </Button>
              )}
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={FolderOpen} label="Total Asset" value={String(stats.total)} />
          <StatCard icon={FileText} label="SOP" value={String(stats.sop)} tone="info" />
          <StatCard icon={Presentation} label="Media" value={String(stats.media)} tone="default" />
          <StatCard icon={ImageIcon} label="Picture" value={String(stats.picture)} tone="positive" />
        </div>

        {/* Toolbar: search + filter + view toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari asset..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-40 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20 sm:w-56"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
            >
              <option value="all">Semua Tipe</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gray-400">{filtered.length} asset</span>
          </div>

          <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              title="Card view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                viewMode === "card" ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="List view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                viewMode === "list" ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {loading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Tidak ada asset"
              description={
                search || filterType !== "all"
                  ? "Coba ubah filter pencarian"
                  : canEdit
                  ? "Klik Tambah untuk menambahkan asset baru"
                  : "Belum ada asset tersedia"
              }
              action={
                canEdit && !search && filterType === "all" ? (
                  <Button
                    icon={Plus}
                    size="sm"
                    onClick={() => {
                      setModalMode("add");
                      setModalAsset({});
                      setShowModal(true);
                    }}
                  >
                    Tambah Asset
                  </Button>
                ) : undefined
              }
            />
          ) : viewMode === "card" ? (
            <div className="space-y-5">
              {grouped.map(([groupKey, items]) => (
                <div key={groupKey}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${getTypeDotColor(groupKey)}`} />
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      {groupKey}
                    </p>
                    <span className="text-[10px] text-gray-300">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {items.map((a) => (
                      <AssetCard
                        key={a.id}
                        asset={a}
                        canEdit={canEdit}
                        onEdit={(asset) => {
                          setModalMode("edit");
                          setModalAsset({ ...asset });
                          setShowModal(true);
                        }}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([groupKey, items]) => (
                <div key={groupKey} className="overflow-hidden rounded-xl border border-gray-100">
                  <div className="flex items-center gap-1.5 bg-gray-50 px-3.5 py-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${getTypeDotColor(groupKey)}`} />
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      {groupKey}
                    </p>
                    <span className="text-[10px] text-gray-300">({items.length})</span>
                  </div>
                  <div>
                    {items.map((a) => (
                      <AssetListRow
                        key={a.id}
                        asset={a}
                        canEdit={canEdit}
                        onEdit={(asset) => {
                          setModalMode("edit");
                          setModalAsset({ ...asset });
                          setShowModal(true);
                        }}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      <AssetFormModal
        key={modalAsset.id ?? "new"}
        open={showModal}
        mode={modalMode}
        asset={modalAsset}
        saving={saving}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        title="Hapus asset ini?"
        description={deleteTarget ? `"${deleteTarget.asset_name}" akan dihapus permanen.` : undefined}
        confirmLabel="Hapus"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}
