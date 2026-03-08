import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow } from '@/lib/sheets';
import { createSign, createPrivateKey } from 'crypto';

const SUBSCRIPTION_KEY_PREFIX = 'push_sub_';

function urlBase64ToBuffer(base64: string): Buffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function bufferToBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function buildVapidToken(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const header = bufferToBase64Url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = bufferToBase64Url(
    Buffer.from(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject }))
  );
  const signingInput = `${header}.${payload}`;

  const pubBuf = urlBase64ToBuffer(publicKey);
  const x = bufferToBase64Url(pubBuf.slice(1, 33));
  const y = bufferToBase64Url(pubBuf.slice(33, 65));

  const jwk = { kty: 'EC', crv: 'P-256', d: privateKey, x, y };
  const key = createPrivateKey({ key: jwk, format: 'jwk' } as any);

  const sign = createSign('SHA256');
  sign.update(signingInput);
  sign.end();
  const sig = sign.sign({ key, dsaEncoding: 'ieee-p1363' } as any);

  return `${signingInput}.${bufferToBase64Url(sig)}`;
}

async function sendPushToSubscription(
  subscription: any,
  title: string,
  body: string,
  publicKey: string,
  privateKey: string
): Promise<{ success: boolean; expired?: boolean; error?: string }> {
  const endpoint: string = subscription.endpoint;
  const origin = new URL(endpoint).origin;

  let jwt: string;
  try {
    jwt = await buildVapidToken(origin, 'mailto:admin@torch.id', publicKey, privateKey);
  } catch (err: any) {
    console.error('Failed to build VAPID token:', err);
    return { success: false, error: `VAPID token error: ${err.message}` };
  }

  const payload = JSON.stringify({
    title: title || 'New Request',
    body: body || 'You have a new request.',
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `vapid t=${jwt},k=${publicKey}`,
      TTL: '86400',
    },
    body: payload,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Push failed:', res.status, text);
    // 410 = expired/unsubscribed, 404 = not found — both mean stale subscription
    const expired = res.status === 410 || res.status === 404;
    return { success: false, expired, error: `Push failed: ${res.status}` };
  }

  return { success: true };
}

export async function POST(request: NextRequest) {
  try {
    const { assignedTo, requesterUsername, title, body } = await request.json();

    if (!assignedTo && !requesterUsername) {
      return NextResponse.json(
        { error: 'assignedTo or requesterUsername required' },
        { status: 400 }
      );
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.VAPID_PRIVATE_KEY || '';

    if (!publicKey || !privateKey) {
      console.warn('VAPID keys not configured');
      return NextResponse.json({ success: false, message: 'VAPID keys not configured' });
    }

    const data = await getSheetData('system_config');
    const results: Record<string, any> = {};

    const recipients = new Set<string>();
    if (assignedTo) recipients.add(assignedTo);
    if (requesterUsername && requesterUsername !== assignedTo) recipients.add(requesterUsername);

    for (const username of recipients) {
      const key = `${SUBSCRIPTION_KEY_PREFIX}${username}`;
      const entryIdx = data.findIndex((row: any) => row.config_key === key);
      const entry = data[entryIdx];

      if (!entry?.config_value) {
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

      const result = await sendPushToSubscription(
        subscription,
        title || 'New Request',
        body || 'You have a new request.',
        publicKey,
        privateKey
      );

      // Auto-cleanup stale subscription from sheet (410/404)
      if (result.expired) {
        console.log(`Clearing expired subscription for ${username}`);
        try {
          await updateSheetRow('system_config', entryIdx + 2, [key, '', username, '']);
        } catch (e) {
          console.error('Failed to clear expired subscription:', e);
        }
      }

      results[username] = result;
    }

    const allSuccess = Object.values(results).every((r: any) => r.success);
    return NextResponse.json({ success: allSuccess, results });
  } catch (error: any) {
    console.error('Push notify error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}