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
    const users = await getSheetData("users");
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

    const updatedRow = [
      user.id, // A
      user.name, // B
      user.user_name, // C
      user.password, // D
      permissions.dashboard ? "TRUE" : "FALSE", // E
      permissions.order_report ? "TRUE" : "FALSE", // F
      permissions.stock ? "TRUE" : "FALSE", // G
      permissions.registration_request ? "TRUE" : "FALSE", // H
      permissions.user_setting ? "TRUE" : "FALSE", // I
      permissions.petty_cash ? "TRUE" : "FALSE", // J
      permissions.petty_cash_add ? "TRUE" : "FALSE", // K
      permissions.petty_cash_export ? "TRUE" : "FALSE", // L
      permissions.petty_cash_balance ? "TRUE" : "FALSE", // M
      permissions.order_report_import ? "TRUE" : "FALSE", // N
      permissions.order_report_export ? "TRUE" : "FALSE", // O
      permissions.customer ? "TRUE" : "FALSE", // P
      permissions.voucher ? "TRUE" : "FALSE", // Q
      permissions.bundling ? "TRUE" : "FALSE", // R
      permissions.canvasing ? "TRUE" : "FALSE", // S
      permissions.canvasing_export ? "TRUE" : "FALSE", // T
      permissions.request ? "TRUE" : "FALSE", // U
      permissions.edit_request ? "TRUE" : "FALSE", // V
      permissions.analytics_order ? "TRUE" : "FALSE", // W
      permissions.stock_opname ? "TRUE" : "FALSE", // X
      permissions.stock_import ? "TRUE" : "FALSE", // Y
      permissions.stock_export ? "TRUE" : "FALSE", // Z
      permissions.stock_view_store ? "TRUE" : "FALSE", // AA
      permissions.stock_view_pca ? "TRUE" : "FALSE", // AB
      permissions.stock_view_master ? "TRUE" : "FALSE", // AC
      permissions.stock_view_hpp ? "TRUE" : "FALSE", // AD
      permissions.stock_view_hpt ? "TRUE" : "FALSE", // AE
      permissions.stock_view_hpj ? "TRUE" : "FALSE", // AF
      permissions.stock_refresh_javelin ? "TRUE" : "FALSE", // AG
      permissions.traffic_store ? "TRUE" : "FALSE", // AH
      permissions.report_store ? "TRUE" : "FALSE", // AI
      permissions.request_tracking ? "TRUE" : "FALSE", // AJ ← baru
      permissions.tracking_edit ? "TRUE" : "FALSE", // AK ← baru
      permissions.stock_opname_report ? "TRUE" : "FALSE", // AL ← baru
      permissions.attendance ? "TRUE" : "FALSE", // AN ← baru
      permissions.attendance_report ? "TRUE" : "FALSE", // AM ← baru
      timestamp, // AM
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
