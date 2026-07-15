import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow, deleteSheetRows } from '@/lib/sheets';
import { createNotification } from '@/lib/notifications';

// Sheet voucher_list, kolom (A-F): id, voucher_name, category, description, created_at, update_at
// CRUD ini hanya boleh dipakai dari frontend oleh user dengan akses `user_setting`
// (lihat app/(main)/voucher/page.tsx) — enforcement dilakukan di client,
// sama seperti pola akses fitur lain di app ini.

function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('voucher_list');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching voucher data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voucher data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = toJakartaTimestamp();
    const row = [
      Date.now().toString(),
      body.voucher_name || '',
      body.category || '',
      body.description || '',
      now,
      now,
    ];
    await appendSheetData('voucher_list', [row]);

    // voucher_list adalah master data bersama, notifikasi broadcast ke semua user.
    try {
      await createNotification({
        scope: 'all',
        type: 'voucher_added',
        title: 'Voucher baru ditambahkan',
        message: `${body.actorName ? body.actorName + ' menambahkan' : 'Ada'} voucher baru: ${body.voucher_name}.`,
        sourceFeature: 'voucher',
        sourceId: row[0],
        createdBy: body.actorName || '',
      });
    } catch (err) {
      console.error('Failed to send voucher-added notification:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating voucher:', error);
    return NextResponse.json({ error: 'Failed to create voucher' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, voucher_name, category, description } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await getSheetData('voucher_list', { skipCache: true });
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = rows[idx];
    const now = toJakartaTimestamp();
    const updatedRow = [
      existing.id,
      voucher_name ?? existing.voucher_name,
      category ?? existing.category,
      description ?? existing.description,
      existing.created_at,
      now,
    ];
    await updateSheetRow('voucher_list', idx + 2, updatedRow);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating voucher:', error);
    return NextResponse.json({ error: 'Failed to update voucher' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const actorName = searchParams.get('actorName') || '';
    const voucherName = searchParams.get('voucher_name') || '';
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await getSheetData('voucher_list', { skipCache: true });
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await deleteSheetRows('voucher_list', [idx + 2]);

    try {
      await createNotification({
        scope: 'all',
        type: 'voucher_deleted',
        title: 'Voucher dihapus',
        message: `${actorName ? actorName + ' menghapus' : 'Ada'} voucher: ${voucherName || id}.`,
        sourceFeature: 'voucher',
        sourceId: id,
        createdBy: actorName,
      });
    } catch (err) {
      console.error('Failed to send voucher-deleted notification:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting voucher:', error);
    return NextResponse.json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
}
