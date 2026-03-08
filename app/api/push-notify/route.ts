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

async function buildVapidToken(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const header = bufferToBase64Url(
    Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = bufferToBase64Url(
    Buffer.from(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject }))
  );
  const signingInput = `${header}.${payload}`;

  // Convert raw 32-byte EC private key (base64url) to PKCS8 PEM
  // ASN.1 DER structure for EC P-256 private key in PKCS8:
  // SEQUENCE {
  //   INTEGER 0
  //   SEQUENCE { OID ecPublicKey, OID P-256 }
  //   OCTET STRING {
  //     SEQUENCE {
  //       INTEGER 1
  //       OCTET STRING <32-byte private key>
  //       [1] BIT STRING <65-byte uncompressed public key>
  //     }
  //   }
  // }
  const privKeyBuf = urlBase64ToBuffer(privateKey);
  const pubKeyBuf = urlBase64ToBuffer(publicKey);

  // ECPrivateKey inner sequence (RFC 5915)
  // 30 77 02 01 01 04 20 <32 priv> a1 44 03 42 00 <65 pub>
  const ecPrivKey = Buffer.concat([
    Buffer.from('3077020101042', 'hex').slice(0, -1), // partial — build properly below
  ]);

  // Build ECPrivateKey manually
  const privPart = Buffer.concat([
    Buffer.from('3077', 'hex'),       // SEQUENCE, length 119
    Buffer.from('020101', 'hex'),     // INTEGER 1
    Buffer.from('0420', 'hex'),       // OCTET STRING, length 32
    privKeyBuf,                        // 32-byte private key
    Buffer.from('a144034200', 'hex'), // [1] BIT STRING, length 66 (0x00 + 65 bytes)
    pubKeyBuf,                         // 65-byte uncompressed public key
  ]);

  // PKCS8 wrapper
  // SEQUENCE {
  //   INTEGER 0
  //   SEQUENCE { OID 1.2.840.10045.2.1 (ecPublicKey), OID 1.2.840.10045.3.1.7 (P-256) }
  //   OCTET STRING { <ECPrivateKey> }
  // }
  const algIdentifier = Buffer.from(
    '301306072a8648ce3d020106082a8648ce3d030107',
    'hex'
  );

  const octetWrapped = Buffer.concat([
    Buffer.from([0x04, privPart.length]), // OCTET STRING tag + length
    privPart,
  ]);

  const innerSeq = Buffer.concat([
    Buffer.from([0x02, 0x01, 0x00]), // INTEGER 0
    algIdentifier,
    octetWrapped,
  ]);

  const pkcs8Der = Buffer.concat([
    Buffer.from([0x30, innerSeq.length]), // SEQUENCE
    innerSeq,
  ]);

  const pem = [
    '-----BEGIN PRIVATE KEY-----',
    ...pkcs8Der.toString('base64').match(/.{1,64}/g)!,
    '-----END PRIVATE KEY-----',
  ].join('\n');

  const sign = createSign('SHA256');
  sign.update(signingInput);
  sign.end();
  const sig = sign.sign({ key: pem, dsaEncoding: 'ieee-p1363' });

  return `${signingInput}.${bufferToBase64Url(sig)}`;
}

async function sendPushToSubscription(
  subscription: any,
  title: string,
  body: string,
  publicKey: string,
  privateKey: string
): Promise<{ success: boolean; error?: string }> {
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
      // Correct VAPID authorization header format
      Authorization: `vapid t=${jwt},k=${publicKey}`,
      TTL: '86400',
    },
    body: payload,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Push failed:', res.status, text);
    return { success: false, error: `Push failed: ${res.status} - ${text}` };
  }

  return { success: true };
}

export async function POST(request: NextRequest) {
  try {
    const { assignedTo, requesterUsername, title, body } = await request.json();

    // Must have at least one recipient
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

    // Collect unique recipients (avoid sending twice if same user)
    const recipients = new Map<string, string>(); // username → title/body override
    if (assignedTo) recipients.set(assignedTo, assignedTo);
    if (requesterUsername && requesterUsername !== assignedTo) {
      recipients.set(requesterUsername, requesterUsername);
    }

    for (const [username] of recipients) {
      const key = `${SUBSCRIPTION_KEY_PREFIX}${username}`;
      const entry = data.find((row: any) => row.config_key === key);

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
      results[username] = result;
    }

    const allSuccess = Object.values(results).every((r: any) => r.success);
    return NextResponse.json({ success: allSuccess, results });
  } catch (error: any) {
    console.error('Push notify error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}