import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow, appendSheetData } from '@/lib/sheets';

const SUBSCRIPTION_KEY_PREFIX = 'push_sub_';

export async function POST(request: NextRequest) {
  try {
    const { username, subscription } = await request.json();
    if (!username || !subscription) {
      return NextResponse.json({ error: 'Username and subscription required' }, { status: 400 });
    }

    const data = await getSheetData('system_config');
    const key = `${SUBSCRIPTION_KEY_PREFIX}${username}`;

    const now = new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
    });

    const subscriptionStr = JSON.stringify(subscription);

    // Cari SEMUA index yang punya key sama (termasuk duplikat)
    const matchingIndices: number[] = [];
    data.forEach((row: any, idx: number) => {
      if (row.config_key === key) matchingIndices.push(idx);
    });

    if (matchingIndices.length === 0) {
      // Belum ada, append baru
      await appendSheetData('system_config', [[key, subscriptionStr, username, now]]);
    } else {
      // Update row pertama dengan subscription terbaru
      await updateSheetRow('system_config', matchingIndices[0] + 2, [key, subscriptionStr, username, now]);

      // Clear duplikat jika ada
      for (let i = 1; i < matchingIndices.length; i++) {
        await updateSheetRow('system_config', matchingIndices[i] + 2, ['', '', '', '']);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 });

    const data = await getSheetData('system_config');
    const key = `${SUBSCRIPTION_KEY_PREFIX}${username}`;

    // Ambil yang pertama dan punya config_value
    const entry = data.find((row: any) => row.config_key === key && row.config_value);

    if (!entry?.config_value) return NextResponse.json({ subscription: null });
    return NextResponse.json({ subscription: JSON.parse(entry.config_value) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get subscription' }, { status: 500 });
  }
}