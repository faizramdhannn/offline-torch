"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Trash2,
  X,
  ListChecks,
  Edit2,
  Check,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { ProgressBar } from "./ProgressBar";
import { computeEntryProgress, type StepErpTypeDef } from "@/lib/stepErpConfig";

const OWNER_BADGE: Record<string, "info" | "purple" | "teal" | "warning"> = {
  Requester: "info",
  Sender: "purple",
  Receiver: "teal",
  "Head Office": "warning",
};

interface EntryDetailPanelProps {
  entry: Record<string, any> | null;
  typeDef: StepErpTypeDef | undefined;
  savingStepKey: string | null;
  onToggleStep: (stepKey: string, value: boolean) => void;
  onRequestDelete: () => void;
  onClose: () => void;
  onEditField: (field: "store" | "erp_number", value: string) => Promise<void>;
  storeOptions: string[];
}

export function EntryDetailPanel({
  entry,
  typeDef,
  savingStepKey,
  onToggleStep,
  onRequestDelete,
  onClose,
  onEditField,
  storeOptions,
}: EntryDetailPanelProps) {
  const [editingField, setEditingField] = useState<"store" | "erp_number" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingField, setSavingField] = useState(false);

  const startEdit = (field: "store" | "erp_number") => {
    setEditingField(field);
    setEditValue(entry?.[field] ?? "");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const confirmEdit = async () => {
    if (!editingField || !editValue.trim()) return;
    setSavingField(true);
    try {
      await onEditField(editingField, editValue.trim());
      setEditingField(null);
    } finally {
      setSavingField(false);
    }
  };

  const open = !!entry && !!typeDef;

  const progress =
    open ? computeEntryProgress(entry!, typeDef!) : { done: 0, total: 0, percent: 0 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="detail-panel"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 32 }}
          transition={{ duration: 0.2 }}
          className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white shadow-sm lg:w-80 lg:shrink-0"
        >
          {/* Header */}
          <div className="flex items-start gap-2 border-b border-gray-100 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              {/* ERP Number editable */}
              {editingField === "erp_number" ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="w-full rounded border border-primary/40 px-1.5 py-0.5 text-sm font-semibold text-gray-900 outline-none focus:ring-1 focus:ring-primary"
                  />
                  {savingField ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <>
                      <button onClick={confirmEdit} className="text-green-500 hover:text-green-600">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => startEdit("erp_number")}
                  className="group flex items-center gap-1"
                >
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {entry!.erp_number || "–"}
                  </span>
                  <Edit2 className="h-3 w-3 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}

              {/* Store editable */}
              {editingField === "store" ? (
                <div className="mt-0.5 flex items-center gap-1">
                  <select
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full rounded border border-primary/40 px-1.5 py-0.5 text-xs text-gray-600 outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Pilih Store --</option>
                    {storeOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {savingField ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <>
                      <button onClick={confirmEdit} className="text-green-500 hover:text-green-600">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-500">
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => startEdit("store")}
                  className="group mt-0.5 flex items-center gap-1"
                >
                  <span className="text-xs text-gray-500">{entry!.store || "–"}</span>
                  <Edit2 className="h-2.5 w-2.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-4 py-3 border-b border-gray-100">
            <ProgressBar
              percent={progress.percent}
              done={progress.done}
              total={progress.total}
              size="md"
            />
          </div>

          {/* Steps list */}
          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-gray-100">
              {typeDef!.steps.map((step, idx) => {
                const checked = entry![step.key] === "TRUE";
                const saving = savingStepKey === step.key;
                return (
                  <li key={step.key} className="flex items-start gap-3 px-4 py-3">
                    {/* Step number pill */}
                    <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                          checked
                            ? "bg-green-100 text-green-600"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs leading-relaxed ${
                          checked ? "text-gray-400 line-through" : "text-gray-700"
                        }`}
                      >
                        {step.label}
                      </p>
                      <Badge
                        variant={OWNER_BADGE[step.owner] ?? "neutral"}
                        className="mt-1"
                      >
                        {step.owner}
                      </Badge>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onToggleStep(step.key, !checked)}
                      className="mt-0.5 shrink-0 text-gray-300 transition-colors hover:text-primary disabled:cursor-wait"
                      aria-label={checked ? "Tandai belum selesai" : "Tandai selesai"}
                    >
                      {saving ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : checked ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="mb-2 text-[11px] text-gray-400">
              Dibuat: {entry!.created_at || "–"} · oleh {entry!.created_by || "–"}
            </p>
            <Button
              variant="ghost"
              className="w-full text-red-500 hover:bg-red-50 hover:text-red-600"
              icon={Trash2}
              onClick={onRequestDelete}
            >
              Hapus Entry
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}