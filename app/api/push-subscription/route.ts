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
    const existingIdx = data.findIndex((row: any) => row.config_key === key);

    const now = new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
    });

    const subscriptionStr = JSON.stringify(subscription);

    if (existingIdx !== -1) {
      await updateSheetRow('system_config', existingIdx + 2, [key, subscriptionStr, username, now]);
    } else {
      await appendSheetData('system_config', [[key, subscriptionStr, username, now]]);
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
    const entry = data.find((row: any) => row.config_key === key);

    if (!entry?.config_value) return NextResponse.json({ subscription: null });
    return NextResponse.json({ subscription: JSON.parse(entry.config_value) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get subscription' }, { status: 500 });
  }
}