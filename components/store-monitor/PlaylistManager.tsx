"use client";

import { useState } from "react";
import type { Playlist } from "./types";

export default function PlaylistManager({ playlists, onChanged }: { playlists: Playlist[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const call = async (method: string, body: object) => {
    const r = await fetch("/api/music/playlists", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Gagal"); return false; }
    setErr("");
    onChanged();
    return true;
  };
  return (
    <div className="max-w-2xl">
      <p className="mb-3 text-xs text-gray-500">Tempel tautan playlist atau video YouTube. Playlist diputar acak dan berulang.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama (mis. Santai Pagi)" className="w-48 rounded-lg border border-gray-200 px-3 py-1.5 text-xs" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/playlist?list=…" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs" />
        <button onClick={async () => { if (await call("POST", { name, url })) { setName(""); setUrl(""); } }} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">Tambah</button>
      </div>
      {err && <p className="mb-3 text-xs text-red-500">{err}</p>}
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {playlists.length === 0 && <li className="p-4 text-xs text-gray-400">Belum ada playlist.</li>}
        {playlists.map((p) => (
          <li key={p.id} className="flex items-center gap-3 p-3 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-700">{p.name}</p>
              <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-gray-400 hover:underline">{p.url}</a>
            </div>
            <button onClick={() => { const n = prompt("Nama playlist", p.name); if (n) call("PUT", { id: p.id, name: n, url: p.url }); }} className="text-gray-500">Ubah nama</button>
            <button onClick={() => confirm(`Hapus playlist "${p.name}"? Jadwal yang memakainya ikut terhapus.`) && call("DELETE", { id: p.id })} className="text-red-500">Hapus</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
