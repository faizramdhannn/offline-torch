"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, MessageCircle, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/shared/Button";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import Popup from "@/components/Popup";
import { BulkFormModal } from "@/components/bulk/BulkFormModal";
import { ItemsPopover } from "@/components/bulk/ItemsPopover";
import { BulkReport } from "@/components/bulk/BulkReport";
import { BulkFilterBar } from "@/components/bulk/BulkFilterBar";
import { bulkRawRows, bulkRecapRows } from "@/lib/bulkExport";
import { applyBulkFilters, bulkFilterOptions, emptyBulkFilters } from "@/lib/bulkFilter";
import { buildBulkWaMessage, bulkWaLink, groupBulkRows, isBulkBought, summarizeGroup, type BulkGroup, type BulkMaster, type BulkRow } from "@/lib/bulkOrder";
import { normStore } from "@/lib/shipmentVisibility";
import { parsePrice } from "@/lib/bulkOrder";
import { thClass, tdClass } from "@/components/shared/tableStyles";

const PAGE_SIZE = 25;
const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const EMPTY_MASTER: BulkMaster = { items: [], reasonBuy: [], reasonNotBuy: [] };

function Reason({ g }: { g: BulkGroup }) {
  return g.reason_buy ? (
    <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700" title="Reason buy">{g.reason_buy}</span>
  ) : g.reason_not_buy ? (
    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title="Reason not buy">{g.reason_not_buy}</span>
  ) : (
    <span className="text-gray-300">—</span>
  );
}

