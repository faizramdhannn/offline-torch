import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData } from '@/lib/sheets';
import { createNotification } from '@/lib/notifications';

// GET ?userName=xxx
// Menggabungkan notifikasi scope 'all' (custom broadcast dari admin) dengan
// scope 'user' yang target_user-nya = userName, lalu tandai masing-masing
// `read: boolean` berdasarkan sheet notification_reads (per-item, per-user).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = (searchParams.get('userName') || '').trim();
    if (!userName) return NextResponse.json({ error: 'Missing userName' }, { status: 400 });

    const [allRows, reads] = await Promise.all([
      getSheetData('notifications'),
      getSheetData('notification_reads'),
    ]);

    const readSet = new Set(
      reads
        .filter((r: any) => r.user_name === userName)
        .map((r: any) => r.notification_id)
    );

    const visible = allRows.filter((n: any) => n.scope === 'all' || n.target_user === userName);

    const sorted = [...visible].sort((a: any, b: any) => {
      const tA = new Date(a.created_at || 0).getTime();
      const tB = new Date(b.created_at || 0).getTime();
      return tB - tA;
    });

    const result = sorted.map((n: any) => ({ ...n, read: readSet.has(n.id) }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST — dipakai HANYA oleh UI notifikasi custom (tombol "+" di dropdown bell,
// hanya muncul untuk user dengan akses user_setting — enforcement di client,
// sama seperti pola akses fitur lain di app ini). Selalu scope 'all'.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, message, createdBy } = body;
    if (!title || !message) {
      return NextResponse.json({ error: 'title & message wajib diisi' }, { status: 400 });
    }
    const id = await createNotification({
      scope: 'all',
      type: 'custom',
      title,
      message,
      sourceFeature: 'custom',
      createdBy,
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('POST notifications error:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

// PUT — tandai SATU notifikasi sebagai sudah dibaca oleh SATU user.
// Body: { id: notification_id, userName }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userName } = body;
    if (!id || !userName) {
      return NextResponse.json({ error: 'Missing id/userName' }, { status: 400 });
    }

    const reads = await getSheetData('notification_reads', { skipCache: true });
    const already = reads.some((r: any) => r.notification_id === id && r.user_name === userName);
    if (already) return NextResponse.json({ success: true });

    const readId = `NR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    await appendSheetData('notification_reads', [[readId, id, userName]]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT notifications error:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
