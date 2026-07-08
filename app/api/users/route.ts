import { NextRequest, NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";
import { google } from "googleapis";

const SPREADSHEET_MAP: Record<string, string> = {
  users: process.env.SPREADSHEET_USERS || "",
};

function getSpreadsheetId(sheetName: string): string {
  return SPREADSHEET_MAP[sheetName] || "";
}

async function updateSheetRow(
  sheetName: string,
  rowIndex: number,
  data: any[],
) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const numColumns = data.length;
    let endColumn = "";
    if (numColumns <= 26) {
      endColumn = String.fromCharCode(64 + numColumns);
    } else {
      const firstChar = String.fromCharCode(
        64 + Math.floor((numColumns - 1) / 26),
      );
      const secondChar = String.fromCharCode(65 + ((numColumns - 1) % 26));
      endColumn = firstChar + secondChar;
    }
    const range = `${sheetName}!A${rowIndex}:${endColumn}${rowIndex}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(sheetName),
      range: range,
      valueInputOption: "RAW",
      requestBody: { values: [data] },
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating sheet row:", error);
    throw error;
  }
}

// Helper: resolve permission value — merges existing user value with incoming change.
// If the key exists in `changes`, use the new value; otherwise keep the existing
// sheet value (which is already "TRUE" or "FALSE" or any truthy string).
function resolvePermission(
  changes: Record<string, boolean>,
  existing: string | null | undefined,
  key: string,
): string {
  if (key in changes) {
    return changes[key] ? "TRUE" : "FALSE";
  }
  // Keep existing sheet value as-is; treat anything that isn't "TRUE" as FALSE
  return existing === "TRUE" ? "TRUE" : "FALSE";
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData("users");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, permissions } = await request.json();
    const users = await getSheetData("users", { skipCache: true });
    const userIndex = users.findIndex((u: any) => u.id === id);
    if (userIndex === -1) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const user = users[userIndex];
    const rowIndex = userIndex + 2;
    const now = new Date();
    const timestamp = now.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });

    // `permissions` only contains the changed keys (partial update from frontend).
    // We merge with existing user data so unchanged permissions are preserved.
    const p = permissions as Record<string, boolean>;
    const r = (key: string) => resolvePermission(p, user[key], key);

    const updatedRow = [
      user.id,                      // A
      user.name,                    // B
      user.user_name,               // C
      user.password,                // D
      r("dashboard"),               // E
      r("order_report"),            // F
      r("stock"),                   // G
      r("registration_request"),    // H
      r("user_setting"),            // I
      r("petty_cash"),              // J
      r("petty_cash_add"),          // K
      r("petty_cash_export"),       // L
      r("petty_cash_balance"),      // M
      r("order_report_import"),     // N
      r("order_report_export"),     // O
      r("customer"),                // P
      r("voucher"),                 // Q
      r("bundling"),                // R
      r("canvasing"),               // S
      r("canvasing_export"),        // T
      r("request"),                 // U
      r("edit_request"),            // V
      r("analytics_order"),         // W
      r("stock_opname"),            // X
      r("stock_import"),            // Y
      r("stock_export"),            // Z
      r("stock_view_store"),        // AA
      r("stock_view_pca"),          // AB
      r("stock_view_master"),       // AC
      r("stock_view_hpp"),          // AD
      r("stock_view_hpt"),          // AE
      r("stock_view_hpj"),          // AF
      r("stock_refresh_javelin"),   // AG
      r("traffic_store"),           // AH
      r("report_store"),            // AI
      r("request_tracking"),        // AJ
      r("tracking_edit"),           // AK
      r("stock_opname_report"),     // AL
      r("attendance"),              // AM
      r("attendance_report"),       // AN
      r("invoice"),                 // AO
      r("invoice_create"),          // AP
      r("invoice_edit"),            // AQ
      r("invoice_delete"),          // AR
      r("invoice_master"),          // AS
      r("sales_view"),              // AT
      r("sales_view_all"),          // AU
      r("attendance_store"),        // AV
      r("attendance_store_all"),    // AW
      r("material_issue"),          // AX
      r("material_issue_all"),      // AY
      r("asset_store"),             // AZ
      timestamp,                    // BA
      r("step_erp"),                 // BB
      r("step_erp_all"),             // BC
    ];

    console.log(`Updating row ${rowIndex} with ${updatedRow.length} columns`);
    await updateSheetRow("users", rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}