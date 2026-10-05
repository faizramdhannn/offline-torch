// Mapping category sheet online_catalog -> grup katalog, urut dari barang
// terbesar ke terkecil. Category yang tidak terdaftar jatuh ke "Accessories".
export const ONLINE_GROUPS = [
  { name: "Backpack", color: "#0b7a8f" },
  { name: "Sling Bag", color: "#b45309" },
  { name: "Waist Bag", color: "#be123c" },
  { name: "Travel Pouch", color: "#15803d" },
  { name: "Accessories", color: "#6d28d9" },
] as const;

export type OnlineGroupName = (typeof ONLINE_GROUPS)[number]["name"];

const CATEGORY_TO_GROUP: Record<string, OnlineGroupName> = {
  "backpack": "Backpack",
  "tote backpack": "Backpack",
  "light travel backpack": "Backpack",
  "travel backpack": "Backpack",
  "duffle bag": "Backpack",
  "drawstring bag": "Backpack",

  "crossbody & shoulder bag": "Sling Bag",
  "cross body bag": "Sling Bag",
  "sling bag": "Sling Bag",
  "chest bag": "Sling Bag",
  "messenger bag": "Sling Bag",
  "tote bag": "Sling Bag",
  "clutch": "Sling Bag",
  "clutch bag": "Sling Bag",
  "bicycle bag": "Sling Bag",

  "waist bag": "Waist Bag",

  "packing system": "Travel Pouch",
  "mini pouch": "Travel Pouch",
  "foldable pouch": "Travel Pouch",
  "travel pouch": "Travel Pouch",
  "neck wallet": "Travel Pouch",
  "office series": "Travel Pouch",
  "laptop sleeve": "Travel Pouch",
};

// Category kosong di sheet -> tebak dari nama artikel (mis. "... Tote Backpack").
const NAME_KEYWORDS: [RegExp, OnlineGroupName][] = [
  [/backpack/i, "Backpack"],
  [/waist/i, "Waist Bag"],
  [/sling|shoulder|crossbody|cross body/i, "Sling Bag"],
  [/pouch|packing/i, "Travel Pouch"],
];

export function onlineGroupOf(category: string | undefined | null, artikel?: string | null): OnlineGroupName {
  const key = String(category || "").trim().toLowerCase();
  if (CATEGORY_TO_GROUP[key]) return CATEGORY_TO_GROUP[key];
  if (!key && artikel) {
    for (const [re, group] of NAME_KEYWORDS) if (re.test(artikel)) return group;
  }
  return "Accessories";
}

export function onlineGroupIndex(group: string): number {
  const i = ONLINE_GROUPS.findIndex((g) => g.name === group);
  return i === -1 ? ONLINE_GROUPS.length : i;
}

const COLOR_HEX: Record<string, string> = {
  black: "#111111",
  white: "#ffffff",
  grey: "#9ca3af",
  gray: "#9ca3af",
  "dark grey": "#4b5563",
  navy: "#1f2a44",
  blue: "#2563eb",
  "legion blue": "#3b5b92",
  "light blue": "#7dd3fc",
  red: "#dc2626",
  green: "#16a34a",
  "dark green": "#14532d",
  "cactus green": "#6b8e6b",
  greenish: "#4d7c0f",
  olive: "#6b705c",
  brown: "#7c4a2d",
  cream: "#f3ead3",
  khaki: "#c3b091",
  yellow: "#facc15",
  orange: "#f97316",
  terracotta: "#c8553d",
  tosca: "#14b8a6",
  pink: "#ec4899",
  purple: "#7c3aed",
  maroon: "#7f1d1d",
  silver: "#c0c0c0",
  gold: "#d4af37",
};

export function parseColors(raw: string | undefined | null): { name: string; hex: string }[] {
  return String(raw || "")
    .split(/[;,]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((name) => ({ name, hex: COLOR_HEX[name.toLowerCase()] || guessHex(name) }));
}

// Nama warna yang tidak ada di tabel (mis. "Charcoal Grey", "Jet Black",
// "Ocean Blue") ditebak dari kata kuncinya; benar-benar tak dikenal -> abu muda.
const KEYWORD_HEX: [RegExp, string][] = [
  [/black|caviar|jet/i, "#111111"],
  [/charcoal/i, "#4b5563"],
  [/gr[ea]y/i, "#9ca3af"],
  [/navy/i, "#1f2a44"],
  [/blue/i, "#2563eb"],
  [/tosca|teal|everglade/i, "#14b8a6"],
  [/green|sage|sycamore/i, "#4d7c0f"],
  [/olive/i, "#6b705c"],
  [/burgundy|maroon|beet|red/i, "#9f1239"],
  [/brown|oat|coffee|chocolate/i, "#7c4a2d"],
  [/cream|beige|sand|ivory/i, "#f3ead3"],
  [/khaki/i, "#c3b091"],
  [/white/i, "#ffffff"],
  [/yellow|mustard/i, "#facc15"],
  [/orange/i, "#f97316"],
  [/pink/i, "#ec4899"],
  [/purple|violet/i, "#7c3aed"],
];

function guessHex(name: string): string {
  for (const [re, hex] of KEYWORD_HEX) if (re.test(name)) return hex;
  return "#cbd5e1";
}
