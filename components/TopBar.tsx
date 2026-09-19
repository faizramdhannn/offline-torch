"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X, Megaphone, ImagePlus, Trash2 } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useTheme } from "@/context/ThemeContext";
import NotificationBell from "@/components/NotificationBell";

// Hanya user dengan id ini yang boleh mengedit announcement bar — dicek juga
// di server (app/api/announcement/route.ts PUT), ini cuma untuk sembunyikan
// tombol edit dari user lain.
const ANNOUNCEMENT_EDITOR_ID = "260917112001";

interface Announcement {
  message: string;
  active: boolean;
  image_url: string;
  link_text: string;
}

const EMPTY_ANNOUNCEMENT: Announcement = { message: "", active: false, image_url: "", link_text: "" };

/**
 * Top bar sticky di atas konten (bukan di atas sidebar) — berisi announcement
 * bar (bisa diedit user tertentu saja, boleh sisipkan gambar yang muncul di
 * popup lewat teks tombol custom), toggle tema, notifikasi, dan logout. Dulu
 * tema/notifikasi/logout ada di footer Sidebar, dipindah ke sini supaya
 * selalu terlihat walau sidebar collapsed dan tetap kelihatan saat halaman
 * di-scroll (sticky, bukan ikut scroll bersama konten).
 */
export default function TopBar() {
  const { user, logout } = useUser();
  const { isDark, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [announcement, setAnnouncement] = useState<Announcement>(EMPTY_ANNOUNCEMENT);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [draftLinkText, setDraftLinkText] = useState("");
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null);
  const [draftImagePreview, setDraftImagePreview] = useState("");
  const [draftRemoveImage, setDraftRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImagePopup, setShowImagePopup] = useState(false);

  const canEditAnnouncement = user && String(user.id) === ANNOUNCEMENT_EDITOR_ID;

  const loadAnnouncement = () => {
    fetch("/api/announcement")
      .then((r) => r.json())
      .then((data) => {
        setAnnouncement({
          message: data.message || "",
          active: !!data.active,
          image_url: data.image_url || "",
          link_text: data.link_text || "",
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  };

  useEffect(() => {
    loadAnnouncement();
  }, []);

  const startEditing = () => {
    setDraftMessage(announcement.message);
    // Kalau ini pengumuman baru (belum pernah ada pesan sebelumnya), default
    // "Tampilkan" ke aktif — sebelumnya default-nya ikut status lama (mati),
    // jadi orang yang baru pertama kali isi announcement bisa lupa centang
    // dan bingung kenapa hasilnya tidak muncul.
    setDraftActive(announcement.message ? announcement.active : true);
    setDraftLinkText(announcement.link_text);
    setDraftImageFile(null);
    setDraftImagePreview(announcement.image_url);
    setDraftRemoveImage(false);
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDraftImageFile(file);
    setDraftRemoveImage(false);
    setDraftImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setDraftImageFile(null);
    setDraftImagePreview("");
    setDraftRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveAnnouncement = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("userId", String(user?.id || ""));
      formData.set("username", user?.user_name || "");
      formData.set("message", draftMessage);
      formData.set("active", String(draftActive));
      formData.set("linkText", draftLinkText);
      formData.set("removeImage", String(draftRemoveImage));
      if (draftImageFile) formData.set("image", draftImageFile);

      const response = await fetch("/api/announcement", { method: "PUT", body: formData });
      if (response.ok) {
        const data = await response.json();
        setAnnouncement({
          message: draftMessage,
          active: draftActive,
          image_url: data.image_url ?? announcement.image_url,
          link_text: draftLinkText,
        });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const showAnnouncement = (loaded && announcement.active && announcement.message) || editing;
  const hasImage = !!announcement.image_url;

  return (
    <div className="topbar-glass sticky top-0 z-30 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2">
        {/* ── Announcement ── */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder="Tulis pengumuman..."
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white/50 px-2.5 py-1 text-xs outline-none focus:border-primary/40"
                autoFocus
              />
              <input
                type="text"
                value={draftLinkText}
                onChange={(e) => setDraftLinkText(e.target.value)}
                placeholder='Teks tombol, mis. "Klik" / "Link"'
                className="w-40 shrink-0 rounded-lg border border-black/10 bg-white/50 px-2.5 py-1 text-xs outline-none focus:border-primary/40"
              />

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePickImage} className="hidden" />
              {draftImagePreview ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  <img src={draftImagePreview} alt="" className="h-7 w-7 rounded object-cover" />
                  <button
                    onClick={handleRemoveImage}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    title="Hapus gambar"
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-black/5 px-2 py-1 text-[11px] text-gray-600 hover:bg-black/10"
                  title="Sisipkan gambar"
                  type="button"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Gambar
                </button>
              )}

              <label className="flex shrink-0 items-center gap-1 text-[11px] text-gray-600">
                <input type="checkbox" checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} />
                Tampilkan
              </label>
              <button
                onClick={saveAnnouncement}
                disabled={saving}
                className="shrink-0 rounded-lg bg-primary p-1.5 text-white disabled:opacity-50"
                title="Simpan"
                type="button"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="shrink-0 rounded-lg bg-black/5 p-1.5 text-gray-600"
                title="Batal"
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : showAnnouncement ? (
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{announcement.message}</span>
              {hasImage && (
                <button
                  onClick={() => setShowImagePopup(true)}
                  className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                  type="button"
                >
                  {announcement.link_text || "Lihat"}
                </button>
              )}
              {canEditAnnouncement && (
                <button
                  onClick={startEditing}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700"
                  title="Edit announcement"
                  type="button"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            canEditAnnouncement && (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600"
                type="button"
              >
                <Pencil className="h-3 w-3" />
                Tambah announcement
              </button>
            )
          )}
        </div>

        {/* ── Controls: theme, notifikasi, logout ── */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleTheme}
            title={isDark ? "Light mode" : "Dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 text-gray-500 transition-all hover:bg-black/10 hover:text-gray-900"
          >
            {isDark ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <NotificationBell userName={user?.user_name || ""} canAddCustom={!!user?.user_setting} isCollapsed={false} />

          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg bg-black/5 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-red-500/80 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* ── Popup gambar announcement ── */}
      {showImagePopup && announcement.image_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowImagePopup(false)}
        >
          <div className="relative max-h-[85vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImagePopup(false)}
              className="absolute -top-3 -right-3 rounded-full bg-white p-1.5 text-gray-700 shadow-lg hover:bg-gray-100"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={announcement.image_url}
              alt="Announcement"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
