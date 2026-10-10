import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { createUser, getUserByUserName } from '@/lib/users';
import bcrypt from 'bcryptjs';
import { clientInfo } from '@/lib/clientInfo';
import { getRegistrationMeta, recentFromIp, recentTotal, saveRegistrationMeta } from '@/lib/registrationMeta';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('registration_request');
    // Hash password tidak perlu (dan tidak boleh) sampai ke browser; sertakan jejak pendaftar (IP, lokasi, perangkat).
    const meta = await getRegistrationMeta(data.map((r: any) => String(r.id))).catch(() => ({}));
    const out = data.map((r: any) => {
      const { password, ...rest } = r;
      const m = (meta as any)[String(r.id)];
      return { ...rest, meta: m ? {
        ip: m.ip, country: m.country, region: m.region, city: m.city, latitude: m.latitude, longitude: m.longitude,
        timezone: m.timezone, device_type: m.device_type, os: m.os, browser: m.browser, model: m.model,
        user_agent: m.user_agent, client: m.client, at: m.created_at,
      } : null };
    });
    return NextResponse.json(out);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch registration requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    // Form login mengirim `user_name`; versi lama `username` — terima keduanya (sebelumnya username hilang → tersimpan "null").
    const name = String(body.name || '').trim().slice(0, 80);
    const username = String(body.user_name ?? body.username ?? '').trim().slice(0, 60);
    const password = String(body.password || '');
    // Jebakan bot: kolom tersembunyi "website" tidak pernah diisi manusia → pura-pura sukses, tidak disimpan.
    if (String(body.website || '').trim()) return NextResponse.json({ success: true });
    const info = clientInfo(request);
    // Pembatas laju: maks 3 permintaan per IP per jam, dan 30 per hari secara total.
    if ((await recentFromIp(info.ip, 60)) >= 3 || (await recentTotal(24)) >= 30) {
      return NextResponse.json({ message: 'Terlalu banyak permintaan, coba lagi nanti atau hubungi admin' }, { status: 429 });
    }
    if (!name || !username || !password) {
      return NextResponse.json({ message: 'Nama, username, dan password wajib diisi' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: 'Password minimal 6 karakter' }, { status: 400 });
    }
    if (/\s/.test(username)) {
      return NextResponse.json({ message: 'Username tidak boleh mengandung spasi' }, { status: 400 });
    }
    // Username belum boleh dipakai akun lain, dan tidak boleh sudah menunggu persetujuan.
    if (await getUserByUserName(username)) {
      return NextResponse.json({ message: 'Username sudah dipakai, pilih yang lain' }, { status: 409 });
    }
    const existing = await getSheetData('registration_request', { skipCache: true });
    if (existing.some((r: any) => r.status === 'pending' && String(r.user_name).toLowerCase() === username.toLowerCase())) {
      return NextResponse.json({ message: 'Permintaan dengan username ini sudah menunggu persetujuan' }, { status: 409 });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Date.now().toString();
    const requestAt = new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const newRequest = [id, name, username, hashedPassword, 'pending', requestAt];
    await appendSheetData('registration_request', [newRequest]);
    // Jejak pendaftar; gagal mencatat tidak boleh menggagalkan permintaannya.
    await saveRegistrationMeta(id, info, { tz: body.tz, lang: body.lang, screen: body.screen }).catch((e) => console.error('registration meta', e));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: 'Gagal mengirim permintaan' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, status, permissions } = await request.json();

    const requests = await getSheetData('registration_request', { skipCache: true });
    const requestIndex = requests.findIndex((r: any) => r.id === id);

    if (requestIndex === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const requestData = requests[requestIndex];
    const rowIndex = requestIndex + 2;

    if (status === 'approved') {
      const uname = String(requestData.user_name || '').trim();
      if (!uname || uname.toLowerCase() === 'null' || uname.toLowerCase() === 'undefined') {
        return NextResponse.json({ error: 'Username permintaan ini kosong (bug lama). Tolak, lalu minta pendaftar mengajukan ulang.' }, { status: 400 });
      }
      if (await getUserByUserName(uname)) {
        return NextResponse.json({ error: 'Username sudah dipakai akun lain' }, { status: 409 });
      }
      await createUser(
        { id: requestData.id, name: requestData.name, user_name: requestData.user_name, password: requestData.password },
        permissions || {}
      );

      const updatedRow = [
        requestData.id,
        requestData.name,
        requestData.user_name,
        requestData.password,
        'approved',
        requestData.request_at,
      ];
      await updateSheetRow('registration_request', rowIndex, updatedRow);

    } else if (status === 'rejected') {
      const updatedRow = [
        requestData.id,
        requestData.name,
        requestData.user_name,
        requestData.password,
        'rejected',
        requestData.request_at,
      ];
      await updateSheetRow('registration_request', rowIndex, updatedRow);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update registration request' }, { status: 500 });
  }
}