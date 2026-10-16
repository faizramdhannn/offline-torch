import { NextRequest, NextResponse } from 'next/server';
import { actorName } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { getMaster, saveMaster } from '@/lib/invoices';

export const dynamic = 'force-dynamic';

// GET – pengaturan master invoice (kop, perusahaan, tanda tangan, PPN). Boleh dibaca semua pemegang izin invoice.
export async function GET() {
  try {
    const m = await getMaster();
    return NextResponse.json(Object.keys(m).length ? m : null);
  } catch (error) {
    console.error('Error fetching master invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch master invoice' }, { status: 500 });
  }
}

// POST – ubah pengaturan master (izin invoice_master, lihat RULES)
export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    await saveMaster(b, actorName(request));
    audit(request, 'PUT', 'Pengaturan master invoice diubah', 'invoice');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving master invoice:', error);
    return NextResponse.json({ error: 'Failed to save master invoice' }, { status: 500 });
  }
}