export default function BulkPage() {
  const router = useRouter();
  useSessionGuard();
  const [user, setUser] = useState<any>(null);
  const [master, setMaster] = useState<BulkMaster>(EMPTY_MASTER);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [storePhones, setStorePhones] = useState<Record<string, string>>({}); // nama toko (dinormalkan) → nomor WA toko
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filters, setFilters] = useState(() => emptyBulkFilters());
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"data" | "report">("data"); // tab Report hanya untuk Bulk All
  const [exporting, setExporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BulkGroup | null>(null);
  const [popup, setPopup] = useState({ show: false, message: "", type: "success" as "success" | "error" });

  const isAdmin = !!user?.bulk_order_all;
  const notify = (message: string, type: "success" | "error" = "success") => setPopup({ show: true, message, type });

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    const u = JSON.parse(raw);
    if (!u.bulk_order && !u.bulk_order_all) { router.push("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const loadRows = async (all = showAll) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bulk/orders${all ? "?all=1" : ""}`);
      const d = await res.json();
      setRows(res.ok && Array.isArray(d) ? d : []);
      if (!res.ok) notify(d?.error || "Gagal memuat data", "error");
    } catch {
      notify("Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetch("/api/bulk/master").then((r) => (r.ok ? r.json() : EMPTY_MASTER)).then((m) => setMaster(m?.items ? m : EMPTY_MASTER)).catch(() => {});
    {
      fetch("/api/store-directory").then((r) => (r.ok ? r.json() : [])).then((d) => {
        const list = Array.isArray(d) ? d : [];
        if (user.bulk_order_all) setStores(list.map((s: any) => s.store_location).filter(Boolean)); // daftar toko di form hanya untuk admin
        setStorePhones(Object.fromEntries(list.filter((s: any) => s.store_location && s.phone_number).map((s: any) => [normStore(s.store_location), s.phone_number])));
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => { if (user) loadRows(showAll); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, showAll]);

  const groups = useMemo(() => groupBulkRows(rows), [rows]);
  const filterOptions = useMemo(() => bulkFilterOptions(groups), [groups]);
  const filtered = useMemo(() => applyBulkFilters(groups, filters), [groups, filters]);

  useEffect(() => { setPage(1); }, [filters, showAll]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageGroups = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const sum = useMemo(() => filtered.reduce((a, g) => ({ qty: a.qty + g.total_qty, value: a.value + g.total_value, net: a.net + g.total_net }), { qty: 0, value: 0, net: 0 }), [filtered]);

  // Kirim WA ke nomor toko: membuka WhatsApp dengan pesan format grup bulk sudah terisi (admin tinggal menekan kirim).
  const sendWa = (g: BulkGroup) => {
    const link = bulkWaLink(storePhones[normStore(g.source_store)], buildBulkWaMessage(g));
    if (!link) { notify(`Nomor WA ${g.source_store} belum ada di profil akunnya`, "error"); return; }
    window.open(link, "_blank", "noopener,noreferrer");
  };
  // Export XLSX mengikuti filter di layar. Rekap "berapa kali bulk" butuh seluruh riwayat, jadi bila baru 120 hari yang
  // dimuat, riwayat lengkap diambil dulu (satu panggilan) lalu filter yang sama diterapkan.
  const exportXlsx = async () => {
    setExporting(true);
    try {
      let src = groups;
      if (!showAll) {
        const res = await fetch("/api/bulk/orders?all=1");
        const d = await res.json();
        if (!res.ok || !Array.isArray(d)) { notify(d?.error || "Gagal memuat riwayat untuk export", "error"); return; }
        src = groupBulkRows(d);
      }
      const data = applyBulkFilters(src, filters);
      if (data.length === 0) { notify("Tidak ada data yang cocok dengan filter", "error"); return; }
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const sheet = (rows: Record<string, any>[], name: string, widths: number[]) => {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = widths.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(wb, ws, name);
      };
      sheet(bulkRawRows(data), "Data Mentah", [38, 18, 16, 28, 16, 8, 12, 12, 20, 18, 16, 16, 16, 12, 24, 22, 14, 22, 14]);
      sheet(bulkRecapRows(data), "Rekap Customer", [24, 16, 22, 12, 10, 44, 10, 10, 12, 14, 14, 14, 14]);
      XLSX.writeFile(wb, `bulk_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      notify(`Export selesai: ${data.length} input`);
    } catch {
      notify("Gagal export data", "error");
    } finally {
      setExporting(false);
    }
  };
  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (g: BulkGroup) => { setEditing(g); setFormOpen(true); };
  const del = async (g: BulkGroup) => {
    if (!window.confirm(`Hapus input Bulk milik ${g.customer_name} (${g.rows.length} item)? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await fetch(`/api/bulk/orders?id=${encodeURIComponent(g.id)}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { notify("Data Bulk dihapus"); loadRows(); } else notify(j.error || "Gagal menghapus", "error");
  };

  if (!user) return null;


  return (
    <div className="flex-1 overflow-auto page-bg">
      <div className="space-y-3 p-4">
        <SectionHeader
          icon={Package}
          title="Bulk"
          description={isAdmin ? "Order bulk semua toko" : "Order bulk toko Anda"}
          actions={
            <>
              {isAdmin && (
                <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                  {(["data", "report"] as const).map((v) => (
                    <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${view === v ? "bg-primary text-white shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}>{v === "data" ? "Data" : "Report"}</button>
                  ))}
                </div>
              )}
              <Button icon={Download} variant="secondary" onClick={exportXlsx} disabled={exporting || loading}>{exporting ? "Mengexport…" : "Export"}</Button>
              <Button icon={Plus} onClick={openAdd}>Tambah Bulk</Button>
            </>
          }
        />

        {isAdmin && view === "report" ? (
          loading ? <p className="py-16 text-center text-xs text-gray-400">Memuat…</p> : <BulkReport groups={groups} showAll={showAll} onShowAll={setShowAll} />
        ) : (<>
        <BulkFilterBar
          filters={filters}
          onChange={setFilters}
          options={filterOptions}
          isAdmin={isAdmin}
          extra={
            <>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-600" title="Secara bawaan hanya 120 hari terakhir yang dimuat">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Semua riwayat
              </label>
              <span className="ml-auto text-[11px] text-gray-500">{filtered.length} input · {sum.qty.toLocaleString("id-ID")} pcs · gross {rupiah(sum.value)} · net <b className="text-gray-700">{rupiah(sum.net)}</b></span>
            </>
          }
        />

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <p className="py-16 text-center text-xs text-gray-400">Memuat…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Package} title="Belum ada data Bulk" description={rows.length ? "Tidak ada yang cocok dengan filter." : "Klik Tambah Bulk untuk memulai."} />
          ) : (
            <>
              {/* Desktop: tabel rapat, SATU baris per input (item digabung: kode ";", "n x nama", "n x kategori") */}
              <div className="hidden overflow-x-auto md:block">
                <table data-stack="off" className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Tanggal", "Toko", "Customer", "Institusi", "No. HP", "Item Code", "Item Name", "Kategori", "Qty", "Harga", "Net", "Reason Buy", "Reason Not Buy", "SO", "Note", "Aksi"].map((h) => (
                        <th key={h} className={`${thClass} ${h === "Qty" || h === "Harga" || h === "Net" ? "text-right" : h === "Aksi" ? "text-center" : ""}`} title={h === "Harga" ? "Gross: jumlah × harga normal tiap item" : h === "Net" ? "Net: jumlah × harga setelah diskon" : undefined}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageGroups.map((g) => {
                      const s = summarizeGroup(g);
                      const cell = (text: string, w: string, extra = "") => (
                        <td className={`${tdClass} ${w} truncate ${extra}`} title={text}>{text || <span className="text-gray-300">—</span>}</td>
                      );
                      return (
                        <tr key={g.id} className="hover:bg-gray-50/70">
                          <td className={`${tdClass} whitespace-nowrap text-gray-500`}>{g.created_at || "-"}</td>
                          {cell(g.source_store, "max-w-[110px]")}
                          {cell(g.customer_name, "max-w-[120px]", "font-medium text-gray-900")}
                          {cell(g.customer_institution, "max-w-[110px]")}
                          <td className={`${tdClass} whitespace-nowrap`}>{g.customer_phone_number}</td>
                          {cell(s.codes, "max-w-[140px]")}
                          <td className={`${tdClass} whitespace-nowrap`}>
                            <ItemsPopover label={`${s.products.length} product`} title="Item" lines={s.products.map((p) => ({ primary: `${p.qty} x ${p.name}`, secondary: p.code }))} />
                          </td>
                          <td className={`${tdClass} whitespace-nowrap`}>
                            <ItemsPopover label={`${s.categoryList.length} category`} title="Kategori" lines={s.categoryList.map((c) => ({ primary: `${c.qty} x ${c.category}` }))} />
                          </td>
                          <td className={`${tdClass} whitespace-nowrap text-right font-semibold`}>{s.qty}</td>
                          <td className={`${tdClass} whitespace-nowrap text-right`}>{rupiah(s.value)}</td>
                          <td className={`${tdClass} whitespace-nowrap text-right font-semibold ${s.net < s.value ? "text-emerald-700" : ""}`}>{rupiah(s.net)}</td>
                          <td className={`${tdClass} max-w-[110px] truncate`} title={g.reason_buy}>{g.reason_buy ? <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">{g.reason_buy}</span> : <span className="text-gray-300">—</span>}</td>
                          <td className={`${tdClass} max-w-[110px] truncate`} title={g.reason_not_buy}>{g.reason_not_buy ? <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{g.reason_not_buy}</span> : <span className="text-gray-300">—</span>}</td>
                          {cell(g.sales_order, "max-w-[90px]", "whitespace-nowrap")}
                          {cell(g.note, "max-w-[140px]")}
                          {(
                            <td className={`${tdClass} whitespace-nowrap text-center`}>
                              {isBulkBought(g) && <button onClick={() => sendWa(g)} title={`Kirim WA ke ${g.source_store}`} aria-label="Kirim WA ke toko" className="rounded p-1 text-gray-500 hover:bg-green-50 hover:text-green-600"><MessageCircle className="h-3.5 w-3.5" /></button>}
                              <button onClick={() => openEdit(g)} title="Edit" aria-label="Edit" className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => del(g)} title="Hapus" aria-label="Hapus" className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* HP: kartu per input */}
              <div className="divide-y divide-gray-100 md:hidden">
                {pageGroups.map((g) => (
                  <div key={g.id} className="space-y-1.5 p-3 text-[11px]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-900">{g.customer_name}{g.customer_institution && <span className="font-normal text-gray-400"> · {g.customer_institution}</span>}</p>
                        <p className="text-gray-500">{g.customer_phone_number} · {g.source_store}</p>
                        <p className="text-[10px] text-gray-400">{g.created_at}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Reason g={g} />
                        {(
                          <>
                            {isBulkBought(g) && <button onClick={() => sendWa(g)} aria-label="Kirim WA ke toko" className="rounded p-1.5 text-gray-500 hover:bg-green-50 hover:text-green-600"><MessageCircle className="h-4 w-4" /></button>}
                            <button onClick={() => openEdit(g)} aria-label="Edit" className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => del(g)} aria-label="Hapus" className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-0.5 rounded-lg bg-gray-50 p-2">
                      {g.rows.map((r, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate"><b className="text-gray-700">{r.item_code}</b> {r.item_name}</span>
                          <span className="shrink-0 text-gray-600">{r.item_qty} × {rupiah(parsePrice(r.item_net || r.item_price))}</span>
                        </li>
                      ))}
                    </ul>
                    {(g.sales_order || g.note) && <p className="text-gray-500">{g.sales_order && <>SO <b className="text-gray-700">{g.sales_order}</b></>}{g.sales_order && g.note && " · "}{g.note}</p>}
                  </div>
                ))}
              </div>

              <Pagination currentPage={page} totalPages={pageCount} onPageChange={setPage} rangeLabel={`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} dari ${filtered.length} input`} />
            </>
          )}
        </div>
        </>)}
      </div>

      <BulkFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        master={master}
        isAdmin={isAdmin}
        defaultStore={user.name || user.user_name || ""}
        stores={stores}
        editing={editing}
        onSaved={(m) => { setFormOpen(false); notify(m); loadRows(); }}
      />
      <Popup show={popup.show} message={popup.message} type={popup.type} onClose={() => setPopup((p) => ({ ...p, show: false }))} />
    </div>
  );
}
