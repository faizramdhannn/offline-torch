import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { sessionUser } from "@/lib/authz";
import { DEVICE_ID_RE, ensureDevicesSchema } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Keadaan musik toko SENDIRI (dari sesi) untuk tablet: status keinginan + jadwal + playlist yang dipakai.
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  await ensureDevicesSchema();
  const [state, rules] = await Promise.all([
    sql`SELECT playlist_id, volume, muted, playing, shuffle, updated_at FROM store_music WHERE user_name = ${user.user_name}`,
    sql`SELECT id, days, start_min, end_min, playlist_id, volume, shuffle FROM music_schedule WHERE user_name = ${user.user_name} ORDER BY start_min`,
  ]);
  // Apakah perangkat INI pemutar musik toko? Pilihan eksplisit (music_player) menang; tanpa pilihan = tablet.
  const dev = new URL(request.url).searchParams.get("deviceId") || "";
  let player = false;
  if (DEVICE_ID_RE.test(dev)) {
    const rows = await sql`SELECT device_id, kind, music_player FROM store_devices WHERE user_name = ${user.user_name} AND revoked = false`;
    const me = (rows as any[]).find((r) => r.device_id === dev);
    if (me) {
      const explicit = (rows as any[]).some((r) => r.music_player === true);
      player = explicit ? me.music_player === true : me.kind === "tablet";
    }
  }
  const ids = new Set<number>();
  if (state[0]?.playlist_id) ids.add(Number(state[0].playlist_id));
  for (const r of rules as any[]) if (r.playlist_id) ids.add(Number(r.playlist_id));
  const playlists = ids.size
    ? await sql`SELECT id, name, yt_list AS list, yt_video AS video FROM music_playlists WHERE id = ANY(${[...ids]})`
    : [];
  return NextResponse.json(
    { state: state[0] || null, rules, playlists, player },
    { headers: { "Cache-Control": "no-store" } }
  );
}
