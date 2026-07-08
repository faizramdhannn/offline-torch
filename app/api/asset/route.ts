import { NextRequest, NextResponse } from "next/server";
import { getSheetData, appendSheetData, updateSheetRow } from "@/lib/sheets";

// GET /api/asset — fetch all assets
export async function GET() {
  try {
    const data = await getSheetData("asset_store");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

// POST /api/asset — create new asset
export async function POST(request: NextRequest) {
  try {
    const { type_asset, asset_name, link_url } = await request.json();

    if (!type_asset || !asset_name || !link_url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await getSheetData("asset_store");
    const maxId = existing.reduce((max: number, row: any) => {
      const id = parseInt(row.id) || 0;
      return id > max ? id : max;
    }, 0);
    const newId = maxId + 1;

    await appendSheetData("asset_store", [[newId, type_asset, asset_name, link_url]]);

    return NextResponse.json({ success: true, id: newId });
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}

// PUT /api/asset — update existing asset
export async function PUT(request: NextRequest) {
  try {
    const { id, type_asset, asset_name, link_url } = await request.json();

    if (!id || !type_asset || !asset_name || !link_url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await getSheetData("asset_store", { skipCache: true });
    const rowIndex = existing.findIndex((row: any) => String(row.id) === String(id));

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // +2 because sheet rows start at 1 and row 1 is headers
    const sheetRowIndex = rowIndex + 2;
    await updateSheetRow("asset_store", sheetRowIndex, [id, type_asset, asset_name, link_url]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

// DELETE /api/asset — delete asset by id (clear the row by overwriting with empty, or use a flag)
// Since there's no delete in sheets.ts, we'll implement it as a soft approach:
// reload all rows, filter out the deleted one, rewrite the whole sheet.
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = await getSheetData("asset_store", { skipCache: true });
    const rowIndex = existing.findIndex((row: any) => String(row.id) === String(id));

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Import updateSheetDataWithHeader to rewrite full sheet
    const { updateSheetDataWithHeader } = await import("@/lib/sheets");

    const filtered = existing.filter((row: any) => String(row.id) !== String(id));
    const newData = [
      ["id", "type_asset", "asset_name", "link_url"],
      ...filtered.map((row: any) => [row.id, row.type_asset, row.asset_name, row.link_url]),
    ];

    await updateSheetDataWithHeader("asset_store", newData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}