# AGENTS.md

Panduan lengkap untuk agent/developer ada di **[CLAUDE.md](CLAUDE.md)** — baca itu dulu.

Ringkas yang paling sering dilupakan:
- Setiap API baru **wajib** punya aturan di `RULES` (`lib/authz.ts`); identitas dari sesi, bukan body.
- Izin baru → `PERMISSION_KEYS` (`lib/users.ts`) + `PERM_GROUPS` (`lib/permGroups.ts`) + Sidebar + tes `tests/authz.test.ts`.
- Ubah DDL Neon → naikkan versi di `ensureOnce(...)`.
- UI Bahasa Indonesia, ikon SVG (bukan emoji), **tanpa geser kiri-kanan di HP** (lihat CLAUDE.md §7).
- Hemat Vercel Hobby: tanpa polling/cron baru, logika jadwal di perangkat.
- Perbarui `docs/MODULES.md` setiap menambah/mengubah menu.
- Jalankan `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit` dan `npm test` (Node 24) sebelum selesai. Commit/push hanya bila diminta.
