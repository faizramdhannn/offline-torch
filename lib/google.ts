// Pengganti `import { google } from '@/lib/google';` (paket besar ±195 MB yang memuat ratusan API Google).
// Aplikasi ini hanya memakai Sheets + Drive + GoogleAuth, jadi cukup paket modularnya: bundle dan cold start
// jauh lebih ringan, sementara pemanggilan di seluruh kode tetap sama: google.auth.GoogleAuth,
// google.sheets({ version: "v4", auth }), google.drive({ version: "v3", auth }).
import { sheets, auth } from "@googleapis/sheets";
import { drive } from "@googleapis/drive";

export const google = { auth, sheets, drive };
