"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Camera, Mail, MapPin, Phone, Save, Trash2, KeyRound, Loader2 } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { compressImageFile } from "@/lib/compressImage";
import { useRouter, useSearchParams } from "next/navigation";
import { profileProblems, requiredProfileFields, PROFILE_FIELD_LABEL, type ProfileField } from "@/lib/profileRules";

interface Profile {
  name: string;
  user_name: string;
  email: string;
  phone: string;
  address: string;
  photo_url: string;
  role: string;
  prefilled_from_store: boolean;
}

const avatarSrc = (url: string) => `/api/drive-image?url=${encodeURIComponent(url)}&sz=w256`;

function ProfileInner() {
  const { user, setUser } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forced = searchParams.get("required") === "1";
  const [problems, setProblems] = useState<Partial<Record<ProfileField, string>>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.user_name) return;
    fetch(`/api/profile?username=${encodeURIComponent(user.user_name)}`)
      .then((r) => r.json())
      .then((p: Profile) => {
        setProfile(p);
        setForm({ name: p.name || "", email: p.email || "", phone: p.phone || "", address: p.address || "" });
      })
      .catch(() => setMsg({ type: "err", text: "Gagal memuat profil" }));
  }, [user?.user_name]);

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    setPhotoFile(f);
    setRemovePhoto(false);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!user?.user_name) return;
    if (pw.next && pw.next !== pw.confirm) {
      setMsg({ type: "err", text: "Konfirmasi password baru tidak sama" });
      return;
    }
    // Validasi kelengkapan sesuai role (Store & Merchant wajib alamat; semua wajib email, telepon, foto).
    const found = profileProblems(
      { role: profile?.role || user.role, name: form.name, email: form.email, phone: form.phone, address: form.address, photo_url: removePhoto ? "" : profile?.photo_url },
      !!photoFile && !removePhoto
    );
    setProblems(found);
    if (Object.keys(found).length > 0) {
      setMsg({ type: "err", text: "Lengkapi data yang ditandai merah terlebih dahulu" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("username", user.user_name);
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("phone", form.phone);
      fd.append("address", form.address);
      if (photoFile) fd.append("photo", await compressImageFile(photoFile, 800, 0.85, 0));
      if (removePhoto) fd.append("remove_photo", "true");
      if (pw.next) {
        fd.append("current_password", pw.current);
        fd.append("new_password", pw.next);
      }
      const res = await fetch("/api/profile", { method: "PUT", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan");
      const p: Profile = j.profile;
      setProfile(p);
      setPhotoFile(null);
      setPhotoPreview("");
      setRemovePhoto(false);
      setPw({ current: "", next: "", confirm: "" });
      const next = { ...user, name: p.name, email: p.email, phone: p.phone, address: p.address, photo_url: p.photo_url || "", role: p.role, is_super_admin: p.role === "super_admin" };
      try { localStorage.setItem("user", JSON.stringify(next)); } catch {}
      setUser(next);
      setProblems({});
      setMsg({ type: "ok", text: "Profil tersimpan" });
      if (forced) setTimeout(() => router.replace("/dashboard"), 700);
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  };

  const roleNow = profile?.role || user?.role;
  const required = requiredProfileFields(roleNow);
  const star = (f: ProfileField) => (required.includes(f) ? <span className="text-red-500"> *</span> : null);
  const bad = (f: ProfileField) => !!problems[f];
  const errText = (f: ProfileField) => (problems[f] ? <span className="mt-1 block text-[11px] font-normal text-red-600">{problems[f]}</span> : null);

  const shownPhoto = removePhoto ? "" : photoPreview || (profile?.photo_url ? avatarSrc(profile.photo_url) : "");
  const initial = (form.name || user?.user_name || "?").charAt(0).toUpperCase();
  const field = "w-full rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary";

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      {(forced || Object.keys(problems).length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Lengkapi profil Anda terlebih dahulu</p>
          <p className="mt-0.5 text-xs">
            Kolom bertanda <span className="text-red-500">*</span> wajib diisi:{" "}
            {required.map((f) => PROFILE_FIELD_LABEL[f]).join(", ")}.
            {!required.includes("address") && " Alamat tidak wajib untuk akun Anda."}
          </p>
        </div>
      )}
      <div
        className="rounded-3xl px-6 py-6 text-white"
        style={{ background: "linear-gradient(135deg, #35393C 0%, #1f4e63 45%, #0d7a8f 100%)" }}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/15 text-2xl font-semibold ring-2 ring-white/40">
              {shownPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownPhoto} alt="Foto profil" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-800 shadow"
              title="Ganti foto"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold" style={{ color: "#fff" }}>{form.name || user?.user_name}</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
              @{user?.user_name}
              {profile?.role && ` · ${({ super_admin: "Super Admin", admin: "Admin", store: "Store" } as Record<string, string>)[profile.role] || profile.role}`}
            </p>
            {problems.photo && <p className="mt-1 rounded bg-red-500/90 px-2 py-0.5 text-[11px] text-white">{problems.photo}</p>}
            {!shownPhoto && !problems.photo && required.includes("photo") && <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,.85)" }}>Foto profil wajib (klik ikon kamera)</p>}
            {(profile?.photo_url || photoFile) && !removePhoto && (
              <button
                type="button"
                onClick={() => { setRemovePhoto(true); setPhotoFile(null); setPhotoPreview(""); }}
                className="mt-1 inline-flex items-center gap-1 text-xs"
                style={{ color: "rgba(255,255,255,.8)" }}
              >
                <Trash2 className="h-3 w-3" /> Hapus foto
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card-elevated space-y-4 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900">Data diri</h2>
        {profile?.prefilled_from_store && (
          <p className="text-xs text-gray-500">Telepon/alamat diisi otomatis dari data toko. Simpan untuk menjadikannya data profil Anda.</p>
        )}
        <label className="block text-xs font-medium text-gray-600">
          Nama{star("name")}
          <input className={`${field} mt-1 ${bad("name") ? "!border-red-400" : ""}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {errText("name")}
        </label>
        <label className="block text-xs font-medium text-gray-600">
          <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> Email{star("email")}</span>
          <input type="email" className={`${field} mt-1 ${bad("email") ? "!border-red-400" : ""}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {errText("email")}
        </label>
        <label className="block text-xs font-medium text-gray-600">
          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> No. telepon{star("phone")}</span>
          <input inputMode="tel" className={`${field} mt-1 ${bad("phone") ? "!border-red-400" : ""}`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {errText("phone")}
        </label>
        <label className="block text-xs font-medium text-gray-600">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Alamat{star("address")}</span>
          <textarea rows={3} className={`${field} mt-1 ${bad("address") ? "!border-red-400" : ""}`} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {errText("address")}
        </label>
      </div>

      <div className="glass-card-elevated space-y-4 rounded-2xl p-5">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900"><KeyRound className="h-4 w-4" /> Ganti password</h2>
        <p className="text-xs text-gray-500">Kosongkan jika tidak ingin mengganti.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input type="password" placeholder="Password saat ini" className={field} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <input type="password" placeholder="Password baru" className={field} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <input type="password" placeholder="Ulangi password baru" className={field} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        </div>
      </div>

      {msg && (
        <p className={`rounded-xl px-4 py-2 text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      <button
        onClick={save}
        disabled={saving || !profile}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Simpan
      </button>
    </div>
  );
}


export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileInner />
    </Suspense>
  );
}
