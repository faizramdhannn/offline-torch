"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
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

export default function BundlingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<Bundling[]>([]);
  const [filteredData, setFilteredData] = useState<Bundling[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedBundling, setSelectedBundling] = useState<Bundling | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Form data
  const [formData, setFormData] = useState({
    bundling_name: "",
    option_1: "", option_2: "", option_3: "", option_4: "", option_5: "", option_6: "",
    discount_1: "0", discount_2: "0", discount_3: "0", discount_4: "0", discount_5: "0", discount_6: "0",
    total_value: "",
    discount_percentage: "",
    discount_value: "",
    value: "",
    status: "active",
  });

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.bundling) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
    fetchMasterItems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, data]);

  // Recalculate totals whenever options or discounts change
  useEffect(() => {
    recalculateTotals(formData);
  }, [
    formData.option_1, formData.option_2, formData.option_3,
    formData.option_4, formData.option_5, formData.option_6,
    formData.discount_1, formData.discount_2, formData.discount_3,
    formData.discount_4, formData.discount_5, formData.discount_6,
  ]);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const logActivity = async (method: string, activity: string) => {
    try {
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.user_name, method, activity_log: activity }),
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
    } catch (error) {
      console.error("Failed to fetch master items:", error);
    }
  };

  const getHPJ = (artikel: string): number => {
    if (!artikel) return 0;
    const item = masterItems.find((i) => i.Artikel === artikel);
    if (!item) return 0;
    // Format: "Rp269.000" — strip semua non-digit
    return parseInt(String(item.HPJ).replace(/[^0-9]/g, "") || "0");
  };

  /**
   * Recalculate total_value, discount_value, discount_percentage, value
   * based on selected options and their individual discounts.
   *
   * total_value   = sum of HPJ for each selected option
   * discount_value = sum of (HPJ * discount% / 100) per option
   * discount_percentage = (discount_value / total_value) * 100
   * value         = total_value - discount_value
   */
  const recalculateTotals = (fd: typeof formData) => {
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

    setFormData((prev) => ({
      ...prev,
      total_value: formatRupiah(totalHPJ.toString()),
      discount_value: formatRupiah(totalDiscount.toString()),
      discount_percentage: overallDiscPct.toFixed(2),
      value: formatRupiah(finalValue.toString()),
    }));
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

  const formatRupiah = (value: string) => {
    const number = parseInt(value.replace(/[^0-9]/g, "") || "0");
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
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
        total_value: bundling.total_value,
        discount_percentage: bundling.discount_percentage,
        discount_value: bundling.discount_value,
        value: bundling.value,
        status: bundling.status,
      });
    } else {
      setEditingId(null);
      setFormData({
        bundling_name: "",
        option_1: "", option_2: "", option_3: "", option_4: "", option_5: "", option_6: "",
        discount_1: "0", discount_2: "0", discount_3: "0", discount_4: "0", discount_5: "0", discount_6: "0",
        total_value: "",
        discount_percentage: "",
        discount_value: "",
        value: "",
        status: "active",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleViewStock = (bundling: Bundling) => {
    setSelectedBundling(bundling);
    setShowStockModal(true);
  };

  const handleOptionChange = (optionKey: string, value: string) => {
    const updated = { ...formData, [optionKey]: value };
    setFormData(updated);
    // recalculate will fire via useEffect
  };

  const handleDiscountOptionChange = (discountKey: string, value: string) => {
    const updated = { ...formData, [discountKey]: value };
    setFormData(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: any = { ...formData };
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
          editingId ? "Bundling updated successfully" : "Bundling created successfully",
          "success"
        );
        handleCloseModal();
        fetchData();
      } else {
        showMessage("Failed to save bundling", "error");
      }
    } catch (error) {
      showMessage("Failed to save bundling", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bundling?")) return;
    try {
      const response = await fetch(`/api/bundling?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        await logActivity("DELETE", `Deleted bundling ID: ${id}`);
        showMessage("Bundling deleted successfully", "success");
        fetchData();
      } else {
        showMessage("Failed to delete bundling", "error");
      }
    } catch (error) {
      showMessage("Failed to delete bundling", "error");
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
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-primary">Bundling Management</h1>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
            >
              Add Bundling
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or options..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter[0] || ""}
                  onChange={(e) => setStatusFilter(e.target.value ? [e.target.value] : [])}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <button
              onClick={resetFilters}
              className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
            >
              Reset Filters
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Bundling Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Options</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Value</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Discount</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Final Value</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Stock</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Actions</th>
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
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.bundling_name}</td>
                            <td className="px-3 py-2">
                              <div className="text-xs">
                                {options.slice(0, 2).join(", ")}
                                {options.length > 2 && ` +${options.length - 2} more`}
                              </div>
                            </td>
                            <td className="px-3 py-2">{item.total_value}</td>
                            <td className="px-3 py-2">
                              {item.discount_percentage}% ({item.discount_value})
                            </td>
                            <td className="px-3 py-2 font-semibold text-green-600">{item.value}</td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => handleViewStock(item)}
                                className="text-blue-600 hover:text-blue-800 font-semibold"
                              >
                                {totalStock} units
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  item.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleOpenModal(item)}
                                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredData.length === 0 && (
                    <div className="p-8 text-center text-gray-500">No bundling data available</div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirstItem + 1} to{" "}
                      {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (
                          page === 1 || page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 text-xs border rounded ${
                                currentPage === page ? "bg-primary text-white" : "hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="px-2">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">
              {editingId ? "Edit Bundling" : "Add New Bundling"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Bundling Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bundling Name*
                </label>
                <input
                  type="text"
                  value={formData.bundling_name}
                  onChange={(e) => setFormData({ ...formData, bundling_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Options 1–6 dengan layout 2 kolom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options (Item &amp; Diskon per Item)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {OPTION_KEYS.map(({ option, discount }, idx) => {
                    const selectedArtikel = formData[option as keyof typeof formData] as string;
                    const hpj = getHPJ(selectedArtikel);
                    const discPct = parseFloat((formData[discount as keyof typeof formData] as string) || "0");
                    const discVal = Math.round(hpj * (discPct / 100));
                    const afterDisc = hpj - discVal;

                    return (
                      <div key={option} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">Option {idx + 1}</p>

                        {/* Item dropdown */}
                        <SearchableSelect
                          options={masterItems.map((item) => ({
                            value: item.Artikel,
                            label: item.Artikel,
                          }))}
                          value={selectedArtikel}
                          onChange={(val) => handleOptionChange(option, val)}
                          placeholder="-- Pilih Item --"
                        />

                        {/* Diskon % */}
                        <div className="mt-1.5">
                          <input
                            type="number"
                            value={formData[discount as keyof typeof formData] as string}
                            onChange={(e) => handleDiscountOptionChange(discount, e.target.value)}
                            placeholder="Diskon %"
                            min="0"
                            max="100"
                            step="0.01"
                            disabled={!selectedArtikel}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-200 disabled:cursor-not-allowed"
                          />
                        </div>

                        {/* Info HPJ */}
                        {selectedArtikel && hpj > 0 && (
                          <div className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                            <div className="flex justify-between">
                              <span>HPJ</span>
                              <span className="font-medium text-gray-700">{formatRupiah(hpj.toString())}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Diskon</span>
                              <span className="text-red-500">-{formatRupiah(discVal.toString())}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-200 pt-0.5">
                              <span>Harga</span>
                              <span className="font-semibold text-green-600">{formatRupiah(afterDisc.toString())}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary: Total Value, Discount, Final Value */}
              <div className="border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Total HPJ</label>
                    <input
                      type="text"
                      value={formData.total_value}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Total Diskon (%)
                    </label>
                    <input
                      type="text"
                      value={formData.discount_percentage ? `${formData.discount_percentage}%` : "0%"}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Total Diskon (Rp)</label>
                    <input
                      type="text"
                      value={formData.discount_value}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white text-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Harga Final</label>
                    <input
                      type="text"
                      value={formData.value}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white font-semibold text-green-600"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status*</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingId ? "Update Bundling" : "Create Bundling"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Detail Modal */}
      {showStockModal && selectedBundling && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-lg font-bold text-primary mb-4">
              Stock Details - {selectedBundling.bundling_name}
            </h2>

            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {STORE_LIST.map((store) => {
                const stock = parseInt(
                  (selectedBundling[store.key as keyof Bundling] as string) || "0"
                );
                return (
                  <div key={store.key} className="flex justify-between items-center border-b border-gray-200 py-2">
                    <span className="text-sm text-gray-700">{store.label}</span>
                    <span className={`text-sm font-semibold ${stock > 0 ? "text-green-600" : "text-gray-400"}`}>
                      {stock} units
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Total Stock:</span>
                <span className="text-lg font-bold text-primary">
                  {getTotalStock(selectedBundling)} units
                </span>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowStockModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                Close
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