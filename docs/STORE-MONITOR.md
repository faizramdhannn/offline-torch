# Store Monitor (pantau perangkat toko, musik, pengumuman)

Halaman `/store-monitor` untuk memantau dan mengatur perangkat di toko (akun **Store/Merchant**): **tablet** (pemutar musik) dan **PC** (kerja staf). Satu akun boleh login di banyak perangkat — identitas perangkat = `device_id` (acak, disimpan di `localStorage["torch_device_id"]`), bukan akun.

Prinsip: **hampir tanpa beban Vercel**. Koneksi live lewat Ably; logika jadwal dihitung di perangkat. Jangan menambah polling/cron.

## Izin
- Menu & API: `store_monitor` **atau** `user_setting` **atau** Super Admin (`RULES`: `/api/devices`, `/api/music`, `/api/announce-schedule`; `store_monitor` diturunkan otomatis di `lib/clientUser.ts`).
- Hanya **musik** yang boleh diatur Admin. **Reload, pengumuman (kirim & jadwal), logout paksa, pindah halaman, putuskan perangkat = Super Admin** (dicek di route: `/api/devices/command`, `/api/devices` DELETE, `/api/announce-schedule`).
- Batas laju perintah: 30/menit per akun (memori instance, `command/route.ts`).

## Arsitektur
```
Perangkat toko (browser)                         Ably (channel "stores")              Dashboard (admin)
  useDevicePresence  ──enter/update presence──►  presence set  ◄──subscribe──────  /store-monitor
  (di app/(main)/layout.tsx)                      │
  ◄──"command" (publish dari SERVER saja)─────────┘  ◄── POST /api/devices/command (cek izin + audit)
  webhook Ably ─► POST /api/realtime/webhook ─► Neon (online/offline, baterai, riwayat) + peringatan
```
- **Token**: `GET /api/realtime/token?deviceId=…` → `TokenRequest` bertanda tangan HMAC (`lib/ablyServer.ts`, tanpa memanggil Ably). Hak token: **subscribe + presence** saja. `clientId` = `deviceId` (hanya akun pendaftar perangkat itu) atau `monitor:<user>`. **Browser tidak boleh publish** — perintah selalu lewat `/api/devices/command`.
- **Presence data**: `{kind, user_name, store, page, battery, charging, visible, music:{state,title,playlist,volume,muted,shuffle,note}, ack:{id,t}}`. Update halaman/baterai dibatasi 1× per 30 dtk; perubahan musik langsung. Webhook melewati update tanpa perubahan baterai (cache memori, tanpa query DB).
- **Perintah** (`type`): `music` (action: `load`, `preset`, `play`, `pause`, `volume`, `mute`, `shuffle`, `next`, `prev`, `refresh`, `role`), `announce`, `reload`, `logout`, `navigate`, `announce_refresh`. Target: `{all}` | `{user_names[]}` | `{deviceId}`. Pesan membawa `id`; perangkat yang menjalankan membalas `ack:{id}` lewat presence → dashboard menampilkan "Diterima N dari M".
- **Bus klien** (`hooks/useDevicePresence.ts`): `onDeviceCommand(handler)`, `emitLocalCommand(cmd)` (aksi lokal tanpa server), `setPresenceExtra({...})`, `ackCommand(id)`, `getPresenceExtra()`. Hook lain (musik, pengumuman) menumpang satu koneksi Ably yang sama.

## Deteksi tipe perangkat
`getDeviceKind()`: tablet jika UA iPad/Tablet/Android non-Mobile, iPadOS menyamar Mac dengan multi-touch, atau pointer utama `coarse`; selain itu PC. HP staf yang login akun toko ikut terdeteksi "tablet".

## Musik (`hooks/useStoreMusic.ts`)
- **Satu pemutar per toko** (pilihan `store_devices.music_player`; tanpa pilihan = tablet). `/api/music/state?deviceId=` memberi tahu perangkat apakah ia pemutar (+ status, jadwal, jam buka).
- Pemutar = YouTube IFrame API tersembunyi. Sumber: tautan playlist (`list=PL…`, diacak + mulai dari lagu acak bila `shuffle`) atau video tunggal (diulang). Mix `RD…` mungkin tidak bisa disematkan.
- Status keinginan toko di `store_music` (playlist, volume, muted, playing, shuffle). Jadwal per jam/hari (WIB) di `music_schedule` (`lib/musicSchedule.ts`: `activeRule`). Perintah manual yang lebih baru dari awal jendela jadwal menang.
- Opsi **musik mengikuti jam buka** (`store_hours.follow`) bila toko tak punya jadwal musik.
- Fade in/out volume, redam saat pengumuman, watchdog pemulihan mandiri, Wake Lock saat musik berbunyi, alasan musik belum berbunyi dilaporkan di `music.note`.
- `components/MusicBadge.tsx` (lencana untuk staf: judul lagu + tombol *Lagu berikutnya* lokal, judul tab "Musik aktif · …", konfirmasi tutup tab).
- Playlist: tabel `music_playlists` (`parseYouTube` di `lib/devices.ts`).

