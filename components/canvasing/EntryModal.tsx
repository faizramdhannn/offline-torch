"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Pencil, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESULT_STATUS_OPTIONS, StatusSelectButton } from "./DomainBadges";

// ── Shared field helpers (scoped to this module) ─────────────────────────────

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

const inputClass = (err?: boolean) =>
  cn(
    "w-full rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-800 outline-none transition-colors duration-200 hover:bg-white focus:bg-white focus:ring-2",
    err
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-gray-200 focus:border-primary/40 focus:ring-primary/10"
  );

// ── Form data type ─────────────────────────────────────────────────────────────

export interface EntryFormData {
  name: string;
  contact_person: string;
  category: string;
  sub_category: string;
  canvasser: string;
  visit_at: string;
  result_status: string;
  notes: string;
  files: File[];
  keepExistingImages: boolean;
}

interface EntryModalProps {
  open: boolean;
  isEditing: boolean;
  hasExistingImages: boolean;
  formData: EntryFormData;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updated: EntryFormData) => void;
}

/**
 * Add / Edit modal for a canvasing entry.
 * Purely presentational — business logic (submit, validation) stays in the page.
 */
export function EntryModal({
  open,
  isEditing,
  hasExistingImages,
  formData,
  submitting,
  onClose,
  onSubmit,
  onChange,
}: EntryModalProps) {
  const set = (patch: Partial<EntryFormData>) =>
    onChange({ ...formData, ...patch });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {isEditing ? (
                    <Pencil className="h-4 w-4 text-primary" />
                  ) : (
                    <Plus className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {isEditing ? "Edit Entry" : "Add New Entry"}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    Semua field bertanda * wajib diisi
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <form id="canvasing-form" onSubmit={onSubmit} className="space-y-5">
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>Name</FieldLabel>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => set({ name: e.target.value })}
                      className={inputClass()}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel required>Contact Person</FieldLabel>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => set({ contact_person: e.target.value })}
                      className={inputClass()}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel required>Category</FieldLabel>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => set({ category: e.target.value })}
                      className={inputClass()}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel required>Sub Category</FieldLabel>
                    <input
                      type="text"
                      value={formData.sub_category}
                      onChange={(e) => set({ sub_category: e.target.value })}
                      className={inputClass()}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel required>Canvasser</FieldLabel>
                    <input
                      type="text"
                      value={formData.canvasser}
                      onChange={(e) => set({ canvasser: e.target.value })}
                      className={inputClass()}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel required>Visit Date</FieldLabel>
                    <input
                      type="date"
                      value={formData.visit_at}
                      onChange={(e) => set({ visit_at: e.target.value })}
                      className={inputClass()}
                      required
                    />
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-200" />

                {/* Status selector */}
                <div>
                  <FieldLabel required>Result Status</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {RESULT_STATUS_OPTIONS.map((status) => (
                      <StatusSelectButton
                        key={status}
                        status={status}
                        selected={formData.result_status === status}
                        onClick={() => set({ result_status: status })}
                      />
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <FieldLabel required>Notes</FieldLabel>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => set({ notes: e.target.value })}
                    className={inputClass()}
                    rows={3}
                    required
                  />
                </div>

                <div className="border-t border-dashed border-gray-200" />

                {/* Image upload */}
                <div>
                  <FieldLabel>Upload Images</FieldLabel>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center transition-colors hover:border-primary/30 hover:bg-primary/5">
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                    <div>
                      <p className="text-xs font-medium text-gray-600">
                        Klik untuk pilih foto
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        Bisa pilih beberapa sekaligus
                      </p>
                    </div>
                    {formData.files.length > 0 && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {formData.files.length} file dipilih
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files)
                          set({ files: Array.from(e.target.files) });
                      }}
                      className="sr-only"
                    />
                  </label>

                  {isEditing && hasExistingImages && (
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={formData.keepExistingImages}
                        onChange={(e) =>
                          set({ keepExistingImages: e.target.checked })
                        }
                        className="accent-primary"
                      />
                      Pertahankan foto yang sudah ada
                    </label>
                  )}
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="canvasing-form"
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {submitting
                  ? "Menyimpan..."
                  : isEditing
                  ? "Update Entry"
                  : "Buat Entry"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}