# Offline Torch — panduan untuk AI agent & developer

Aplikasi operasional retail (toko, stok, request, absensi, katalog, dsb.). **Baca file ini sebelum menambah atau memperbaiki menu/API.**
Dokumen pendamping: [docs/MODULES.md](docs/MODULES.md) (peta menu → file → API → data → izin) dan [docs/STORE-MONITOR.md](docs/STORE-MONITOR.md) (pemantauan perangkat toko, musik, pengumuman).

## 1. Ringkasan teknis

| Hal | Isi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind **v3** |
| Hosting | Vercel **Hobby** (region `sin1`) — kuota CPU/invocation sangat terbatas, lihat §8 |
| Database | **Neon Postgres** (`lib/neon.ts`, tagged template `sql\`...\``) — users, role, activity log, perangkat, musik, dsb. |
| Data bisnis | **Google Sheets** (`lib/sheets.ts`) — sebagian besar modul lama (stok, request, petty cash, dsb.) |
| File | Google Drive (foto/dokumen), Vercel Blob (PDF katalog) |
| Realtime | Ably (presence + perintah) — hanya untuk Store Monitor |
| Tes | Vitest (`tests/*.test.ts`, 48+ tes, environment node) |
| Bahasa UI | **Bahasa Indonesia**. Komentar kode juga Indonesia. Jangan ubah UI ke bahasa Inggris. |
| Zona waktu | WIB (`Asia/Jakarta`) untuk semua tanggal/jam bisnis |

Perintah penting (jalankan dari root repo):

```bash
npm run dev                # dev server (Turbopack) di :3000
npx tsc --noEmit           # cek tipe  → pakai NODE_OPTIONS=--max-old-space-size=6144 (kalau tidak, OOM/exit 137)
npm test                   # vitest run  → butuh Node 24 (nvm: v24.18.0). Node 18 gagal: "styleText" tidak ada
```

Catatan lingkungan: kalau dev server macet saat compile route (Turbopack), `rm -rf .next` lalu jalankan ulang. Build lokal (`next build`) bisa kehabisan memori; pakai `NODE_OPTIONS=--max-old-space-size=6144`.

## 2. Struktur folder

```
app/
  (main)/<menu>/page.tsx   halaman ber-login (layout: sidebar + topbar + gate absen/checklist + toast update)
  api/<modul>/route.ts     route handler (satu folder = satu modul)
  login, online-catalog, clearance-catalog, affiliator, affiliate-report,
  jastiper-monitor, jastiper-report   halaman publik / di luar (main)
  r/[uuid]/route.ts        redirect + catat scan QR (publik; di luar /api sehingga tidak lewat proxy.ts)
components/                komponen; sub-folder per modul (stock/, canvasing/, store-monitor/, ...)
components/shared/         UI bersama: GlassCard, FilterBar, Button, Modal, Popup, Badge, tableStyles, SortableTh, ...
context/                   UserContext (user + fetch wrapper 401), SidebarContext, ThemeContext
hooks/                     useSessionGuard, useSortableTable, useDevicePresence, useStoreMusic, ...
lib/                       logika server & util murni (lihat §3–§6)
proxy.ts                   penegakan akses semua /api (BUKAN middleware.ts — Next 16)
scripts/generate-catalogs.ts   dijalankan GitHub Actions (PDF katalog)
tests/                     vitest
types/index.ts             tipe domain bersama
.github/workflows/catalog-refresh.yml   jadwal katalog
vercel.json                region, cron, header
```

## 3. Autentikasi, sesi, role, izin

