"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Popup from "@/components/Popup";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { SearchShortcutHint } from "@/components/shared/SearchShortcutHint";
import { Customer, CustomerBadge } from "@/types";
import { Button } from "@/components/shared/Button";
import { BadgeManagerModal } from "@/components/customer/BadgeManagerModal";
import { ImportCsvModal } from "@/components/customer/ImportCsvModal";
import { FollowupMessageModal } from "@/components/customer/FollowupMessageModal";
import { ExportModal } from "@/components/customer/ExportModal";
import { CopyButton } from "@/components/request-tracking/DomainBadges";
import { CheckCircle2, Circle, MessageCircle, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { idbGet, idbSet, isCacheFresh } from "@/lib/idbCache";
import * as XLSX from "xlsx";

function formatRupiah(v: number) {
  return "Rp" + Math.round(v).toLocaleString("id-ID");
}

// Cache di IndexedDB (bukan localStorage — respons customer bisa puluhan MB
// untuk ribuan customer, gampang kena batas quota localStorage yang cuma
// ~5-10MB) supaya bertahan lintas refresh/tab/browser baru, tidak cuma
// selama tab masih terbuka. TTL 1 hari; setelah itu (atau saat Import CSV /
// ubah Badge / edit Followup) cache di-refresh.
const CUSTOMER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 hari

const RESULT_OPTIONS = [
  "Terkirim",
  "Tidak ada Respon",
  "Merespon Membeli",
  "Merespon Tidak Membeli",
];

export default function CustomerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  // Data hasil server SUDAH terpaginasi/terfilter (bukan seluruh dataset) —
  // dulu endpoint ini bisa balikin puluhan MB / puluhan ribu baris sekaligus
  // (18 detik, 16MB untuk ~36rb customer), yang bikin loading macet/timeout
  // di koneksi lambat. Sekarang server cuma kirim 1 halaman (default 25).
  const [items, setItems] = useState<Customer[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<
    { key: string; count: number; totalOrder: number; totalQty: number; totalValue: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  useSessionGuard();

  const [followupChecked, setFollowupChecked] = useState(false);
  const [followupResult, setFollowupResult] = useState("");
  const [followupKet, setFollowupKet] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBadgeManager, setShowBadgeManager] = useState(false);
  const [waModalCustomer, setWaModalCustomer] = useState<Customer | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [badgeMap, setBadgeMap] = useState<Record<string, CustomerBadge>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter state dipulihkan dari URL query params (bukan default kosong) —
  // jadi kalau user buka detail customer lalu klik Back, filter yang tadi
  // aktif tidak hilang (dan link-nya sendiri bisa di-share/bookmark dengan
  // filter tertentu, ala ERP).
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const { ref: searchRef, shortcutLabel } = useSearchShortcut();
  const [selectedStores, setSelectedStores] = useState<string[]>(
    searchParams.get("stores")?.split(",").filter(Boolean) ?? [],
  );
  const [stores, setStores] = useState<string[]>([]);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [selectedBadges, setSelectedBadges] = useState<string[]>(
    searchParams.get("badges")?.split(",").filter(Boolean) ?? [],
  );
  const [showBadgeDropdown, setShowBadgeDropdown] = useState(false);
  const [valueMin, setValueMin] = useState(searchParams.get("vmin") ?? "");
  const [valueMax, setValueMax] = useState(searchParams.get("vmax") ?? "");
  const [orderMin, setOrderMin] = useState(searchParams.get("omin") ?? "");
  const [orderMax, setOrderMax] = useState(searchParams.get("omax") ?? "");
  const badgeDropdownRef = useRef<HTMLDivElement>(null);

  // Search di-debounce 400ms sebelum ikut memicu fetch ke server — supaya
  // tidak fetch di setiap ketikan huruf.
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Sort sekarang dikerjakan di server (bukan client-side atas seluruh
  // dataset) — klik header cuma toggle state ini, lalu memicu fetch ulang.
  const [sortKey, setSortKey] = useState("total_value_num");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (key: string) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Ganti filter/sort → balik ke halaman 1 (bukan currentPage sendiri, biar
  // tidak jadi infinite loop).
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, selectedStores, selectedBadges, valueMin, valueMax, orderMin, orderMax, sortKey, sortDir]);

  // Ref for dropdown to detect click outside
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        storeDropdownRef.current &&
        !storeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowStoreDropdown(false);
      }
      if (
        badgeDropdownRef.current &&
        !badgeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowBadgeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.customer) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    fetchBadgeMap();
  }, []);

  // Fetch ulang ke server tiap kali user, filter, sort, atau halaman berubah
  // — server yang mengerjakan filter/sort/pagination sekarang, bukan browser
  // menyaring array besar yang sudah di-download semua.
  useEffect(() => {
    if (!user) return;
    fetchData(user.user_name, !!user.user_setting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, debouncedQuery, selectedStores, selectedBadges, valueMin, valueMax, orderMin, orderMax, sortKey, sortDir, currentPage]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedStores.length > 0) params.set("stores", selectedStores.join(","));
    if (selectedBadges.length > 0) params.set("badges", selectedBadges.join(","));
    if (valueMin) params.set("vmin", valueMin);
    if (valueMax) params.set("vmax", valueMax);
    if (orderMin) params.set("omin", orderMin);
    if (orderMax) params.set("omax", orderMax);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchQuery, selectedStores, selectedBadges, valueMin, valueMax, orderMin, orderMax, pathname, router]);

  const fetchBadgeMap = async () => {
    try {
      const response = await fetch("/api/customer/badges");
      const result = await response.json();
      const map: Record<string, CustomerBadge> = {};
      (result.data || []).forEach((b: any) => {
        map[b.badge_key] = { key: b.badge_key, label: b.label, type: b.badge_type, logo_url: b.logo_url || "" };
      });
      setBadgeMap(map);
    } catch (error) {
      console.error("Failed to fetch badge map:", error);
    }
  };

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const logActivity = async (method: string, activity: string, entityId?: string) => {
    try {
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: user.user_name,
          method,
          activity_log: activity,
          entity_type: "customer",
          entity_id: entityId || "",
        }),
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  const applyFetchResult = (result: any) => {
    setIsOwner(result.isOwner);
    setStoreName(result.storeName || "");
    setItems(result.data || []);
    setTotalItems(result.total || 0);
    setStats(result.stats || []);
    setStores(result.stores || []);
  };

  const buildListQuery = (username: string, fullAccess?: boolean) => {
    const params = new URLSearchParams();
    params.set("username", username);
    params.set("view", "list");
    if (fullAccess) params.set("fullAccess", "true");
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (selectedStores.length > 0) params.set("stores", selectedStores.join(","));
    if (selectedBadges.length > 0) params.set("badges", selectedBadges.join(","));
    if (valueMin) params.set("vmin", valueMin);
    if (valueMax) params.set("vmax", valueMax);
    if (orderMin) params.set("omin", orderMin);
    if (orderMax) params.set("omax", orderMax);
    params.set("sortKey", sortKey);
    params.set("sortDir", sortDir);
    params.set("page", String(currentPage));
    params.set("limit", String(itemsPerPage));
    return params.toString();
  };

  const fetchFromServerAndCache = async (qs: string, cacheKey: string, silent: boolean) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(`/api/customer?${qs}`);
      const result = await response.json();

      applyFetchResult(result);
      await idbSet(cacheKey, result);
    } catch (error) {
      if (!silent) showMessage("Failed to fetch customer data", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchData = async (username: string, fullAccess?: boolean, forceRefresh?: boolean) => {
    const qs = buildListQuery(username, fullAccess);
    const cacheKey = `customer_list:${qs}`;

    if (!forceRefresh) {
      const cached = await idbGet<any>(cacheKey);
      if (isCacheFresh(cached, CUSTOMER_CACHE_TTL_MS)) {
        applyFetchResult(cached!.value);
        setLoading(false);
        // Stale-while-revalidate: diam-diam refresh di belakang layar tanpa
        // memicu spinner, supaya data tetap segar tanpa bikin user nunggu.
        fetchFromServerAndCache(qs, cacheKey, true);
        return;
      }
    }

    await fetchFromServerAndCache(qs, cacheKey, false);
  };

  const handleImportShopifyCsv = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/customer/import", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.error || "Gagal import data", "error");
        return;
      }

      showMessage(
        `Import selesai — ${result.total_orders_found} order dibaca (${result.inserted} baru, ${result.updated} diperbarui)`,
        "success",
      );
      setShowImportModal(false);
      await fetchData(user.user_name, !!user.user_setting, true);
    } catch (error) {
      showMessage("Gagal import data", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (from: string, to: string) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/customer/export?${params}`);
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.error || "Gagal export data", "error");
        return;
      }

      if (!result.data || result.data.length === 0) {
        showMessage("Tidak ada data untuk rentang tanggal ini", "error");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(result.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Order Customer");
      const suffix = from || to ? `_${from || "awal"}_${to || "akhir"}` : "";
      XLSX.writeFile(wb, `customer_order_export${suffix}.xlsx`);

      setShowExportModal(false);
      await logActivity("GET", "Exported customer order data");
    } catch (error) {
      showMessage("Gagal export data", "error");
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedStores([]);
    setSelectedBadges([]);
    setValueMin("");
    setValueMax("");
    setOrderMin("");
    setOrderMax("");
    setCurrentPage(1);
  };

  const toggleStore = (store: string) => {
    setSelectedStores((prev) =>
      prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store],
    );
  };

  const toggleBadge = (badgeKey: string) => {
    setSelectedBadges((prev) =>
      prev.includes(badgeKey) ? prev.filter((b) => b !== badgeKey) : [...prev, badgeKey],
    );
  };

  const copyToClipboard = (text: string, id?: string) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const openFollowupModal = (customer: Customer, rowIndex: number) => {
    setSelectedCustomer(customer);
    setSelectedRowIndex(rowIndex);
    setFollowupChecked(
      customer.followup === "TRUE" ||
        customer.followup === "True" ||
        customer.followup === "true",
    );
    setFollowupResult(customer.result || "");
    setFollowupKet(customer.ket || "");
    setSelectedFile(null);
    setShowFollowupModal(true);
  };

  const closeFollowupModal = () => {
    setShowFollowupModal(false);
    setSelectedCustomer(null);
    setSelectedRowIndex(null);
    setFollowupChecked(false);
    setFollowupResult("");
    setFollowupKet("");
    setSelectedFile(null);
  };

  const handleFollowupSubmit = async () => {
    if (!selectedCustomer || selectedRowIndex === null) return;

    setUploading(true);

    try {
      const formData = new FormData();
      // Selalu pakai store toko asli baris customer ini (bukan storeName
      // login) — penting untuk staff dengan akses lintas-toko (mis. Margonda
      // yang juga bisa lihat Karawaci) supaya followup tersimpan di toko
      // yang benar, bukan ketiban ke toko login-nya.
      formData.append("storeName", selectedCustomer.location_store);
      formData.append("phoneNumber", selectedCustomer.phone_number);
      formData.append("username", user.user_name);
      formData.append("followup", followupChecked.toString());
      formData.append("result", followupResult);
      formData.append("ket", followupKet);

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      formData.append("rowIndex", (selectedRowIndex + 2).toString());

      const response = await fetch("/api/customer", {
        method: "PUT",
        body: formData,
      });

      if (response.ok) {
        await logActivity("PUT", `Updated customer followup`, selectedCustomer.phone_number);
        showMessage("Followup saved successfully", "success");
        closeFollowupModal();
        fetchData(user.user_name, !!user.user_setting, true);
      } else {
        showMessage("Failed to save followup", "error");
      }
    } catch (error) {
      showMessage("Failed to save followup", "error");
    } finally {
      setUploading(false);
    }
  };

  // stats sudah dihitung di server (atas seluruh baris yang cocok filter,
  // bukan cuma 1 halaman) — di sini tinggal resolve label/logo dari badgeMap.
  const badgeStats = stats
    .map((s) => {
      const badge = badgeMap[s.key];
      if (!badge) return null;
      return { badge, count: s.count, totalOrder: s.totalOrder, totalQty: s.totalQty, totalValue: s.totalValue };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // `items` sudah 1 halaman dari server — tidak perlu slice lagi di sini.
  const currentItems = items;
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
  const indexOfLastItem = Math.min(indexOfFirstItem + itemsPerPage, totalItems);
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const SortIcon = ({ active }: { active: boolean }) =>
    !active ? (
      <ChevronsUpDown className="h-3 w-3 flex-none text-gray-300" />
    ) : sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 flex-none text-gray-500" />
    ) : (
      <ChevronDown className="h-3 w-3 flex-none text-gray-500" />
    );

  if (!user) return null;

return (
  <div className="flex-1 overflow-auto">
    <div className="p-4">

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {isOwner ? `${storeName} — Customer Data` : "Customer Management"}
              </h1>
              <p className="mt-0.5 text-[11px] text-gray-400">
                {totalItems.toLocaleString("id-ID")} customer
              </p>
            </div>

            {!isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={() => fetchData(user.user_name, !!user.user_setting, true)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  title="Ambil data terbaru (lewati cache)"
                >
                  {loading ? "Memuat..." : "↺ Refresh"}
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-primary text-white hover:opacity-90"
                  title="Upload file CSV export order dari Shopify"
                >
                  Import Shopify CSV
                </button>
                <button
                  onClick={() => setShowBadgeManager(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                  title="Kelola logo & SKU badge customer"
                >
                  Kelola Badge
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                  title="Export data order lengkap ke XLSX"
                >
                  Export
                </button>
              </div>
            )}
          </div>

          {/* Analytics — mengikuti filter yang aktif */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <div className="flex-none rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total Customer</div>
              <div className="mt-1 text-lg font-bold text-gray-900">
                {totalItems.toLocaleString("id-ID")}
              </div>
            </div>
            {badgeStats.map(({ badge, count, totalOrder, totalQty, totalValue }) => (
              <div
                key={badge.key}
                className="flex-none min-w-[168px] rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  {badge.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={badge.logo_url} alt={badge.label} className="h-4 w-4 rounded-full object-cover" />
                  )}
                  <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {badge.label}
                  </span>
                </div>
                <div className="mt-1 text-lg font-bold text-gray-900">{count}</div>
                <div className="mt-0.5 text-[10px] text-gray-400">
                  {totalOrder} order · {totalQty} qty · {formatRupiah(totalValue)}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3 flex flex-wrap items-end gap-3">
            {(!isOwner || stores.length > 1) && (
              <div className="relative w-48" ref={storeDropdownRef}>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  Store
                </label>
                <button
                  onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] bg-white text-left flex justify-between items-center hover:border-gray-300"
                >
                  <span className="text-gray-600">
                    {selectedStores.length === 0
                      ? "Semua toko"
                      : `${selectedStores.length} dipilih`}
                  </span>
                  <span className="text-gray-400">▾</span>
                </button>
                {showStoreDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {stores.map((store) => (
                      <label
                        key={store}
                        className="flex items-center text-[11px] px-3 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStores.includes(store)}
                          onChange={() => toggleStore(store)}
                          className="mr-2"
                        />
                        {store}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative w-48" ref={badgeDropdownRef}>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Badge
              </label>
              <button
                onClick={() => setShowBadgeDropdown(!showBadgeDropdown)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] bg-white text-left flex justify-between items-center hover:border-gray-300"
              >
                <span className="text-gray-600">
                  {selectedBadges.length === 0
                    ? "Semua badge"
                    : `${selectedBadges.length} dipilih`}
                </span>
                <span className="text-gray-400">▾</span>
              </button>
              {showBadgeDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {Object.values(badgeMap).map((b) => (
                    <label
                      key={b.key}
                      className="flex items-center gap-1.5 text-[11px] px-3 py-2 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBadges.includes(b.key)}
                        onChange={() => toggleBadge(b.key)}
                      />
                      {b.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo_url} alt={b.label} className="h-3.5 w-3.5 rounded-full object-cover" />
                      )}
                      {b.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="w-36">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Value Min
              </label>
              <input
                type="number"
                value={valueMin}
                onChange={(e) => setValueMin(e.target.value)}
                placeholder="0"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="w-36">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Value Max
              </label>
              <input
                type="number"
                value={valueMax}
                onChange={(e) => setValueMax(e.target.value)}
                placeholder="∞"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="w-32">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Order Min
              </label>
              <input
                type="number"
                value={orderMin}
                onChange={(e) => setOrderMin(e.target.value)}
                placeholder="0"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="w-32">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Order Max
              </label>
              <input
                type="number"
                value={orderMax}
                onChange={(e) => setOrderMax(e.target.value)}
                placeholder="∞"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex-1 min-w-[220px] max-w-xs">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Phone / nama customer"
                  className="w-full px-2 py-1.5 pr-10 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <SearchShortcutHint label={shortcutLabel} />
              </div>
            </div>

            <Button onClick={resetFilters} variant="secondary" size="sm" className="ml-auto">
              Reset
            </Button>
          </div>

          {/* Content Area — compact list, ala Shopify customer list */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading...</div>
            ) : totalItems === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">Tidak ada data</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <div className="min-w-[1050px]">
                  {/* Header — klik untuk sort asc/desc */}
                  <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    <button onClick={() => toggleSort("phone_number")} className="flex w-32 flex-none items-center gap-1 hover:text-gray-600">
                      Phone <SortIcon active={sortKey === "phone_number"} />
                    </button>
                    <button onClick={() => toggleSort("customer_name")} className="flex flex-1 min-w-[120px] items-center gap-1 hover:text-gray-600">
                      Customer <SortIcon active={sortKey === "customer_name"} />
                    </button>
                    <button onClick={() => toggleSort("email")} className="flex flex-1 min-w-[140px] items-center gap-1 hover:text-gray-600">
                      Email <SortIcon active={sortKey === "email"} />
                    </button>
                    <button onClick={() => toggleSort("location_store")} className="flex w-28 flex-none items-center gap-1 hover:text-gray-600">
                      Store <SortIcon active={sortKey === "location_store"} />
                    </button>
                    <div className="w-24 flex-none">Badge</div>
                    <button onClick={() => toggleSort("total_order")} className="flex w-20 flex-none items-center justify-end gap-1 hover:text-gray-600">
                      Total Order <SortIcon active={sortKey === "total_order"} />
                    </button>
                    <button onClick={() => toggleSort("total_qty")} className="flex w-20 flex-none items-center justify-end gap-1 hover:text-gray-600">
                      Qty Order <SortIcon active={sortKey === "total_qty"} />
                    </button>
                    <button onClick={() => toggleSort("total_value_num")} className="flex w-24 flex-none items-center justify-end gap-1 hover:text-gray-600">
                      Total Value <SortIcon active={sortKey === "total_value_num"} />
                    </button>
                    <button onClick={() => toggleSort("first_purchase")} className="flex w-24 flex-none items-center justify-end gap-1 hover:text-gray-600">
                      First Purchase <SortIcon active={sortKey === "first_purchase"} />
                    </button>
                    <button onClick={() => toggleSort("last_purchase")} className="flex w-24 flex-none items-center justify-end gap-1 hover:text-gray-600">
                      Last Purchase <SortIcon active={sortKey === "last_purchase"} />
                    </button>
                    <div className="w-32 flex-none text-right">Aksi</div>
                  </div>

                  {currentItems.map((customer, index) => {
                    const actualIndex = indexOfFirstItem + index;
                    const hasFollowup =
                      customer.followup === "TRUE" ||
                      customer.followup === "True" ||
                      customer.followup === "true";
                    return (
                      <div
                        key={actualIndex}
                        onClick={() =>
                          router.push(`/customer/${encodeURIComponent(customer.phone_number)}`)
                        }
                        className={`flex items-center gap-3 border-b border-gray-50 px-3 py-1 text-[11px] cursor-pointer transition-colors hover:bg-gray-50 ${hasFollowup ? "bg-green-50/50" : ""}`}
                      >
                        <div
                          className="flex w-32 flex-none items-center gap-1 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate text-gray-600" title={customer.phone_number}>
                            {customer.phone_number}
                          </span>
                          <CopyButton
                            text={customer.phone_number}
                            id={`phone-${actualIndex}`}
                            copiedId={copiedId}
                            onCopy={copyToClipboard}
                          />
                        </div>
                        <div className="flex-1 min-w-[120px] truncate font-medium text-gray-800" title={customer.customer_name}>
                          {customer.customer_name || "-"}
                        </div>
                        <div className="flex-1 min-w-[140px] truncate text-gray-500" title={customer.email}>
                          {customer.email || "-"}
                        </div>
                        <div className="w-28 flex-none truncate text-gray-500" title={customer.location_store}>
                          {customer.location_store}
                        </div>
                        <div className="flex w-24 flex-none items-center gap-1">
                          {(customer.badges || []).map((key) => {
                            const b = badgeMap[key];
                            if (!b || !b.logo_url) return null;
                            return (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={key}
                                src={b.logo_url}
                                alt={b.label}
                                title={b.label}
                                className="h-5 w-5 flex-none rounded-full object-cover ring-1 ring-gray-100"
                              />
                            );
                          })}
                        </div>
                        <div className="w-20 flex-none text-right text-gray-700">{customer.total_order}</div>
                        <div className="w-20 flex-none text-right text-gray-700">{customer.total_qty || 0}</div>
                        <div className="w-24 flex-none text-right font-semibold text-gray-800">{customer.total_value}</div>
                        <div className="w-24 flex-none text-right text-gray-500">{customer.first_purchase || "-"}</div>
                        <div className="w-24 flex-none text-right text-gray-500">{customer.last_purchase || "-"}</div>

                        <div
                          className="flex w-32 flex-none items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span title={hasFollowup ? "Followup selesai" : "Belum followup"}>
                            {hasFollowup ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-gray-300" />
                            )}
                          </span>
                          {customer.link_url && customer.link_url.trim() !== "" && (
                            <a
                              href={customer.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:underline"
                            >
                              View
                            </a>
                          )}
                          <button
                            onClick={() => setWaModalCustomer(customer)}
                            title="Followup via WhatsApp"
                            className="rounded p-1 text-green-600 hover:bg-green-50"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                          {isOwner && (
                            <Button
                              onClick={() => openFollowupModal(customer, actualIndex)}
                              size="sm"
                              className="h-auto px-2 py-1 text-[10px]"
                            >
                              {hasFollowup ? "Edit" : "Add"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-3 py-2 border-t">
                    <div className="text-[10px] text-gray-500">
                      {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, totalItems)} of{" "}
                      {totalItems}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-[10px] border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Prev
                      </button>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-2 py-1 text-[10px] border rounded ${
                                currentPage === page ? "bg-primary text-white" : "hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <span key={page} className="px-1 text-[10px]">
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 text-[10px] border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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

      {/* Followup Modal */}
      {showFollowupModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-primary mb-4">
              Add/Edit Followup
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">
                <strong>Customer:</strong> {selectedCustomer.customer_name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Phone:</strong> {selectedCustomer.phone_number}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followupChecked}
                    onChange={(e) => setFollowupChecked(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="font-medium">Followup Done</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Result
                </label>
                <select
                  value={followupResult}
                  onChange={(e) => setFollowupResult(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select result...</option>
                  {RESULT_OPTIONS.map((result) => (
                    <option key={result} value={result}>
                      {result}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note / Keterangan
                </label>
                <textarea
                  value={followupKet}
                  onChange={(e) => setFollowupKet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Enter notes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs border border-gray-300 rounded p-2 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                {selectedFile && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {selectedFile.name}
                  </p>
                )}
                {selectedCustomer.link_url && !selectedFile && (
                  <p className="text-xs text-blue-600 mt-1">
                    Current file:{" "}
                    <a
                      href={selectedCustomer.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={closeFollowupModal}
                disabled={uploading}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleFollowupSubmit}
                loading={uploading}
                className="flex-1"
              >
                {uploading ? "Saving..." : "Save Followup"}
              </Button>
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

      {showBadgeManager && (
        <BadgeManagerModal
          onClose={() => setShowBadgeManager(false)}
          onChanged={() => {
            fetchData(user.user_name, !!user.user_setting, true);
            fetchBadgeMap();
          }}
        />
      )}

      {showImportModal && (
        <ImportCsvModal
          importing={importing}
          onClose={() => setShowImportModal(false)}
          onImport={handleImportShopifyCsv}
        />
      )}

      {waModalCustomer && (
        <FollowupMessageModal
          customer={waModalCustomer}
          username={user.user_name}
          onClose={() => setWaModalCustomer(null)}
        />
      )}

      {showExportModal && (
        <ExportModal
          exporting={exporting}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}
    </div>
  </div>
  );
}