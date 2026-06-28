"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { FieldLabel, inputClass } from "@/components/shared/FormField";
import SearchableSelect from "@/components/SearchableSelect";
import { STEP_ERP_STORES, STEP_ERP_TYPES } from "@/lib/stepErpConfig";

const STORE_OPTIONS = STEP_ERP_STORES.map((s) => ({ value: s, label: s }));
const TYPE_OPTIONS = STEP_ERP_TYPES.map((t) => ({ value: t.key, label: t.label }));

interface AddEntryModalProps {
  open: boolean;
  onClose: () => void;
  typeLabel: string;
  store: string;
  erpNumber: string;
  onStoreChange: (v: string) => void;
  onErpNumberChange: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  // Optional: for type selection when on "all" tab
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
  const canSubmit = !!store && !!erpNumber.trim() && !submitting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Plus}
      title={showTypeSelector ? "Tambah Entry" : `Tambah ${typeLabel}`}
      description="Isi tipe (jika perlu), store, dan nomor ERP untuk memulai checklist."
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={onSubmit}
            disabled={!canSubmit}
            loading={submitting}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {showTypeSelector && onTypeChange && (
          <div>
            <FieldLabel required>Tipe ERP</FieldLabel>
            <SearchableSelect
              options={TYPE_OPTIONS}
              value={typeKey ?? ""}
              onChange={onTypeChange}
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
      </div>
    </Modal>
  );
}