- Login: `POST /api/auth/login` → cookie bertanda tangan **`torch_session`** (HMAC, `AUTH_SECRET`, umur 6 jam) + `localStorage["user"]` di browser (berisi data user + izin + `_auth: 2` + `_loginAt`; tanpa dua penanda itu `useSessionGuard` mengeluarkan user).
- Identitas **selalu dari cookie**, bukan dari body/query. Pakai `actorName(request)` / `sessionUser(request)` (`lib/authz.ts`) untuk `created_by`/`update_by`.
- `sessions_valid_after` (di tabel user) membuat "logout semua" — sesi lama ditolak proxy. Akun nonaktif (`active=false`) juga ditolak.
- `/api/auth/me` menyegarkan izin/role/badge pending; `hooks/useSessionGuard.ts` memanggilnya paling sering **sekali per 5 menit**.
- **Role** (`lib/roles.ts`, tabel `app_roles`): `super_admin`, `admin`, `store`, `guest`, `merchant` (+ role buatan Super Admin). Role = *template* izin yang disalin ke user saat "terapkan"; izin user tetap disimpan per user (kolom `perms` JSONB di `app_users`).
- **Izin** = flag string `'TRUE'/'FALSE'`. Daftar kunci: `PERMISSION_KEYS` di `lib/users.ts`. Di browser menjadi boolean (`lib/clientUser.ts`). Super Admin = semua akses.
- `is_super_admin` bukan kunci izin — turunan dari `role === 'super_admin'`.

### Penegakan di server (`lib/authz.ts` + `proxy.ts`)
Semua `/api/*` **wajib sesi sah** kecuali ditandai `pub(...)` di `RULES`. Aturan:
- `need(prefix, [flag...], methods?, scope?)` → user harus punya SALAH SATU flag (`[]` = cukup login).
- Prefix terpanjang menang; aturan khusus-method menang atas aturan umum di prefix yang sama.
- `scope` (hanya GET) mengikat parameter ke sesi: `identity` (diisi paksa user_name), `name`, `privileged` (parameter "lihat semua" hanya jika punya flag), `store`. Proxy menaruh hasilnya di header `x-scoped-search`; route membacanya via `scopedParams(request)` — **jangan baca `request.url` langsung untuk parameter yang ber-scope**.
- Route tanpa aturan = cukup login. Endpoint publik: login/logout, `/api/cron/*` (diamankan `CRON_SECRET`), `/api/admin/db-export`, `/api/jastiper|affiliate/public|report-public`, `/api/drive-image`, `POST /api/registration` (publik, diperketat: jebakan bot + batas laju per IP + jejak IP/lokasi/perangkat di `registration_meta`), `/api/realtime/webhook` (diamankan secret di query).
- Tes `tests/authz.test.ts` memastikan semua flag di `RULES` ada di `PERMISSION_KEYS` (cegah salah ketik).
- **Keputusan pemilik (Okt 2026): `/api/admin/db-export` tetap cukup `username`** (tanpa kunci) supaya formula IMPORTDATA di Google Sheets tidak perlu diubah. Risikonya diketahui: siapa pun yang tahu username ber-izin `registration_request`+`user_setting` bisa mengunduh tabel Neon (customer CRM, jastiper, log). Jangan "memperbaiki" ini tanpa persetujuan pemilik; mitigasinya = repo GitHub dijadikan Private.
- Catatan: komentar lama di beberapa route (mis. `voucher`) yang bilang "enforcement di client" sudah **usang**; sekarang server yang menegakkan.

## 4. Data: Neon vs Google Sheets

### Neon (`lib/neon.ts`)
- `sql\`SELECT ... ${param}\`` (parameter otomatis aman). Untuk query dinamis: `sql(text, [params])`.
- **Skema dibuat lewat `ensureOnce(name, version, fn)`** (tabel `schema_version`): DDL hanya jalan sekali per versi. **Setiap kali mengubah DDL di `fn`, naikkan string versinya** (mis. `"v7"` → `"v8"`), kalau tidak perubahan tidak pernah dijalankan.
- Pola: `let schemaReady: Promise<void> | null`; fungsi `ensureXSchema()` dipanggil di awal route. Lihat `lib/devices.ts`, `lib/users.ts`, `lib/roles.ts`, `lib/activityLog.ts`.
- Tabel: `app_users`, `app_roles`, `app_users_backup`, `app_activity_log`, `app_announcement`, `login_attempts`, `customer_*`, `shopify_orders`, `jastiper_master`, `catalog_state`, `store_devices`, `device_events`, `store_music`, `music_playlists`, `music_schedule`, `store_hours`, `announce_schedule`, `monitor_prefs`, `registration_meta`, `schema_version`.

