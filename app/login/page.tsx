"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/shared/Button";
import { useTheme } from "@/context/ThemeContext";

// phase: "idle" | "loading" | "success" — layout is a single centered card
// now (no more sliding left/right panels), so loading is just an overlay on
// top and errors return straight to "idle" without any re-mount trick.
type Phase = "idle" | "loading" | "success";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");

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
    setError("");
    setRegError("");
    setRegSuccess(false);
    setUsername("");
    setPassword("");
    setRegName("");
    setRegUsername("");
    setRegPassword("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSessionExpired(false);
    setPhase("loading");

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
      // Ditangkap sekali oleh (main)/layout.tsx untuk memicu animasi masuk
      // (sidebar dari kiri, konten dari kanan), lalu dihapus di sana.
      sessionStorage.setItem("justLoggedIn", "1");

      // Success: keep loading then navigate back to whatever page the user
      // originally tried to open (e.g. a shared filtered link), falling back
      // to /dashboard. Only accept an internal path (starts with a single
      // "/") to avoid an open-redirect via a crafted `next` value.
      const next = searchParams.get("next");
      const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      setPhase("success");
      setTimeout(() => router.push(destination), 400);
    } catch {
      setError("Username or password is incorrect");
      setPhase("idle");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);
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

  const isBusy = phase !== "idle";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sl-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'IBM Plex Sans', sans-serif;
          background: #A4D8FF;
          overflow: hidden;
          position: relative;
          padding: 1.5rem;
        }
        html.dark .sl-root { background: #35393C; }

        /* ─── Full-screen video background ─── */
        /* object-fit: cover, edge-to-edge, tidak di-scale — video mengisi
           penuh layar tanpa margin/bar di pinggir. */
        .sl-bg-video {
          position: fixed; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
          z-index: 0;
        }
        .sl-bg-overlay {
          position: fixed; inset: 0;
          background: rgba(15,23,42,0.2);
          z-index: 1; pointer-events: none;
        }
        html.dark .sl-bg-overlay { background: rgba(0,0,0,0.35); }

        /* ─── Centered liquid-glass login card ─── */
        /* Mengikuti pola Liquid Glass Apple: tint hampir tidak ada (nyaris
           cuma blur+saturate), definisi bentuknya datang dari border tipis
           terang + highlight, bukan dari warna solid di baliknya. */
        .sl-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 400px;
          padding: 2.25rem 2.25rem 1.75rem;
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
          backdrop-filter: blur(2px) saturate(220%);
          -webkit-backdrop-filter: blur(2px) saturate(220%);
          border: 1px solid rgba(255,255,255,0.45);
          border-radius: 24px;
          box-shadow: 0 24px 70px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.45);
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .sl-card.busy { opacity: 0; transform: scale(0.97); pointer-events: none; }
        html.dark .sl-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%);
          border-color: rgba(255,255,255,0.08);
          box-shadow: 0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .sl-card-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5rem; position: relative; }
        .sl-card-logo { width: 56px; height: 56px; object-fit: contain; margin-bottom: 0.6rem; filter: drop-shadow(0 2px 10px rgba(0,0,0,0.25)); }
        .sl-brand-name {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.7rem; font-weight: 500; color: #2563eb;
          letter-spacing: 0.14em; text-transform: uppercase;
        }
        html.dark .sl-brand-name { color: #A4D8FF; }

        .sl-theme-toggle {
          position: absolute; top: 0; right: 0;
          width: 30px; height: 30px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.2);
          color: #2563eb; cursor: pointer; transition: background 0.15s;
        }
        .sl-theme-toggle:hover { background: rgba(37,99,235,0.2); }
        html.dark .sl-theme-toggle {
          background: rgba(164,216,255,0.14); border-color: rgba(164,216,255,0.25); color: #A4D8FF;
        }
        html.dark .sl-theme-toggle:hover { background: rgba(164,216,255,0.22); }

        /* ─── Loading overlay ─── */
        .sl-loading-overlay {
          position: fixed; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 10;
          background: rgba(255,255,255,0.5);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        html.dark .sl-loading-overlay { background: rgba(53,57,60,0.6); }
        .sl-root.phase-loading .sl-loading-overlay,
        .sl-root.phase-success .sl-loading-overlay {
          opacity: 1;
          pointer-events: auto;
        }

        /* ─── Brand loader: logo Offline Torch + orbiting ring + embers ─── */
        .sl-loader {
          position: relative;
          width: 110px; height: 110px;
          display: flex; align-items: center; justify-content: center;
        }

        /* Soft breathing glow behind everything */
        .sl-flame-glow {
          position: absolute;
          width: 72px; height: 72px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 70%);
          animation: slGlowBreathe 2.2s ease-in-out infinite;
          filter: blur(2px);
        }
        @keyframes slGlowBreathe {
          0%, 100% { transform: scale(0.85); opacity: 0.55; }
          50%      { transform: scale(1.15); opacity: 1; }
        }

        /* Logo sendiri berdenyut halus di tengah */
        .sl-logo-img {
          position: relative;
          width: 46px; height: 46px;
          object-fit: contain;
          border-radius: 10px;
          animation: slLogoPulse 1.8s ease-in-out infinite;
          filter: drop-shadow(0 0 8px rgba(37,99,235,0.5));
        }
        @keyframes slLogoPulse {
          0%, 100% { transform: scale(1);    opacity: 0.92; }
          50%      { transform: scale(1.07); opacity: 1; }
        }

        /* Dua cincin dashed berputar arah berlawanan mengelilingi logo */
        .sl-orbit-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
        }
        .sl-orbit-ring.outer {
          border: 1.5px dashed rgba(37,99,235,0.45);
          animation: slSpinCW 5s linear infinite;
        }
        .sl-orbit-ring.inner {
          inset: 10px;
          border: 1px dashed rgba(96,165,250,0.55);
          animation: slSpinCCW 3.4s linear infinite;
        }
        @keyframes slSpinCW  { to { transform: rotate(360deg); } }
        @keyframes slSpinCCW { to { transform: rotate(-360deg); } }

        /* Tiga embers mengorbit keluar, staggered */
        .sl-ember {
          position: absolute;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #60a5fa;
          box-shadow: 0 0 6px 1.5px rgba(96,165,250,0.85);
          top: 50%; left: 50%;
          animation: slEmberOrbit 2.8s linear infinite;
        }
        .sl-ember:nth-child(1) { animation-delay: 0s; }
        .sl-ember:nth-child(2) { animation-delay: 0.93s; }
        .sl-ember:nth-child(3) { animation-delay: 1.86s; }
        @keyframes slEmberOrbit {
          0%   { transform: translate(-50%, -50%) rotate(0deg)   translateX(52px) rotate(0deg)   scale(0.4); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 0.5; }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(52px) rotate(-360deg) scale(1.1); opacity: 0; }
        }

        /* ─── Form styles ─── */
        .sl-heading {
          font-size: 1.5rem; font-weight: 700; color: #111827;
          letter-spacing: -0.025em; line-height: 1.2; margin-bottom: 0.3rem;
          text-align: center; text-shadow: 0 1px 3px rgba(255,255,255,0.6);
        }
        html.dark .sl-heading { color: #A4D8FF; }
        .sl-subheading { font-size: 0.8rem; color: #6b7280; font-weight: 300; margin-bottom: 1.5rem; text-align: center; }
        html.dark .sl-subheading { color: rgba(164,216,255,0.65); }

        .sl-alert {
          display: flex; align-items: flex-start; gap: 0.55rem;
          padding: 0.7rem 0.85rem; border-radius: 8px;
          margin-bottom: 1.25rem; font-size: 0.775rem; line-height: 1.5;
          backdrop-filter: blur(10px);
        }
        .sl-alert-warn { background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.4); color: #92400e; }
        .sl-alert-success { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.35); color: #166534; }

        .sl-field { margin-bottom: 1.1rem; }
        .sl-label {
          display: block; font-size: 0.7rem; font-weight: 600; color: #374151;
          letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.4rem;
          text-shadow: 0 1px 2px rgba(255,255,255,0.5);
        }
        html.dark .sl-label { color: rgba(164,216,255,0.65); }
        .sl-iw { position: relative; }
        .sl-input {
          width: 100%; padding: 0.7rem 0.95rem;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.4);
          backdrop-filter: blur(1px) saturate(180%);
          -webkit-backdrop-filter: blur(1px) saturate(180%);
          border-radius: 8px; color: #111827;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 0.875rem; outline: none;
          transition: border-color 0.15s, background 0.15s;
          -webkit-appearance: none;
        }
        .sl-input::placeholder { color: #374151; font-weight: 300; }
        .sl-input:focus { border-color: #2563eb; background: rgba(255,255,255,0.12); }
        .sl-input.pw { padding-right: 2.8rem; }
        html.dark .sl-input {
          background: rgba(255,255,255,0.015); border-color: rgba(255,255,255,0.08); color: #e0f2ff;
        }
        html.dark .sl-input::placeholder { color: rgba(224,242,255,0.35); }
        html.dark .sl-input:focus { border-color: #A4D8FF; background: rgba(255,255,255,0.11); }

        .sl-eye {
          position: absolute; right: 0.8rem; top: 50%;
          transform: translateY(-50%); background: none; border: none;
          cursor: pointer; color: #9ca3af;
          display: flex; align-items: center; padding: 0.2rem;
          transition: color 0.15s;
        }
        .sl-eye:hover { color: #374151; }
        html.dark .sl-eye { color: rgba(224,242,255,0.5); }
        html.dark .sl-eye:hover { color: #A4D8FF; }

        .sl-error {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.75rem; color: #dc2626;
          padding: 0.55rem 0.75rem; margin-bottom: 1rem;
          background: rgba(254,242,242,0.7); border: 1px solid rgba(252,165,165,0.6); border-radius: 7px;
          backdrop-filter: blur(10px);
        }

        .sl-btn {
          width: 100%; padding: 0.75rem;
          background: rgba(37,99,235,0.85); border: 1px solid rgba(255,255,255,0.35);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
          border-radius: 8px;
          color: #ffffff; font-family: 'IBM Plex Sans', sans-serif;
          font-size: 0.875rem; font-weight: 600; cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          margin-top: 0.25rem;
        }
        .sl-btn:hover:not(:disabled) { background: rgba(29,78,216,0.9); transform: translateY(-1px); }
        .sl-btn:active:not(:disabled) { transform: translateY(0); }
        .sl-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .sl-spin {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff; border-radius: 50%;
          animation: spin 0.65s linear infinite; flex-shrink: 0;
        }

        .sl-divider {
          height: 1px; background: rgba(229,231,235,0.8); margin: 1.5rem 0; position: relative;
        }
        .sl-divider span {
          position: absolute; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255,255,255,0.7); padding: 0 0.75rem;
          font-size: 0.7rem; color: #9ca3af;
          letter-spacing: 0.05em; font-family: 'IBM Plex Mono', monospace;
        }
        html.dark .sl-divider { background: rgba(255,255,255,0.12); }
        html.dark .sl-divider span { background: rgba(53,57,60,0.85); color: rgba(224,242,255,0.4); }

        .sl-switch-link { text-align: center; font-size: 0.8rem; color: #6b7280; }
        .sl-switch-link button {
          background: none; border: none; cursor: pointer;
          color: #2563eb; font-weight: 500; font-size: 0.8rem;
          border-bottom: 1px solid rgba(37,99,235,0.25);
          padding: 0; transition: color 0.15s, border-color 0.15s;
        }
        .sl-switch-link button:hover { color: #1d4ed8; border-color: rgba(29,78,216,0.5); }
        html.dark .sl-switch-link { color: rgba(164,216,255,0.65); }
        html.dark .sl-switch-link button { color: #A4D8FF; border-color: rgba(164,216,255,0.35); }
        html.dark .sl-switch-link button:hover { color: #c9e8ff; border-color: rgba(201,232,255,0.5); }

        .sl-footer {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.62rem; color: #9ca3af; letter-spacing: 0.05em;
          text-align: center; margin-top: 1.5rem;
        }
        html.dark .sl-footer { color: rgba(224,242,255,0.35); }

        @media (max-width: 480px) {
          .sl-card { max-width: 100%; padding: 1.75rem 1.5rem 1.25rem; border-radius: 20px; }
        }
      `}</style>

      <div
        className={`sl-root ${
          phase === "loading" ? "phase-loading" : phase === "success" ? "phase-success" : ""
        }`}
      >
        {/* ── Full-screen cover video ── */}
        <video className="sl-bg-video" src="/cover_login.mp4" autoPlay loop muted playsInline preload="auto" />
        <div className="sl-bg-overlay" />

        {/* ── Centered liquid-glass card ── */}
        <div className={`sl-card ${isBusy ? "busy" : ""}`}>
          <div className="sl-card-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_offline_torch.png" alt="Offline Torch" className="sl-card-logo" />
            <span className="sl-brand-name">Offline Torch</span>
            <button
              type="button"
              className="sl-theme-toggle"
              onClick={toggleTheme}
              title={isDark ? "Light mode" : "Dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          {mode === "login" && (
            <>
              <h1 className="sl-heading">Login</h1>

              {sessionExpired && (
                <div className="sl-alert sl-alert-warn">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  Your session has expired. Please log in again.
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div className="sl-field">
                  <label className="sl-label">Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username" className="sl-input" required autoComplete="username" />
                </div>
                <div className="sl-field">
                  <label className="sl-label">Password</label>
                  <div className="sl-iw">
                    <input type={showPassword ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                      className="sl-input pw" required autoComplete="current-password" />
                    <button type="button" className="sl-eye" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                      {showPassword ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="sl-error">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                <Button type="submit" className="sl-btn" disabled={isBusy}>
                  Login
                </Button>
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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Registration request successfully submitted. Please wait for admin approval.
                </div>
              ) : (
                <form onSubmit={handleRegister}>
                  <div className="sl-field">
                    <label className="sl-label">Full Name</label>
                    <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)}
                      placeholder="Enter full name" className="sl-input" required />
                  </div>
                  <div className="sl-field">
                    <label className="sl-label">Username</label>
                    <input type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="Buat username" className="sl-input" required />
                  </div>
                  <div className="sl-field">
                    <label className="sl-label">Password</label>
                    <div className="sl-iw">
                      <input type={regShowPassword ? "text" : "password"} value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)} placeholder="••••••••"
                        className="sl-input pw" required />
                      <button type="button" className="sl-eye" onClick={() => setRegShowPassword(!regShowPassword)} tabIndex={-1}>
                        {regShowPassword ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {regError && (
                    <div className="sl-error">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {regError}
                    </div>
                  )}

                  <Button type="submit" className="sl-btn" disabled={regLoading} loading={regLoading}>
                    {regLoading ? "Sending..." : "Send Request"}
                  </Button>
                </form>
              )}

              <div className="sl-divider"><span>or</span></div>
              <p className="sl-switch-link">
                Already have an account?&nbsp;
                <button onClick={() => switchMode("login")}>Log in here</button>
              </p>
            </>
          )}

          <div className="sl-footer">© 2026 OFFLINE TORCH</div>
        </div>

        {/* ── Loading overlay (full screen) — logo Offline Torch + animasi orbit, tanpa teks ── */}
        <div className="sl-loading-overlay">
          <div className="sl-loader">
            <div className="sl-flame-glow" />
            <div className="sl-orbit-ring outer" />
            <div className="sl-orbit-ring inner" />
            <div className="sl-ember" />
            <div className="sl-ember" />
            <div className="sl-ember" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_offline_torch.png" alt="Offline Torch" className="sl-logo-img" />
          </div>
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
