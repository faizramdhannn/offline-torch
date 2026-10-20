// Perapi data penerima Request Shipment (mirip fitur "tempel alamat" di dashboard Ninja/Lion).
// Input: teks bebas hasil copy chat/formulir ("Nama : ...", "No. Hp : ...", "Alamat : ...", spasi/strip di nomor, dll).
// Output baku (4 baris): Nama / HP (08xxxxxxxxxx) / Alamat lengkap / Kode pos. Murni (tanpa DB) — aman diimpor klien.

export interface ParsedReceiver {
  name: string;
  phone: string;    // 08xxxxxxxxxx ("" bila tidak ketemu)
  address: string;
  postal: string;   // 5 digit ("" bila tidak ketemu)
  text: string;     // hasil rapi (baris dipisah \n)
}

// Kata label yang dibuang. Boleh disusul keterangan pendek sebelum tanda ":" mis. "Alamat (kec/kota :".
const NAME_L = "nama(?:\\s*(?:lengkap|penerima))?|penerima|receiver|name|atas\\s*nama|a\\s*\\/?\\s*n";
const PHONE_L = "no\\.?\\s*(?:hp|handphone|telp|telepon|tlp|wa|whatsapp)|(?:hp|handphone|telp|telepon|tlp|phone|wa|whatsapp)|nomor\\s*(?:hp|telp|telepon|wa|whatsapp)?";
const ADDR_L = "alamat(?:\\s*lengkap)?|address|almt";
const POST_L = "kode\\s*pos|kodepos|kd\\.?\\s*pos|postal(?:\\s*code)?";
const LABEL = new RegExp(`^\\s*(${NAME_L}|${PHONE_L}|${ADDR_L}|${POST_L})\\b[^:：=\\n]{0,28}?\\s*[:：=]\\s*`, "i");
// Label di tengah baris (satu baris berisi "Nama: A HP: 08.. Alamat: ...") → dipecah ke baris baru.
const MID_LABEL = new RegExp(`[\\s,;]+(?<!\\b(?:no|nomor)\\.?\\s*)(?=(?:${NAME_L}|${PHONE_L}|${ADDR_L}|${POST_L})\\b[^:：=\\n]{0,28}?\\s*[:：=])`, "gi");

type Kind = "name" | "phone" | "address" | "postal";
function kindOf(label: string): Kind {
  const l = label.toLowerCase();
  if (new RegExp(`^(${PHONE_L})$`, "i").test(l.replace(/\s+/g, " ").trim())) return "phone";
  if (new RegExp(`^(${ADDR_L})$`, "i").test(l)) return "address";
  if (new RegExp(`^(${POST_L})$`, "i").test(l)) return "postal";
  return "name";
}

// "0857-9488 4653", "+62 857 9488 4653", "6285794884653", "85794884653" → "085794884653"; selain itu null.
export function normalizePhone(raw: string): string | null {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  else if (d.startsWith("8")) d = "0" + d;
  if (!/^08\d{8,12}$/.test(d)) return null; // 08 + 8–12 digit = 10–14 digit
  return d;
}

