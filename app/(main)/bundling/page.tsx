"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import SearchableSelect from "@/components/SearchableSelect";
import { Bundling } from "@/types";

const STORE_LIST = [
  { key: "torch_cirebon", label: "Torch Cirebon" },
  { key: "torch_jogja", label: "Torch Jogja" },
  { key: "torch_karawaci", label: "Torch Karawaci" },
  { key: "torch_karawang", label: "Torch Karawang" },
  { key: "torch_lampung", label: "Torch Lampung" },
  { key: "torch_lembong", label: "Torch Lembong" },
  { key: "torch_makassar", label: "Torch Makassar" },
  { key: "torch_malang", label: "Torch Malang" },
  { key: "torch_margonda", label: "Torch Margonda" },
  { key: "torch_medan", label: "Torch Medan" },
  { key: "torch_pekalongan", label: "Torch Pekalongan" },
  { key: "torch_purwokerto", label: "Torch Purwokerto" },
  { key: "torch_surabaya", label: "Torch Surabaya" },
  { key: "torch_tambun", label: "Torch Tambun" },
];

const OPTION_KEYS = [
  { option: "option_1", discount: "discount_1" },
  { option: "option_2", discount: "discount_2" },
  { option: "option_3", discount: "discount_3" },
  { option: "option_4", discount: "discount_4" },
  { option: "option_5", discount: "discount_5" },
  { option: "option_6", discount: "discount_6" },
];

interface MasterItem {
  Artikel: string;
  HPJ: string;
}

function formatRupiah(value: string | number): string {
  const number = parseInt(String(value).replace(/[^0-9]/g, "") || "0");
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}

