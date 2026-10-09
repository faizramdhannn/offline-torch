import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { sessionUser } from "@/lib/authz";
import { ensureDevicesSchema } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Keadaan musik toko SENDIRI (dari sesi) untuk tablet: status keinginan + jadwal + playlist yang dipakai.
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  await ensureDevicesSchema();
  const [state, rules] = await Promise.all([
    sql`SELECT playlist_id, volume, muted, playing, updated_at FROM store_music WHERE user_name = ${user.user_name}`,
    sql`SELECT id, days, start_min, end_min, playlist_id, volume FROM music_schedule WHERE user_name = ${user.user_name} ORDER BY start_min`,
  ]);
  const ids = new Set<number>();
  if (state[0]?.playlist_id) ids.add(Number(state[0].playlist_id));
  for (const r of rules as any[]) if (r.playlist_id) ids.add(Number(r.playlist_id));
  const playlists = ids.size
    ? await sql`SELECT id, name, yt_list AS list, yt_video AS video FROM music_playlists WHERE id = ANY(${[...ids]})`
    : [];
  return NextResponse.json(
    { state: state[0] || null, rules, playlists },
    { headers: { "Cache-Control": "no-store" } }
  );
}
