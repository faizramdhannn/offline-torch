import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { ensureDevicesSchema } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Ringkasan 7 hari per perangkat dari riwayat online/offline: jam online, jumlah putus, putus terakhir.
// Dihitung saat tab Ringkasan dibuka (tanpa cron/polling).
export async function GET(_request: NextRequest) {
  await ensureDevicesSchema();
  const days = 7;
  const since = new Date(Date.now() - days * 86400_000);
  const [devs, events] = await Promise.all([
    sql`SELECT d.device_id, d.store_name, d.user_name, d.kind, d.label, d.online, d.first_seen
        FROM store_devices d JOIN app_users u ON u.user_name = d.user_name AND u.active = true
        WHERE d.revoked = false ORDER BY d.store_name, d.kind`,
    sql`SELECT device_id, event, at FROM device_events
        WHERE event IN ('online','offline') AND at >= ${since.toISOString()} ORDER BY device_id, at ASC LIMIT 20000`,
  ]);
  const by = new Map<string, { event: string; at: number }[]>();
  for (const e of events as any[]) {
    const a = by.get(e.device_id) || [];
    a.push({ event: e.event, at: new Date(e.at).getTime() });
    by.set(e.device_id, a);
  }
  const now = Date.now();
  const out = (devs as any[]).map((d) => {
    const ev = by.get(d.device_id) || [];
    // Perangkat yang sedang online tanpa event 'online' di jendela ini dianggap online sejak awal jendela.
    let upSince: number | null = d.online && !(ev[0]?.event === "online") ? since.getTime() : null;
    let ms = 0;
    let drops = 0;
    let lastDrop: number | null = null;
    for (const e of ev) {
      if (e.event === "online") { if (upSince === null) upSince = e.at; }
      else if (upSince !== null) { ms += e.at - upSince; upSince = null; drops++; lastDrop = e.at; }
    }
    if (upSince !== null) ms += now - upSince;
    return {
      device_id: d.device_id, store_name: d.store_name || d.user_name, kind: d.kind, label: d.label,
      hours_online: Math.round((ms / 3600_000) * 10) / 10, drops, last_drop: lastDrop ? new Date(lastDrop).toISOString() : null,
    };
  });
  return NextResponse.json({ days, devices: out }, { headers: { "Cache-Control": "no-store" } });
}
