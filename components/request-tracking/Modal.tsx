"use client";

import { ReactNode, useEffect } from "react";
import { LucideIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

/**
 * Shared modal shell (backdrop + animated panel + header/body/footer slots)
 * for Add / Edit / Upload dialogs. Visual only — the page still owns open
 * state, submit handlers and validation.
 */
export function Modal({
  open,
  onClose,
  icon: Icon,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-lg",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

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
            className={`flex w-full ${maxWidth} max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div className="flex items-start gap-3">
                {Icon && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                )}
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                  {description && <div className="mt-0.5 text-[11px] text-gray-400">{description}</div>}
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

            {footer && <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
