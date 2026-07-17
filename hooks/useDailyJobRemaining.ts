"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Shared "remaining error reports" computation for Daily Job, used by both
// components/Sidebar.tsx (badges on the 3 report menu items) and
// components/DailyJobAlertBanner.tsx (the "please complete your reports"
// banner), so the remaining-count formula lives in exactly one place.
//
// remaining_X = total_error_X (from today's daily_checklist row for this
// taft) − count of rows this taft has created TODAY in the corresponding
// _report sheet. Never negative.
//
// NOTE: each hook instance (Sidebar + banner) does its own fetch — the
// formula is shared, the network calls are not deduplicated across the two
// mount points. Acceptable simplification for this pass; a future pass could
// lift this into a context/SWR cache if the duplicate polling becomes a
// measurable problem.
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyJobRemaining {
  delivery_note: number;
  sales_order: number;
  stock_entry: number;
  totalRemaining: number;
  loading: boolean;
  refresh: () => void;
}

function parseCreatedAt(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(",", "").replace(/\./g, ":");
  const t = new Date(cleaned).getTime();
  return isNaN(t) ? 0 : t;
}

function jakartaDateKey(epochMs: number): string {
  if (!epochMs) return "";
  return new Date(epochMs).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function todayJakartaKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function countToday(rows: any[]): number {
  const todayKey = todayJakartaKey();
  return rows.filter((r) => jakartaDateKey(parseCreatedAt(r?.created_at)) === todayKey).length;
}

export function useDailyJobRemaining(userName: string | undefined | null): DailyJobRemaining {
  const [state, setState] = useState({
    delivery_note: 0,
    sales_order: 0,
    stock_entry: 0,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!userName) {
      setState({ delivery_note: 0, sales_order: 0, stock_entry: 0, loading: false });
      return;
    }
    try {
      const qs = `userName=${encodeURIComponent(userName)}`;
      const [checklistRes, dnRes, soRes, seRes] = await Promise.all([
        fetch(`/api/daily-job/checklist?${qs}`, { cache: "no-store" }),
        fetch(`/api/daily-job/delivery-note?${qs}`, { cache: "no-store" }),
        fetch(`/api/daily-job/sales-order?${qs}`, { cache: "no-store" }),
        fetch(`/api/daily-job/stock-entry?${qs}`, { cache: "no-store" }),
      ]);

      const checklist = checklistRes.ok ? await checklistRes.json() : null;
      const dnRows = dnRes.ok ? await dnRes.json() : [];
      const soRows = soRes.ok ? await soRes.json() : [];
      const seRows = seRes.ok ? await seRes.json() : [];

      const totalErrorDN = checklist ? Number(checklist.total_error_delivery_note) || 0 : 0;
      const totalErrorSO = checklist ? Number(checklist.total_error_sales_order) || 0 : 0;
      const totalErrorSE = checklist ? Number(checklist.total_error_stock_entry) || 0 : 0;

      const filledDN = countToday(Array.isArray(dnRows) ? dnRows : []);
      const filledSO = countToday(Array.isArray(soRows) ? soRows : []);
      const filledSE = countToday(Array.isArray(seRows) ? seRows : []);

      setState({
        delivery_note: Math.max(0, totalErrorDN - filledDN),
        sales_order: Math.max(0, totalErrorSO - filledSO),
        stock_entry: Math.max(0, totalErrorSE - filledSE),
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [userName]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  return { ...state, totalRemaining: state.delivery_note + state.sales_order + state.stock_entry, refresh: load };
}
