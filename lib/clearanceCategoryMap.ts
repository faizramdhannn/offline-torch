// Mapping category sheet (clearance_product_2) -> 7 grup catalog, dalam urutan tampil.
export const CATALOG_GROUPS = [
  "Backpack",
  "Sling Bag",
  "Waist Bag",
  "Pouch & Packing System",
  "Wallets & KeyChain",
  "Accessories",
  "Apparels",
] as const;

export type CatalogGroup = (typeof CATALOG_GROUPS)[number];

const CATEGORY_TO_GROUP: Record<string, CatalogGroup> = {
  "backpack": "Backpack",
  "tote backpack": "Backpack",
  "light travel backpack": "Backpack",

  "sling bag": "Sling Bag",
  "cross body bag": "Sling Bag",
  "messenger bag": "Sling Bag",
  "travel pouch": "Sling Bag",
  "tote bag": "Sling Bag",
  "duffle bag": "Sling Bag",

  "waist bag": "Waist Bag",

  "packing system": "Pouch & Packing System",
  "mini pouch": "Pouch & Packing System",
  "laptop sleeve": "Pouch & Packing System",
  "office series": "Pouch & Packing System",

  "neck wallet": "Wallets & KeyChain",

  "accessories": "Accessories",
  "pelengkap": "Accessories",
  "seasonal product": "Accessories",
  "prayer set": "Accessories",

  "apparel": "Apparels",
  "apparels": "Apparels",
  "sandal": "Apparels",
};

// Category yang belum terdaftar di mapping jatuh ke "Accessories" (semua pelengkap sisanya).
export function catalogGroupOf(category: string | undefined | null): CatalogGroup {
  const key = String(category || "").trim().toLowerCase();
  return CATEGORY_TO_GROUP[key] || "Accessories";
}

export function catalogGroupIndex(group: string): number {
  const i = (CATALOG_GROUPS as readonly string[]).indexOf(group);
  return i === -1 ? CATALOG_GROUPS.length : i;
}