## Jam buka & peringatan
- `store_hours` per toko: jam per hari (Min–Sab) + hari libur + `follow`. Bawaan 09:00–22:00 (`lib/storeHours.ts`: `DEFAULT_HOURS`, `isOpenNow`).
- `lib/deviceAlerts.ts` (`checkDeviceAlerts`, dipicu webhook & saat dashboard dibuka): tablet offline > 10 mnt **hanya saat toko buka**; baterai ≤ 15% tidak mengisi (batas ulang 6 jam). Kirim notifikasi dalam aplikasi ke pemegang `user_setting` + Telegram bila `TELEGRAM_*` diset (`lib/telegram.ts`).

## Pengumuman
- Manual: dialog di dashboard (template tersimpan di `monitor_prefs.templates`).
- **Terjadwal** (Super Admin, tab Pengumuman): tabel `announce_schedule` — `once | daily | weekly | monthly`, jam WIB, toko tujuan, rentang tanggal, aktif. Logika murni di `lib/announceSchedule.ts` (`isDue`, `nextToday`, toleransi 2 menit). Perangkat mengambil aturan sekali (`/api/announce-schedule/mine`, juga diperbarui via `announce_refresh`) dan mengecek jam sendiri tiap 20 dtk (`components/DeviceAnnouncement.tsx`; penanda `torch_ann_<id>_<tanggal>` di localStorage mencegah tampil ulang).
- Tampilan: overlay layar penuh + hitung mundur; musik mengecil selama tampil.

## Layar standby tablet (`components/TabletStandby.tsx`)
Setelah 3 menit tanpa sentuhan: jam, nama toko, lagu, **teks standby** (global, `monitor_prefs.standby`) dan pengumuman berikutnya hari ini. Murni di perangkat.

## Perangkat & data
| Tabel Neon | Isi |
|---|---|
| `store_devices` | perangkat (device_id, user_name, store_name, kind, label, online, offline_since, battery, charging, music_player, revoked, alerted_at, last_seen) |
| `device_events` | riwayat online/offline/terdaftar |
| `store_music`, `music_playlists`, `music_schedule` | musik |
| `store_hours` | jam buka + hari libur + follow |
| `announce_schedule` | pengumuman terjadwal |
| `monitor_prefs` | preset suasana, grup toko, template pengumuman, teks standby (kunci: `presets`, `groups`, `templates`, `standby`) |

Skema: `ensureDevicesSchema()` di `lib/devices.ts` memakai `ensureOnce("devices", "vN")` — **naikkan versi bila DDL berubah** (sekarang `v7`).
Putuskan perangkat = `revoked=true`; `register` menjawab `{revoked:true}` sekali → klien logout, baris dihapus.

## Dashboard (`app/(main)/store-monitor/page.tsx`)
Tab: Perangkat, Playlist, Pengumuman (Super Admin), Ringkasan (jam online 7 hari), Riwayat (online/offline + perintah dari activity log). Mobile: bar aksi bawah + panel aksi, kartu toko ringkas yang bisa dibuka, filter *Semua/Offline/Perlu dicek*. Komponen di `components/store-monitor/` (`AnnounceDialog`, `AnnounceSchedule`, `HoursEditor`, `ScheduleEditor`, `PlaylistManager`, `PresetManager`, `SummaryTab`, `EventLog`, `CommandLog`, `icons`).

## Setup eksternal (dilakukan pemilik)
1. Ably: `ABLY_API_KEY` di Vercel (tanpa tanda kutip), key dengan hak publish/subscribe/presence.
2. Webhook Ably (Integrations → Webhook, source Presence, channel `stores`, mode Batch bila ada): `https://<domain>/api/realtime/webhook?s=<REALTIME_WEBHOOK_SECRET>`. Tanpa ini fitur live tetap jalan, tapi riwayat/peringatan kosong.
3. Telegram (opsional): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
4. Tablet: login akun toko, ketuk layar sekali (izin suara), biarkan terbuka & tercolok charger (lihat `/panduan-tablet`).

## Batasan yang disengaja
Tidak ada: kontrol OS (layar/restart), kontrol aplikasi YouTube/Spotify lain di tablet, screenshot layar, musik offline (memakai transfer Blob), WhatsApp (berbayar). Peringatan offline tidak tepat 10 menit (dihitung saat ada kejadian/dashboard dibuka). Musik berhenti bila layar mati/tab disembunyikan di tablet/HP.
