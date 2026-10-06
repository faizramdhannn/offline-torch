import { generateCatalogResponse } from "@/lib/onlineCatalogPdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Sheet: online_catalog (id, artikel, category, color, stock, image_url, price).
export function GET(request: Request) {
  return generateCatalogResponse(request, {
    key: "online",
    sheet: "online_catalog",
    title: "Online Catalog",
    filename: "Torch_Online_Catalog.pdf",
  });
}
