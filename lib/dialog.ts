// Pengganti confirm()/prompt()/alert() bawaan browser: dialog dalam aplikasi (dirender oleh components/DialogHost.tsx
// yang dipasang di root layout). Dipakai seperti biasa dengan await:  if (!(await askConfirm("Hapus?"))) return;
export type DialogRequest =
  | { kind: "confirm"; title: string; description?: string; label: string; danger: boolean; resolve: (ok: boolean) => void }
  | { kind: "prompt"; title: string; value: string; resolve: (v: string | null) => void }
  | { kind: "notice"; message: string; type: "success" | "error" };

type Listener = (r: DialogRequest) => void;
let listener: Listener | null = null;
export const onDialog = (fn: Listener | null) => { listener = fn; };

const DANGER = /hapus|delete|cancel|putuskan|reset|tolak|reject|void|batalkan/i;

export interface ConfirmOptions { title?: string; description?: string; label?: string; danger?: boolean }

// Pesan panjang → judul = kalimat pertama, sisanya keterangan.
export function askConfirm(message: string, opt: ConfirmOptions = {}): Promise<boolean> {
  const m = String(message || "").trim();
  const cut = m.search(/[?.!]\s/);
  const title = opt.title ?? (cut > 0 ? m.slice(0, cut + 1) : m);
  const description = opt.description ?? (cut > 0 ? m.slice(cut + 1).trim() : undefined);
  const danger = opt.danger ?? DANGER.test(m);
  return new Promise((resolve) => {
    if (!listener) return resolve(false); // host belum terpasang: batal, jangan lanjut aksi berisiko
    listener({ kind: "confirm", title, description, label: opt.label ?? (danger ? "Ya, lanjut" : "Ya"), danger, resolve });
  });
}

export function askPrompt(title: string, value = ""): Promise<string | null> {
  return new Promise((resolve) => {
    if (!listener) return resolve(null);
    listener({ kind: "prompt", title, value, resolve });
  });
}

export function notify(message: string, type: "success" | "error" = "error") {
  listener?.({ kind: "notice", message: String(message || ""), type });
}
