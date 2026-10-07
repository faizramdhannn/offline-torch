import type { NextRequest } from "next/server";
import { actorName } from "./authz";
import { insertActivity } from "./activityLog";

// Catat aksi penting (admin) ke activity log (Neon). Fire-and-forget: kegagalan mencatat
// tidak boleh menggagalkan aksinya.
export function audit(
  request: NextRequest | Request,
  method: string,
  text: string,
  entityType = "admin",
  entityId = ""
): void {
  const user = actorName(request) || "system";
  insertActivity({ user, method, activity_log: text, entity_type: entityType, entity_id: entityId }).catch((e) =>
    console.error("audit log gagal:", e)
  );
}