// Cari nomor HP di teks (boleh bertanda baca/spasi). Mengembalikan nomor rapi + rentang teks aslinya.
function findPhone(text: string): { phone: string; start: number; end: number } | null {
  const re = /(?<![\d])(?:\+?62|0)[\s\-.()]*8(?:[\s\-.()]*\d){7,12}(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const p = normalizePhone(m[0]);
    if (p) return { phone: p, start: m.index, end: m.index + m[0].length };
  }
  const bare = /(?<![\d])8(?:[\s\-.()]*\d){8,12}(?!\d)/g; // tanpa 0/62 di depan
  while ((m = bare.exec(text))) {
    const p = normalizePhone(m[0]);
    if (p) return { phone: p, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

const ADDRESS_START = /^(jl\.?|jalan|gg\.?|gang|komp(?:lek)?\.?|perum(?:ahan)?|dusun|dsn\.?|desa|kel\.?|kelurahan|kec\.?|kecamatan|rt\b|rw\b|blok|no\.?\s*\d|apartemen|apt\.?|ruko|gedung|sd\b|smp\b|sma\b|smk\b|pt\b|cv\b|toko\b|kantor|puskesmas|rs\b|rsud|universitas|kampus)/i;

function tidy(s: string): string {
  return s
    .replace(/\(\s*[,;-]?\s*\)/g, " ") // kurung kosong sisa nomor HP: "Miranti ( )"
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*,\s*(,\s*)+/g, ", ")
    .replace(/^[\s,;:.\-–/]+|[\s,;:\-–/]+$/g, "")
    .trim();
}

export function parseReceiver(input: string): ParsedReceiver {
  let raw = String(input || "").replace(/\r/g, "\n").replace(/[​-‍﻿]/g, "").replace(/ /g, " ");
  raw = raw.replace(MID_LABEL, "\n");

  // 1) Nomor HP dari seluruh teks (dibuang dari teks supaya tidak ikut ke alamat)
  const ph = findPhone(raw);
  const phone = ph?.phone || "";
  if (ph) raw = raw.slice(0, ph.start) + " " + raw.slice(ph.end);

  // 2) Pecah per baris + label
  type Seg = { kind: Kind | null; text: string };
  const segs: Seg[] = [];
  for (const line of raw.split("\n")) {
    let t = line.trim();
    if (!t) continue;
    let kind: Kind | null = null;
    const m = t.match(LABEL);
    if (m) { kind = kindOf(m[1]); t = t.slice(m[0].length); }
    t = tidy(t);
    if (!t) continue;
    segs.push({ kind, text: t });
  }

  // 3) Kode pos: label "kode pos" atau 5 digit berdiri sendiri (yang terakhir menang)
  let postal = "";
  const postSeg = segs.find((s) => s.kind === "postal");
  if (postSeg) { postal = (postSeg.text.match(/(?<!\d)\d{5}(?!\d)/) || [""])[0]; postSeg.text = ""; }
  if (!postal) {
    for (let i = segs.length - 1; i >= 0 && !postal; i--) {
      const all = [...segs[i].text.matchAll(/(?<!\d)\d{5}(?!\d)/g)];
      if (!all.length) continue;
      const last = all[all.length - 1];
      postal = last[0];
      const t = segs[i].text;
      segs[i].text = tidy((t.slice(0, last.index!).replace(/(kode\s*pos|kodepos|kd\.?\s*pos|kp)\s*[:.]?\s*$/i, "")) + " " + t.slice(last.index! + 5));
    }
  }

  // 4) Nama: baris berlabel nama; kalau tak ada, baris pertama bila bukan mirip alamat
  let name = "";
  const nameSeg = segs.find((s) => s.kind === "name" && s.text);
  if (nameSeg) { name = nameSeg.text; nameSeg.text = ""; }
  else {
    const first = segs.find((s) => s.text);
    if (first && first.kind === null && !ADDRESS_START.test(first.text) && !/\d{3,}/.test(first.text) && first.text.length <= 60) {
      name = first.text; first.text = "";
    }
  }

  // 5) Sisanya = alamat (urut sesuai teks asli)
  const address = tidy(segs.map((s) => s.text).filter(Boolean).join(", "));
  name = tidy(name);

  const text = [name, phone, address, postal].filter(Boolean).join("\n");
  return { name, phone, address, postal, text };
}

// Hasil rapi bila datanya layak (ada nomor HP); kalau tidak, kembalikan teks apa adanya.
export function cleanReceiver(input: string): string {
  const p = parseReceiver(input);
  return p.phone ? p.text : String(input || "").trim();
}

// Pesan galat untuk tampilan form ("" = valid). Menilai hasil rapi, bukan teks mentah.
export function receiverError(input: string): string {
  if (!String(input || "").trim()) return "Penerima wajib diisi";
  const p = parseReceiver(input);
  if (!p.phone) return "Nomor HP tidak ditemukan — tulis 08xx atau +628xx (spasi/strip boleh)";
  if (!p.postal) return "Kode pos 5 digit belum ada (contoh: 40123)";
  if (!p.address || p.address.length < 8) return "Alamat terlalu pendek — sertakan jalan, kelurahan/kecamatan, kota";
  return "";
}
