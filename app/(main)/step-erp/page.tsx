"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ListChecks, Plus, CheckCircle2, TrendingUp } from "lucide-react";
import Popup from "@/components/Popup";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeletonRows } from "@/components/shared/LoadingSkeleton";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { StatCard } from "@/components/shared/StatCard";

import { TypeGrid, type TypeStats } from "@/components/step-erp/TypeGrid";
import { EntryTable } from "@/components/step-erp/EntryTable";
import { AddEntryModal } from "@/components/step-erp/AddEntryModal";
import { ChecklistModal } from "@/components/step-erp/ChecklistModal";
import {
  STEP_ERP_TYPES,
  getStepErpType,
  summarizeEntries,
} from "@/lib/stepErpConfig";

export default function StepErpPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);

  // "grid" = landing view with the 8 type cards. Otherwise it's a type key.
  const [view, setView] = useState<string>("grid");

  const [typeStats, setTypeStats] = useState<Record<string, TypeStats>>({});
  const [loadingStats, setLoadingStats] = useState(true);

  const [entries, setEntries] = useState<Record<string, any>[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addStore, setAddStore] = useState("");
  const [addErpNumber, setAddErpNumber] = useState("");
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<Record<string, any> | null>(null);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [savingStepKey, setSavingStepKey] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Record<string, any> | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    } catch {
      // Non-critical — don't block the user's action on a logging failure.
    }
  };

  // ── Initial auth + permission gate ────────────────────────────────────────
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
    setUser(parsedUser);
    fetchAllStats();
  }, []);

  // ── Stats for the grid landing view (one read per type) ───────────────────
  const fetchAllStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const results = await Promise.all(
        STEP_ERP_TYPES.map(async (t) => {
          try {
            const res = await fetch(`/api/step-erp?type=${t.key}`);
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            return [t.key, summarizeEntries(list, t)] as const;
          } catch {
            return [t.key, { total: 0, completed: 0, avgPercent: 0 }] as const;
          }
        })
      );
      setTypeStats(Object.fromEntries(results));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ── Entries for the selected type ─────────────────────────────────────────
  const fetchEntries = useCallback(async (typeKey: string) => {
    setLoadingEntries(true);
    try {
      const res = await fetch(`/api/step-erp?type=${typeKey}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      showMessage("Gagal memuat data", "error");
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  const handleSelectType = (typeKey: string) => {
    setView(typeKey);
    fetchEntries(typeKey);
  };

  const handleBack = () => {
    setView("grid");
    setEntries([]);
    fetchAllStats();
  };

  const currentType = view !== "grid" ? getStepErpType(view) : undefined;

  // Keep the grid's stat card for this type roughly in sync after local mutations,
  // without needing a full refetch of all 8 types.
  const syncCurrentTypeStat = (nextEntries: Record<string, any>[]) => {
    if (!currentType) return;
    setTypeStats((prev) => ({ ...prev, [currentType.key]: summarizeEntries(nextEntries, currentType) }));
  };

  // ── Add entry ──────────────────────────────────────────────────────────────
  const openAddModal = () => {
    setAddStore("");
    setAddErpNumber("");
    setShowAddModal(true);
  };

  const handleSubmitAdd = async () => {
    if (!currentType || !addStore || !addErpNumber.trim()) return;
    setSubmittingAdd(true);
    try {
      const res = await fetch("/api/step-erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: currentType.key,
          store: addStore,
          erp_number: addErpNumber.trim(),
          created_by: user?.name || user?.user_name || "",
        }),
      });
      if (!res.ok) throw new Error();
      await logActivity("POST", `Menambahkan ${currentType.label}: ${addErpNumber.trim()} (${addStore})`);
      setShowAddModal(false);
      showMessage("Entry berhasil ditambahkan", "success");
      const refreshed = await fetch(`/api/step-erp?type=${currentType.key}`).then((r) => r.json());
      const list = Array.isArray(refreshed) ? refreshed : [];
      setEntries(list);
      syncCurrentTypeStat(list);
    } catch {
      showMessage("Gagal menambahkan entry", "error");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // ── Checklist detail ───────────────────────────────────────────────────────
  const openChecklist = (entry: Record<string, any>) => {
    setSelectedEntry(entry);
    setShowChecklistModal(true);
  };

  const handleToggleStep = async (stepKey: string, value: boolean) => {
    if (!currentType || !selectedEntry) return;
    const entryId = selectedEntry.id;

    // Optimistic update
    const apply = (e: Record<string, any>) => (e.id === entryId ? { ...e, [stepKey]: value ? "TRUE" : "FALSE" } : e);
    setSelectedEntry((prev) => (prev ? { ...prev, [stepKey]: value ? "TRUE" : "FALSE" } : prev));
    setEntries((prev) => {
      const next = prev.map(apply);
      syncCurrentTypeStat(next);
      return next;
    });

    setSavingStepKey(stepKey);
    try {
      const res = await fetch("/api/step-erp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: currentType.key,
          id: entryId,
          steps: { [stepKey]: value },
          updated_by: user?.name || user?.user_name || "",
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      const revert = (e: Record<string, any>) =>
        e.id === entryId ? { ...e, [stepKey]: value ? "FALSE" : "TRUE" } : e;
      setSelectedEntry((prev) => (prev ? { ...prev, [stepKey]: value ? "FALSE" : "TRUE" } : prev));
      setEntries((prev) => {
        const next = prev.map(revert);
        syncCurrentTypeStat(next);
        return next;
      });
      showMessage("Gagal menyimpan, coba lagi", "error");
    } finally {
      setSavingStepKey(null);
    }
  };

  // ── Delete entry ───────────────────────────────────────────────────────────
  const requestDelete = () => {
    if (!selectedEntry) return;
    setShowChecklistModal(false);
    setDeleteTarget(selectedEntry);
  };

  const handleConfirmDelete = async () => {
    if (!currentType || !deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/step-erp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: currentType.key, id: deleteTarget.id }),
      });
      if (!res.ok) throw new Error();
      await logActivity("DELETE", `Menghapus ${currentType.label}: ${deleteTarget.erp_number}`);
      const next = entries.filter((e) => e.id !== deleteTarget.id);
      setEntries(next);
      syncCurrentTypeStat(next);
      setDeleteTarget(null);
      setSelectedEntry(null);
      showMessage("Entry dihapus", "success");
    } catch {
      showMessage("Gagal menghapus entry", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  const stat = currentType ? typeStats[currentType.key] : undefined;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="space-y-5 p-5">
        {view === "grid" ? (
          <>
            <SectionHeader
              icon={ListChecks}
              title="Step ERP"
              description="Checklist langkah-langkah proses ERP per store, dari pengajuan sampai selesai."
            />
            <TypeGrid stats={typeStats} loadingStats={loadingStats} onSelect={handleSelectType} />
          </>
        ) : currentType ? (
          <>
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-primary"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Kembali ke Step ERP
            </button>

            <SectionHeader
              icon={ListChecks}
              title={currentType.label}
              description={currentType.description}
              actions={
                <Button icon={Plus} size="sm" onClick={openAddModal}>
                  Tambah Entry
                </Button>
              }
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard icon={ListChecks} label="Total Entri" value={String(stat?.total ?? entries.length)} />
              <StatCard
                icon={CheckCircle2}
                label="Selesai 100%"
                value={String(stat?.completed ?? 0)}
                tone="positive"
              />
              <StatCard icon={TrendingUp} label="Rata-rata Progress" value={`${stat?.avgPercent ?? 0}%`} tone="info" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              {loadingEntries ? (
                <TableSkeletonRows />
              ) : entries.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="Belum ada entry"
                  description="Mulai dengan menambahkan entry pertama untuk store ini."
                  action={
                    <Button icon={Plus} size="sm" onClick={openAddModal}>
                      Tambah Entry
                    </Button>
                  }
                />
              ) : (
                <EntryTable entries={entries} typeDef={currentType} onRowClick={openChecklist} />
              )}
            </motion.div>
          </>
        ) : null}
      </div>

      {currentType && (
        <AddEntryModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          typeLabel={currentType.label}
          store={addStore}
          erpNumber={addErpNumber}
          onStoreChange={setAddStore}
          onErpNumberChange={setAddErpNumber}
          submitting={submittingAdd}
          onSubmit={handleSubmitAdd}
        />
      )}

      {currentType && selectedEntry && (
        <ChecklistModal
          open={showChecklistModal}
          onClose={() => setShowChecklistModal(false)}
          typeDef={currentType}
          entry={selectedEntry}
          savingStepKey={savingStepKey}
          onToggleStep={handleToggleStep}
          onRequestDelete={requestDelete}
        />
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Hapus entry ini?"
        description={
          deleteTarget ? `Entry "${deleteTarget.erp_number}" (${deleteTarget.store}) akan dihapus permanen.` : undefined
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
