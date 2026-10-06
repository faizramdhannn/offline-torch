import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { getUserByUserName, type UserRow } from "./users";

// Identitas pemanggil dari cookie sesi bertanda tangan (bukan dari body/query).
export function sessionInfo(request: NextRequest | Request): { user: string; iat: number } | null {
  const header = request.headers.get("cookie") || "";
  const m = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return verifySessionToken(m ? decodeURIComponent(m[1]) : null);
}

export function sessionUserName(request: NextRequest | Request): string | null {
  return sessionInfo(request)?.user ?? null;
}

export async function sessionUser(request: NextRequest | Request): Promise<UserRow | null> {
  const name = sessionUserName(request);
  return name ? getUserByUserName(name) : null;
}

// Query yang sudah "diikat" ke sesi oleh proxy.ts (identitas, hak lihat-semua, toko).
// Route GET yang ber-scope membaca parameter lewat sini, bukan langsung dari request.url.
export const SCOPED_HEADER = "x-scoped-search";
export function scopedParams(request: NextRequest | Request): URLSearchParams {
  const h = request.headers.get(SCOPED_HEADER);
  return new URLSearchParams(h !== null ? h : new URL(request.url).search);
}

export const isTrue = (v: unknown) => v === "TRUE";

// Penegakan akses di server.
// - Semua /api WAJIB sesi sah, kecuali yang ditandai `public`.
// - `any` = user harus punya SALAH SATU flag (kosong = cukup login).
// - Aturan dengan prefix terpanjang menang; `methods` kosong = semua method.
// `scope` (hanya GET) mengikat identitas/hak data ke sesi, bukan ke parameter dari browser:
//  - identity: parameter yang diisi paksa dengan user_name sesi (username, userName, ...)
//  - name: parameter yang diisi paksa dengan nama lengkap user
//  - privileged: parameter "lihat semua" (mis. isAll=true) hanya berlaku bila user punya salah satu flag;
//    kalau tidak, nilainya dipaksa false.
//  - store: parameter nama toko; user tanpa salah satu flag bypass hanya boleh memakai user_name-nya sendiri.
interface Scope {
  identity?: string[];
  name?: string[];
  privileged?: { param: string; value?: string; any: string[] }[];
  store?: { param: string; bypass: string[] };
}

export interface Rule {
  prefix: string;
  methods?: string[];
  any: string[];
  public?: boolean;
  scope?: Scope;
}

const pub = (prefix: string, methods?: string[]): Rule => ({ prefix, methods, any: [], public: true });
const need = (prefix: string, any: string[], methods?: string[], scope?: Scope): Rule => ({ prefix, methods, any, scope });
const ID = ["username", "userName", "user_name"];