export default function BundlingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const userRef = useRef<any>(null);
  const [data, setData] = useState<Bundling[]>([]);
  const [filteredData, setFilteredData] = useState<Bundling[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const masterItemsRef = useRef<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedBundling, setSelectedBundling] = useState<Bundling | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [submitting, setSubmitting] = useState(false);
  useSessionGuard();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const emptyForm = {
    bundling_name: "",
    option_1: "", option_2: "", option_3: "", option_4: "", option_5: "", option_6: "",
    discount_1: "0", discount_2: "0", discount_3: "0", discount_4: "0", discount_5: "0", discount_6: "0",
    total_value: "0",
    discount_percentage: "0",
    discount_value: "0",
    value: "0",
    status: "active",
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.bundling) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    userRef.current = parsedUser;
    fetchData();
    fetchMasterItems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, data]);

  useEffect(() => {
    masterItemsRef.current = masterItems;
  }, [masterItems]);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const logActivity = async (method: string, activity: string) => {
    try {
      const currentUser = userRef.current;
      if (!currentUser) return;
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: currentUser.user_name, method, activity_log: activity }),
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  const fetchData = async () => {
    try {
      const response = await fetch("/api/bundling");
      const result = await response.json();
      const activeData = result.filter((b: Bundling) => b.status !== "deleted");
      setData(activeData);
      setFilteredData(activeData);
    } catch (error) {
      showMessage("Failed to fetch bundling data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterItems = async () => {
    try {
      const response = await fetch("/api/master-item");
      const result = await response.json();
      setMasterItems(result);
      masterItemsRef.current = result;
    } catch (error) {
      console.error("Failed to fetch master items:", error);
    }
  };

  const getHPJ = (artikel: string): number => {
    if (!artikel) return 0;
    const items = masterItemsRef.current;
    const item = items.find((i) => i.Artikel === artikel);
    if (!item) return 0;
    return parseInt(String(item.HPJ).replace(/[^0-9]/g, "") || "0");
  };

  const calcTotals = (fd: typeof formData) => {
    let totalHPJ = 0;
    let totalDiscount = 0;

    OPTION_KEYS.forEach(({ option, discount }) => {
      const artikel = fd[option as keyof typeof fd] as string;
      const discPct = parseFloat((fd[discount as keyof typeof fd] as string) || "0");
      const hpj = getHPJ(artikel);
      if (hpj > 0) {
        totalHPJ += hpj;
        totalDiscount += Math.round(hpj * (discPct / 100));
      }
    });

    const finalValue = totalHPJ - totalDiscount;
    const overallDiscPct = totalHPJ > 0 ? (totalDiscount / totalHPJ) * 100 : 0;

    return {
      total_value: String(totalHPJ),
      discount_value: String(totalDiscount),
      discount_percentage: overallDiscPct.toFixed(2),
      value: String(finalValue),
    };
  };

  const handleOptionChange = (optionKey: string, val: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [optionKey]: val };
      const totals = calcTotals(updated);
      return { ...updated, ...totals };
    });
  };

  const handleDiscountOptionChange = (discountKey: string, val: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [discountKey]: val };
      const totals = calcTotals(updated);
      return { ...updated, ...totals };
    });
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.bundling_name.toLowerCase().includes(query) ||
          item.option_1?.toLowerCase().includes(query) ||
          item.option_2?.toLowerCase().includes(query)
      );
    }
    if (statusFilter.length > 0) {
      filtered = filtered.filter((item) => statusFilter.includes(item.status));
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter([]);
    setFilteredData(data);
    setCurrentPage(1);
  };

  const handleOpenModal = (bundling?: Bundling) => {
    if (bundling) {
      setEditingId(bundling.id);
      setFormData({
        bundling_name: bundling.bundling_name,
        option_1: bundling.option_1 || "",
        option_2: bundling.option_2 || "",
        option_3: bundling.option_3 || "",
        option_4: bundling.option_4 || "",
        option_5: bundling.option_5 || "",
        option_6: bundling.option_6 || "",
        discount_1: bundling.discount_1 || "0",
        discount_2: bundling.discount_2 || "0",
        discount_3: bundling.discount_3 || "0",
        discount_4: bundling.discount_4 || "0",
        discount_5: bundling.discount_5 || "0",
        discount_6: bundling.discount_6 || "0",
        total_value: bundling.total_value || "0",
        discount_percentage: bundling.discount_percentage || "0",
        discount_value: bundling.discount_value || "0",
        value: bundling.value || "0",
        status: bundling.status,
      });
    } else {
      setEditingId(null);
      setFormData(emptyForm);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleViewStock = (bundling: Bundling) => {
    setSelectedBundling(bundling);
    setShowStockModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bundling_name.trim()) {
      showMessage("Bundling name wajib diisi", "error");
      return;
    }

    setSubmitting(true);
    try {
      const totals = calcTotals(formData);
      const payload: any = {
        ...formData,
        total_value: formatRupiah(totals.total_value),
        discount_value: formatRupiah(totals.discount_value),
        discount_percentage: totals.discount_percentage,
        value: formatRupiah(totals.value),
      };
      if (editingId) payload.id = editingId;

      const method = editingId ? "PUT" : "POST";

      const response = await fetch("/api/bundling", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const action = editingId ? "Updated" : "Created";
        await logActivity(method, `${action} bundling: ${formData.bundling_name}`);
        showMessage(
          editingId ? "Bundling berhasil diperbarui" : "Bundling berhasil dibuat",
          "success"
        );
        handleCloseModal();
        fetchData();
      } else {
        const err = await response.json().catch(() => ({}));
        showMessage(err.error || "Gagal menyimpan bundling", "error");
      }
    } catch (error) {
      showMessage("Gagal menyimpan bundling", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus bundling ini?")) return;
    try {
      const response = await fetch(`/api/bundling?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        await logActivity("DELETE", `Deleted bundling ID: ${id}`);
        showMessage("Bundling berhasil dihapus", "success");
        fetchData();
      } else {
        showMessage("Gagal menghapus bundling", "error");
      }
    } catch (error) {
      showMessage("Gagal menghapus bundling", "error");
    }
  };

  const getTotalStock = (bundling: Bundling) => {
    return STORE_LIST.reduce((total, store) => {
      const stock = parseInt((bundling[store.key as keyof Bundling] as string) || "0");
      return total + stock;
    }, 0);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-primary">Bundling Management</h1>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Bundling
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama bundling atau item..."
              className="pl-6 pr-2 py-1 border border-gray-300 rounded text-[11px] w-64 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter[0] || ""}
            onChange={(e) => setStatusFilter(e.target.value ? [e.target.value] : [])}
            className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary bg-white"
          >
            <option value="">Semua Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(searchQuery || statusFilter.length > 0) && (
            <>
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 border border-gray-200 rounded text-[11px] hover:bg-gray-200"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reset
              </button>
              <span className="text-[10px] text-gray-400">{filteredData.length} hasil</span>
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
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Bundling Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Options</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Total HPJ</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Diskon</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Harga Final</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Stock</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Status</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((item, index) => {
                      const options = [
                        item.option_1, item.option_2, item.option_3,
                        item.option_4, item.option_5, item.option_6,
                      ].filter(Boolean);
                      const totalStock = getTotalStock(item);

                      return (
                        <tr key={item.id || index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 font-medium text-gray-800">{item.bundling_name}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {options.slice(0, 2).join(", ")}
                            {options.length > 2 && (
                              <span className="ml-1 text-[10px] text-primary font-medium">+{options.length - 2} lagi</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{item.total_value}</td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-red-500">{item.discount_percentage}%</span>
                            <span className="text-gray-400 ml-1">({item.discount_value})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600">{item.value}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleViewStock(item)}
                              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                            >
                              {totalStock} unit
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                            }`}>
                              {item.status === "active" ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenModal(item)}
                                className="px-2.5 py-1 bg-blue-500 text-white rounded text-[10px] font-medium hover:bg-blue-600 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-2.5 py-1 bg-red-500 text-white rounded text-[10px] font-medium hover:bg-red-600 transition-colors"
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
                {filteredData.length === 0 && (
                  <div className="p-8 text-center text-sm text-gray-500">
                    {searchQuery || statusFilter.length > 0 ? "Tidak ada hasil yang sesuai" : "Belum ada data bundling"}
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center px-4 py-2.5 border-t">
                  <span className="text-[11px] text-gray-400">
                    {indexOfFirstItem + 1}&#x2013;{Math.min(indexOfLastItem, filteredData.length)} dari {filteredData.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 text-[11px] border rounded disabled:opacity-40 hover:bg-gray-50"
                    >
                      Prev
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button key={page} onClick={() => setCurrentPage(page)}
                            className={`px-2.5 py-1 text-[11px] border rounded ${currentPage === page ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}>
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-1 text-[11px] text-gray-400 self-center">&#x2026;</span>;
                      }
                      return null;
                    })}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 text-[11px] border rounded disabled:opacity-40 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {editingId ? "Edit Bundling" : "Bundling Baru"}
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {editingId ? "Perbarui data bundling" : "Tambah bundling baru ke master"}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={submitting}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form id="bundling-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Bundling Name */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nama Bundling <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bundling_name}
                  onChange={(e) => setFormData({ ...formData, bundling_name: e.target.value })}
                  placeholder="Contoh: Paket Starter Pack"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  required
                />
              </div>

              <div className="border-t border-dashed border-gray-200" />

              {/* Options */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Item &amp; Diskon per Item
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {OPTION_KEYS.map(({ option, discount }, idx) => {
                    const selectedArtikel = formData[option as keyof typeof formData] as string;
                    const hpj = getHPJ(selectedArtikel);
                    const discPct = parseFloat((formData[discount as keyof typeof formData] as string) || "0");
                    const discVal = Math.round(hpj * (discPct / 100));
                    const afterDisc = hpj - discVal;

                    return (
                      <div key={option} className="border border-gray-200 rounded-xl p-3 bg-gray-50/60">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                          Option {idx + 1}
                        </p>

                        <SearchableSelect
  options={Array.from(
    new Map(
      masterItems
        .filter((item) => item.Artikel != null && item.Artikel !== "")
        .map((item) => [item.Artikel, { value: item.Artikel, label: item.Artikel }])
    ).values()
  )}
  value={selectedArtikel}
  onChange={(val) => handleOptionChange(option, val)}
  placeholder="-- Pilih Item --"
/>

                        <div className="mt-2">
                          <input
                            type="number"
                            value={formData[discount as keyof typeof formData] as string}
                            onChange={(e) => handleDiscountOptionChange(discount, e.target.value)}
                            placeholder="Diskon %"
                            min="0"
                            max="100"
                            step="0.01"
                            disabled={!selectedArtikel}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>

                        {selectedArtikel && hpj > 0 && (
                          <div className="mt-2 text-[10px] text-gray-500 space-y-0.5 bg-white rounded-lg px-2.5 py-2 border border-gray-100">
                            <div className="flex justify-between">
                              <span>HPJ</span>
                              <span className="font-semibold text-gray-700">{formatRupiah(hpj)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Diskon</span>
                              <span className="text-red-500">-{formatRupiah(discVal)}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-100 pt-0.5 mt-0.5">
                              <span className="font-semibold">Harga</span>
                              <span className="font-bold text-green-600">{formatRupiah(afterDisc)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-dashed border-gray-200" />

              {/* Summary */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Ringkasan Harga
                </label>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Total HPJ</p>
                    <p className="text-sm font-semibold text-gray-800">{formatRupiah(formData.total_value)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Total Diskon (%)</p>
                    <p className="text-sm font-semibold text-red-500">
                      {formData.discount_percentage ? `${parseFloat(formData.discount_percentage).toFixed(1)}%` : "0%"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Total Diskon (Rp)</p>
                    <p className="text-sm font-semibold text-red-500">-{formatRupiah(formData.discount_value)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Harga Final</p>
                    <p className="text-base font-bold text-green-600">{formatRupiah(formData.value)}</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-gray-50"
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="bundling-form"
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Menyimpan..." : editingId ? "Update Bundling" : "Simpan Bundling"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Detail Modal */}
      {showStockModal && selectedBundling && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Stock per Toko</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{selectedBundling.bundling_name}</p>
              </div>
              <button
                onClick={() => setShowStockModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 max-h-80 overflow-y-auto space-y-1">
              {STORE_LIST.map((store) => {
                const stock = parseInt(
                  (selectedBundling[store.key as keyof Bundling] as string) || "0"
                );
                return (
                  <div key={store.key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-700">{store.label}</span>
                    <span className={`text-xs font-semibold ${stock > 0 ? "text-green-600" : "text-gray-300"}`}>
                      {stock} unit
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Stock</p>
                <p className="text-xl font-bold text-primary">{getTotalStock(selectedBundling)} unit</p>
              </div>
              <button
                onClick={() => setShowStockModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup
        show={showPopup}
        message={popupMessage}
        type={popupType}
        onClose={() => setShowPopup(false)}
      />
    </div>
  );
}