"use client";

import { useRef } from "react";
import { Plus, Pencil, ExternalLink } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { FieldLabel } from "@/components/shared/FormField";
import { DropZone } from "@/components/request-tracking/DropZone";

export interface PettyCashFormData {
  description: string;
  category: string;
  value: string;
  ket: string;
  transfer: boolean;
  file: File | null;
}

interface EntryFormModalProps {
  mode: "add" | "edit";
  open: boolean;
  onClose: () => void;
  formData: PettyCashFormData;
  onChange: (data: PettyCashFormData) => void;
  categories: string[];
  storeLabel: string;
  existingLinkUrl?: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 outline-none transition-colors duration-200 hover:bg-white focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10";

export function EntryFormModal({
  mode,
  open,
  onClose,
  formData,
  onChange,
  categories,
  storeLabel,
  existingLinkUrl,
  submitting,
  onSubmit,
}: EntryFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValueChange = (raw: string, formatRupiah: (v: string) => string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    onChange({ ...formData, value: digits ? formatRupiah(digits) : "" });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={mode === "add" ? Plus : Pencil}
      title={mode === "add" ? "Add Petty Cash Entry" : "Edit Petty Cash Entry"}
      footer={
        <>
          <Button variant="secondary" className="flex-1 justify-center" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button form="petty-cash-entry-form" type="submit" className="flex-1 justify-center" loading={submitting}>
            {submitting ? (mode === "add" ? "Submitting..." : "Updating...") : mode === "add" ? "Add Entry" : "Update Entry"}
          </Button>
        </>
      }
    >
      <form id="petty-cash-entry-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel required>Description</FieldLabel>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            className={inputClass}
            required
          />
        </div>
        <div>
          <FieldLabel required>Category</FieldLabel>
          <select value={formData.category} onChange={(e) => onChange({ ...formData, category: e.target.value })} className={inputClass} required>
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel required>Value</FieldLabel>
          <input
            type="text"
            value={formData.value}
            onChange={(e) => handleValueChange(e.target.value, (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(parseInt(v)))}
            placeholder="Rp 0"
            className={inputClass}
            required
          />
        </div>
        <div>
          <FieldLabel>Store</FieldLabel>
          <input type="text" value={storeLabel} disabled className={`${inputClass} bg-gray-100 text-gray-500`} />
        </div>
        <div className="col-span-2">
          <FieldLabel>Dana Talang</FieldLabel>
          <textarea
            value={formData.ket}
            onChange={(e) => onChange({ ...formData, ket: e.target.value })}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div className="flex items-center">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={formData.transfer}
              onChange={(e) => onChange({ ...formData, transfer: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
            />
            Transfer
          </label>
        </div>
        <div className="col-span-2">
          <FieldLabel>{mode === "add" ? "Upload Receipt" : "Upload Receipt (Optional — akan mengganti yang lama)"}</FieldLabel>
          <DropZone
            file={formData.file}
            onFile={(f) => onChange({ ...formData, file: f })}
            inputRef={fileInputRef}
          />
          {mode === "edit" && existingLinkUrl && !formData.file && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600">
              <ExternalLink className="h-3 w-3" />
              <a href={existingLinkUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                File saat ini
              </a>
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
