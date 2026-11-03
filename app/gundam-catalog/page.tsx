import { redirect } from "next/navigation";

// Katalog Gundam = desain HTML jadi (A4 landscape) yang disajikan statis dari public/katalog-gundam.html.
// Redirect ini dibuat saat build (tanpa invocation Vercel). Harga/stok = snapshot; ganti file untuk memperbarui.
export default function GundamCatalogPage() {
  redirect("/katalog-gundam.html");
}
