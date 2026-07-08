"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PopupProps {
  show: boolean;
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

/**
 * Shared success/error popup. Dismisses on any click (inside or outside)
 * or Escape, so every overlay in the app behaves the same way.
 */
export default function Popup({ show, message, type, onClose }: PopupProps) {
  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="flex flex-col items-center text-center">
              {type === "success" ? (
                <CheckCircle2 className="mb-2 h-9 w-9 text-green-600" />
              ) : (
                <XCircle className="mb-2 h-9 w-9 text-red-600" />
              )}
              <h3
                className={cn(
                  "text-sm font-semibold",
                  type === "success" ? "text-green-700" : "text-red-700"
                )}
              >
                {type === "success" ? "Success" : "Error"}
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-xs text-gray-600">{message}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
