import type { NextRequest } from "next/server";
import { actorName } from "./authz";

// Catat aksi penting (admin) ke activity_log — format sama dengan POST /api/activity-log.
// Fire-and-forget: kegagalan mencatat tidak boleh menggagalkan aksinya.
export function audit(
  request: NextRequest | Request,
  method: string,
  text: string,
  entityType = "admin",
  entityId = ""
): void {
  const user = actorName(request) || "system";
  (async () => {
    const { appendSheetData } = await import("./sheets");
    const timestamp = new Date().toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta",
    });
    await appendSheetData("activity_log", [[Date.now().toString(), timestamp, user, method, text, entityType, entityId]]);
  })().catch((e) => console.error("audit log gagal:", e));
}
