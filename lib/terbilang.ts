// Angka → kata dalam Bahasa Indonesia ("Lima Ribu Rupiah"). Murni (tanpa dependensi).
const SATUAN = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan",
  "Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas", "Lima Belas",
  "Enam Belas", "Tujuh Belas", "Delapan Belas", "Sembilan Belas"];
const PULUHAN = ["", "", "Dua Puluh", "Tiga Puluh", "Empat Puluh", "Lima Puluh", "Enam Puluh", "Tujuh Puluh", "Delapan Puluh", "Sembilan Puluh"];

function toWords(num: number): string {
  if (num === 0) return "";
  if (num < 20) return SATUAN[num];
  if (num < 100) return `${PULUHAN[Math.floor(num / 10)]}${num % 10 ? " " + SATUAN[num % 10] : ""}`;
  if (num < 200) return `Seratus${num % 100 ? " " + toWords(num % 100) : ""}`;
  if (num < 1000) return `${SATUAN[Math.floor(num / 100)]} Ratus${num % 100 ? " " + toWords(num % 100) : ""}`;
  if (num < 2000) return `Seribu${num % 1000 ? " " + toWords(num % 1000) : ""}`;
  if (num < 1_000_000) return `${toWords(Math.floor(num / 1000))} Ribu${num % 1000 ? " " + toWords(num % 1000) : ""}`;
  if (num < 1_000_000_000) return `${toWords(Math.floor(num / 1_000_000))} Juta${num % 1_000_000 ? " " + toWords(num % 1_000_000) : ""}`;
  return `${toWords(Math.floor(num / 1_000_000_000))} Miliar${num % 1_000_000_000 ? " " + toWords(num % 1_000_000_000) : ""}`;
}

export function terbilang(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (v <= 0) return "Nol Rupiah";
  return `${toWords(v).trim()} Rupiah`;
}
