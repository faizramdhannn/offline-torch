# Peta modul: menu → file → API → data → izin

Pendamping [CLAUDE.md](../CLAUDE.md). **Perbarui tabel ini setiap menambah/mengubah menu.**
Izin = kunci di `PERMISSION_KEYS` (`lib/users.ts`); penegakan di server ada di `RULES` (`lib/authz.ts`) — tabel ini hanya ringkasan, **sumber kebenarannya kode**.
`sheet:` = nama sheet Google Sheets (spreadsheet dari env `SPREADSHEET_*`), `neon:` = tabel Neon.

## Menu sidebar

| Menu | Path | Izin menu | API (`/api/…`) | Data | Komponen/lib terkait |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | `dashboard` | `store-directory`, `attendance/{meta,report,schedule}`, `activity-log`, `drive-image` | neon: `app_users` (lokasi toko = akun Store/Merchant), sheet absensi | `components/dashboard/*` |
| QR Code | `/qr-code` | `dashboard` | `qr-code`, `qr-code/analytics` | sheet: `qr_code`, `qr_code_analytic` | `/r/[uuid]` = route handler publik (redirect 302 + catat scan ke `qr_code_analytic`; QR meng-encode link ini) |
| Asset | `/asset` | `asset_store` | `asset` | sheet: `asset_store` | `components/asset/*` |
| Attendance | `/attendance` | `attendance` (laporan: `attendance_report`) | `attendance/{meta,report,sales,schedule,template}` | sheet: `date_list`, `store_list`, `taft_list`, `time_schedule`, `sales_store` | `components/attendance/*` (FullReport, WeeklySchedule, SalesWagesChart) |
| Capture Attendance | `/capture-attendance` | `attendance_store` / `attendance_store_all` | `capture-attendance/{capture,meta}` | sheet: `attendance_store`, `store_list`, `taft_list`; foto di Drive (`DRIVE_ATTENDANCE_FOLDER_ID`) | `components/capture-attendance/*` (peta OSM di `MapPreview`) |
| Bundling | `/bundling` | `bundling` | `bundling`, `master-item` | sheet: `master_bundling`, `master_item` | — |
| Canvasing | `/canvasing` | `canvasing` (ekspor: `canvasing_export`) | `canvasing`, `canvasing/ecatalog*/generate`, `canvasing/export-doc`, `drive-image` | sheet: `canvasing_store`, produk e-catalog (`catalog_product`, `clearance_product*`, `ihls_product`, `pasaraya_product`) | `components/canvasing/*` |
| Catalog | `/catalog` | `canvasing` | `catalog/{refresh,data,upload}` (aksi: `user_setting`) | neon: `catalog_state`; PDF di Vercel Blob | `lib/catalogs.ts`, `catalogPdfCore.ts`, `catalogPdfClient.ts`, `catalogBlob.ts`, `onlineCatalogPdf.ts`; halaman publik `/online-catalog`, `/clearance-catalog` |
| Daily Job | `/daily-job/checklist` | `daily_checklist` / `daily_checklist_all` | `daily-job/{checklist,dropdown}` | sheet: `daily_checklist` | gate khusus role **store** (`hooks/useDailyChecklistGate.ts`) |
| Petty Cash | `/petty-cash` | `petty_cash` (+`_add`, `_export`, `_balance`) | `petty-cash`, `petty-cash/{balance,history,export-doc}`, `categories` | sheet: `petty_cash`, `petty_cash_balance`, `master_dropdown` | `components/petty-cash/*` |
| Step ERP | `/step-erp` | `step_erp` / `step_erp_all` | `step-erp` | sheet (lihat `lib/stepErpConfig.ts`) | `components/step-erp/*` |
| Stock | `/stock` | `stock` (+`stock_view_*`, `stock_import`, `stock_export`, `stock_refresh_javelin`, `stock_pca_view`) | `stock`, `stock/{import,javelin-refresh,last-update}`, `customer/badges` | sheet: `result_stock`, `pca_stock` (+`_yesterday`), `last_update`, `system_config` | `components/stock/*`, `lib/javelin.ts` |
| Stock Opname | `/stock-opname` | `stock_opname` (+`stock_opname_report`) | `stock-opname/{store,report}` | sheet: `sto_store`, `sto_store_report` | `components/stock-opname/*` |
| Survey Store | `/traffic-store` | `traffic_store` / `report_store` | `traffic-store`, `master-traffic` | sheet traffic (`SPREADSHEET_TRAFFIC`) | `components/traffic-store/*` |
| Voucher | `/voucher` | `voucher` | `voucher` | sheet: `voucher_list` | — |
| Registration | `/registration` | `registration_request` | `registration` (POST publik dari `/login`: jebakan bot, batas 3/jam/IP & 30/hari, password ≥ 6, cek username ganda) | sheet: `registration_request` (kolom A–F) + neon `registration_meta` (IP, lokasi perkiraan dari header Vercel, perangkat) + `app_users` | `lib/clientInfo.ts`, `lib/registrationMeta.ts`; hash password tidak dikirim ke browser |
| User Profiles | `/profiles` | **Super Admin** | `profiles`, `profiles/{backup,logout,password}`, `roles` | neon: `app_users`, `app_roles`, `app_users_backup` | `lib/users.ts`, `lib/roles.ts`, `lib/usersBackup.ts` |
| Store Monitor | `/store-monitor` | `store_monitor` (Settings & Super Admin otomatis) | `devices*`, `music*`, `announce-schedule*`, `realtime/*` | neon (banyak tabel) + Ably | **[STORE-MONITOR.md](STORE-MONITOR.md)** |
| Settings | `/settings` | `user_setting` | `users`, `activity-log`, `admin/db-export`, `javelin-cookie`, `javelin-login`, `test-env` | neon: `app_users`, `app_activity_log` | `lib/permGroups.ts` (kolom izin), `lib/activityLog.ts` |
| Profil saya | `/profile` | login | `profile` | neon: `app_users` | `lib/profileRules.ts` |
| Panduan tablet | `/panduan-tablet` | login | — (statis) | — | — |

