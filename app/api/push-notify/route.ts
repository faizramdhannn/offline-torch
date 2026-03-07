import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { createSign } from 'crypto';

const SUBSCRIPTION_KEY_PREFIX = 'push_sub_';

function urlBase64ToBuffer(base64: string): Buffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function bufferToBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function buildVapidToken(audience: string, subject: string, publicKey: string, privateKey: string): Promise<string> {
  const header = bufferToBase64Url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = bufferToBase64Url(Buffer.from(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject })));
  const signingInput = `${header}.${payload}`;
  
  const sign = createSign('SHA256');
  sign.update(signingInput);
  
  // Convert base64url private key to PEM
  const privKeyBuf = urlBase64ToBuffer(privateKey);
  // web-push private key is raw 32-byte EC private key, need to wrap in PKCS8
  const pkcs8Header = Buffer.from('308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420', 'hex');
  const pkcs8Footer = Buffer.from('a144034200', 'hex');
  const pubKeyBuf = urlBase64ToBuffer(publicKey);
  const fullPkcs8 = Buffer.concat([pkcs8Header, privKeyBuf, pkcs8Footer, pubKeyBuf]);
  const pem = `-----BEGIN PRIVATE KEY-----\n${fullPkcs8.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  
  sign.end();
  const sig = sign.sign({ key: pem, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${bufferToBase64Url(sig)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { assignedTo, title, body } = await request.json();
    if (!assignedTo) return NextResponse.json({ error: 'assignedTo required' }, { status: 400 });

    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.VAPID_PRIVATE_KEY || '';

    if (!publicKey || !privateKey) {
      console.warn('VAPID keys not configured');
      return NextResponse.json({ success: false, message: 'VAPID keys not configured' });
    }

    const data = await getSheetData('system_config');
    const key = `${SUBSCRIPTION_KEY_PREFIX}${assignedTo}`;
    const entry = data.find((row: any) => row.config_key === key);

    if (!entry?.config_value) {
      return NextResponse.json({ success: false, message: 'No subscription found for user' });
    }

    const subscription = JSON.parse(entry.config_value);
    const endpoint: string = subscription.endpoint;
    const origin = new URL(endpoint).origin;

    const jwt = await buildVapidToken(origin, 'mailto:admin@torch.id', publicKey, privateKey);

    const payload = JSON.stringify({ title: title || 'New Request', body: body || 'You have a new request.' });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `vapid t=${jwt},k=${publicKey}`,
        'TTL': '86400',
      },
      body: payload,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Push failed:', res.status, text);
      return NextResponse.json({ success: false, error: `Push failed: ${res.status}` });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Push notify error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}