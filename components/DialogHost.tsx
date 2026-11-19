"use client";

import { useEffect, useRef, useState } from "react";
import Popup from "@/components/Popup";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { onDialog, type DialogRequest } from "@/lib/dialog";

// Satu-satunya tempat dialog dirender; dipanggil lewat lib/dialog.ts (askConfirm / askPrompt / notify).
export default function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cur = queue[0];

  useEffect(() => {
    onDialog((r) => setQueue((q) => [...q, r]));
    return () => onDialog(null);
  }, []);

  useEffect(() => {
    if (cur?.kind === "prompt") { setText(cur.value); setTimeout(() => inputRef.current?.select(), 30); }
  }, [cur]);

  const next = () => setQueue((q) => q.slice(1));

  return (
    <>
      <ConfirmationDialog
        open={cur?.kind === "confirm"}
        title={cur?.kind === "confirm" ? cur.title : ""}
        description={cur?.kind === "confirm" ? cur.description : undefined}
        confirmLabel={cur?.kind === "confirm" ? cur.label : undefined}
        danger={cur?.kind === "confirm" ? cur.danger : true}
        onCancel={() => { if (cur?.kind === "confirm") cur.resolve(false); next(); }}
        onConfirm={() => { if (cur?.kind === "confirm") cur.resolve(true); next(); }}
      />
      <Popup
        show={cur?.kind === "notice"}
        message={cur?.kind === "notice" ? cur.message : ""}
        type={cur?.kind === "notice" ? cur.type : "success"}
        onClose={next}
      />
      {cur?.kind === "prompt" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => { cur.resolve(null); next(); }}>
          <form
            className="modal-solid w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); cur.resolve(text); next(); }}
          >
            <h3 className="mb-3 text-sm font-semibold text-gray-900">{cur.title}</h3>
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} autoFocus className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { cur.resolve(null); next(); }} className="rounded-lg px-4 py-2 text-xs text-gray-500 hover:bg-gray-100">Batal</button>
              <button type="submit" className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-medium text-white hover:bg-gray-800">Simpan</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
