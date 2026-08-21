import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow, deleteSheetRows } from '@/lib/sheets';

// Sheet qr_code (spreadsheet SAMA dengan users), kolom (A-E):
// uuid, name, url, created_at, update_at. CRUD dipakai dari menu QR Code
// (app/(main)/qr-code/page.tsx), digerbang oleh permission `dashboard` —
// enforcement dilakukan di client, sama seperti fitur lain di app ini.

function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('qr_code');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching qr_code data:', error);
    return NextResponse.json({ error: 'Failed to fetch qr_code data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const url = (body.url || '').trim();
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    if (!url) return NextResponse.json({ error: 'URL wajib diisi' }, { status: 400 });

    const now = toJakartaTimestamp();
    const uuid = crypto.randomUUID();
    const row = [uuid, name, url, now, now];
    await appendSheetData('qr_code', [row]);

    return NextResponse.json({ success: true, uuid });
  } catch (error) {
    console.error('Error creating qr_code:', error);
    return NextResponse.json({ error: 'Failed to create qr_code' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { uuid, name, url } = body;
    if (!uuid) return NextResponse.json({ error: 'Missing uuid' }, { status: 400 });

    const rows = await getSheetData('qr_code', { skipCache: true });
    const idx = rows.findIndex((r: any) => r.uuid === uuid);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = rows[idx];
    const now = toJakartaTimestamp();
    const updatedRow = [
      existing.uuid,
      (name ?? existing.name) || '',
      (url ?? existing.url) || '',
      existing.created_at,
      now,
    ];
    await updateSheetRow('qr_code', idx + 2, updatedRow);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating qr_code:', error);
    return NextResponse.json({ error: 'Failed to update qr_code' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');
    if (!uuid) return NextResponse.json({ error: 'Missing uuid' }, { status: 400 });

    const rows = await getSheetData('qr_code', { skipCache: true });
    const idx = rows.findIndex((r: any) => r.uuid === uuid);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await deleteSheetRows('qr_code', [idx + 2]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting qr_code:', error);
    return NextResponse.json({ error: 'Failed to delete qr_code' }, { status: 500 });
  }
}
