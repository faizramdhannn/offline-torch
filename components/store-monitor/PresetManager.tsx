"use client";

import { useState } from "react";
import type { Group, Preset } from "./localLists";
import type { Playlist } from "./types";

// Kelola preset suasana (playlist + volume + acak) dan grup toko. Disimpan lokal di browser ini.
export default function PresetManager({
  presets, groups, playlists, selected, onPresets, onGroups, onClose,
}: {
  presets: Preset[];
  groups: Group[];
  playlists: Playlist[];
  selected: string[];
  onPresets: (p: Preset[]) => void;
  onGroups: (g: Group[]) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [pl, setPl] = useState<number | "">(playlists[0]?.id ?? "");
  const [vol, setVol] = useState(40);
  const [shuffle, setShuffle] = useState(true);
  const [gname, setGname] = useState("");
  const input = "rounded border border-gray-200 px-2 py-1 text-xs";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Preset suasana</h3>
        <p className="mb-3 text-xs text-gray-500">Satu tombol untuk mengatur playlist, volume, dan acak sekaligus. Tersimpan di browser ini.</p>
        <ul className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-200 text-xs">
          {presets.length === 0 && <li className="p-3 text-gray-400">Belum ada preset.</li>}
          {presets.map((p) => (
            <li key={p.name} className="flex items-center gap-2 p-2.5">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-gray-700">{p.name}</span>{" "}
                <span className="text-gray-400">{playlists.find((x) => x.id === p.playlist_id)?.name || "playlist dihapus"} · vol {p.volume} · {p.shuffle ? "acak" : "berurutan"}</span>
              </span>
              <button onClick={() => onPresets(presets.filter((x) => x.name !== p.name))} className="text-red-500">Hapus</button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama (mis. Pagi santai)" className={`${input} w-40`} />
          <select value={pl} onChange={(e) => setPl(Number(e.target.value))} className={`${input} min-w-0 flex-1`}>
            {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="flex items-center gap-1 text-gray-500">Vol <input type="number" min={0} max={100} value={vol} onChange={(e) => setVol(Number(e.target.value))} className={`${input} w-14`} /></label>
          <label className="flex items-center gap-1 text-gray-500"><input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Acak</label>
          <button
            onClick={() => {
              if (!name.trim() || pl === "") return;
              onPresets([...presets.filter((x) => x.name !== name.trim()), { name: name.trim(), playlist_id: Number(pl), volume: vol, shuffle }]);
              setName("");
            }}
            className="rounded-lg bg-gray-900 px-3 py-1 font-medium text-white"
          >Simpan</button>
        </div>

        <h3 className="mb-1 mt-6 text-sm font-semibold text-gray-800">Grup toko</h3>
        <p className="mb-3 text-xs text-gray-500">Centang toko di dashboard, lalu simpan sebagai grup (mis. Jawa Barat) untuk memilih banyak toko sekali klik.</p>
        <ul className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-200 text-xs">
          {groups.length === 0 && <li className="p-3 text-gray-400">Belum ada grup.</li>}
          {groups.map((g) => (
            <li key={g.name} className="flex items-center gap-2 p-2.5">
              <span className="min-w-0 flex-1 truncate"><span className="font-medium text-gray-700">{g.name}</span> <span className="text-gray-400">{g.users.length} toko</span></span>
              <button onClick={() => onGroups(groups.filter((x) => x.name !== g.name))} className="text-red-500">Hapus</button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 text-xs">
          <input value={gname} onChange={(e) => setGname(e.target.value)} placeholder={`Nama grup (${selected.length} toko dipilih)`} className={`${input} min-w-0 flex-1`} />
          <button
            disabled={!selected.length}
            onClick={() => {
              if (!gname.trim()) return;
              onGroups([...groups.filter((x) => x.name !== gname.trim()), { name: gname.trim(), users: selected }]);
              setGname("");
            }}
            className="rounded-lg bg-gray-900 px-3 py-1 font-medium text-white disabled:opacity-40"
          >Simpan pilihan</button>
        </div>
        <div className="mt-5 text-right">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100">Tutup</button>
        </div>
      </div>
    </div>
  );
}