### Google Sheets (`lib/sheets.ts`)
- `getSheetData(name)` (cache 5 menit), `appendSheetData`, `updateSheetRow`, `deleteSheetRows`, `withCache(key, ttl, fn)`, `invalidateCache(key)`. ID spreadsheet dari env `SPREADSHEET_*`.
- Baris dibaca berdasarkan **header sheet**; pasangan kolom A–… didokumentasikan di komentar tiap route. Jangan ubah urutan/nama kolom sheet tanpa mengubah route-nya.
- Format lokal Indonesia: angka bisa memakai **koma desimal** (`-6,300358147`). Jangan `parseFloat` mentah — lihat `parseCoord` di `components/capture-attendance/helpers.ts`.
- Pembaca Sheets dimuat **dinamis** (`await import("./sheets")`) di tempat yang bisa dihindari supaya paket besar tidak ikut bundle route lain. Pakai paket modular `@googleapis/sheets` & `@googleapis/drive` lewat `lib/google.ts` (jangan pasang `googleapis` penuh).

### Pola umum API route
```ts
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { ... jsonWithEtag(request, data) }   // ETag: hemat transfer
```
- Balasan besar yang sering dipoll → `jsonWithEtag` (`lib/etag.ts`).
- Catatan aksi penting admin → `audit(request, method, teks, entityType, entityId)` (`lib/audit.ts`, fire-and-forget ke `app_activity_log`).
- Notifikasi dalam aplikasi: `createNotification` / `notifyUsersWithPermission` (`lib/notifications.ts`, disimpan di sheet `notifications`).

## 5. Checklist: MENAMBAH MENU / HALAMAN BARU

1. **Izin**: kalau butuh flag baru → tambahkan ke `PERMISSION_KEYS` (`lib/users.ts`) **dan** `PERM_GROUPS` (`lib/permGroups.ts`, supaya muncul di Settings & halaman Role). Tidak perlu DDL (izin disimpan di JSONB).
2. **Halaman**: `app/(main)/<menu>/page.tsx` (`"use client"`). Pakai `useSessionGuard()` dan baca user dari `useUser()`/`localStorage`. Cek izin di klien hanya untuk UX — penegakan sebenarnya di server.
3. **Sidebar**: tambahkan item di `components/Sidebar.tsx` (array `menuItems` atau grup Request/Order/Customer). Perhatikan `checkPermission` (beberapa menu memakai lebih dari satu flag) dan tipe `permissions` di `SidebarProps` (tambahkan `?: boolean` untuk flag baru).
4. **API**: `app/api/<modul>/route.ts`.
5. **Aturan akses**: tambahkan baris di `RULES` (`lib/authz.ts`) untuk setiap prefix API baru, urut dari yang umum ke khusus. Tanpa aturan, route hanya butuh login. Untuk data per-user/per-toko pakai `scope`.
6. **Tes**: tambah ekspektasi di `tests/authz.test.ts`.
7. **Mobile**: lihat §7 — wajib dicek di lebar 375 px.
8. **Dokumentasi**: tambahkan baris di [docs/MODULES.md](docs/MODULES.md).
9. Kalau data baru di Neon → buat `ensureXSchema` dengan `ensureOnce`; kalau di Sheets → catat nama sheet & kolom di komentar route.

## 6. Checklist: MENAMBAH / MENGUBAH API

- Setiap prefix baru → aturan di `RULES`. Setiap aksi tulis memakai identitas dari sesi.
- Jangan percaya `username`/`created_by` dari body. Jangan kembalikan data yang user tidak berhak lihat; pakai `scope` atau cek peran (`user.role === "super_admin"`).
- Endpoint yang dipanggil perangkat/Cron tanpa sesi → `pub(...)` + secret (`CRON_SECRET`, `REALTIME_WEBHOOK_SECRET`).
- Hindari polling dan query berulang (lihat §8).

## 7. UI & mobile (aturan penting)

