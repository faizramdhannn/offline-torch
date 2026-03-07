import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

const SUBSCRIPTION_KEY_PREFIX = 'push_sub_';

export async function POST(request: NextRequest) {
  try {
    const { assignedTo, title, body } = await request.json();
    if (!assignedTo) return NextResponse.json({ error: 'assignedTo required' }, { status: 400 });

    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.VAPID_PRIVATE_KEY || '';

    if (!publicKey || !privateKey) {
      console.warn('VAPID keys not configured, skipping push notification');
      return NextResponse.json({ success: false, message: 'VAPID keys not configured' });
    }

    // Lazy require to avoid module-level validation by web-push
    const webpush = require('web-push');
    webpush.setVapidDetails('mailto:admin@torch.id', publicKey, privateKey);

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