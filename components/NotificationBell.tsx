"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, Plus } from "lucide-react";

interface NotificationItem {
  id: string;
  scope: "all" | "user";
  target_user: string;
  type: string;
  title: string;
  message: string;
  source_feature: string;
  source_id: string;
  created_by: string;
  created_at: string;
  read: boolean;
}

interface NotificationBellProps {
  userName: string;
  canAddCustom: boolean;
  isCollapsed?: boolean;
}

export default function NotificationBell({ userName, canAddCustom, isCollapsed }: NotificationBellProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addMessage, setAddMessage] = useState("");
  const [sending, setSending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  // Cache hasil fetch di localStorage per user, supaya (a) tampilan langsung
  // terisi dari cache saat komponen mount (bukan blank sambil nunggu network),
  // dan (b) hard-refresh/re-mount yang terjadi dalam CACHE_TTL_MS tidak perlu
  // nembak API lagi — mengurangi jumlah invocation /api/notifications yang
  // sebelumnya terus-menerus muncul di log Vercel dari banyak user aktif.
  const CACHE_TTL_MS = 60_000;
  const cacheKey = `notif_cache_${userName}`;

  const fetchNotifications = async (opts?: { skipIfFresh?: boolean }) => {
    if (!userName) return;
    if (opts?.skipIfFresh) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw);
          if (Date.now() - cached.ts < CACHE_TTL_MS) {
            setItems(cached.items);
            return;
          }
        }
      } catch {}
    }
    try {
      const res = await fetch(`/api/notifications?userName=${encodeURIComponent(userName)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ items: data, ts: Date.now() }));
        } catch {}
      }
    } catch {}
  };

  useEffect(() => {
    // Tampilkan cache dulu (kalau ada) supaya tidak blank, lalu tetap fetch
    // fresh di background (bukan skip) supaya read-status tetap akurat.
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) setItems(JSON.parse(raw).items || []);
    } catch {}
    fetchNotifications();
    // Interval dinaikkan dari 30s -> 90s: notifikasi tidak butuh real-time
    // sedetail itu, dan ini memotong jumlah request ~3x untuk setiap user
    // yang sedang aktif di aplikasi.
    const interval = setInterval(() => fetchNotifications(), 90_000);
    return () => clearInterval(interval);
  }, [userName]);

  // Munculkan bubble "Ada notifikasi yang belum dibaca" sekali ketika ada unread
  // dan dropdown belum pernah dibuka di sesi ini.
  useEffect(() => {
    if (unreadCount > 0 && !open && !bubbleDismissed) {
      setShowBubble(true);
    } else {
      setShowBubble(false);
    }
  }, [unreadCount, open, bubbleDismissed]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleOpen = () => {
    setOpen((p) => !p);
    setBubbleDismissed(true);
    setShowBubble(false);
  };

  // Read state per-item: hanya notifikasi yang benar-benar diklik yang
  // ditandai dibaca, sesuai keputusan produk (bukan semua otomatis saat
  // dropdown dibuka).
  const markAsRead = async (item: NotificationItem) => {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, userName }),
      });
    } catch {}
  };

  const handleAddCustom = async () => {
    if (!addTitle.trim() || !addMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: addTitle, message: addMessage, createdBy: userName }),
      });
      if (res.ok) {
        setAddTitle("");
        setAddMessage("");
        setShowAddForm(false);
        fetchNotifications();
      }
    } catch {
    } finally {
      setSending(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleOpen}
        title="Notifikasi"
        className={`relative flex items-center justify-center rounded-lg text-white/60 hover:text-white bg-white/8 hover:bg-white/15 transition-all duration-200 ${
          isCollapsed ? "w-full h-8" : "w-8 h-8 shrink-0"
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Bubble chat "Ada notifikasi yang belum dibaca" — anchor dari kiri
          (bukan center) supaya tidak overflow keluar sidebar yang sempit. */}
      {showBubble && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-max max-w-[200px]">
          <div className="relative bg-white text-gray-800 text-[10px] font-medium rounded-lg shadow-lg px-2.5 py-1.5 whitespace-nowrap">
            Ada notifikasi yang belum dibaca
            <div className="absolute left-3 top-full w-2 h-2 bg-white rotate-45 -mt-1" />
          </div>
        </div>
      )}

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b bg-gray-50">
            <span className="text-xs font-bold text-gray-800">Notifikasi</span>
            {canAddCustom && (
              <button
                onClick={() => setShowAddForm((p) => !p)}
                title="Tambah notifikasi untuk semua user"
                className="p-1 rounded hover:bg-gray-200 text-gray-500"
              >
                {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {showAddForm && canAddCustom && (
            <div className="p-3 border-b bg-gray-50 space-y-2">
              <input
                type="text"
                placeholder="Judul notifikasi"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-900 placeholder:text-gray-400"
              />
              <textarea
                placeholder="Isi notifikasi"
                value={addMessage}
                onChange={(e) => setAddMessage(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-900 placeholder:text-gray-400"
              />
              <button
                onClick={handleAddCustom}
                disabled={sending}
                className="w-full bg-primary text-white rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {sending ? "Mengirim..." : "Kirim ke semua user"}
              </button>
            </div>
          )}

          {/* Tinggi dipatok supaya cuma ~3 notifikasi yang terlihat, sisanya di-scroll. */}
          <div className="max-h-[240px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">Belum ada notifikasi</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n)}
                  className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                    !n.read ? "bg-blue-50/60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    <div className={`min-w-0 flex-1 ${n.read ? "pl-3.5" : ""}`}>
                      <p className="text-xs font-semibold text-gray-800 break-words">{n.title}</p>
                      <p className="text-[11px] text-gray-500 break-words whitespace-pre-wrap">{n.message}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">{n.created_at}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
