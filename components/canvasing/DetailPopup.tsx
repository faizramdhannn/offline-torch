"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, Pencil, Image as ImageIcon } from "lucide-react";
import { Canvasing } from "@/types";
import { StatusBadge } from "./DomainBadges";

interface DriveImageProps {
  href: string;
  urls: string[];
  alt: string;
}

function DriveImage({ href, urls, alt }: DriveImageProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex-shrink-0"
    >
      <img
        src={urls[0]}
        alt={alt}
        className="h-56 w-56 cursor-pointer rounded-xl border border-gray-200 object-cover shadow-sm transition-opacity group-hover:opacity-80"
      />
    </a>
  );
}

interface DetailField {
  label: string;
  value: string | undefined;
}

interface DetailPopupProps {
  entry: Canvasing;
  onClose: () => void;
  onEdit: (entry: Canvasing) => void;
  canEdit: boolean;
  getDriveImageUrls: (url: string) => string[];
  toTitleCase: (s: string) => string;
}

/**
 * Full-detail slide-in modal for a single canvasing entry.
 * Shows images, all fields and a shortcut Edit button.
 */
export function DetailPopup({
  entry,
  onClose,
  onEdit,
  canEdit,
  getDriveImageUrls,
  toTitleCase,
}: DetailPopupProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const images = entry.image_url
    ? entry.image_url.split(";").filter((u) => u.trim())
    : [];

  const fields: DetailField[] = [
    { label: "Contact Person", value: entry.contact_person },
    { label: "Category", value: entry.category },
    { label: "Sub Category", value: entry.sub_category },
    { label: "Canvasser", value: entry.canvasser },
    { label: "Visit At", value: entry.visit_at },
  ];

  return (
    <AnimatePresence>
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
          className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {entry.name}
                </h2>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {toTitleCase(entry.store)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Images */}
            {images.length > 0 ? (
              <div className="flex justify-center gap-3 overflow-x-auto border-b border-gray-100 bg-gray-50 p-4">
                {images.map((url, i) => (
                  <DriveImage
                    key={i}
                    href={url}
                    urls={getDriveImageUrls(url)}
                    alt={`Image ${i + 1}`}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center gap-2 border-b border-gray-100 bg-gray-50 text-sm text-gray-400">
                <ImageIcon className="h-4 w-4" />
                Tidak ada foto
              </div>
            )}

            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5">
              {fields.map((f) => (
                <div key={f.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {f.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {f.value || "—"}
                  </p>
                </div>
              ))}

              {/* Status spans 1 column */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Result Status
                </p>
                <div className="mt-1">
                  <StatusBadge status={entry.result_status} />
                </div>
              </div>

              {/* Notes spans full width */}
              <div className="col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                  {entry.notes || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
            {canEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(entry);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-gray-800 px-4 text-xs font-medium text-white hover:bg-gray-700"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}