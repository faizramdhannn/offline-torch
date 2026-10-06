import { generateCatalogResponse } from "@/lib/onlineCatalogPdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Sheet: clearance_catalog (kolom sama dengan online_catalog).
export function GET(request: Request) {
  return generateCatalogResponse(request, {
    key: "clearance",
    sheet: "clearance_catalog",
    title: "Clearance Catalog",
    showStock: true,
    note: "S&K Berlaku",
    filename: "Torch_Clearance_Catalog.pdf",
  });
}
