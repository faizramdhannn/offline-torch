"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Helper: Drive URL → proxy ────────────────────────────────────────────────
function toDriveProxyUrl(url: string, sz = 'w400'): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `/api/drive-image?id=${m[1]}&sz=${sz}`;
  if (url.startsWith('/api/')) return url;
  return url;
}

function AttCardSmall({ row }: { row: any }) {
  const hasClose = !!row.close_timestamp;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [popup, setPopup] = useState<{
  storeName: string;
  open: { src: string; time: string } | null;
  close: { src: string; time: string } | null;
} | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: '100px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fmtTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts.match(/\d{2}:\d{2}/)?.[0] ?? '';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const photoBox: React.CSSProperties = {
    width: '100%', aspectRatio: '1', borderRadius: 5,
    background: '#f3f4f6', display: 'flex',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  };

  return (
    <div
      ref={ref}
      style={{
        background: '#f9fafb', border: '0.5px solid #e5e7eb',
        borderRadius: 8, padding: '5px 6px',
        minWidth: 120, maxWidth: 132, flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 5,
      }}
    >
      {/* Store name */}
      <p style={{
        margin: 0, fontSize: 8, fontWeight: 500, color: '#111827', textTransform: 'capitalize',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        {row.store_name}
      </p>

      {/* Photos */}
      <div style={{ display: 'flex', gap: 5 }}>
        {(['open', 'close'] as const).map((type) => {
          const ts = type === 'open' ? row.open_timestamp : row.close_timestamp;
          const selfieRaw = type === 'open' ? row.open_selfie : row.close_selfie;
          const selfie = (visible && selfieRaw) ? toDriveProxyUrl(selfieRaw, 'w80') : '';
          const time = fmtTime(ts);
          const present = !!ts;

          return (
            <div key={type} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <p style={{
                margin: 0, fontSize: 6, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                {type === 'open' ? `O${time ? `·${time}` : ''}` : `C${time ? `·${time}` : ''}`}
              </p>
              {selfie ? (
                <img
                  src={selfie}
                  alt=""
                  loading="lazy"
                  onClick={() => {
    const openRaw = row.open_selfie;
    const closeRaw = row.close_selfie;
    const openTime = fmtTime(row.open_timestamp);
    const closeTime = fmtTime(row.close_timestamp);
    setPopup({
      storeName: row.store_name,
      open: openRaw ? { src: toDriveProxyUrl(openRaw, 'w800'), time: openTime } : null,
      close: closeRaw ? { src: toDriveProxyUrl(closeRaw, 'w800'), time: closeTime } : null,
    });
  }}
                  style={{
                    ...photoBox,
                    objectFit: 'cover',
                    border: '0.5px solid #e5e7eb',
                    cursor: 'pointer',
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{ ...photoBox, border: present ? '0.5px solid #e5e7eb' : '0.5px dashed #e5e7eb' }}>
                  {present
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 6, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          <span style={{
            width: 4, height: 4, borderRadius: '50%',
            background: hasClose ? '#9ca3af' : '#10b981',
            display: 'inline-block', flexShrink: 0,
            boxShadow: hasClose ? 'none' : '0 0 4px #10b981',
          }} />
          {row.open_staff_name || '-'}
        </span>
        <span style={{
          fontSize: 5, fontWeight: 500, padding: '1px 6px', borderRadius: 100,
          background: hasClose ? '#f3f4f6' : '#dcfce7',
          color: hasClose ? '#6b7280' : '#166534',
          fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em',
        }}>
          {hasClose ? 'Closed' : 'Open'}
        </span>
      </div>

      {/* Popup via Portal */}
      {popup && createPortal(
  <div
    onClick={() => setPopup(null)}
    style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      cursor: 'zoom-out', padding: '2rem',
    }}
  >
    {/* Store name header */}
    <p style={{
      color: '#fff', fontSize: 13, fontWeight: 600,
      marginBottom: 16, textTransform: 'capitalize',
      fontFamily: "'IBM Plex Sans', sans-serif",
      letterSpacing: '0.02em',
    }}>
      {popup.storeName}
    </p>

    {/* Two photos side by side */}
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}
    >
      {(['open', 'close'] as const).map((type) => {
        const data = popup[type];
        return (
          <div key={type} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <p style={{
              color: '#9ca3af', fontSize: 9,
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0,
            }}>
              {type === 'open' ? `Open${data?.time ? ` · ${data.time}` : ''}` : `Close${data?.time ? ` · ${data.time}` : ''}`}
            </p>
            {data ? (
              <img
                src={data.src}
                alt=""
                style={{
                  width: 'min(38vw, 260px)', aspectRatio: '1',
                  borderRadius: 10, objectFit: 'cover',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
            ) : (
              <div style={{
                width: 'min(38vw, 260px)', aspectRatio: '1',
                borderRadius: 10, border: '1px dashed rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.04)',
              }}>
                <p style={{ color: '#4b5563', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
                  No photo
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>

    <p style={{
      color: '#4b5563', fontSize: 10, marginTop: 20,
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>
      Tap di luar untuk tutup
    </p>
  </div>,
  document.body
)}
    </div>
  );
}

// ─── AttendanceTicker component ───────────────────────────────────────────────
function AttendanceTicker() {
  const [yesterday, setYesterday] = useState<any[]>([]);
  const [dayBefore, setDayBefore] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const now = new Date();
      const jakartaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));

      const getISO = (daysAgo: number) => {
        const d = new Date(jakartaNow);
        d.setDate(d.getDate() - daysAgo);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const [d1, d2] = [getISO(1), getISO(2)];

      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/capture-attendance/capture?date=${d1}&all=false`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
          fetch(`/api/capture-attendance/capture?date=${d2}&all=false`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);
        setYesterday((r1 as any[]).slice(0, 8));
        setDayBefore((r2 as any[]).slice(0, 8));
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || (yesterday.length === 0 && dayBefore.length === 0)) return null;

  const fmtLabel = (daysAgo: number) => {
    const now = new Date();
    const jakartaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const d = new Date(jakartaNow);
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <>
      <style>{`
        @keyframes att-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .att-row {
          display: flex;
          gap: 8px;
          width: max-content;
          animation: att-ticker-scroll 30s linear infinite;
        }
        .att-row:hover { animation-play-state: paused; }
      `}</style>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 10 }}>
        {([
          { label: fmtLabel(1), rows: yesterday },
          { label: fmtLabel(2), rows: dayBefore },
        ] as const).map(({ label, rows }, gi) => {
          if (rows.length === 0) return null;
          const doubled = [...rows, ...rows];
          const duration = Math.max(15, rows.length * 4);
          return (
            <div key={gi} style={{ marginBottom: gi === 0 ? 8 : 0 }}>
              <p style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.5rem', color: '#9ca3af',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                marginBottom: 5,
              }}>
                {label}
              </p>
              <div style={{ position: 'relative' }}>
                {['left', 'right'].map((side) => (
                  <div key={side} style={{
                    position: 'absolute', [side]: 0, top: 0, bottom: 0, width: 28,
                    background: `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, #ffffff, transparent)`,
                    zIndex: 2, pointerEvents: 'none',
                  }} />
                ))}
                <div style={{ overflow: 'hidden' }}>
                  <div
                    className="att-row"
                    style={{ animationDuration: `${duration}s` }}
                  >
                    {doubled.map((row, i) => (
                      <AttCardSmall key={i} row={row} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("reason") === "session_expired") {
      setSessionExpired(true);
    }
  }, [searchParams]);

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setError(""); setRegError(""); setRegSuccess(false);
    setUsername(""); setPassword("");
    setRegName(""); setRegUsername(""); setRegPassword("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSessionExpired(false); setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error("Invalid credentials");
      const user = await response.json();
      user._loginAt = Date.now();
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dashboard");
    } catch {
      setError("Username or password is incorrect");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(""); setRegLoading(true);
    try {
      const response = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, user_name: regUsername, password: regPassword }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Gagal mengirim permintaan");
      }
      setRegSuccess(true);
    } catch (err: any) {
      setRegError(err.message || "Failed to submit registration request");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sl-root {
          min-height: 100vh;
          display: flex;
          font-family: 'IBM Plex Sans', sans-serif;
          background: #f9fafb;
        }

        .sl-left {
          width: 100%;
          max-width: 480px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2.5rem 3rem;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          position: relative;
          z-index: 1;
        }

        .sl-brand { display: flex; align-items: center; gap: 0.6rem; }
        .sl-logo-box {
          width: 30px; height: 30px;
          background: #2563eb;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sl-logo-box svg { width: 16px; height: 16px; }
        .sl-brand-name {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.75rem; font-weight: 500;
          color: #2563eb;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .sl-form-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          max-width: 360px;
          padding: 3rem 0;
        }

        .sl-heading {
          font-size: 1.8rem; font-weight: 600;
          color: #111827;
          letter-spacing: -0.025em; line-height: 1.2;
          margin-bottom: 0.4rem;
        }
        .sl-subheading {
          font-size: 0.82rem; color: #6b7280;
          font-weight: 300; margin-bottom: 2rem;
        }

        .sl-alert {
          display: flex; align-items: flex-start; gap: 0.55rem;
          padding: 0.7rem 0.85rem;
          border-radius: 8px; margin-bottom: 1.25rem;
          font-size: 0.775rem; line-height: 1.5;
        }
        .sl-alert-warn {
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.3);
          color: #92400e;
        }
        .sl-alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .sl-field { margin-bottom: 1.1rem; }
        .sl-label {
          display: block; font-size: 0.7rem; font-weight: 500;
          color: #6b7280; letter-spacing: 0.07em;
          text-transform: uppercase; margin-bottom: 0.4rem;
        }
        .sl-iw { position: relative; }
        .sl-input {
          width: 100%; padding: 0.7rem 0.95rem;
          background: #f9fafb; border: 1px solid #e5e7eb;
          border-radius: 8px; color: #111827;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 0.875rem; outline: none;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          -webkit-appearance: none;
        }
        .sl-input::placeholder { color: #9ca3af; font-weight: 300; }
        .sl-input:focus {
          border-color: #2563eb; background: #ffffff;
        }
        .sl-input.pw { padding-right: 2.8rem; }

        .sl-eye {
          position: absolute; right: 0.8rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #9ca3af;
          display: flex; align-items: center; padding: 0.2rem;
          transition: color 0.15s; line-height: 1;
        }
        .sl-eye:hover { color: #374151; }

        .sl-error {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.75rem; color: #dc2626;
          padding: 0.55rem 0.75rem; margin-bottom: 1rem;
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 7px;
        }

        .sl-btn {
          width: 100%; padding: 0.75rem;
          background: #2563eb; border: none; border-radius: 8px;
          color: #ffffff; font-family: 'IBM Plex Sans', sans-serif;
          font-size: 0.875rem; font-weight: 600; cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          margin-top: 0.25rem;
        }
        .sl-btn:hover:not(:disabled) {
          background: #1d4ed8; transform: translateY(-1px);
        }
        .sl-btn:active:not(:disabled) { transform: translateY(0); }
        .sl-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .sl-spin {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff; border-radius: 50%;
          animation: spin 0.65s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .sl-divider {
          height: 1px; background: #e5e7eb;
          margin: 1.5rem 0; position: relative;
        }
        .sl-divider span {
          position: absolute; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          background: #ffffff; padding: 0 0.75rem;
          font-size: 0.7rem; color: #9ca3af;
          letter-spacing: 0.05em;
          font-family: 'IBM Plex Mono', monospace;
        }

        .sl-switch-link {
          text-align: center; font-size: 0.8rem; color: #6b7280;
        }
        .sl-switch-link button {
          background: none; border: none; cursor: pointer;
          color: #2563eb; font-weight: 500; font-size: 0.8rem;
          border-bottom: 1px solid rgba(37,99,235,0.25);
          padding: 0; transition: color 0.15s, border-color 0.15s;
        }
        .sl-switch-link button:hover {
          color: #1d4ed8; border-color: rgba(29,78,216,0.5);
        }

        .sl-footer {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.62rem; color: #9ca3af; letter-spacing: 0.05em;
        }

        .sl-right {
          flex: 1; position: relative; overflow: hidden;
          display: flex; align-items: flex-end; background: #eff6ff;
        }
        .sl-right img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
          z-index: 0;
        }
        .sl-right::before { display: none; }
        .sl-right::after {
          content: ''; position: absolute; inset: 0;
          background: rgba(37,99,235,0.18);
          z-index: 1; pointer-events: none;
        }
        .sl-right-content {
          position: relative; z-index: 2; padding: 2.5rem; width: 100%;
        }

        @media (max-width: 768px) {
          .sl-right { display: none; }
          .sl-left { max-width: 100%; padding: 2rem 1.75rem; }
        }
        .sl-left { animation: fadeUp 0.5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="sl-root">
        {/* ── LEFT PANEL ── */}
        <div className="sl-left">
          {/* Brand */}
          <div className="sl-brand">
            <div className="sl-logo-box">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L4 9v12h16V9L12 3z" fill="white" />
                <path d="M12 7l-5 3.5V19h10v-8.5L12 7z" fill="#2563eb" opacity="0.2" />
                <rect x="9" y="14" width="6" height="5" rx="1" fill="#2563eb" />
              </svg>
            </div>
            <span className="sl-brand-name">Welcome Back</span>
          </div>

          {/* ── FORM AREA ── */}
          <div className="sl-form-area">
            {mode === "login" && (
              <>
                <h1 className="sl-heading">Login</h1>

                {sessionExpired && (
                  <div className="sl-alert sl-alert-warn">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Your session has expired. Please log in again.
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  <div className="sl-field">
                    <label className="sl-label">Username</label>
                    <input type="text" value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username" className="sl-input"
                      required autoComplete="username" />
                  </div>
                  <div className="sl-field">
                    <label className="sl-label">Password</label>
                    <div className="sl-iw">
                      <input type={showPassword ? "text" : "password"} value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" className="sl-input pw"
                        required autoComplete="current-password" />
                      <button type="button" className="sl-eye"
                        onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                        {showPassword ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="sl-error">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <button type="submit" className="sl-btn" disabled={loading}>
                    {loading && <div className="sl-spin" />}
                    {loading ? "Processing..." : "Login"}
                  </button>
                </form>

                <div className="sl-divider"><span>or</span></div>
                <p className="sl-switch-link">
                  Don't have an account?&nbsp;
                  <button onClick={() => switchMode("register")}>Register here</button>
                </p>
              </>
            )}

            {mode === "register" && (
              <>
                <h1 className="sl-heading">Registration</h1>
                <p className="sl-subheading">The request will be approved by the admin</p>

                {regSuccess ? (
                  <div className="sl-alert sl-alert-success">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Registration request successfully submitted. Please wait for admin approval.
                  </div>
                ) : (
                  <form onSubmit={handleRegister}>
                    <div className="sl-field">
                      <label className="sl-label">Full Name</label>
                      <input type="text" value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Enter full name" className="sl-input" required />
                    </div>
                    <div className="sl-field">
                      <label className="sl-label">Username</label>
                      <input type="text" value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="Buat username" className="sl-input" required />
                    </div>
                    <div className="sl-field">
                      <label className="sl-label">Password</label>
                      <div className="sl-iw">
                        <input type={regShowPassword ? "text" : "password"} value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••" className="sl-input pw" required />
                        <button type="button" className="sl-eye"
                          onClick={() => setRegShowPassword(!regShowPassword)} tabIndex={-1}>
                          {regShowPassword ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {regError && (
                      <div className="sl-error">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                          strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {regError}
                      </div>
                    )}

                    <button type="submit" className="sl-btn" disabled={regLoading}>
                      {regLoading && <div className="sl-spin" />}
                      {regLoading ? "Sending..." : "Send Request"}
                    </button>
                  </form>
                )}

                <div className="sl-divider"><span>or</span></div>
                <p className="sl-switch-link">
                  Already have an account?&nbsp;
                  <button onClick={() => switchMode("login")}>Log in here</button>
                </p>
              </>
            )}
          </div>

          {/* ── FOOTER + TICKER ── */}
          <div>
            <AttendanceTicker />
            <div className="sl-footer" style={{ marginTop: 12 }}>
              © 2026 OFFLINE TORCH
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="sl-right">
          <img src="/cover_login.png" alt="Offline Torch" />
          <div className="sl-right-content"></div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}