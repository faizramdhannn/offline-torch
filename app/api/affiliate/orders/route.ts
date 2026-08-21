import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow, deleteSheetRows } from '@/lib/sheets';

// Sheet order_log_affiliate, kolom (A-K):
// uuid, affiliate_code, store_name, sales_order, order_date, value_order,
// commission_rate, reedem_status, note, created_at, update_at
// (catatan: nama kolom "reedem_status" memang typo di sheet aslinya, dipertahankan)
//
// Satu-satunya sheet affiliate yang full CRUD — master_affiliate, master_data,
// dan affiliate_store_list semuanya read-only (lihat app/api/affiliate/master/route.ts).

function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

// sales_order harus selalu diawali "#" — server adalah sumber kebenaran,
// normalisasi di sini terlepas dari apa yang dikirim client.
function normalizeSalesOrder(v: string): string {
  const trimmed = (v || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

const VALID_COMMISSION_RATES = ['7%', '10%'];
const VALID_REEDEM_STATUS = ['Belum diproses', 'Diproses', 'Sudah Redeem'];

async function findAffiliateByCode(code: string) {
  const trimmed = (code || '').trim().toLowerCase();
  if (!trimmed) return null;
  const master = await getSheetData('master_affiliate');
  return master.find((r: any) => (r.affiliate_code || '').trim().toLowerCase() === trimmed) || null;
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('order_log_affiliate');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching affiliate orders:', error);
    return NextResponse.json({ error: 'Failed to fetch affiliate orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { affiliate_code, store_name, sales_order, order_date, value_order, commission_rate, note } = body;

    if (!affiliate_code || !store_name || !sales_order || !order_date || !value_order || !commission_rate) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
    }
    if (!VALID_COMMISSION_RATES.includes(commission_rate)) {
      return NextResponse.json({ error: 'Commission rate tidak valid' }, { status: 400 });
    }

    const affiliate = await findAffiliateByCode(affiliate_code);
    if (!affiliate) {
      return NextResponse.json({ error: 'Kode affiliate tidak ditemukan' }, { status: 400 });
    }

    const now = toJakartaTimestamp();
    const uuid = crypto.randomUUID();
    const row = [
      uuid,
      affiliate_code.trim(),
      store_name,
      normalizeSalesOrder(sales_order),
      order_date,
      String(value_order).replace(/[^0-9]/g, ''),
      commission_rate,
      'Belum diproses',
      note || '',
      now,
      now,
    ];
    await appendSheetData('order_log_affiliate', [row]);

    return NextResponse.json({ success: true, uuid });
  } catch (error) {
    console.error('Error creating affiliate order:', error);
    return NextResponse.json({ error: 'Failed to create affiliate order' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { uuid, affiliate_code, store_name, sales_order, order_date, value_order, commission_rate, reedem_status, note } = body;
    if (!uuid) return NextResponse.json({ error: 'Missing uuid' }, { status: 400 });

    const rows = await getSheetData('order_log_affiliate', { skipCache: true });
    const idx = rows.findIndex((r: any) => r.uuid === uuid);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = rows[idx];
    const newAffiliateCode = affiliate_code ?? existing.affiliate_code;

    if (affiliate_code && affiliate_code !== existing.affiliate_code) {
      const affiliate = await findAffiliateByCode(newAffiliateCode);
      if (!affiliate) {
        return NextResponse.json({ error: 'Kode affiliate tidak ditemukan' }, { status: 400 });
      }
    }
    if (commission_rate && !VALID_COMMISSION_RATES.includes(commission_rate)) {
      return NextResponse.json({ error: 'Commission rate tidak valid' }, { status: 400 });
    }
    if (reedem_status && !VALID_REEDEM_STATUS.includes(reedem_status)) {
      return NextResponse.json({ error: 'Status redeem tidak valid' }, { status: 400 });
    }

    const now = toJakartaTimestamp();
    const updatedRow = [
      existing.uuid,
      newAffiliateCode,
      store_name ?? existing.store_name,
      sales_order ? normalizeSalesOrder(sales_order) : existing.sales_order,
      order_date ?? existing.order_date,
      value_order !== undefined ? String(value_order).replace(/[^0-9]/g, '') : existing.value_order,
      commission_rate ?? existing.commission_rate,
      reedem_status ?? existing.reedem_status,
      note ?? existing.note,
      existing.created_at,
      now,
    ];
    await updateSheetRow('order_log_affiliate', idx + 2, updatedRow);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating affiliate order:', error);
    return NextResponse.json({ error: 'Failed to update affiliate order' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');
    if (!uuid) return NextResponse.json({ error: 'Missing uuid' }, { status: 400 });

    const rows = await getSheetData('order_log_affiliate', { skipCache: true });
    const idx = rows.findIndex((r: any) => r.uuid === uuid);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await deleteSheetRows('order_log_affiliate', [idx + 2]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting affiliate order:', error);
    return NextResponse.json({ error: 'Failed to delete affiliate order' }, { status: 500 });
  }
}