export const RULES: Rule[] = [
  // ── Publik (tanpa login): login, cron, Google Sheets IMPORTDATA, halaman publik ──
  pub("/api/auth/login"),
  pub("/api/auth/logout"),
  pub("/api/cron"),
  pub("/api/admin/db-export"),
  pub("/api/jastiper/public"),
  pub("/api/jastiper/report-public"),
  pub("/api/affiliate/public"),
  pub("/api/affiliate/report-public"),
  pub("/api/drive-image"),
  pub("/api/registration", ["POST"]),

  // ── Admin / setting ──
  need("/api/users", ["user_setting"]),
  need("/api/registration", ["registration_request"]),
  need("/api/javelin-cookie", ["user_setting"]),
  need("/api/javelin-login", ["user_setting"]),
  need("/api/test-env", ["user_setting"]),
  need("/api/catalog/refresh", ["user_setting"], ["POST"]),
  need("/api/roles", []),
  need("/api/auth/me", []),
  need("/api/profiles", []),
  need("/api/profile", []),

  // ── Export / import / hapus ──
  need("/api/petty-cash/export-doc", ["petty_cash_export"]),
  need("/api/canvasing/export-doc", ["canvasing_export"]),
  need("/api/stock/import", ["stock_import"]),
  need("/api/stock/javelin-refresh", ["stock_refresh_javelin"]),
  need("/api/import", ["order_report_import"]),
  need("/api/jastiper/import", ["jastiper"]),
  need("/api/customer/import", ["customer"]),

  // ── Modul ──
  need("/api/asset", ["asset_store"]),
  need("/api/bundling", ["bundling"]),
  need("/api/canvasing", ["canvasing"], undefined, { identity: ID }),
  need("/api/customer", ["customer"], undefined, { identity: ID }),
  need("/api/customer/badges", [], ["GET"]), // dibaca juga oleh halaman Stock
  need("/api/customer/badges", ["customer"], ["POST", "PUT", "DELETE"]),
  need("/api/daily-job", ["daily_checklist", "daily_checklist_all"], undefined, {
    identity: ID,
    name: ["name"],
    privileged: [{ param: "scope", value: "all", any: ["daily_checklist_all"] }],
  }),
  need("/api/employee-discount", ["employee_discount", "employee_discount_approval"], undefined, {
    identity: ID,
    privileged: [{ param: "isAll", any: ["employee_discount_approval"] }],
  }),
  need("/api/invoice", ["invoice"]),
  need("/api/invoice", ["invoice_create", "invoice_edit"], ["POST", "PUT"]),
  need("/api/invoice", ["invoice_delete"], ["DELETE"]),
  need("/api/invoice/master", ["invoice_master"], ["POST"]),
  need("/api/jastiper", ["jastiper"], undefined, { identity: ID }),
  need("/api/material-issue", ["material_issue", "material_issue_all"], undefined, {
    identity: ID,
    privileged: [{ param: "isAll", any: ["material_issue_all"] }],
  }),
  need("/api/order-report", ["order_report"]),
  need("/api/shopify-analytics", ["analytics_order"]),
  need("/api/analytics-order", ["analytics_order"]),
  need("/api/petty-cash", ["petty_cash"], undefined, {
    identity: ID,
    privileged: [{ param: "isAdmin", any: ["petty_cash_export"] }],
  }),
  need("/api/petty-cash", ["petty_cash_add"], ["POST", "PUT", "DELETE"]),
  need("/api/petty-cash/history", ["petty_cash"]),
  need("/api/petty-cash/balance", ["petty_cash_balance"], ["POST", "PUT", "DELETE"]),
  need("/api/qr-code", ["dashboard"]),
  need("/api/request-store", ["request", "edit_request"]),
  need("/api/request-tracking", ["request_tracking", "tracking_edit"], undefined, {
    identity: ID,
    privileged: [{ param: "isTrackingEdit", any: ["tracking_edit"] }],
  }),
  need("/api/sales", ["sales_view", "sales_view_all"]),
  need("/api/step-erp", ["step_erp", "step_erp_all"]),
  need("/api/attendance/report", ["attendance_report"], ["POST"]),
  need("/api/stock-opname", ["stock_opname", "stock_opname_report"], undefined, {
    identity: ID,
    privileged: [{ param: "hasReportAccess", any: ["stock_opname_report"] }],
  }),
  need("/api/traffic-store", ["traffic_store", "report_store"]),
  need("/api/voucher", ["voucher"]),
  need("/api/affiliate", ["affiliate_view"]),
  need("/api/capture-attendance/capture", [], ["GET"], {
    privileged: [{ param: "all", any: ["attendance_store_all"] }],
    store: { param: "store_name", bypass: ["attendance_store_all"] },
  }),
  // attendance/*, capture-attendance/*, stock (GET), master-*, notifications, push-*,
  // activity-log, announcement, store-address, categories: cukup login (dipakai lintas halaman).
];

const DEFAULT_RULE: Rule = { prefix: "", any: [] };

export function matchRule(pathname: string, method: string): Rule {
  const hit = RULES.filter(
    (r) => (pathname === r.prefix || pathname.startsWith(r.prefix + "/")) && (!r.methods || r.methods.includes(method))
  ).sort((a, b) => b.prefix.length - a.prefix.length || Number(!!b.methods) - Number(!!a.methods))[0];
  return hit || DEFAULT_RULE;
}
