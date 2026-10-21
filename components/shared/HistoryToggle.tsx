"use client";
import { historyAll, setHistoryAll } from "@/lib/historyFlag";
import { WINDOW_DAYS } from "@/lib/rowWindow";

// Penjelasan jendela data + tombol untuk memuat seluruh riwayat (memuat ulang halaman supaya semua pengambilan data ikut).
export default function HistoryToggle({ mod, className = "" }: { mod: string; className?: string }) {
  const all = historyAll(mod);
  return (
    <p className={`text-[11px] text-gray-400 ${className}`}>
      {all ? "Menampilkan seluruh riwayat." : `Menampilkan ${WINDOW_DAYS} hari terakhir + yang belum selesai.`}{" "}
      <button
        type="button"
        onClick={() => { setHistoryAll(mod, !all); window.location.reload(); }}
        className="font-semibold text-primary underline-offset-2 hover:underline"
      >
        {all ? "Kembali ke ringkas" : "Tampilkan semua riwayat"}
      </button>
    </p>
  );
}
