import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { DEVICE_ID_RE, ensureDevicesSchema, logDeviceEvent } from "@/lib/devices";
import { checkDeviceAlerts } from "@/lib/deviceAlerts";

export const dynamic = "force-dynamic";

// Webhook Ably (Integrations → Webhook, source: Presence, channel "stores").
// Mencatat online/offline & baterai ke Neon + riwayat + peringatan. Diamankan secret di query (?s=).
// Update presence biasa (pindah halaman) tidak menyentuh database kecuali baterai berubah.
const ACTIONS: Record<string, string> = { "1": "present", "2": "enter", "3": "leave", "4": "update", present: "present", enter: "enter", leave: "leave", update: "update" };

// Baterai terakhir per perangkat (memori instance): update presence tanpa perubahan baterai tidak menyentuh database.
const lastBattery = new Map<string, string>();

export async function POST(request: NextRequest) {
  const secret = process.env.REALTIME_WEBHOOK_SECRET;
  if (!secret || new URL(request.url).searchParams.get("s") !== secret) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const items: any[] = Array.isArray(body?.items) ? body.items : body ? [body] : [];
  const events: { clientId: string; action: string; data: any }[] = [];
  for (const it of items) {
    for (const p of it?.data?.presence || []) {
      const action = ACTIONS[String(p.action)];
      const clientId = String(p.clientId || "");
      if (!action || !DEVICE_ID_RE.test(clientId)) continue;
      let data = p.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { data = {}; }
      }
      events.push({ clientId, action, data: data || {} });
    }
  }
  if (events.length) {
    await ensureDevicesSchema();
    for (const e of events) {
      const bat = typeof e.data.battery === "number" ? Math.round(e.data.battery) : null;
      const chg = typeof e.data.charging === "boolean" ? e.data.charging : null;
      if (e.action === "update") {
        const sig = `${bat}|${chg}`;
        if (lastBattery.get(e.clientId) === sig) continue;
        lastBattery.set(e.clientId, sig);
        await sql`
          UPDATE store_devices SET battery = ${bat}, charging = ${chg}
          WHERE device_id = ${e.clientId} AND (battery IS DISTINCT FROM ${bat} OR charging IS DISTINCT FROM ${chg})
        `;
      } else if (e.action === "leave") {
        const r = await sql`
          UPDATE store_devices SET online = false, offline_since = now(), last_seen = now()
          WHERE device_id = ${e.clientId} AND online = true RETURNING device_id
        `;
        if (r.length) await logDeviceEvent(e.clientId, "offline");
      } else {
        const prev = await sql`SELECT online FROM store_devices WHERE device_id = ${e.clientId}`;
        if (!prev.length) continue;
        await sql`
          UPDATE store_devices SET online = true, offline_since = NULL, last_seen = now(), battery = ${bat}, charging = ${chg}
          WHERE device_id = ${e.clientId}
        `;
        if (prev[0].online === false) await logDeviceEvent(e.clientId, "online");
      }
    }
    await checkDeviceAlerts().catch((er) => console.error("device alerts", er));
  }
  return NextResponse.json({ ok: true });
}
