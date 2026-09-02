import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { jakartaDateKeyFromCreatedAt } from '@/lib/dailyJobDate';

// Endpoint PUBLIK, TIDAK ADA auth/session check — sengaja terbuka supaya
// siapa saja bisa lihat report performa Affiliate dari app/affiliate-report/page.tsx
// (halaman publik, di luar (main) route group), dengan filter store (semua/salah satu).
//
// JANGAN tambahkan auth check di sini — ini disengaja.

function parseCommissionRate(v: string | undefined | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace('%', '').trim());
  return isNaN(n) ? 0 : n;
}

function parseValueOrder(v: string | undefined | null): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toProperCase(v: string | undefined | null): string {
  if (!v) return '';
  return String(v)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const store = (searchParams.get('store') || 'all').trim();

    const [allOrders, masterAffiliate, storeListRaw] = await Promise.all([
      getSheetData('order_log_affiliate'),
      getSheetData('master_affiliate'),
      getSheetData('affiliate_store_list'),
    ]);

    const nameByCode: Record<string, string> = {};
    const storeByCode: Record<string, string> = {};
    const jobByCode: Record<string, string> = {};
    for (const a of masterAffiliate as any[]) {
      if (a.affiliate_code) {
        nameByCode[a.affiliate_code] = a.affiliate_name || a.affiliate_code;
        storeByCode[a.affiliate_code] = a.affiliate_store || '';
        jobByCode[a.affiliate_code] = a.affiliate_job || '';
      }
    }

    const stores = (storeListRaw as any[])
      .map((s) => s.store_name)
      .filter(Boolean);

    const filtered = (allOrders as any[]).filter(
      (o) => store === 'all' || (o.store_name || '') === store
    );

    let totalValue = 0;
    let totalCommission = 0;
    const byStore: Record<string, { orders: number; value: number; commission: number }> = {};
    // Keyed by affiliate_code (bukan nama) supaya code tetap ikut terbawa
    // untuk ditampilkan di tabel "List Affiliate" (nama saja bisa ambigu
    // kalau ada 2 affiliate dengan nama sama).
    const byAffiliateCode: Record<string, { name: string; orders: number; value: number; commission: number }> = {};
    const byDay: Record<string, { orders: number; commission: number }> = {};

    for (const o of filtered) {
      const value = parseValueOrder(o.value_order);
      const rate = parseCommissionRate(o.commission_rate);
      const commission = (value * rate) / 100;
      totalValue += value;
      totalCommission += commission;

      const storeKey = o.store_name || 'Lainnya';
      if (!byStore[storeKey]) byStore[storeKey] = { orders: 0, value: 0, commission: 0 };
      byStore[storeKey].orders += 1;
      byStore[storeKey].value += value;
      byStore[storeKey].commission += commission;

      const code = o.affiliate_code || 'Unknown';
      if (!byAffiliateCode[code]) {
        byAffiliateCode[code] = { name: nameByCode[code] || code, orders: 0, value: 0, commission: 0 };
      }
      byAffiliateCode[code].orders += 1;
      byAffiliateCode[code].value += value;
      byAffiliateCode[code].commission += commission;

      const dayKey = jakartaDateKeyFromCreatedAt(o.created_at) || o.order_date || 'Unknown';
      if (!byDay[dayKey]) byDay[dayKey] = { orders: 0, commission: 0 };
      byDay[dayKey].orders += 1;
      byDay[dayKey].commission += commission;
    }

    const chartByStore = Object.entries(byStore)
      .map(([store_name, v]) => ({ store_name, ...v }))
      .sort((a, b) => b.commission - a.commission);

    const affiliateEntries = Object.entries(byAffiliateCode)
      .map(([affiliate_code, v]) => ({
        affiliate_code,
        affiliate_name: v.name,
        affiliate_store: storeByCode[affiliate_code] || '',
        affiliate_job: toProperCase(jobByCode[affiliate_code]),
        orders: v.orders,
        value: v.value,
        commission: v.commission,
      }))
      .sort((a, b) => b.commission - a.commission);

    const chartByAffiliate = affiliateEntries.slice(0, 10);

    // List SEMUA affiliate (bukan cuma top 10 kayak chart) — untuk tabel
    // "List Affiliate" di halaman publik. Termasuk affiliate yang terdaftar
    // di master_affiliate tapi belum punya order sama sekali (orders: 0),
    // supaya list-nya benar-benar representasi semua affiliate.
    const affiliateList = [...affiliateEntries];
    for (const a of masterAffiliate as any[]) {
      const code = a.affiliate_code;
      if (code && !byAffiliateCode[code]) {
        affiliateList.push({
          affiliate_code: code,
          affiliate_name: a.affiliate_name || code,
          affiliate_store: a.affiliate_store || '',
          affiliate_job: toProperCase(a.affiliate_job),
          orders: 0,
          value: 0,
          commission: 0,
        });
      }
    }
    affiliateList.sort((a, b) => b.commission - a.commission || a.affiliate_name.localeCompare(b.affiliate_name, 'id'));

    const chartTrend = Object.entries(byDay)
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([date, v]) => ({ date, ...v }))
      .slice(-30);

    const list = [...filtered]
      .map((o) => ({
        sales_order: o.sales_order,
        affiliate_code: o.affiliate_code,
        affiliate_name: nameByCode[o.affiliate_code] || o.affiliate_code,
        store_name: o.store_name,
        order_date: o.order_date,
        value_order: o.value_order,
        commission_rate: o.commission_rate,
        reedem_status: o.reedem_status,
        created_at: o.created_at,
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 100);

    return NextResponse.json({
      stores,
      summary: {
        total_orders: filtered.length,
        total_value: totalValue,
        total_commission: totalCommission,
      },
      chart_by_store: chartByStore,
      chart_by_affiliate: chartByAffiliate,
      affiliate_list: affiliateList,
      chart_trend: chartTrend,
      list,
    });
  } catch (error) {
    console.error('Error fetching affiliate public report:', error);
    return NextResponse.json({ error: 'Gagal memuat report' }, { status: 500 });
  }
}
