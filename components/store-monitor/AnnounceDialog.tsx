"use client";

import { useState } from "react";
import type { Template } from "./localLists";

// Kirim pengumuman layar penuh, dengan template pesan yang tersimpan (dibagi ke semua admin).
export default function AnnounceDialog({
  label, templates, onTemplates, onSend, onClose,
}: {
  label: string;
  templates: Template[];
  onTemplates: (t: Template[]) => void;
  onSend: (text: string, seconds: number) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [busy, setBusy] = useState(false);
  const input = "rounded border border-gray-200 px-2 py-1.5 text-xs";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Pengumuman · {label}</h3>
        {templates.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <span key={t.name} className="inline-flex items-center overflow-hidden rounded-full border border-gray-200 text-xs">
                <button onClick={() => { setText(t.text); setSeconds(t.seconds); }} className="px-3 py-1.5 text-gray-600 hover:bg-gray-50">{t.name}</button>
                <button onClick={() => onTemplates(templates.filter((x) => x.name !== t.name))} className="border-l border-gray-200 px-2 py-1.5 text-gray-400 hover:text-red-500" aria-label={`Hapus template ${t.name}`}>×</button>
              </span>
            ))}
          </div>
        )}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={300} placeholder="Isi pengumuman…" className={`${input} w-full`} />
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <label className="flex items-center gap-1">Tampil <input type="number" min={5} max={600} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className={`${input} w-16`} /> detik</label>
          <button
            disabled={!text.trim()}
            onClick={() => {
              const name = prompt("Nama template (mis. Toko tutup 15 menit)");
              if (name?.trim()) onTemplates([...templates.filter((x) => x.name !== name.trim()), { name: name.trim().slice(0, 40), text: text.trim(), seconds }]);
            }}
            className="ml-auto underline disabled:opacity-40"
          >Simpan sebagai template</button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-gray-500 hover:bg-gray-100">Batal</button>
          <button
            disabled={!text.trim() || busy}
            onClick={async () => { setBusy(true); try { await onSend(text.trim(), seconds); } finally { setBusy(false); } }}
            className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >{busy ? "Mengirim…" : "Kirim"}</button>
        </div>
      </div>
    </div>
  );
}