- **Tidak boleh ada geser kiri-kanan di HP** untuk tabel/daftar. Mekanisme otomatis: `components/ResponsiveTables.tsx` + CSS di `app/globals.css` mengubah **setiap tabel dengan satu baris header sederhana** menjadi kartu di layar < 768 px (label kolom dari `<th>`, sel kosong disembunyikan, kontrol "Urutkan" otomatis bila header punya `cursor-pointer`).
  - Tabel dengan header bertingkat (`colSpan/rowSpan`), matriks, atau grid khusus **tidak** otomatis diubah → buat tampilan kartu sendiri: bungkus tabel `hidden md:block` (atau `hidden lg:block`) dan tambahkan daftar kartu `md:hidden`. Contoh: `components/stock/StockTable.tsx`, `components/capture-attendance/AttendanceTable.tsx`, `components/request-tracking/ShipmentTable.tsx`, Settings → User Management.
  - Untuk mengecualikan tabel dari mekanisme otomatis: beri `data-stack="off"`.
  - Tombol yang hanya muncul saat hover (`group-hover:opacity-100`) otomatis terlihat di layar sentuh.
- **Ikon = SVG** (lucide-react atau `<svg>` inline; lihat `components/store-monitor/icons.tsx`). **Jangan pakai emoji** di UI.
- Komponen bersama ada di `components/shared/` (GlassCard, FilterBar, Button, Modal, Pagination, SortableTh, tableStyles). Pakai ulang, jangan membuat varian baru.
- Mode gelap: kelas `html.dark`; warna lewat variabel CSS di `globals.css`.
- Layar sempit: target sentuh ≥ 36–40 px, aksi massal di bar bawah/bottom-sheet (contoh: Store Monitor).

## 8. Hemat Vercel Hobby (jangan melanggar tanpa alasan kuat)

Kuota (30 hari) yang pernah hampir habis: **Fluid Active CPU 4 jam**, **Fast Origin Transfer 10 GB**, invocation 1 juta. Kuota dipakai bersama semua proyek di akun yang sama. Praktik yang sudah diterapkan — pertahankan:
- Tidak ada polling server; `visiblePoll` (`lib/poll.ts`) hanya saat tab terlihat. Cek sesi dibatasi 5 menit.
- Cache Sheets 5 menit di server; ETag untuk balasan besar; jendela tanggal untuk data besar.
- Foto diperkecil di browser (`lib/compressImage.ts`); server tidak memproses ulang foto < 300 KB (`lib/shrinkImage.ts`).
- PDF katalog dibuat di **browser** atau **GitHub Actions** lalu disimpan ke Vercel Blob — bukan di fungsi Vercel (`lib/catalogPdfCore.ts` isomorfik, `scripts/generate-catalogs.ts`, `.github/workflows/catalog-refresh.yml`; cron Vercel hanya cadangan).
- Activity log di Neon (bukan Sheets). Skema Neon sekali per versi.
- Realtime lewat **Ably**, bukan polling: perangkat toko tidak memanggil Vercel berkala. Update presence dibatasi sekali per 30 detik; webhook melewati update tanpa perubahan baterai.
- Logika jadwal (musik, pengumuman, jam buka) dihitung **di perangkat**, bukan di server/cron.
- Import dinamis untuk paket besar (`ably`, `leaflet`, Sheets) — hanya dimuat di halaman yang memakainya.

## 9. Environment (nama saja — nilai rahasia, jangan dicetak/di-commit)

