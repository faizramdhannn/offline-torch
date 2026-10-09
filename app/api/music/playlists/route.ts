import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { audit } from "@/lib/audit";
import { ensureDevicesSchema, parseYouTube } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Daftar playlist YouTube (nama + tautan). Izin: user_setting (proxy).
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 80);
  const url = String(b.url || "").trim().slice(0, 300);
  const yt = parseYouTube(url);
  if (!name || !yt) return NextResponse.json({ error: "Nama dan tautan YouTube (playlist/video) wajib valid" }, { status: 400 });
  await ensureDevicesSchema();
  const r = await sql`INSERT INTO music_playlists (name, url, yt_list, yt_video) VALUES (${name}, ${url}, ${yt.list}, ${yt.video}) RETURNING id`;
  audit(request, "POST", `Playlist ditambah: ${name}`, "music", String(r[0].id));
  return NextResponse.json({ ok: true, id: r[0].id });
}

export async function PUT(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id);
  const name = String(b.name || "").trim().slice(0, 80);
  const url = String(b.url || "").trim().slice(0, 300);
  const yt = parseYouTube(url);
  if (!id || !name || !yt) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  await ensureDevicesSchema();
  await sql`UPDATE music_playlists SET name = ${name}, url = ${url}, yt_list = ${yt.list}, yt_video = ${yt.video} WHERE id = ${id}`;
  audit(request, "PUT", `Playlist diubah: ${name}`, "music", String(id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  await ensureDevicesSchema();
  await sql`UPDATE store_music SET playlist_id = NULL WHERE playlist_id = ${id}`;
  await sql`DELETE FROM music_schedule WHERE playlist_id = ${id}`;
  await sql`DELETE FROM music_playlists WHERE id = ${id}`;
  audit(request, "DELETE", "Playlist dihapus", "music", String(id));
  return NextResponse.json({ ok: true });
}
