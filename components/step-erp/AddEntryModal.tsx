"use client";

import { useState, useEffect } from "react";
import { Plus, ArrowRight, ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { FieldLabel, inputClass } from "@/components/shared/FormField";
import { ProgressBar } from "@/components/step-erp/ProgressBar";
import SearchableSelect from "@/components/SearchableSelect";
import {
  STEP_ERP_STORES,
  STEP_ERP_TYPES,
  getStepErpType,
} from "@/lib/stepErpConfig";

const STORE_OPTIONS = STEP_ERP_STORES.map((s) => ({ value: s, label: s }));
const TYPE_OPTIONS  = STEP_ERP_TYPES.map((t) => ({ value: t.key, label: t.label }));

const OWNER_BADGE: Record<string, "info" | "purple" | "teal" | "warning"> = {
  Requester:    "info",
  Sender:       "purple",
  Receiver:     "teal",
  "Head Office":"warning",
};

interface AddEntryModalProps {
  open: boolean;
  onClose: () => void;
  typeLabel: string;
  store: string;
  erpNumber: string;
  onStoreChange: (v: string) => void;
  onErpNumberChange: (v: string) => void;
  submitting: boolean;
  onSubmit: (checked: Record<string, boolean>) => void;
  typeKey?: string;
  onTypeChange?: (v: string) => void;
  showTypeSelector?: boolean;
}

export function AddEntryModal({
  open,
  onClose,
  typeLabel,
  store,
  erpNumber,
  onStoreChange,
  onErpNumberChange,
  submitting,
  onSubmit,
  typeKey,
  onTypeChange,
  showTypeSelector = false,
}: AddEntryModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Per-step checklist state — keyed by step.key
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const typeDef   = getStepErpType(typeKey ?? "");
  const steps     = typeDef?.steps ?? [];
  const doneCount = steps.filter((s) => checked[s.key]).length;
  const percent   = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

  // Reset wizard whenever the modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setChecked({});
    }
  }, [open]);

  const canProceed = !!store && !!erpNumber.trim();

  const handleClose = () => {
    setStep(1);
    setChecked({});
    onClose();
  };

  const toggleStep = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Step 1 — form ──────────────────────────────────────────────────────────
  const stepOneBody = (
    <div className="space-y-4">
      {showTypeSelector && onTypeChange && (
        <div>
          <FieldLabel required>Tipe ERP</FieldLabel>
          <SearchableSelect
            options={TYPE_OPTIONS}
            value={typeKey ?? ""}
            onChange={(v) => {
              onTypeChange(v);
              setChecked({});
            }}
            placeholder="-- Pilih Tipe --"
          />
        </div>
      )}
      <div>
        <FieldLabel required>Store</FieldLabel>
        <SearchableSelect
          options={STORE_OPTIONS}
          value={store}
          onChange={onStoreChange}
          placeholder="-- Pilih Store --"
        />
      </div>
      <div>
        <FieldLabel required>ERP Number</FieldLabel>
        <input
          type="text"
          value={erpNumber}
          onChange={(e) => onErpNumberChange(e.target.value)}
          placeholder="Contoh: MR-00123"
          className={inputClass()}
        />
      </div>

      {/* Preview tipe yang dipilih */}
      {typeDef && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3">
          <p className="text-[11px] font-semibold text-primary">{typeDef.label}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{typeDef.description}</p>
          <p className="mt-1.5 text-[10px] text-gray-400">
            {typeDef.steps.length} langkah · setelah ini kamu akan diminta mengisi checklist
          </p>
        </div>
      )}
    </div>
  );

  // ── Step 2 — pre-submit checklist ──────────────────────────────────────────
  const stepTwoBody = (
    <div className="space-y-4">
      {/* Context pill */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          {store}
        </span>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-medium text-gray-700">
          {erpNumber}
        </span>
      </div>

      {/* Progress */}
      <ProgressBar percent={percent} done={doneCount} total={steps.length} size="md" />

      {/* Tip */}
      <p className="text-[11px] text-gray-400">
        Centang langkah yang sudah kamu lakukan. Kamu tetap bisa mengubahnya nanti setelah entry tersimpan.
      </p>

      {/* Checklist */}
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
        {steps.map((s, i) => {
          const isChecked = !!checked[s.key];
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggleStep(s.key)}
                className={`flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors ${
                  isChecked ? "bg-green-50/60 hover:bg-green-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {isChecked ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                  ) : (
                    <Circle className="h-4.5 w-4.5 text-gray-300" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-[10px] font-bold text-gray-300">
                      {i + 1}.
                    </span>
                    <p
                      className={`text-xs leading-relaxed ${
                        isChecked ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {s.label}
                    </p>
                  </div>
                  <Badge variant={OWNER_BADGE[s.owner] ?? "neutral"} className="mt-1">
                    {s.owner}
                  </Badge>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      icon={Plus}
      title={
        step === 1
          ? showTypeSelector
            ? "Tambah Entry"
            : `Tambah ${typeLabel}`
          : "Checklist Sebelum Submit"
      }
      description={
        step === 1
          ? "Isi tipe, store, dan nomor ERP untuk memulai checklist."
          : `${typeDef?.label ?? typeLabel} · ${doneCount}/${steps.length} langkah ditandai`
      }
      maxWidth="max-w-lg"
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              Batal
            </Button>
            <Button
              variant="primary"
              className="ml-auto"
              icon={ArrowRight}
              disabled={!canProceed}
              onClick={() => setStep(2)}
            >
              Lanjut ke Checklist
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              icon={ArrowLeft}
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              Kembali
            </Button>
            <Button
              variant="primary"
              className="ml-auto"
              onClick={() => onSubmit(checked)}
              loading={submitting}
            >
              {doneCount === steps.length
                ? "Submit ✓"
                : `Submit (${doneCount}/${steps.length})`}
            </Button>
          </>
        )
      }
    >
      {step === 1 ? stepOneBody : stepTwoBody}
    </Modal>
  );
}
