import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { audit } from "@/lib/audit";
import { ensureDevicesSchema } from "@/lib/devices";
import { publishCommand, realtimeConfigured } from "@/lib/ablyServer";

export const dynamic = "force-dynamic";

// Ganti seluruh jadwal musik satu toko (atau beberapa toko sekaligus). Izin: user_setting (proxy).
// body: { user_names: string[], rules: [{ days:"1,2,..", start_min, end_min, playlist_id, volume }] }
export async function PUT(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const users: string[] = (Array.isArray(b.user_names) ? b.user_names : []).slice(0, 100).map((x: unknown) => String(x).slice(0, 80));
  const rules: any[] = Array.isArray(b.rules) ? b.rules.slice(0, 20) : [];
  if (!users.length) return NextResponse.json({ error: "Toko kosong" }, { status: 400 });
  const clean = [];
  for (const r of rules) {
    const days = String(r.days || "").split(",").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    const s = Number(r.start_min), e = Number(r.end_min);
    if (!days.length || !(s >= 0 && s < 1440 && e > s && e <= 1440)) return NextResponse.json({ error: "Jam jadwal tidak valid" }, { status: 400 });
    clean.push({
      days: [...new Set(days)].sort().join(","),
      start_min: s,
      end_min: e,
      playlist_id: r.playlist_id ? Number(r.playlist_id) : null,
      volume: Math.min(100, Math.max(0, Math.round(Number(r.volume) || 50))),
    });
  }
  await ensureDevicesSchema();
  for (const u of users) {
    await sql`DELETE FROM music_schedule WHERE user_name = ${u}`;
    for (const r of clean) {
      await sql`INSERT INTO music_schedule (user_name, days, start_min, end_min, playlist_id, volume)
                VALUES (${u}, ${r.days}, ${r.start_min}, ${r.end_min}, ${r.playlist_id}, ${r.volume})`;
    }
  }
  // tablet memuat ulang jadwalnya tanpa menunggu reload
  if (realtimeConfigured()) {
    await publishCommand({ type: "music", target: { user_names: users }, payload: { action: "refresh" }, ts: Date.now() }).catch(() => {});
  }
  audit(request, "PUT", `Jadwal musik diubah (${clean.length} aturan) untuk ${users.length} toko`, "music");
  return NextResponse.json({ ok: true });
}
