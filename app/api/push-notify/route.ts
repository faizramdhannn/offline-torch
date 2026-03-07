import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBSCRIPTION_KEY_PREFIX = 'push_sub_';

webpush.setVapidDetails(
  'mailto:admin@torch.id',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export async function POST(request: NextRequest) {
  try {
    const { assignedTo, title, body } = await request.json();
    if (!assignedTo) return NextResponse.json({ error: 'assignedTo required' }, { status: 400 });

    const data = await getSheetData('system_config');
    const key = `${SUBSCRIPTION_KEY_PREFIX}${assignedTo}`;
    const entry = data.find((row: any) => row.config_key === key);

    if (!entry?.config_value) {
      return NextResponse.json({ success: false, message: 'No subscription found for user' });
    }

    const subscription = JSON.parse(entry.config_value);

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: title || 'New Request', body: body || 'You have a new request.' })
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Push notify error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}