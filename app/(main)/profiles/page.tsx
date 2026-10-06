"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserCog, X, Save, Loader2, Plus, Trash2, ShieldCheck, LogOut, UserPlus, KeyRound, Archive } from "lucide-react";
import { PERM_GROUPS } from "@/lib/permGroups";
import { useSessionGuard } from "@/hooks/useSessionGuard";

type Role = string;
interface RoleRow { key: string; name: string; perms: Record<string, string>; is_system: boolean; user_count: number }
interface Row {
  id: string; name: string; user_name: string; role: Role; email: string;
  phone: string; address: string; photo_url: string; last_activity: string; active: boolean;
}

const ROLE_STYLE: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  admin: "bg-amber-100 text-amber-700",
  store: "bg-teal-100 text-teal-700",
};
const roleStyle = (k: string) => ROLE_STYLE[k] || "bg-sky-100 text-sky-700";
const avatar = (url: string) => `/api/drive-image?url=${encodeURIComponent(url)}&sz=w128`;

export default function ProfilesPage() {
  const router = useRouter();
  useSessionGuard();
  const [actor, setActor] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [edit, setEdit] = useState<Row | null>(null);
  const [applyRole, setApplyRole] = useState(true);
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [roleEdit, setRoleEdit] = useState<(RoleRow & { isNew?: boolean }) | null>(null);
  const [notice, setNotice] = useState("");

  // ── Buat user ──
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", user_name: "", password: "", role: "store" });
  const createUserSubmit = async () => {
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal membuat user");
      setShowCreate(false);
      setNewUser({ name: "", user_name: "", password: "", role: "store" });
      setNotice(`User ${newUser.user_name} dibuat. Berikan username dan password-nya kepada yang bersangkutan.`);
      await load(actor);
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  // ── Reset password ──
  const [resetResult, setResetResult] = useState("");
  const resetPassword = async (target: { user_name: string; name: string }) => {
    if (!confirm(`Reset password ${target.name}? Semua sesinya akan di-logout.`)) return;
    const res = await fetch("/api/profiles/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_name: target.user_name }) });
    const j = await res.json();
    if (!res.ok) { setErr(j.error || "Gagal reset password"); return; }
    setResetResult(`Password baru untuk ${target.user_name}: ${j.password}`);
  };

  // ── Cadangan (snapshot user & role) ──
  const [showBackup, setShowBackup] = useState(false);
  const [snaps, setSnaps] = useState<{ id: string; taken_at: string; reason: string; taken_by: string; user_count: number }[]>([]);
  const loadSnaps = async () => {
    const res = await fetch("/api/profiles/backup");
    if (res.ok) setSnaps(await res.json());
  };
  const backupAction = async (body: any) => {
    if (body.action === "restore" && !confirm(`Pulihkan user & role dari snapshot #${body.id}? Snapshot "sebelum pemulihan" dibuat otomatis.`)) return;
    const res = await fetch("/api/profiles/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    setNotice(res.ok ? (body.action === "restore" ? `Dipulihkan: ${j.users} user, ${j.roles} role${j.skipped ? ` (${j.skipped} dilewati)` : ""}.` : `Snapshot #${j.id} dibuat.`) : j.error || "Gagal");
    await loadSnaps();
    if (body.action === "restore") await load(actor);
  };

  const forceLogout = async (target?: { user_name: string; name: string }) => {
    const msg = target
      ? `Paksa logout ${target.name}?`
      : "Paksa logout SEMUA akun kecuali Super Admin? Mereka harus login ulang.";
    if (!confirm(msg)) return;
    const res = await fetch("/api/profiles/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target ? { user_name: target.user_name } : { all: true }),
    });
    const j = await res.json();
    setNotice(res.ok ? (target ? `${target.name} di-logout.` : `${j.count} akun di-logout.`) : j.error || "Gagal");
  };
  const roleName = (k: string) => roles.find((r) => r.key === k)?.name || k;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = async (a: string) => {
    setLoading(true);
    const [res, rr] = await Promise.all([
      fetch(`/api/profiles?actor=${encodeURIComponent(a)}`),
      fetch(`/api/roles?actor=${encodeURIComponent(a)}`),
    ]);
    if (res.ok) setRows(await res.json());
    if (rr.ok) setRoles(await rr.json());
    setLoading(false);
  };

  const saveRole = async (apply: boolean) => {
    if (!roleEdit) return;
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/roles", {
        method: roleEdit.isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, key: roleEdit.key, name: roleEdit.name, perms: roleEdit.perms, apply }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan role");
      setNotice(apply ? `Role disimpan dan diterapkan ke ${j.applied} user.` : "Role disimpan.");
      setRoleEdit(null);
      await load(actor);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (key: string) => {
    if (!confirm("Hapus role ini?")) return;
    const res = await fetch("/api/roles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actor, key }) });
    const j = await res.json();
    if (!res.ok) { setErr(j.error); return; }
    setRoleEdit(null);
    await load(actor);
  };

  const togglePerm = (key: string, on: boolean) =>
    setRoleEdit((r) => (r ? { ...r, perms: { ...r.perms, [key]: on ? "TRUE" : "FALSE" } } : r));

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      if (!u) return router.push("/login");
      if (!u.is_super_admin) return router.push("/dashboard");
      setActor(u.user_name);
      load(u.user_name);
    } catch {
      router.push("/login");
    }
  }, [router]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (roleFilter === "all" || r.role === roleFilter) &&
        (!t || [r.name, r.user_name, r.email, r.phone, r.address].some((v) => (v || "").toLowerCase().includes(t)))
    );
  }, [rows, q, roleFilter]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, ...edit, apply_role_perms: applyRole }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan");
      setEdit(null);
      await load(actor);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = "mt-1 w-full rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary";

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><UserCog className="h-5 w-5 text-gray-700" /></span>
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-gray-900">User Profiles & Roles</h1>
          <p className="text-xs text-gray-400">Kelola profil dan role semua user (khusus Super Admin)</p>
        </div>
        <button onClick={() => { setErr(""); setShowCreate(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white">
          <UserPlus className="h-4 w-4" /> Buat user
        </button>
        <button onClick={() => { setShowBackup(true); loadSnaps(); }} className="inline-flex items-center gap-1.5 rounded-xl bg-black/5 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-black/10">
          <Archive className="h-4 w-4" /> Cadangan
        </button>
        <button onClick={() => forceLogout()} className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
          <LogOut className="h-4 w-4" /> Logout semua (kecuali Super Admin)
        </button>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, email, telepon..." className="w-64 rounded-xl border border-gray-200 bg-white/70 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-primary" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900">
          <option value="all">Semua role</option>
          {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
        </select>
      </div>

      <div className="flex gap-2">
        {([["users", "Users"], ["roles", "Roles & Permission"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setNotice(""); setErr(""); }}
            className={`rounded-xl px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-primary text-white" : "bg-black/5 text-gray-700 hover:bg-black/10"}`}>
            {label}
          </button>
        ))}
      </div>
      {notice && <p className="rounded-xl bg-green-50 px-4 py-2 text-xs text-green-700">{notice}</p>}
      {tab === "roles" && err && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{err}</p>}

      {tab === "roles" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <button key={r.key} onClick={() => { setErr(""); setRoleEdit({ ...r }); }} className="glass-card-elevated flex items-start gap-3 rounded-2xl p-4 text-left hover:shadow-lg">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-black/5"><ShieldCheck className="h-5 w-5 text-gray-700" /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-gray-900">{r.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleStyle(r.key)}`}>{r.user_count} user</span></div>
                <p className="text-xs text-gray-500">{Object.values(r.perms).filter((v) => v === "TRUE").length} permission aktif{r.is_system ? " · bawaan" : ""}</p>
              </div>
            </button>
          ))}
          <button onClick={() => { setErr(""); setRoleEdit({ key: "", name: "", perms: {}, is_system: false, user_count: 0, isNew: true }); }} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-4 text-sm font-medium text-gray-500 hover:border-primary hover:text-primary">
            <Plus className="h-4 w-4" /> Tambah role
          </button>
        </div>
      ) : loading ? (
        <p className="py-10 text-center text-sm text-gray-400">Memuat...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <button key={r.id} onClick={() => { setErr(""); setResetResult(""); setEdit(r); }} className="glass-card-elevated flex items-start gap-3 rounded-2xl p-4 text-left transition-shadow hover:shadow-lg">
              <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-full bg-black/5 text-base font-semibold text-gray-700">
                {r.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar(r.photo_url)} alt={r.name} className="h-full w-full object-cover" />
                ) : (
                  (r.name || r.user_name).charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.name}</p>
                  <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleStyle(r.role)}`}>{roleName(r.role)}</span>
                  {!r.active && <span className="flex-none rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Nonaktif</span>}
                </div>
                <p className="text-[11px] text-gray-400">@{r.user_name}</p>
                <p className="mt-1 truncate text-xs text-gray-600">{r.email || <span className="italic text-gray-300">Email belum diisi</span>}</p>
                <p className="truncate text-xs text-gray-600">{r.phone || <span className="italic text-gray-300">Telepon belum diisi</span>}</p>
              </div>
            </button>
          ))}
          {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-gray-400">Tidak ada user</p>}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEdit(null)}>
          <div className="glass-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Profil @{edit.user_name}</h2>
              <button onClick={() => setEdit(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-600">Role
                <select className={field} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
                  {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-gray-500">
                <input type="checkbox" checked={applyRole} onChange={(e) => setApplyRole(e.target.checked)} className="accent-primary" />
                Terapkan permission role ini ke user (jika role diganti)
              </label>
              <label className="block text-xs font-medium text-gray-600">Nama
                <input className={field} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-gray-600">Email
                <input type="email" className={field} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-gray-600">No. telepon
                <input className={field} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-gray-600">Alamat
                <textarea rows={3} className={field} value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800">
                <span>Akun aktif <span className="text-[11px] text-gray-400">(nonaktif = tidak bisa login, sesi dicabut)</span></span>
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={edit.active} disabled={edit.role === "super_admin" || edit.user_name === actor} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              </label>
              <button type="button" onClick={() => resetPassword(edit)} className="inline-flex items-center gap-1.5 text-xs text-gray-700 hover:underline">
                <KeyRound className="h-3.5 w-3.5" /> Reset password
              </button>
              {resetResult && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-mono text-amber-900 select-all">{resetResult}</p>}
              {edit.role !== "super_admin" && (
                <button type="button" onClick={() => forceLogout(edit)} className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:underline">
                  <LogOut className="h-3.5 w-3.5" /> Paksa logout user ini
                </button>
              )}
              <p className="text-[11px] text-gray-400">Login terakhir: {edit.last_activity || "Belum pernah"}</p>
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
              <button onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}


      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreate(false)}>
          <div className="glass-card w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Buat user baru</h2>
              <button onClick={() => setShowCreate(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-600">Nama
                <input className={field} value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-gray-600">Username
                <input className={field} value={newUser.user_name} onChange={(e) => setNewUser({ ...newUser, user_name: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-gray-600">Password awal (min. 6 karakter)
                <input type="text" className={field} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-gray-600">Role (permission mengikuti role)
                <select className={field} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                </select>
              </label>
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
              <button onClick={createUserSubmit} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Buat user
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowBackup(false)}>
          <div className="glass-card max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Cadangan user & role</h2>
              <button onClick={() => setShowBackup(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-3 text-xs text-gray-500">Snapshot otomatis tiap hari dan sebelum "terapkan role". Memulihkan tidak menghapus user yang dibuat setelah snapshot.</p>
            <button onClick={() => backupAction({ action: "create" })} className="mb-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white">
              <Archive className="h-3.5 w-3.5" /> Buat snapshot sekarang
            </button>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {snaps.map((sn) => (
                <div key={sn.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800">#{sn.id} · {new Date(sn.taken_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="truncate text-gray-500">{sn.reason} · {sn.user_count} user · {sn.taken_by}</p>
                  </div>
                  <a href={`/api/profiles/backup?id=${sn.id}`} className="rounded-lg bg-black/5 px-2 py-1 text-gray-700 hover:bg-black/10">Unduh</a>
                  <button onClick={() => backupAction({ action: "restore", id: sn.id })} className="rounded-lg bg-amber-100 px-2 py-1 text-amber-800 hover:bg-amber-200">Pulihkan</button>
                </div>
              ))}
              {snaps.length === 0 && <p className="px-3 py-4 text-center text-xs text-gray-400">Belum ada snapshot</p>}
            </div>
          </div>
        </div>
      )}

      {roleEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRoleEdit(null)}>
          <div className="glass-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">{roleEdit.isNew ? "Role baru" : `Role: ${roleEdit.name}`}</h2>
              <button onClick={() => setRoleEdit(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <label className="block text-xs font-medium text-gray-600">Nama role
              <input className={field} value={roleEdit.name} onChange={(e) => setRoleEdit({ ...roleEdit, name: e.target.value })} placeholder="mis. Supervisor" />
            </label>
            {roleEdit.key === "super_admin" ? (
              <p className="mt-3 text-xs text-gray-500">Super Admin selalu memiliki semua permission.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {PERM_GROUPS.map((g) => {
                  const allOn = g.fields.every((f) => roleEdit.perms[f.key] === "TRUE");
                  return (
                    <div key={g.label} className="rounded-xl border border-gray-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700">{g.label}</p>
                        <button type="button" className="text-[11px] text-primary" onClick={() => g.fields.forEach((f) => togglePerm(f.key, !allOn))}>
                          {allOn ? "Kosongkan" : "Pilih semua"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                        {g.fields.map((f) => (
                          <label key={f.key} className="flex items-center gap-1.5 text-xs text-gray-700">
                            <input type="checkbox" className="accent-primary" checked={roleEdit.perms[f.key] === "TRUE"} onChange={(e) => togglePerm(f.key, e.target.checked)} />
                            {f.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => saveRole(false)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
              </button>
              {!roleEdit.isNew && (
                <button onClick={() => saveRole(true)} disabled={saving} className="rounded-xl bg-black/5 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-black/10 disabled:opacity-50">
                  Simpan & terapkan ke {roleEdit.user_count} user
                </button>
              )}
              {!roleEdit.isNew && !roleEdit.is_system && (
                <button onClick={() => removeRole(roleEdit.key)} className="ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
