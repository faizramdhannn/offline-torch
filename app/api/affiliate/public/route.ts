import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

// Endpoint PUBLIK, TIDAK ADA auth/session check — sengaja terbuka supaya
// affiliator (bukan user internal) bisa cek performa mereka sendiri dari
// app/affiliator/page.tsx (halaman publik, di luar (main) route group).
// Verifikasi identitas dilakukan dengan mencocokkan affiliate_code + email
// terhadap sheet master_affiliate, BUKAN lewat session.
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // `identifier` = email ATAU no. telepon (`email` tetap diterima untuk klien lama)
    const email = body.identifier ?? body.email;
    const affiliate_code = body.affiliate_code;

    if (!email || !affiliate_code) {
      return NextResponse.json(
        { error: 'Email/no. telepon dan kode affiliate wajib diisi' },
        { status: 400 }
      );
    }

    const idNorm = String(email).trim().toLowerCase();
    // Telepon: ambil angka saja, 0812… / +62812… / 62812… dianggap sama (kunci = 8xx…).
    const phoneKey = (v: any) => String(v || '').replace(/\D/g, '').replace(/^(62|0)+/, '');
    const isEmail = idNorm.includes('@');
    const idPhone = phoneKey(idNorm);
    const codeNorm = String(affiliate_code).trim().toLowerCase();

    const masterAffiliate = await getSheetData('master_affiliate');
    const affiliate = masterAffiliate.find(
      (r: any) =>
        (r.affiliate_code || '').trim().toLowerCase() === codeNorm &&
        (isEmail
          ? (r.affiliate_email || '').trim().toLowerCase() === idNorm
          : idPhone.length >= 8 && phoneKey(r.affiliate_number) === idPhone)
    );

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Email/no. telepon atau kode affiliate tidak ditemukan' },
        { status: 404 }
      );
    }

    const allOrders = await getSheetData('order_log_affiliate');
    const orders = allOrders.filter(
      (r: any) => (r.affiliate_code || '').trim().toLowerCase() === codeNorm
    );

    let totalCommission = 0;
    const commissionByStatus: Record<string, number> = {};
    for (const o of orders) {
      const value = parseValueOrder(o.value_order);
      const rate = parseCommissionRate(o.commission_rate);
      const commission = (value * rate) / 100;
      totalCommission += commission;
      const status = o.reedem_status || 'Belum diproses';
      commissionByStatus[status] = (commissionByStatus[status] || 0) + commission;
    }

    return NextResponse.json({
      affiliate: {
        affiliate_name: affiliate.affiliate_name,
        affiliate_number: affiliate.affiliate_number,
        affiliate_code: affiliate.affiliate_code,
      },
      orders,
      summary: {
        total_orders: orders.length,
        total_commission: totalCommission,
        commission_by_status: commissionByStatus,
      },
    });
  } catch (error) {
    console.error('Error checking affiliate performance:', error);
    return NextResponse.json(
      { error: 'Gagal memuat data affiliate' },
      { status: 500 }
    );
  }
}