`DATABASE_URL`, `AUTH_SECRET` (cadangan `CRON_SECRET`), `CRON_SECRET`, `GOOGLE_CREDENTIALS`, `SPREADSHEET_*` (STOCK, CUSTOMER, MATERIAL_ISSUE, STORE, ATTENDANCE, STEP_ERP, CATALOG, SALES, PETTY_CASH, ORDER_REPORT, AFFILIATE, USERS, SYSTEM, BALANCE, TRAFFIC, ORDER, VOUCHER, REGISTRATION, MASTER, BUNDLING), `DRIVE_*_FOLDER_ID`, `BLOB_STORE_ID` (OIDC di Vercel) / `BLOB_READ_WRITE_TOKEN` (GitHub Actions; tanpa tanda kutip), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `ABLY_API_KEY` (format `appId.keyId:secret`, tanpa tanda kutip), `REALTIME_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (opsional), `NEXT_PUBLIC_BUILD_ID`/`VERCEL_*` (otomatis). Lokal di `.env.local` (di-gitignore).

## 10. Subsistem khusus (ringkas)

- **Store Monitor** (`/store-monitor`): pantau tablet/PC toko, musik YouTube per toko, jadwal, jam buka, pengumuman. Detail lengkap di [docs/STORE-MONITOR.md](docs/STORE-MONITOR.md).
- **Katalog**: halaman publik `/online-catalog` dan `/clearance-catalog` (+ `/pdf`); status di tabel `catalog_state` (versi → URL PDF berversi `?v=`). Menu Catalog (izin `canvasing`) berisi tombol refresh. Harga promo Clearance dihitung di `lib/catalogs.ts` (`promoPercent: 50`).
- **Profil wajib lengkap** (`lib/profileRules.ts`): semua role butuh nama/email/telepon/foto; Store & Merchant juga alamat (harus ada kode pos). Telepon dinormalisasi ke `62…`. Layout memaksa ke `/profile?required=1` bila belum lengkap.
- **Gate Store**: Attendance gate & Daily Checklist gate hanya untuk role **store** (Merchant tidak kena gate).
- **Badge pending sidebar** (`lib/pendingCounts.ts`): angka request menunggu, hanya untuk user yang boleh mengubah status; ikut `/api/auth/me`.
- **Update toast** (`lib/buildInfo.ts`, `components/UpdateToast.tsx`): memberi tahu bila ada deployment baru.
- **Activity log**: `/api/activity-log`, tabel `app_activity_log`; tampil di Settings.

## 11. Konvensi kerja

- Tulis kode **mengikuti gaya file di sekitarnya** (komentar Indonesia singkat yang menjelaskan *mengapa*).
- Jangan menambah dependensi besar tanpa alasan (kuota & ukuran bundle). Jangan `npm install googleapis`.
- Jangan mencetak atau meng-commit rahasia (`.env.local`, kunci API, token). Jangan menempel key di chat.
- Sebelum menyatakan selesai: `npx tsc --noEmit` bersih dan `npm test` lulus; untuk UI cek di lebar HP (375 px) dan desktop.
- **Commit & push hanya bila diminta pemilik repo.** Pesan commit berbahasa Indonesia, ringkas, dan diakhiri baris `Co-Authored-By: Claude ...` bila dibuat oleh agent.
- Perubahan yang butuh env/pengaturan eksternal (Vercel, Ably, GitHub, Telegram) → sebutkan jelas langkah untuk pemilik, jangan diasumsikan sudah ada.
- Jangan menghapus data/proyek/secret di layanan eksternal tanpa konfirmasi eksplisit.

## 12. Jebakan yang pernah terjadi

- `router.replace` untuk redirect gate tertimpa halaman yang menyinkronkan filter ke URL → pakai `window.location.replace`.
- `NextResponse.rewrite` tidak meneruskan query yang diubah ke route handler → pakai header `x-scoped-search` + `scopedParams()`.
- Aturan `RULES` dengan prefix sama: urutan penentu — sudah ditangani sort (prefix terpanjang, lalu yang khusus-method).
- Tile peta CARTO sekarang mewajibkan API key (petak bertuliskan "API KEY REQUIRED") → `MapPreview` memakai OpenStreetMap standar.
- Secret GitHub `BLOB_READ_WRITE_TOKEN` harus tanpa tanda kutip; di Vercel Blob memakai OIDC (`BLOB_STORE_ID`), di GitHub memakai token.
- Jadwal GitHub Actions tidak presisi (bisa tertunda jam-jaman) → jadwal dimajukan + cron Vercel sebagai cadangan.
- Wake Lock/YouTube/autoplay butuh interaksi pengguna; musik dihentikan browser saat layar mati/tab disembunyikan di HP/tablet.
- Komponen yang di-import dari klien **tidak boleh** mengimpor `lib/neon.ts` (melempar error tanpa `DATABASE_URL`). Pisahkan logika murni ke file tanpa DB (contoh: `lib/musicSchedule.ts`, `lib/announceSchedule.ts`, `lib/storeHours.ts`).
