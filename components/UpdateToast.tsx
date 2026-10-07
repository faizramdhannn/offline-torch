"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { UPDATE_EVENT } from "@/lib/buildInfo";

const SNOOZE_MS = 15 * 60 * 1000;
const SNOOZE_KEY = "update_toast_snooze_until";

/**
 * Notifikasi "Versi baru tersedia" — meluncur dari kanan seperti notifikasi WhatsApp.
 * Muncul bila server sudah menjalankan deployment yang berbeda dari yang dimuat browser ini
 * (lihat lib/buildInfo.ts). Tidak memuat ulang otomatis supaya isian form tidak hilang.
 */
export default function UpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onUpdate = () => {
      try {
        if (Date.now() < Number(sessionStorage.getItem(SNOOZE_KEY) || 0)) return;
      } catch {}
      setShow(true);
    };
    window.addEventListener(UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(UPDATE_EVENT, onUpdate);
  }, []);

  const later = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch {}
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed right-3 top-16 z-[70] w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl sm:right-5"
        >
          <div className="flex gap-3 p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <RefreshCw className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Versi baru tersedia</p>
              <p className="mt-0.5 text-xs text-gray-600">
                Aplikasi baru saja diperbarui. Muat ulang halaman untuk mendapatkan perbaikan terbaru.
                Pastikan data yang sedang diisi sudah disimpan.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
                </button>
                <button onClick={later} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-black/5">
                  Nanti
                </button>
              </div>
            </div>
            <button onClick={later} aria-label="Tutup" className="h-6 w-6 flex-none rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-1 bg-emerald-500" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
