import { NextRequest, NextResponse } from 'next/server';
import { toClientUser } from '@/lib/clientUser';
import { getUserByUserName, touchLastActivity } from '@/lib/users';
import bcrypt from 'bcryptjs';
import { loginKeys, lockedSeconds, recordFailure, clearFailures } from '@/lib/loginGuard';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_S } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || '';
    const { userKey, ipKey } = loginKeys(username, ip);

    const wait = await lockedSeconds(userKey, ipKey);
    if (wait > 0) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(wait / 60)} menit.` },
        { status: 429, headers: { 'Retry-After': String(wait) } }
      );
    }

    const user = await getUserByUserName(username);

    if (!user) {
      await recordFailure(userKey, ipKey);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.active === 'FALSE') {
      return NextResponse.json({ error: 'Akun nonaktif' }, { status: 403 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await recordFailure(userKey, ipKey);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    await clearFailures(userKey);

    // ✅ Catat waktu login terakhir ke kolom last_activity di sheet users.
    // Fail-soft: kalau gagal update sheet, login tetap lanjut tanpa error ke user.
    const loginTimestamp = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });
    touchLastActivity(user.user_name, loginTimestamp).catch((err) => {
      console.error('Failed to update last_activity:', err);
    });

    // Bentuk user di browser SAMA dengan /api/auth/me (toClientUser): izin baru otomatis ikut,
    // tidak perlu menambah daftar manual di sini (dulu invoice_approval & store_monitor tidak terkirim saat login).
    const res = NextResponse.json(toClientUser(user));
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.user_name), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_S,
    });
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}