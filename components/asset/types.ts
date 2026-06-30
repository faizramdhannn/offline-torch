// ─── Asset Types & Constants ────────────────────────────────────────────────

export interface Asset {
  id: string;
  type_asset: string;
  asset_name: string;
  link_url: string;
}

/** Same 3 types the original modal's <select> offered — kept verbatim. */
export const ASSET_TYPES = ["SOP", "Media", "Picture"] as const;

/** Badge color per asset type, using the shared <Badge /> variant palette. */
const TYPE_BADGE_VARIANT: Record<string, "info" | "purple" | "success" | "neutral"> = {
  SOP: "info",
  Media: "purple",
  Picture: "success",
};

export function getTypeBadgeVariant(type: string) {
  return TYPE_BADGE_VARIANT[type] ?? "neutral";
}

/** Small accent dot color per type — used on group headers / list rows. */
const TYPE_DOT_COLOR: Record<string, string> = {
  SOP: "bg-blue-500",
  Media: "bg-purple-500",
  Picture: "bg-emerald-500",
};

export function getTypeDotColor(type: string) {
  return TYPE_DOT_COLOR[type] ?? "bg-gray-400";
}
