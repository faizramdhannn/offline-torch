"use client";

import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { FieldLabel } from "@/components/shared/FormField";

export interface BalanceFormData {
  type_balance: string;
  value: string;
  notes: string;
}

interface BalanceFormModalProps {
  mode: "add" | "edit";
  open: boolean;
  onClose: () => void;
  formData: BalanceFormData;
  onChange: (data: BalanceFormData) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  formatRupiah: (value: string) => string;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 outline-none transition-colors duration-200 hover:bg-white focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10";

export function BalanceFormModal({ mode, open, onClose, formData, onChange, submitting, onSubmit, formatRupiah }: BalanceFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={mode === "add" ? Plus : Pencil}
      title={mode === "add" ? "Add Balance Entry" : "Edit Balance Entry"}
      maxWidth="max-w-sm"
      footer={
        <>
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button form="balance-form" type="submit" className="flex-1 justify-center" loading={submitting}>
            {submitting ? (mode === "add" ? "Submitting..." : "Updating...") : mode === "add" ? "Add Entry" : "Update Entry"}
          </Button>
        </>
      }
    >
      <form id="balance-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <FieldLabel required>Type</FieldLabel>
          <select
            value={formData.type_balance}
            onChange={(e) => onChange({ ...formData, type_balance: e.target.value })}
            className={inputClass}
            required
          >
            <option value="credit">Credit (Pemasukan)</option>
            <option value="debit">Debit (Pengeluaran)</option>
          </select>
        </div>
        <div>
          <FieldLabel required>Value</FieldLabel>
          <input
            type="text"
            value={formData.value}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "");
              onChange({ ...formData, value: digits ? formatRupiah(digits) : "" });
            }}
            placeholder="Rp 0"
            className={inputClass}
            required
          />
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={formData.notes}
            onChange={(e) => onChange({ ...formData, notes: e.target.value })}
            rows={2}
            placeholder="Optional notes..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </form>
    </Modal>
  );
}