### Grup Request
| Menu | Path | Izin | API | Data |
|---|---|---|---|---|
| Cancel Order | `/request-store` | `request` / `edit_request` | `request-store`, `master-dropdown`, `push-notify` | sheet: `request_store` |
| Invoice | `/invoice` | `invoice` (+`_create`, `_edit`, `_delete`, `_master`) | `invoice`, `invoice/{master,pdf,word}`, `master-item` | sheet: `invoices`, `invoice_items`, `master_invoice` |
| Material Issue | `/material-issue` | `material_issue` / `material_issue_all` | `material-issue`, `material-issue-dropdown`, `master-item`, `push-notify` | sheet: `material_issue` |
| Employee Discount | `/employee-discount` | `employee_discount` / `employee_discount_approval` | `employee-discount`, `employee-discount/upload`, `master-item` | sheet: `request_discount` |
| Shipment | `/request-tracking` | `request_tracking` / `tracking_edit` | `request-tracking`, `store-directory`, `push-notify` | sheet: `request_tracking` |

Angka merah di sidebar (pending) dihitung `lib/pendingCounts.ts` dan ikut `/api/auth/me`; hanya untuk user yang boleh mengubah status.

### Grup Order
| Menu | Path | Izin | API | Data |
|---|---|---|---|---|
| Analytics | `/analytics-order` | `analytics_order` | `shopify-analytics`, `analytics-order/sales-by-badge`, `master-traffic` | neon: `shopify_orders` (+ `customer_*`) |
| Report | `/order-report` | `order_report` (+`order_report_import`, `order_report_export`) | `order-report`, `import` | sheet: `order_report` |
| Sales | `/sales` | `sales_view` / `sales_view_all` | `sales` | sheet (`SPREADSHEET_SALES`) |

### Grup Customer
| Menu | Path | Izin | API | Data |
|---|---|---|---|---|
| Affiliate | `/affiliate` | `affiliate_view` | `affiliate/{master,orders}`, `qr-code` | sheet: `master_affiliate`, `order_log_affiliate` |
| Customer Segmentation | `/customer` | `customer` | `customer`, `customer/{badges,detail,export,import,followup-message}` | neon: `customer_crm`, `customer_badges`, `customer_wa_followups`, `shopify_orders` |
| Jastiper | `/jastiper` | `jastiper` | `jastiper`, `jastiper/import` | neon: `jastiper_master` |

## Halaman publik (tanpa login)
`/login`, `/online-catalog`, `/clearance-catalog` (+ `/pdf`), `/affiliator` (`affiliate/public`), `/affiliate-report` (`affiliate/report-public`), `/jastiper-monitor` (`jastiper/public`), `/jastiper-report` (`jastiper/report-public`), `/r/[uuid]` (route handler redirect + pencatatan scan QR; di luar `/api` sehingga tidak lewat `proxy.ts` — tetap publik).

## Cron & otomatisasi
| Apa | Di mana | Catatan |
|---|---|---|
| Refresh PDF katalog | GitHub Actions `.github/workflows/catalog-refresh.yml` (utama), cron Vercel `/api/cron/catalog-refresh` 03:00 UTC (cadangan) | Jalankan `scripts/generate-catalogs.ts`; unggah ke Vercel Blob |
| Backup user | cron Vercel `/api/cron/users-backup` 20:30 UTC | Neon `app_users_backup` |
| Webhook Ably | `POST /api/realtime/webhook?s=<REALTIME_WEBHOOK_SECRET>` | Riwayat online/offline + peringatan |

## File bersama yang sering disentuh
`lib/authz.ts` (aturan akses), `lib/users.ts` (izin & user), `lib/permGroups.ts` (UI kolom izin), `components/Sidebar.tsx` (menu), `app/(main)/layout.tsx` (gate & hook perangkat), `app/globals.css` (tema, tabel→kartu), `types/index.ts` (tipe domain).
