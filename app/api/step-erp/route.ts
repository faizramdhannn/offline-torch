import { NextRequest, NextResponse } from "next/server";
import { getSheetData, appendSheetData, updateSheetRow, deleteSheetRows } from "@/lib/sheets";
import { getStepErpType, isValidStepErpType, STEP_ERP_STORES } from "@/lib/stepErpConfig";

function timestamp(): string {
  return new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

// GET /api/step-erp?type=material_request_store — list entries for one type
export async function GET(request: NextRequest) {
  try {
    const type = new URL(request.url).searchParams.get("type") || "";
    if (!isValidStepErpType(type)) {
      return NextResponse.json({ error: "Invalid or missing type" }, { status: 400 });
    }
    const data = await getSheetData(type);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching step-erp entries:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

// POST /api/step-erp — create a new entry (store + erp_number, all steps start unchecked)
export async function POST(request: NextRequest) {
  try {
    const { type, store, erp_number, created_by } = await request.json();

    if (!isValidStepErpType(type)) {
      return NextResponse.json({ error: "Invalid or missing type" }, { status: 400 });
    }
    const typeDef = getStepErpType(type)!;

    if (!store || !STEP_ERP_STORES.includes(store)) {
      return NextResponse.json({ error: "Invalid store" }, { status: 400 });
    }
    if (!erp_number || !String(erp_number).trim()) {
      return NextResponse.json({ error: "ERP number is required" }, { status: 400 });
    }

    const existing = await getSheetData(type);
    const maxId = existing.reduce((max: number, row: any) => {
      const id = parseInt(row.id) || 0;
      return id > max ? id : max;
    }, 0);
    const newId = maxId + 1;
    const now = timestamp();

    const row = [
      typeDef.id, // id_type
      newId, // id
      store,
      String(erp_number).trim(),
      ...typeDef.steps.map(() => "FALSE"),
      created_by || "",
      now,
      created_by || "",
      now,
    ];

    await appendSheetData(type, [row]);
    return NextResponse.json({ success: true, id: newId });
  } catch (error) {
    console.error("Error creating step-erp entry:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}

// PUT /api/step-erp — update an entry: store/erp_number and/or any subset of steps
export async function PUT(request: NextRequest) {
  try {
    const { type, id, store, erp_number, steps, updated_by } = await request.json();

    if (!isValidStepErpType(type)) {
      return NextResponse.json({ error: "Invalid or missing type" }, { status: 400 });
    }
    const typeDef = getStepErpType(type)!;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (store !== undefined && !STEP_ERP_STORES.includes(store)) {
      return NextResponse.json({ error: "Invalid store" }, { status: 400 });
    }

    const existing = await getSheetData(type);
    const rowIndex = existing.findIndex((row: any) => String(row.id) === String(id));
    if (rowIndex === -1) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    const current: any = existing[rowIndex];
    const sheetRowIndex = rowIndex + 2; // header is row 1

    const nextStore = store !== undefined ? store : current.store;
    const nextErpNumber =
      erp_number !== undefined ? String(erp_number).trim() : current.erp_number;
    const stepPatch: Record<string, boolean> =
      steps && typeof steps === "object" ? steps : {};
    const now = timestamp();

    const row = [
      current.id_type,
      current.id,
      nextStore,
      nextErpNumber,
      ...typeDef.steps.map((s) =>
        Object.prototype.hasOwnProperty.call(stepPatch, s.key)
          ? stepPatch[s.key]
            ? "TRUE"
            : "FALSE"
          : current[s.key] === "TRUE"
          ? "TRUE"
          : "FALSE"
      ),
      current.created_by ?? "",
      current.created_at ?? "",
      updated_by || current.update_by || "",
      now,
    ];

    await updateSheetRow(type, sheetRowIndex, row);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating step-erp entry:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

// DELETE /api/step-erp — remove an entry
export async function DELETE(request: NextRequest) {
  try {
    const { type, id } = await request.json();

    if (!isValidStepErpType(type)) {
      return NextResponse.json({ error: "Invalid or missing type" }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = await getSheetData(type);
    const rowIndex = existing.findIndex((row: any) => String(row.id) === String(id));
    if (rowIndex === -1) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await deleteSheetRows(type, [rowIndex + 2]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting step-erp entry:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
