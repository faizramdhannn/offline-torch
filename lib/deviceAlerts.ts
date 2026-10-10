import { sql } from "./neon";
import { notifyUsersWithPermission } from "./notifications";
import { sendTelegram } from "./telegram";
import { DEFAULT_HOURS, isOpenNow, normalizeHours, type StoreHours } from "./storeHours";

// Peringatan perangkat → notifikasi dalam aplikasi untuk pemegang akses Settings.
// Dipicu oleh webhook Ably dan saat dashboard dibuka (tanpa cron/polling).
// Klaim lewat UPDATE ... RETURNING supaya satu kejadian hanya memberi satu notifikasi walau dipicu bersamaan.
// Tablet offline hanya diperingatkan saat toko itu BUKA (jam buka per toko + hari libur; bawaan 09–22 WIB).
export async function checkDeviceAlerts(): Promise<void> {
  const cand = await sql`
    SELECT device_id, store_name, user_name, label FROM store_devices
    WHERE kind = 'tablet' AND revoked = false AND online = false
      AND offline_since IS NOT NULL AND offline_since < now() - interval '10 minutes'
      AND (alerted_at IS NULL OR alerted_at < offline_since)
  `;
  if ((cand as any[]).length) {
    const hrows = await sql`SELECT user_name, weekly, closed_dates, follow FROM store_hours`;
    const hours = new Map<string, StoreHours>();
    for (const r of hrows as any[]) {
      const h = normalizeHours({ weekly: r.weekly, closed_dates: r.closed_dates, follow: r.follow });
      if (h) hours.set(r.user_name, h);
    }
    for (const c of cand as any[]) {
      if (!isOpenNow(hours.get(c.user_name) || DEFAULT_HOURS)) continue;
      // klaim agar satu kejadian hanya satu notifikasi walau dipicu bersamaan
      const claimed = await sql`
        UPDATE store_devices SET alerted_at = now()
        WHERE device_id = ${c.device_id} AND (alerted_at IS NULL OR alerted_at < offline_since)
        RETURNING device_id`;
      if (!claimed.length) continue;
      const msg = `${c.label || "Tablet"} ${c.store_name || c.user_name} offline lebih dari 10 menit (toko sedang buka).`;
      await sendTelegram(`Tablet toko offline: ${msg}`);
      await notifyUsersWithPermission("user_setting", {
        type: "device_offline",
        title: "Tablet toko offline",
        message: msg,
        sourceFeature: "store_monitor",
      }).catch((e) => console.error("alert offline", e));
    }
  }

  const low = await sql`
    UPDATE store_devices SET alerted_at = now()
    WHERE revoked = false AND online = true AND battery IS NOT NULL AND battery <= 15 AND charging = false
      AND (alerted_at IS NULL OR alerted_at < now() - interval '6 hours')
    RETURNING store_name, user_name, label, kind, battery
  `;
  for (const d of low as any[]) {
    const msg = `${d.label || (d.kind === "tablet" ? "Tablet" : "PC")} ${d.store_name || d.user_name} tersisa ${d.battery}% dan tidak mengisi.`;
    await sendTelegram(`Baterai rendah: ${msg}`);
    await notifyUsersWithPermission("user_setting", {
      type: "device_battery",
      title: "Baterai perangkat toko rendah",
      message: msg,
      sourceFeature: "store_monitor",
    }).catch((e) => console.error("alert battery", e));
  }
}
