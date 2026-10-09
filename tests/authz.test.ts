import { describe, it, expect } from "vitest";
import { matchRule, RULES } from "@/lib/authz";
import { PERMISSION_KEYS } from "@/lib/users";

const rule = (path: string, method = "GET") => matchRule(path, method);

describe("aturan akses /api", () => {
  it("endpoint publik tidak butuh sesi", () => {
    for (const p of ["/api/auth/login", "/api/auth/logout", "/api/cron/catalog-refresh", "/api/admin/db-export",
      "/api/jastiper/public", "/api/jastiper/report-public", "/api/affiliate/public", "/api/affiliate/report-public", "/api/drive-image"]) {
      expect(rule(p).public, p).toBe(true);
    }
    expect(rule("/api/registration", "POST").public).toBe(true);
  });

  it("registrasi GET/PUT butuh registration_request", () => {
    expect(rule("/api/registration", "GET").public).toBeFalsy();
    expect(rule("/api/registration", "GET").any).toEqual(["registration_request"]);
    expect(rule("/api/registration", "PUT").any).toEqual(["registration_request"]);
  });

  it("route tanpa aturan khusus = wajib login saja", () => {
    for (const p of ["/api/stock", "/api/announcement", "/api/notifications", "/api/store-address"]) {
      const r = rule(p);
      expect(r.public, p).toBeFalsy();
      expect(r.any, p).toEqual([]);
    }
  });

  it("aturan spesifik-method menang atas aturan umum (prefix sama)", () => {
    expect(rule("/api/petty-cash", "GET").any).toEqual(["petty_cash"]);
    expect(rule("/api/petty-cash", "POST").any).toEqual(["petty_cash_add"]);
    expect(rule("/api/petty-cash", "DELETE").any).toEqual(["petty_cash_add"]);
    expect(rule("/api/invoice", "GET").any).toEqual(["invoice"]);
    expect(rule("/api/invoice", "POST").any).toEqual(["invoice_create", "invoice_edit"]);
    expect(rule("/api/invoice", "DELETE").any).toEqual(["invoice_delete"]);
  });

  it("prefix terpanjang menang", () => {
    expect(rule("/api/invoice/master", "POST").any).toEqual(["invoice_master"]);
    expect(rule("/api/invoice/master", "GET").any).toEqual(["invoice"]);
    expect(rule("/api/customer/badges", "GET").any).toEqual([]);
    expect(rule("/api/customer/badges", "POST").any).toEqual(["customer"]);
    expect(rule("/api/petty-cash/export-doc", "POST").any).toEqual(["petty_cash_export"]);
    expect(rule("/api/canvasing/export-doc", "POST").any).toEqual(["canvasing_export"]);
    expect(rule("/api/stock/import", "POST").any).toEqual(["stock_import"]);
  });

  it("prefix tidak bocor ke nama yang mirip (/api/profile vs /api/profiles)", () => {
    expect(rule("/api/profile").prefix).toBe("/api/profile");
    expect(rule("/api/profiles").prefix).toBe("/api/profiles");
    expect(rule("/api/profiles/logout", "POST").prefix).toBe("/api/profiles");
    expect(rule("/api/stock-opname/store").prefix).toBe("/api/stock-opname");
  });

  it("endpoint admin butuh user_setting", () => {
    for (const p of ["/api/users", "/api/javelin-cookie", "/api/javelin-login", "/api/test-env"]) {
      expect(rule(p).any, p).toEqual(["user_setting"]);
    }
  });

  it("scope identitas & hak lihat-semua terpasang", () => {
    const pc = rule("/api/petty-cash", "GET");
    expect(pc.scope?.identity).toContain("username");
    expect(pc.scope?.privileged?.[0]).toMatchObject({ param: "isAdmin", any: ["petty_cash_export"] });
    expect(rule("/api/material-issue").scope?.privileged?.[0]).toMatchObject({ param: "isAll", any: ["material_issue_all"] });
    expect(rule("/api/capture-attendance/capture").scope?.store).toMatchObject({ param: "store_name", bypass: ["attendance_store_all"] });
  });

  it("perangkat toko: register cukup login, daftar & perintah butuh user_setting", () => {
    expect(rule("/api/devices/register", "POST").any).toEqual([]);
    expect(rule("/api/devices", "GET").any).toEqual(["user_setting"]);
    expect(rule("/api/devices/command", "POST").any).toEqual(["user_setting"]);
  });

  it("semua flag di RULES adalah permission yang valid (cegah salah ketik)", () => {
    const valid = new Set(PERMISSION_KEYS);
    for (const r of RULES) {
      for (const f of r.any) expect(valid.has(f), `${r.prefix} → ${f}`).toBe(true);
      for (const p of r.scope?.privileged || []) for (const f of p.any) expect(valid.has(f), `${r.prefix} privileged → ${f}`).toBe(true);
      for (const f of r.scope?.store?.bypass || []) expect(valid.has(f), `${r.prefix} store → ${f}`).toBe(true);
    }
  });
});
