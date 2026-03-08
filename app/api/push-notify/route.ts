import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow } from '@/lib/sheets';
import { createSign, createPrivateKey } from 'crypto';

const SUBSCRIPTION_KEY_PREFIX = 'push_sub_';

// ─── VAPID helpers (untuk endpoint non-FCM legacy) ───────────────────────────
function urlBase64ToBuffer(base64: string): Buffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function buildVapidToken(audience: string, subject: string, publicKey: string, privateKey: string): Promise<string> {
  const header = toBase64Url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(Buffer.from(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject })));
  const signingInput = `${header}.${payload}`;

  const pubBuf = urlBase64ToBuffer(publicKey);
  const x = toBase64Url(pubBuf.slice(1, 33));
  const y = toBase64Url(pubBuf.slice(33, 65));

  const jwk = { kty: 'EC', crv: 'P-256', d: privateKey, x, y };
  const key = createPrivateKey({ key: jwk, format: 'jwk' } as any);
  const sign = createSign('SHA256');
  sign.update(signingInput);
  sign.end();
  const sig = sign.sign({ key, dsaEncoding: 'ieee-p1363' } as any);
  return `${signingInput}.${toBase64Url(sig)}`;
}

// ─── Google OAuth2 access token untuk FCM v1 ─────────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
  const { client_email, private_key } = creds;

  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = toBase64Url(Buffer.from(JSON.stringify({
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));

  const signingInput = `${header}.${claim}`;
  const sign = createSign('SHA256');
  sign.update(signingInput);
  sign.end();
  const sig = sign.sign(private_key);
  const jwt = `${signingInput}.${sig.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ─── Kirim via FCM HTTP v1 (untuk legacy /fcm/send/ endpoints) ───────────────
async function sendViaFCMv1(fcmToken: string, title: string, body: string): Promise<{ success: boolean; expired?: boolean; error?: string }> {
  const projectId = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}').project_id;
  if (!projectId) return { success: false, error: 'project_id not found in GOOGLE_CREDENTIALS' };

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (err: any) {
    return { success: false, error: `OAuth error: ${err.message}` };
  }

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        webpush: {
          notification: {
            title,
            body,
            icon: '/logo_offline_torch.png',
            badge: '/logo_offline_torch.png',
            requireInteraction: true,
            vibrate: [200, 100, 200],
          },
          fcm_options: { link: '/request-store' },
        },
      },
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const errCode = data?.error?.details?.[0]?.errorCode || '';
    // UNREGISTERED / INVALID_ARGUMENT = token expired/invalid
    const expired = res.status === 404 || errCode === 'UNREGISTERED' || errCode === 'INVALID_ARGUMENT';
    console.error('FCM v1 failed:', res.status, JSON.stringify(data));
    return { success: false, expired, error: `FCM v1 failed: ${res.status}` };
  }

  return { success: true };
}

// ─── Kirim via VAPID Web Push standar (untuk endpoint non-FCM) ───────────────
async function sendViaVapid(
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
    return { success: false, error: `VAPID token error: ${err.message}` };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `vapid t=${jwt},k=${publicKey}`,
      TTL: '86400',
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    const text = await res.text();
    const expired = res.status === 410 || res.status === 404;
    console.error('VAPID push failed:', res.status, text);
    return { success: false, expired, error: `VAPID push failed: ${res.status}` };
  }

  return { success: true };
}

// ─── Router: pilih metode berdasarkan endpoint ────────────────────────────────
async function sendPush(
  subscription: any,
  title: string,
  body: string,
  publicKey: string,
  privateKey: string
): Promise<{ success: boolean; expired?: boolean; error?: string }> {
  const endpoint: string = subscription.endpoint;

  // Legacy FCM endpoint → pakai FCM HTTP v1 API
  if (endpoint.includes('fcm.googleapis.com/fcm/send/')) {
    const fcmToken = endpoint.split('/fcm/send/')[1];
    console.log('Using FCM v1 API for legacy endpoint');
    return sendViaFCMv1(fcmToken, title, body);
  }

  // Standard Web Push (Mozilla, etc.) → pakai VAPID
  console.log('Using VAPID for standard endpoint');
  return sendViaVapid(subscription, title, body, publicKey, privateKey);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { assignedTo, requesterUsername, title, body } = await request.json();

    if (!assignedTo && !requesterUsername) {
      return NextResponse.json({ error: 'assignedTo or requesterUsername required' }, { status: 400 });
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.VAPID_PRIVATE_KEY || '';

    if (!publicKey || !privateKey) {
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

      const result = await sendPush(subscription, title || 'New Request', body || 'You have a new request.', publicKey, privateKey);

      // Auto-cleanup expired subscription
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