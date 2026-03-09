import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow } from '@/lib/sheets';
import webpush from 'web-push';

const SUBSCRIPTION_KEY_PREFIX = 'push_sub_';

// ─── Setup web-push VAPID ─────────────────────────────────────────────────────
// web-push library handle semua enkripsi dan format push secara otomatis,
// kompatibel dengan Chrome, Firefox, dan semua browser modern.
// Tidak perlu manual FCM v1 API lagi.
webpush.setVapidDetails(
  'https://offline-torch.vercel.app',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const { assignedTo, requesterUsername, title, body } = await request.json();

    if (!assignedTo && !requesterUsername) {
      return NextResponse.json(
        { error: 'assignedTo or requesterUsername required' },
        { status: 400 }
      );
    }

    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return NextResponse.json({ success: false, message: 'VAPID keys not configured' });
    }

    const data = await getSheetData('system_config');
    const results: Record<string, any> = {};

    const recipients = new Set<string>();
    if (assignedTo) recipients.add(assignedTo);
    if (requesterUsername && requesterUsername !== assignedTo) recipients.add(requesterUsername);

    console.log('Sending push to recipients:', [...recipients]);

    for (const username of recipients) {
      const key = `${SUBSCRIPTION_KEY_PREFIX}${username}`;
      const entryIdx = data.findIndex((row: any) => row.config_key === key);
      const entry = data[entryIdx];

      if (!entry?.config_value) {
        console.log(`No subscription found for ${username}`);
        results[username] = { success: false, message: 'No subscription found' };
        continue;
      }

      let subscription: any;
      try {
        subscription = JSON.parse(entry.config_value);
      } catch {
        results[username] = { success: false, message: 'Invalid subscription data' };
        continue;
      }

      console.log(`Sending to ${username}, endpoint: ${subscription.endpoint?.substring(0, 60)}...`);

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: title || 'New Request',
            body: body || 'You have a new request.',
            icon: '/logo_offline_torch.png',
            badge: '/logo_offline_torch.png',
            url: '/request-store',
          })
        );
        console.log(`Push sent successfully to ${username}`);
        results[username] = { success: true };
      } catch (err: any) {
        const statusCode = err.statusCode || 0;
        const expired = statusCode === 404 || statusCode === 410;

        console.error(`Push failed for ${username}:`, statusCode, err.body || err.message);

        if (expired) {
          console.log(`Clearing expired subscription for ${username}`);
          try {
            await updateSheetRow('system_config', entryIdx + 2, [key, '', username, '']);
          } catch (e) {
            console.error('Failed to clear expired subscription:', e);
          }
        }

        results[username] = { success: false, expired, error: `Push failed: ${statusCode}` };
      }
    }

    const allSuccess = Object.values(results).every((r: any) => r.success);
    console.log('Push results:', JSON.stringify(results));
    return NextResponse.json({ success: allSuccess, results });
  } catch (error: any) {
    console.error('Push notify error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}