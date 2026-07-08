"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListChecks,
  Plus,
  CheckCircle2,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Search,
  BookOpenCheck,
} from "lucide-react";
import Popup from "@/components/Popup";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeletonRows } from "@/components/shared/LoadingSkeleton";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { StatCard } from "@/components/shared/StatCard";

import { AddEntryModal } from "@/components/step-erp/AddEntryModal";
import { EntryDetailPanel } from "@/components/step-erp/EntryDetailPanel";
import { ProgressBar } from "@/components/step-erp/ProgressBar";
import { MasterChecklistGuide } from "@/components/step-erp/MasterChecklistGuide";
import {
  STEP_ERP_TYPES,
  STEP_ERP_STORES,
  getStepErpType,
  computeEntryProgress,
  summarizeEntries,
  type StepErpTypeDef,
} from "@/lib/stepErpConfig";

const PAGE_SIZE = 20;

// Tab: "all" = semua type, atau key type spesifik
type TabKey = "all" | string;

export default function StepErpPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [isAllAccess, setIsAllAccess] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // All entries keyed by type key
  const [entriesByType, setEntriesByType] = useState<Record<string, Record<string, any>[]>>({});
  const [loading, setLoading] = useState(true);

  // Selected entry for detail panel
  const [selectedEntry, setSelectedEntry] = useState<Record<string, any> | null>(null);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);
  const [savingStepKey, setSavingStepKey] = useState<string | null>(null);

  // Add entry modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<string>(STEP_ERP_TYPES[0].key);
  const [addStore, setAddStore] = useState("");
  const [addErpNumber, setAddErpNumber] = useState("");
  const [addChecked, setAddChecked] = useState<Record<string, boolean>>({});
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Master checklist guide (shown automatically the first time this menu is opened)
  const [showChecklistGuide, setShowChecklistGuide] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ entry: Record<string, any>; typeKey: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Popup
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

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
        body: JSON.stringify({ user: user?.user_name, method, activity_log: activity }),
      });
    } catch {}
  };

  // ── Auth + permission gate ─────────────────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.step_erp) {
      router.push("/dashboard");
      return;
    }
    const allAccess = parsedUser.step_erp_all === true || parsedUser.step_erp_all === "TRUE";
    setIsAllAccess(allAccess);
    setUser(parsedUser);
    setShowChecklistGuide(true);
  }, []);

  // Derive user's store from their name (matching STEP_ERP_STORES)
  const userStore = useMemo(() => {
    if (!user || isAllAccess) return null;
    // Try to match user name to a store, e.g. "lembong" → "Torch Lembong"
    const nameToken = (user.name || user.user_name || "").toLowerCase();
    return (
      STEP_ERP_STORES.find((s) => nameToken.includes(s.split(" ")[1]?.toLowerCase() ?? "")) ??
      null
    );
  }, [user, isAllAccess]);

  // ── Fetch all types ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        STEP_ERP_TYPES.map(async (t) => {
          try {
            const params = new URLSearchParams({ type: t.key });
            if (!isAllAccess && userStore) params.set("store", userStore);
            const res = await fetch(`/api/step-erp?${params}`);
            const data = await res.json();
            return [t.key, Array.isArray(data) ? data : []] as const;
          } catch {
            return [t.key, []] as const;
          }
        })
      );
      setEntriesByType(Object.fromEntries(results));
    } finally {
      setLoading(false);
    }
  }, [user, isAllAccess, userStore]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  // ── Derived flat list for current tab ─────────────────────────────────────
  const flatEntries = useMemo(() => {
    const typesToShow =
      activeTab === "all"
        ? STEP_ERP_TYPES
        : STEP_ERP_TYPES.filter((t) => t.key === activeTab);

    return typesToShow.flatMap((t) =>
      (entriesByType[t.key] ?? []).map((e): Record<string, any> => ({ ...e, _typeKey: t.key }))
    );
  }, [activeTab, entriesByType]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return flatEntries;
    const q = search.toLowerCase();
    return flatEntries.filter(
      (e) =>
        e.erp_number?.toLowerCase().includes(q) ||
        e.store?.toLowerCase().includes(q) ||
        e.created_by?.toLowerCase().includes(q)
    );
  }, [flatEntries, search]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const pagedEntries = filteredEntries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page on tab/search change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedEntry(null);
    setSelectedTypeKey(null);
  }, [activeTab, search]);

  // ── Stats summary ──────────────────────────────────────────────────────────
  const allEntries = useMemo(() => Object.values(entriesByType).flat(), [entriesByType]);
  const totalCount = allEntries.length;
  const completedCount = useMemo(() => {
    return allEntries.filter((e) => {
      const typeKey = e._type ?? Object.keys(entriesByType).find((k) =>
        entriesByType[k].some((x) => x.id === e.id)
      );
      if (!typeKey) return false;
      const td = getStepErpType(typeKey);
      if (!td) return false;
      return computeEntryProgress(e, td).percent >= 100;
    }).length;
  }, [allEntries, entriesByType]);

  const avgPercent = useMemo(() => {
    if (allEntries.length === 0) return 0;
    let sum = 0;
    allEntries.forEach((e) => {
      const typeKey = e._type ?? Object.keys(entriesByType).find((k) =>
        entriesByType[k].some((x) => x.id === e.id)
      );
      const td = typeKey ? getStepErpType(typeKey) : undefined;
      if (td) sum += computeEntryProgress(e, td).percent;
    });
    return Math.round(sum / allEntries.length);
  }, [allEntries, entriesByType]);

  // ── Row click → open panel ─────────────────────────────────────────────────
  const handleRowClick = (entry: Record<string, any>) => {
    setSelectedEntry(entry);
    setSelectedTypeKey(entry._typeKey);
  };

  const handleClosePanel = () => {
    setSelectedEntry(null);
    setSelectedTypeKey(null);
  };

  // ── Toggle step ────────────────────────────────────────────────────────────
  const handleToggleStep = async (stepKey: string, value: boolean) => {
    if (!selectedTypeKey || !selectedEntry) return;
    const entryId = selectedEntry.id;

    const applyPatch = (e: Record<string, any>) =>
      e.id === entryId ? { ...e, [stepKey]: value ? "TRUE" : "FALSE" } : e;

    // Optimistic
    setSelectedEntry((prev) => (prev ? { ...prev, [stepKey]: value ? "TRUE" : "FALSE" } : prev));
    setEntriesByType((prev) => ({
      ...prev,
      [selectedTypeKey]: (prev[selectedTypeKey] ?? []).map(applyPatch),
    }));

    const currentTypeDef = getStepErpType(selectedTypeKey)!;
    setSavingStepKey(stepKey);
    try {
      const res = await fetch("/api/step-erp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedTypeKey,
          id: entryId,
          steps: { [stepKey]: value },
          updated_by: user?.name || user?.user_name || "",
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      const revert = (e: Record<string, any>) =>
        e.id === entryId ? { ...e, [stepKey]: value ? "FALSE" : "TRUE" } : e;
      setSelectedEntry((prev) => (prev ? { ...prev, [stepKey]: value ? "FALSE" : "TRUE" } : prev));
      setEntriesByType((prev) => ({
        ...prev,
        [selectedTypeKey]: (prev[selectedTypeKey] ?? []).map(revert),
      }));
      showMessage("Gagal menyimpan, coba lagi", "error");
    } finally {
      setSavingStepKey(null);
    }
  };

  // ── Edit field (store / erp_number) ───────────────────────────────────────
  const handleEditField = async (field: "store" | "erp_number", value: string) => {
    if (!selectedTypeKey || !selectedEntry) return;
    const res = await fetch("/api/step-erp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: selectedTypeKey,
        id: selectedEntry.id,
        [field]: value,
        updated_by: user?.name || user?.user_name || "",
      }),
    });
    if (!res.ok) throw new Error("Gagal menyimpan");
    const patched = { ...selectedEntry, [field]: value };
    setSelectedEntry(patched);
    setEntriesByType((prev) => ({
      ...prev,
      [selectedTypeKey]: (prev[selectedTypeKey] ?? []).map((e) =>
        e.id === selectedEntry.id ? { ...e, [field]: value } : e
      ),
    }));
    showMessage("Berhasil disimpan", "success");
    await logActivity("PUT", `Edit ${field} entry ${selectedEntry.erp_number} → ${value}`);
  };

  // ── Add entry ──────────────────────────────────────────────────────────────
  const openAddModal = () => {
    setAddType(activeTab !== "all" ? activeTab : STEP_ERP_TYPES[0].key);
    setAddStore("");
    setAddErpNumber("");
    setAddChecked({});
    setShowAddModal(true);
  };

  const toggleAddStep = (key: string) =>
    setAddChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  // Type change resets the checklist (steps differ per type) but keeps store/number
  const handleAddTypeChange = (v: string) => {
    setAddType(v);
    setAddChecked({});
  };

  const handleSubmitAdd = async (preChecked: Record<string, boolean> = {}) => {
    // ERP Number is optional on purpose — some processes only get their
    // number after a step or two, some already have it up front.
    if (!addStore) return;
    const typeDef = getStepErpType(addType);
    if (!typeDef) return;
    setSubmittingAdd(true);
    try {
      // Build initial step values from the checklist
      const initialSteps: Record<string, string> = {};
      typeDef.steps.forEach((s) => {
        initialSteps[s.key] = preChecked[s.key] ? "TRUE" : "FALSE";
      });

      const res = await fetch("/api/step-erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addType,
          store: addStore,
          erp_number: addErpNumber.trim(),
          created_by: user?.name || user?.user_name || "",
          ...initialSteps,
        }),
      });
      if (!res.ok) throw new Error();
      await logActivity(
        "POST",
        `Tambah ${typeDef.label}: ${addErpNumber.trim() || "(tanpa nomor)"} (${addStore})`
      );
      setShowAddModal(false);
      showMessage("Entry berhasil ditambahkan", "success");
      // Refresh just this type
      const params = new URLSearchParams({ type: addType });
      if (!isAllAccess && userStore) params.set("store", userStore);
      const refreshed = await fetch(`/api/step-erp?${params}`).then((r) => r.json());
      setEntriesByType((prev) => ({ ...prev, [addType]: Array.isArray(refreshed) ? refreshed : [] }));
    } catch {
      showMessage("Gagal menambahkan entry", "error");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const requestDelete = () => {
    if (!selectedEntry || !selectedTypeKey) return;
    setDeleteTarget({ entry: selectedEntry, typeKey: selectedTypeKey });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/step-erp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: deleteTarget.typeKey, id: deleteTarget.entry.id }),
      });
      if (!res.ok) throw new Error();
      await logActivity("DELETE", `Hapus entry ${deleteTarget.entry.erp_number}`);
      setEntriesByType((prev) => ({
        ...prev,
        [deleteTarget.typeKey]: (prev[deleteTarget.typeKey] ?? []).filter(
          (e) => e.id !== deleteTarget.entry.id
        ),
      }));
      setDeleteTarget(null);
      setSelectedEntry(null);
      setSelectedTypeKey(null);
      showMessage("Entry dihapus", "success");
    } catch {
      showMessage("Gagal menghapus entry", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  const selectedTypeDef = selectedTypeKey ? getStepErpType(selectedTypeKey) : undefined;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="space-y-5 p-4">
        {/* Header */}
        <SectionHeader
          icon={ListChecks}
          title="Step ERP"
          description={
            isAllAccess
              ? "Checklist Proses ERP Semua Store"
              : userStore
              ? `Menampilkan Data Store: ${userStore}`
              : "Checklist Proses ERP Store"
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                icon={BookOpenCheck}
                size="sm"
                onClick={() => setShowChecklistGuide(true)}
              >
                Lihat Checklist
              </Button>
              <Button icon={Plus} size="sm" onClick={openAddModal}>
                Tambah Entry
              </Button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={ListChecks} label="Total Entri" value={String(totalCount)} />
          <StatCard icon={CheckCircle2} label="Selesai 100%" value={String(completedCount)} tone="positive" />
          <StatCard icon={TrendingUp} label="Rata-rata Progress" value={`${avgPercent}%`} tone="info" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "all"
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            Semua
          </button>
          {STEP_ERP_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari ERP number, store, atau dibuat oleh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-4 text-xs text-gray-700 shadow-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>

        {/* Main content: table + detail panel */}
        <div className="flex gap-4">
          {/* Table */}
          <motion.div
            layout
            className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            {loading ? (
              <TableSkeletonRows />
            ) : filteredEntries.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="Belum ada entry"
                description="Mulai dengan menambahkan entry pertama."
                action={
                  <Button icon={Plus} size="sm" onClick={openAddModal}>
                    Tambah Entry
                  </Button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-gray-100 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-500">
                          ERP Number
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-500">
                          Store
                        </th>
                        {activeTab === "all" && (
                          <th className="px-4 py-2.5 text-left font-semibold text-gray-500">
                            Tipe
                          </th>
                        )}
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-500">
                          Dibuat
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-500" style={{ minWidth: 180 }}>
                          Progress
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pagedEntries.map((entry, i) => {
                        const td = getStepErpType(entry._typeKey);
                        const prog = td
                          ? computeEntryProgress(entry, td)
                          : { done: 0, total: 0, percent: 0 };
                        const isSelected =
                          selectedEntry?.id === entry.id &&
                          selectedTypeKey === entry._typeKey;

                        return (
                          <motion.tr
                            key={`${entry._typeKey}-${entry.id ?? i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.12, delay: Math.min(i, 10) * 0.02 }}
                            onClick={() => handleRowClick(entry)}
                            className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                              isSelected ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {entry.erp_number || <span className="text-gray-300">–</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{entry.store}</td>
                            {activeTab === "all" && (
                              <td className="px-4 py-3 text-gray-400">
                                {td?.label ?? entry._typeKey}
                              </td>
                            )}
                            <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                              {entry.created_at}
                            </td>
                            <td className="px-4 py-3">
                              {/* Step pills + bar */}
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-1">
                                  {td?.steps.map((step, si) => {
                                    const checked = entry[step.key] === "TRUE";
                                    return (
                                      <span
                                        key={step.key}
                                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                                          checked
                                            ? "bg-green-100 text-green-600"
                                            : "bg-gray-100 text-gray-400"
                                        }`}
                                        title={step.label}
                                      >
                                        {si + 1}
                                      </span>
                                    );
                                  })}
                                </div>
                                <ProgressBar
                                  percent={prog.percent}
                                  done={prog.done}
                                  total={prog.total}
                                  size="sm"
                                />
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                    <span className="text-[11px] text-gray-400">
                      {(currentPage - 1) * PAGE_SIZE + 1}–
                      {Math.min(currentPage * PAGE_SIZE, filteredEntries.length)} dari{" "}
                      {filteredEntries.length} entri
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="rounded-lg border border-gray-200 p-1 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-2 text-xs text-gray-500">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="rounded-lg border border-gray-200 p-1 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* Detail panel */}
          <EntryDetailPanel
            entry={selectedEntry}
            typeDef={selectedTypeDef}
            savingStepKey={savingStepKey}
            onToggleStep={handleToggleStep}
            onRequestDelete={requestDelete}
            onClose={handleClosePanel}
            onEditField={handleEditField}
            storeOptions={STEP_ERP_STORES}
          />
        </div>
      </div>

      {/* Master checklist guide */}
      <MasterChecklistGuide
        open={showChecklistGuide}
        onClose={() => setShowChecklistGuide(false)}
      />

      {/* Add modal */}
      <AddEntryModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        typeLabel={getStepErpType(addType)?.label ?? ""}
        store={addStore}
        erpNumber={addErpNumber}
        onStoreChange={setAddStore}
        onErpNumberChange={setAddErpNumber}
        submitting={submittingAdd}
        onSubmit={handleSubmitAdd}
        // Pass extra props for type selector
        typeKey={addType}
        onTypeChange={handleAddTypeChange}
        showTypeSelector={activeTab === "all"}
        checked={addChecked}
        onToggleStep={toggleAddStep}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Hapus entry ini?"
        description={
          deleteTarget
            ? `Entry "${deleteTarget.entry.erp_number}" (${deleteTarget.entry.store}) akan dihapus permanen.`
            : undefined
        }
        confirmLabel="Hapus"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}