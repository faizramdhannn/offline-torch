"use client";

import { CheckCircle2, Circle, Loader2, Trash2, ListChecks } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { ProgressBar } from "./ProgressBar";
import { computeEntryProgress, type StepErpTypeDef } from "@/lib/stepErpConfig";

const OWNER_BADGE: Record<string, "info" | "purple" | "teal" | "warning"> = {
  Requester: "info",
  Sender: "purple",
  Receiver: "teal",
  "Head Office": "warning",
};

interface ChecklistModalProps {
  open: boolean;
  onClose: () => void;
  typeDef: StepErpTypeDef;
  entry: Record<string, any>;
  savingStepKey: string | null;
  onToggleStep: (stepKey: string, value: boolean) => void;
  onRequestDelete: () => void;
}

export function ChecklistModal({
  open,
  onClose,
  typeDef,
  entry,
  savingStepKey,
  onToggleStep,
  onRequestDelete,
}: ChecklistModalProps) {
  const { done, total, percent } = computeEntryProgress(entry, typeDef);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={ListChecks}
      title={entry.erp_number || "-"}
      description={entry.store}
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600" icon={Trash2} onClick={onRequestDelete}>
            Hapus Entry
          </Button>
          <Button variant="primary" className="ml-auto" onClick={onClose}>
            Tutup
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ProgressBar percent={percent} done={done} total={total} size="md" />

        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {typeDef.steps.map((step) => {
            const checked = entry[step.key] === "TRUE";
            const saving = savingStepKey === step.key;
            return (
              <li key={step.key} className="flex items-start gap-3 px-3 py-2.5">
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
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-relaxed ${checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
                    {step.label}
                  </p>
                  <Badge variant={OWNER_BADGE[step.owner] ?? "neutral"} className="mt-1">
                    {step.owner}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
