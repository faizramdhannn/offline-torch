import { sql } from "./neon";
import { notifyUsersWithPermission } from "./notifications";

// Peringatan perangkat → notifikasi dalam aplikasi untuk pemegang akses Settings.
// Dipicu oleh webhook Ably dan saat dashboard dibuka (tanpa cron/polling).
// Klaim lewat UPDATE ... RETURNING supaya satu kejadian hanya memberi satu notifikasi walau dipicu bersamaan.
const OPEN_FROM = 9;
const OPEN_TO = 22; // jam buka toko (WIB); di luar jam ini tablet mati dianggap wajar

export async function checkDeviceAlerts(): Promise<void> {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  const open = hour >= OPEN_FROM && hour < OPEN_TO;

  if (open) {
    const off = await sql`
      UPDATE store_devices SET alerted_at = now()
      WHERE kind = 'tablet' AND revoked = false AND online = false
        AND offline_since IS NOT NULL AND offline_since < now() - interval '10 minutes'
        AND (alerted_at IS NULL OR alerted_at < offline_since)
      RETURNING store_name, user_name, label
    `;
    for (const d of off as any[]) {
      await notifyUsersWithPermission("user_setting", {
        type: "device_offline",
        title: "Tablet toko offline",
        message: `${d.label || "Tablet"} ${d.store_name || d.user_name} offline lebih dari 10 menit.`,
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
    await notifyUsersWithPermission("user_setting", {
      type: "device_battery",
      title: "Baterai perangkat toko rendah",
      message: `${d.label || (d.kind === "tablet" ? "Tablet" : "PC")} ${d.store_name || d.user_name} tersisa ${d.battery}% dan tidak mengisi.`,
      sourceFeature: "store_monitor",
    }).catch((e) => console.error("alert battery", e));
  }
}
