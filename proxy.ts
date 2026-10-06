import { NextRequest, NextResponse } from "next/server";
import { matchRule, sessionInfo, isTrue, SCOPED_HEADER } from "@/lib/authz";
import { getUserByUserName, type UserRow } from "@/lib/users";

// Penegakan akses di server — aturan ada di RULES (lib/authz.ts).
// Permission user di-cache 15 detik per instance supaya tidak query DB tiap request.
const userCache = new Map<string, { user: UserRow | null; exp: number }>();
async function cachedUser(name: string) {
  const hit = userCache.get(name);
  if (hit && hit.exp > Date.now()) return hit.user;
  const user = await getUserByUserName(name);
  userCache.set(name, { user, exp: Date.now() + 15_000 });
  return user;
}

export async function proxy(request: NextRequest) {
  const rule = matchRule(request.nextUrl.pathname, request.method);
  // Header ini hanya boleh diisi proxy (klien tidak boleh memalsukan).
  const fwd = new Headers(request.headers);
  fwd.delete(SCOPED_HEADER);
  const pass = () => NextResponse.next({ request: { headers: fwd } });
  if (rule.public) return pass();

  const info = sessionInfo(request);
  if (!info) {
    return NextResponse.json({ error: "Sesi tidak valid, silakan login ulang" }, { status: 401 });
  }
  const user = await cachedUser(info.user);
  // Akun dihapus/nonaktif, atau sesi diterbitkan sebelum "logout semua" → sesi tidak sah.
  if (!user || user.active === "FALSE" || info.iat < Number(user.sessions_valid_after)) {
    return NextResponse.json({ error: "Sesi berakhir, silakan login ulang" }, { status: 401 });
  }
  if (rule.any.length > 0 && !rule.any.some((k) => isTrue(user[k]))) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  // Ikat identitas & hak data ke sesi (hanya GET).
  if (rule.scope && request.method === "GET") {
    const url = request.nextUrl.clone();
    const q = url.searchParams;
    const sc = rule.scope;
    let changed = false;
    const set = (k: string, v: string) => {
      if (q.get(k) !== v) { q.set(k, v); changed = true; }
    };
    for (const k of sc.identity || []) if (q.has(k)) set(k, user.user_name);
    for (const k of sc.name || []) if (q.has(k)) set(k, user.name);
    for (const p of sc.privileged || []) {
      const want = p.value ?? "true";
      if (q.get(p.param) === want && !p.any.some((f) => isTrue(user[f]))) set(p.param, "false");
    }
    if (sc.store && q.has(sc.store.param) && !sc.store.bypass.some((f) => isTrue(user[f]))) {
      set(sc.store.param, user.user_name);
    }
    if (changed) fwd.set(SCOPED_HEADER, url.search);
  }
  return pass();
}

export const config = { matcher: ["/api/:path*"] };
