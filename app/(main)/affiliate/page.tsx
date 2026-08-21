"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import Popup from "@/components/Popup";
import { Button } from "@/components/shared/Button";
import { SearchShortcutHint } from "@/components/shared/SearchShortcutHint";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { AffiliateScannerModal } from "@/components/affiliate/AffiliateScannerModal";
import {
  MasterAffiliate,
  MasterAffiliateData,
  AffiliateStoreListItem,
  AffiliateOrder,
} from "@/types";
import { Plus, Pencil, Trash2, Download, ScanLine, QrCode } from "lucide-react";

type MainTab = "list" | "orders" | "report" | "master";
type ReportSubTab = "affiliate" | "store";

const COMMISSION_RATES = ["7%", "10%"];
const REEDEM_STATUSES = ["Belum diproses", "Diproses", "Sudah Redeem"];

function formatRupiah(value: string | number) {
  const number =
    typeof value === "string"
      ? parseInt((value || "0").replace(/[^0-9]/g, "") || "0")
      : value || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}

function parseCommissionRate(v: string | undefined | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace("%", "").trim());
  return isNaN(n) ? 0 : n;
}

function parseValueOrder(v: string | undefined | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v || "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// Link redirect+tracking (app/r/[uuid]/route.ts) dari menu QR Code — dipakai
// supaya QR tab Master ikut tercatat analitiknya di menu QR Code.
function trackingLink(uuid: string): string {
  if (typeof window === "undefined" || !uuid) return "";
  return `${window.location.origin}/r/${uuid}`;
}

export default function AffiliatePage() {
  const router = useRouter();
  useSessionGuard();
  const [user, setUser] = useState<any>(null);
  const [mainTab, setMainTab] = useState<MainTab>("list");

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  // ── Data ────────────────────────────────────────────────────────────────
  const [masterAffiliates, setMasterAffiliates] = useState<MasterAffiliate[]>([]);
  const [masterData, setMasterData] = useState<MasterAffiliateData[]>([]);
  const [storeList, setStoreList] = useState<AffiliateStoreListItem[]>([]);
  const [orders, setOrders] = useState<AffiliateOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Auth + permission gate ─────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.affiliate_view) {
      router.push("/dashboard");
      return;
    }
    setUser(parsed);
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [affRes, dataRes, storeRes, orderRes] = await Promise.all([
        fetch("/api/affiliate/master?type=affiliate"),
        fetch("/api/affiliate/master?type=data"),
        fetch("/api/affiliate/master?type=stores"),
        fetch("/api/affiliate/orders"),
      ]);
      setMasterAffiliates(affRes.ok ? await affRes.json() : []);
      setMasterData(dataRes.ok ? await dataRes.json() : []);
      setStoreList(storeRes.ok ? await storeRes.json() : []);
      setOrders(orderRes.ok ? await orderRes.json() : []);
    } catch {
      showMessage("Gagal memuat data affiliate", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-primary">Affiliate</h1>
          <p className="text-xs text-gray-500">Kelola affiliate, order, dan laporan komisi</p>
        </div>

        <div className="bg-white rounded-lg shadow px-2 pt-2 mb-4 flex gap-1 overflow-x-auto">
          {(
            [
              ["list", "List Affiliate"],
              ["orders", "Order Affiliate"],
              ["report", "Report"],
              ["master", "Master"],
            ] as [MainTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMainTab(key)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                mainTab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
        ) : (
          <>
            {mainTab === "list" && <ListAffiliateTab affiliates={masterAffiliates} />}
            {mainTab === "orders" && (
              <OrderAffiliateTab
                orders={orders}
                storeList={storeList}
                showMessage={showMessage}
                refresh={fetchAll}
              />
            )}
            {mainTab === "report" && (
              <ReportTab orders={orders} affiliates={masterAffiliates} />
            )}
            {mainTab === "master" && <MasterTab masterData={masterData} />}
          </>
        )}
      </div>

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ── Tab 1: List Affiliate (business card grid, read-only) ─────────────────
// ─────────────────────────────────────────────────────────────────────────
function ListAffiliateTab({ affiliates }: { affiliates: MasterAffiliate[] }) {
  const { ref: searchRef, shortcutLabel } = useSearchShortcut();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return affiliates;
    return affiliates.filter(
      (a) =>
        (a.affiliate_name || "").toLowerCase().includes(q) ||
        (a.affiliate_code || "").toLowerCase().includes(q) ||
        (a.affiliate_email || "").toLowerCase().includes(q)
    );
  }, [affiliates, search]);

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
        <div className="relative max-w-sm">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kode, atau email affiliate..."
            className="w-full px-2 py-1.5 pr-11 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <SearchShortcutHint label={shortcutLabel} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-sm text-gray-500">
          Tidak ada data affiliate
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a, i) => (
            <AffiliateCard key={a.id || i} affiliate={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AffiliateCard({ affiliate }: { affiliate: MasterAffiliate }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    try {
      const qrCanvas = document.getElementById(
        `affiliate-qr-${affiliate.id}`
      ) as HTMLCanvasElement | null;
      if (!qrCanvas) throw new Error("QR canvas not found");

      const width = 500;
      const height = 220;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // Background card
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      // QR on the left
      const qrSize = 180;
      const qrPad = 20;
      ctx.drawImage(qrCanvas, qrPad, (height - qrSize) / 2, qrSize, qrSize);

      // Text on the right
      const textX = qrPad + qrSize + 30;
      ctx.fillStyle = "#111827";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(affiliate.affiliate_name || "-", textX, height / 2 - 10);

      ctx.fillStyle = "#6b7280";
      ctx.font = "16px sans-serif";
      ctx.fillText(affiliate.affiliate_number || "-", textX, height / 2 + 20);

      ctx.fillStyle = "#2563eb";
      ctx.font = "600 14px sans-serif";
      ctx.fillText(affiliate.affiliate_code || "-", textX, height / 2 + 45);

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Affiliate_${(affiliate.affiliate_name || "unknown").replace(/\s+/g, "_")}_${affiliate.affiliate_code || ""}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download affiliate card:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
      <div className="flex-shrink-0">
        <QRCodeCanvas
          id={`affiliate-qr-${affiliate.id}`}
          value={affiliate.affiliate_code || ""}
          size={96}
          level="H"
          imageSettings={{
            // Logo asli 3544x1182px (rasio ~3:1, wordmark memanjang) — jangan
            // dipaksa jadi persegi (sebelumnya 22x22 bikin logo gepeng/rusak),
            // pertahankan rasio aslinya.
            src: "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png",
            height: 12,
            width: 36,
            excavate: true,
            crossOrigin: "anonymous",
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{affiliate.affiliate_name}</p>
        <p className="text-xs text-gray-500 truncate">{affiliate.affiliate_number}</p>
        <p className="text-xs font-medium text-primary truncate">{affiliate.affiliate_code}</p>
        <Button
          size="sm"
          variant="outline"
          icon={Download}
          className="mt-2"
          onClick={handleDownload}
          loading={downloading}
        >
          Download
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ── Tab 2: Order Affiliate (full CRUD) ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
interface OrderFormState {
  affiliate_code: string;
  store_name: string;
  sales_order: string;
  order_date: string;
  value_order: string;
  commission_rate: string;
  reedem_status: string;
  note: string;
}

const emptyOrderForm = (): OrderFormState => ({
  affiliate_code: "",
  store_name: "",
  sales_order: "",
  order_date: "",
  value_order: "",
  commission_rate: "7%",
  reedem_status: "Belum diproses",
  note: "",
});

function OrderAffiliateTab({
  orders,
  storeList,
  showMessage,
  refresh,
}: {
  orders: AffiliateOrder[];
  storeList: AffiliateStoreListItem[];
  showMessage: (m: string, t: "success" | "error") => void;
  refresh: () => Promise<void>;
}) {
  const { ref: searchRef, shortcutLabel } = useSearchShortcut();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selected, setSelected] = useState<AffiliateOrder | null>(null);
  const [form, setForm] = useState<OrderFormState>(emptyOrderForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AffiliateOrder | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        (o.affiliate_code || "").toLowerCase().includes(q) ||
        (o.store_name || "").toLowerCase().includes(q) ||
        (o.sales_order || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const openAdd = () => {
    setForm(emptyOrderForm());
    setShowAddModal(true);
  };

  const openEdit = (order: AffiliateOrder) => {
    setSelected(order);
    setForm({
      affiliate_code: order.affiliate_code || "",
      store_name: order.store_name || "",
      sales_order: order.sales_order || "",
      order_date: order.order_date || "",
      value_order: order.value_order || "",
      commission_rate: order.commission_rate || "7%",
      reedem_status: order.reedem_status || "Belum diproses",
      note: order.note || "",
    });
    setShowEditModal(true);
  };

  // Normalisasi tampilan/pengetikan sales_order — validasi final tetap di
  // server (lihat app/api/affiliate/orders/route.ts), ini cuma UX helper.
  const normalizeSalesOrderClient = (v: string) => {
    const trimmed = (v || "").trim();
    if (!trimmed) return trimmed;
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  };

  const validateForm = (): string | null => {
    if (!form.affiliate_code.trim()) return "Kode affiliate wajib diisi";
    if (!form.store_name) return "Store wajib dipilih";
    if (!form.sales_order.trim()) return "Sales order wajib diisi";
    if (!form.order_date) return "Tanggal order wajib diisi";
    if (!form.value_order) return "Value order wajib diisi";
    if (!form.commission_rate) return "Commission rate wajib dipilih";
    return null;
  };

  const handleCreate = async () => {
    const err = validateForm();
    if (err) {
      showMessage(err, "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/affiliate/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sales_order: normalizeSalesOrderClient(form.sales_order),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menambahkan order");
      showMessage("Order affiliate berhasil ditambahkan", "success");
      setShowAddModal(false);
      await refresh();
    } catch (e: any) {
      showMessage(e.message || "Gagal menambahkan order", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const err = validateForm();
    if (err) {
      showMessage(err, "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/affiliate/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid: selected.uuid,
          ...form,
          sales_order: normalizeSalesOrderClient(form.sales_order),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memperbarui order");
      showMessage("Order affiliate berhasil diperbarui", "success");
      setShowEditModal(false);
      setSelected(null);
      await refresh();
    } catch (e: any) {
      showMessage(e.message || "Gagal memperbarui order", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/affiliate/orders?uuid=${encodeURIComponent(deleteTarget.uuid)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      showMessage("Order affiliate berhasil dihapus", "success");
      setDeleteTarget(null);
      await refresh();
    } catch {
      showMessage("Gagal menghapus order", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderFormFields = () => (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500">Kode Affiliate</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.affiliate_code}
            onChange={(e) => setForm((p) => ({ ...p, affiliate_code: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Ketik atau scan kode affiliate"
          />
          <Button type="button" variant="outline" size="icon" icon={ScanLine} onClick={() => setShowScanner(true)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Store</label>
        <select
          value={form.store_name}
          onChange={(e) => setForm((p) => ({ ...p, store_name: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Pilih store...</option>
          {storeList.map((s) => (
            <option key={s.id} value={s.store_name}>
              {s.store_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-500">Sales Order</label>
        <input
          type="text"
          value={form.sales_order}
          onChange={(e) => setForm((p) => ({ ...p, sales_order: e.target.value }))}
          onBlur={(e) => setForm((p) => ({ ...p, sales_order: normalizeSalesOrderClient(e.target.value) }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="#SO-0001"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500">Tanggal Order</label>
        <input
          type="date"
          value={form.order_date}
          onChange={(e) => setForm((p) => ({ ...p, order_date: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500">Value Order (Rp)</label>
        <input
          type="number"
          value={form.value_order}
          onChange={(e) => setForm((p) => ({ ...p, value_order: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="0"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500">Commission Rate</label>
        <select
          value={form.commission_rate}
          onChange={(e) => setForm((p) => ({ ...p, commission_rate: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {COMMISSION_RATES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-500">Status Redeem</label>
        <select
          value={form.reedem_status}
          onChange={(e) => setForm((p) => ({ ...p, reedem_status: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {REEDEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-500">Catatan (opsional)</label>
        <textarea
          value={form.note}
          onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          rows={2}
        />
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button icon={Plus} onClick={openAdd}>
          Tambah Order
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
        <div className="relative max-w-sm">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode affiliate, store, atau sales order..."
            className="w-full px-2 py-1.5 pr-11 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <SearchShortcutHint label={shortcutLabel} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Kode Affiliate</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Store</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Sales Order</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Tanggal</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Value</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Komisi</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((o) => (
                <tr key={o.uuid} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{o.affiliate_code}</td>
                  <td className="px-3 py-2">{o.store_name}</td>
                  <td className="px-3 py-2">{o.sales_order}</td>
                  <td className="px-3 py-2">{o.order_date}</td>
                  <td className="px-3 py-2">{formatRupiah(o.value_order)}</td>
                  <td className="px-3 py-2">{o.commission_rate}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        o.reedem_status === "Sudah Redeem"
                          ? "bg-green-100 text-green-700"
                          : o.reedem_status === "Diproses"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {o.reedem_status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(o)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(o)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500">Tidak ada order affiliate</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t">
            <div className="text-xs text-gray-600">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} entries
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Tambah Order Affiliate</h2>
            {renderFormFields()}
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Batal</Button>
              <Button onClick={handleCreate} loading={saving}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selected && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Edit Order Affiliate</h2>
            {renderFormFields()}
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>Batal</Button>
              <Button onClick={handleSaveEdit} loading={saving}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <AffiliateScannerModal
          onScan={(code) => {
            setForm((p) => ({ ...p, affiliate_code: code }));
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Hapus Order Affiliate?"
        description="Tindakan ini tidak dapat dibatalkan."
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ── Tab 3: Report (aggregated per affiliate / per store) ──────────────────
// ─────────────────────────────────────────────────────────────────────────
function ReportTab({
  orders,
  affiliates,
}: {
  orders: AffiliateOrder[];
  affiliates: MasterAffiliate[];
}) {
  const [subTab, setSubTab] = useState<ReportSubTab>("affiliate");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter && o.reedem_status !== statusFilter) return false;
      if (startDate && o.order_date && o.order_date < startDate) return false;
      if (endDate && o.order_date && o.order_date > endDate) return false;
      return true;
    });
  }, [orders, startDate, endDate, statusFilter]);

  const affiliateNameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    affiliates.forEach((a) => {
      map[(a.affiliate_code || "").trim().toLowerCase()] = a.affiliate_name;
    });
    return map;
  }, [affiliates]);

  const perAffiliate = useMemo(() => {
    const groups: Record<string, { code: string; name: string; count: number; totalValue: number; totalCommission: number }> = {};
    filteredOrders.forEach((o) => {
      const code = o.affiliate_code || "-";
      const key = code.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          code,
          name: affiliateNameByCode[key] || "-",
          count: 0,
          totalValue: 0,
          totalCommission: 0,
        };
      }
      const value = parseValueOrder(o.value_order);
      const rate = parseCommissionRate(o.commission_rate);
      groups[key].count += 1;
      groups[key].totalValue += value;
      groups[key].totalCommission += (value * rate) / 100;
    });
    return Object.values(groups);
  }, [filteredOrders, affiliateNameByCode]);

  const perStore = useMemo(() => {
    const groups: Record<string, { store: string; count: number; totalValue: number; totalCommission: number }> = {};
    filteredOrders.forEach((o) => {
      const store = o.store_name || "-";
      if (!groups[store]) groups[store] = { store, count: 0, totalValue: 0, totalCommission: 0 };
      const value = parseValueOrder(o.value_order);
      const rate = parseCommissionRate(o.commission_rate);
      groups[store].count += 1;
      groups[store].totalValue += value;
      groups[store].totalCommission += (value * rate) / 100;
    });
    return Object.values(groups);
  }, [filteredOrders]);

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status Redeem</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
            >
              <option value="">Semua status</option>
              {REEDEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setSubTab("affiliate")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
            subTab === "affiliate" ? "bg-primary text-white" : "bg-white text-gray-600 border border-gray-200"
          }`}
        >
          Per Affiliate
        </button>
        <button
          onClick={() => setSubTab("store")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
            subTab === "store" ? "bg-primary text-white" : "bg-white text-gray-600 border border-gray-200"
          }`}
        >
          Per Store
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {subTab === "affiliate" ? (
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Kode Affiliate</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Nama</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Order</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Value</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Komisi</th>
                </tr>
              </thead>
              <tbody>
                {perAffiliate.map((row) => (
                  <tr key={row.code} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{row.code}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.count}</td>
                    <td className="px-3 py-2">{formatRupiah(row.totalValue)}</td>
                    <td className="px-3 py-2">{formatRupiah(row.totalCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Store</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Order</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Value</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Komisi</th>
                </tr>
              </thead>
              <tbody>
                {perStore.map((row) => (
                  <tr key={row.store} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{row.store}</td>
                    <td className="px-3 py-2">{row.count}</td>
                    <td className="px-3 py-2">{formatRupiah(row.totalValue)}</td>
                    <td className="px-3 py-2">{formatRupiah(row.totalCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(subTab === "affiliate" ? perAffiliate.length : perStore.length) === 0 && (
            <div className="p-8 text-center text-gray-500">Tidak ada data untuk filter ini</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ── Tab 4: Master (list + QR for url) ──────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
function MasterTab({ masterData }: { masterData: MasterAffiliateData[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [qrUuidByUrl, setQrUuidByUrl] = useState<Record<string, string>>({});

  // Supaya QR di tab ini ikut kebaca analitiknya di menu QR Code, tiap item
  // master_data dipetakan ke 1 baris di sheet qr_code (dicari by url, kalau
  // belum ada langsung dibuatkan sekali) — lalu QR-nya digenerate dari LINK
  // TRACKING (/r/<uuid>, lihat app/r/[uuid]/route.ts), bukan url aslinya
  // langsung, supaya tiap scan tercatat di menu QR Code > Analitik.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/qr-code");
        const existing: { uuid: string; url: string }[] = res.ok ? await res.json() : [];
        const map: Record<string, string> = {};
        existing.forEach((q) => {
          if (q.url) map[q.url] = q.uuid;
        });

        for (const d of masterData) {
          if (!d.url || map[d.url]) continue;
          try {
            const createRes = await fetch("/api/qr-code", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: `Master - ${d.data_name || d.url}`, url: d.url }),
            });
            const created = await createRes.json();
            if (createRes.ok && created.uuid) map[d.url] = created.uuid;
          } catch {
            // Biarkan — baris ini akan fallback ke QR url langsung (tidak tercatat).
          }
        }
        if (!cancelled) setQrUuidByUrl(map);
      } catch {
        // Gagal ambil/siapkan qr_code — QR tetap tampil, cuma tanpa tracking.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [masterData]);

  // Sama seperti AffiliateCard.handleDownload di atas — gambar ulang canvas
  // QR (yang sudah termasuk logo Torch) + nama/url ke canvas offscreen,
  // lalu didownload jadi 1 file PNG.
  const handleDownloadMasterQr = (d: MasterAffiliateData, key: string) => {
    setDownloadingKey(key);
    try {
      const qrCanvas = document.getElementById(`master-qr-${key}`) as HTMLCanvasElement | null;
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
      ctx.fillText(d.data_name || "-", width / 2, qrSize + 60);

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Master_${(d.data_name || "unknown").replace(/\s+/g, "_")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download master QR:", err);
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {masterData.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Tidak ada master data</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {masterData.map((d, i) => {
            const key = d.id || String(i);
            const isOpen = expanded === key;
            return (
              <li key={key}>
                <button
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-800">{d.data_name}</span>
                  <QrCode className="w-4 h-4 text-gray-400" />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 flex flex-col items-center gap-2">
                    <QRCodeCanvas
                      id={`master-qr-${key}`}
                      value={d.url ? trackingLink(qrUuidByUrl[d.url]) || d.url : ""}
                      size={140}
                      level="H"
                      imageSettings={{
                        src: "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png",
                        height: 16,
                        width: 48,
                        excavate: true,
                        crossOrigin: "anonymous",
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Download}
                      loading={downloadingKey === key}
                      onClick={() => handleDownloadMasterQr(d, key)}
                    >
                      Download
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
