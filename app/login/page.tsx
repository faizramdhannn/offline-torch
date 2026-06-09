"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    setLoading(true);
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
    setRegError("");
    setRegLoading(true);
    try {
      const response = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          user_name: regUsername,
          password: regPassword,
        }),
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
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Your session has expired. Please log in again.
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  <div className="sl-field">
                    <label className="sl-label">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      className="sl-input"
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div className="sl-field">
                    <label className="sl-label">Password</label>
                    <div className="sl-iw">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="sl-input pw"
                        required
                        autoComplete="current-password"
                      />
                      <button type="button" className="sl-eye" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                        {showPassword ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="sl-error">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Registration request successfully submitted. Please wait for admin approval.
                  </div>
                ) : (
                  <form onSubmit={handleRegister}>
                    <div className="sl-field">
                      <label className="sl-label">Full Name</label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Enter full name"
                        className="sl-input"
                        required
                      />
                    </div>
                    <div className="sl-field">
                      <label className="sl-label">Username</label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="Buat username"
                        className="sl-input"
                        required
                      />
                    </div>
                    <div className="sl-field">
                      <label className="sl-label">Password</label>
                      <div className="sl-iw">
                        <input
                          type={regShowPassword ? "text" : "password"}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••"
                          className="sl-input pw"
                          required
                        />
                        <button type="button" className="sl-eye" onClick={() => setRegShowPassword(!regShowPassword)} tabIndex={-1}>
                          {regShowPassword ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {regError && (
                      <div className="sl-error">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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

          {/* ── FOOTER ── */}
          <div className="sl-footer">
            © 2026 OFFLINE TORCH
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