import { generateCatalogResponse } from "@/lib/onlineCatalogPdf";
import { CATALOG_CONFIGS } from "@/lib/catalogs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return generateCatalogResponse(request, CATALOG_CONFIGS.online);
}
