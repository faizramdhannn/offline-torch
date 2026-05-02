"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRegistration, setIsRegistration] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Dodge state
  const [dodgeCount, setDodgeCount] = useState(0);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});
  const cardRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const MAX_DODGE = 3;

  useEffect(() => {
    if (searchParams.get("reason") === "session_expired") {
      setSessionExpired(true);
    }
  }, [searchParams]);

  useEffect(() => {
    setDodgeCount(0);
    setCardStyle({});
    offsetRef.current = { x: 0, y: 0 };
  }, [isRegistration]);

  const handleDodge = (e: React.MouseEvent) => {
    if (dodgeCount >= MAX_DODGE) return;

    const card = cardRef.current;
    if (!card) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const cardRect = card.getBoundingClientRect();
    const cardCX = cardRect.left + cardRect.width / 2;
    const cardCY = cardRect.top + cardRect.height / 2;

    // Vector away from mouse
    const dx = cardCX - mouseX;
    const dy = cardCY - mouseY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    const dist = 200 + Math.random() * 80;
    const moveX = (dx / len) * dist;
    const moveY = (dy / len) * dist;

    // Clamp within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const halfW = cardRect.width / 2;
    const halfH = cardRect.height / 2;
    const margin = 16;

    const newCX = Math.max(halfW + margin, Math.min(vw - halfW - margin, cardCX + moveX));
    const newCY = Math.max(halfH + margin, Math.min(vh - halfH - margin, cardCY + moveY));

    // Accumulate offset from original center position
    const newOffsetX = offsetRef.current.x + (newCX - cardCX);
    const newOffsetY = offsetRef.current.y + (newCY - cardCY);
    offsetRef.current = { x: newOffsetX, y: newOffsetY };

    setCardStyle({
      transform: `translate(${newOffsetX}px, ${newOffsetY}px)`,
      transition: "transform 0.2s cubic-bezier(.22,.68,0,1.3)",
    });

    const newCount = dodgeCount + 1;
    setDodgeCount(newCount);

    if (newCount >= MAX_DODGE) {
      setTimeout(() => {
        offsetRef.current = { x: 0, y: 0 };
        setCardStyle({
          transform: "translate(0px, 0px)",
          transition: "transform 0.4s cubic-bezier(.22,.68,0,1.2)",
        });
      }, 400);
    }
  };

  const getDodgeMessage = () => {
    if (dodgeCount === 1) return "awkowkowk.";
    if (dodgeCount === 2) return "mmmmmm";
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dodgeCount < MAX_DODGE) return;
    setError("");
    setSessionExpired(false);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      const user = await response.json();
      user._loginAt = Date.now();
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err) {
      setError("Username atau password salah");
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password }),
      });

      if (!response.ok) {
        throw new Error("Registration failed");
      }

      setSuccess(
        "Permintaan registrasi berhasil dikirim. Tunggu approval dari admin.",
      );
      setName("");
      setUsername("");
      setPassword("");

      setTimeout(() => {
        setIsRegistration(false);
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError("Registrasi gagal. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center overflow-hidden">
      <div
        ref={cardRef}
        style={cardStyle}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md"
      >
        <h1 className="text-2xl font-bold text-primary mb-6 text-center">
          Offline Torch
        </h1>

        {sessionExpired && (
          <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-md flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-xs text-yellow-800">
              Your session has expired. Please log in again.
            </p>
          </div>
        )}

        {!isRegistration ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}

            {getDodgeMessage() && (
              <p className="text-amber-500 text-xs text-center">
                {getDodgeMessage()}
              </p>
            )}

            <button
              type={dodgeCount >= MAX_DODGE ? "submit" : "button"}
              disabled={loading}
              onMouseEnter={dodgeCount < MAX_DODGE ? handleDodge : undefined}
              onClick={dodgeCount < MAX_DODGE ? handleDodge : undefined}
              className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
            >
              {loading ? "Loading..." : "Login"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistration(true);
                  setError("");
                  setSessionExpired(false);
                  setShowPassword(false);
                }}
                className="text-sm text-primary hover:underline"
              >
                Don&apos;t have an account? Sign up here
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegistration} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            {success && <p className="text-green-500 text-xs">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
            >
              {loading ? "Loading..." : "Daftar"}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistration(false);
                  setError("");
                  setSuccess("");
                  setShowPassword(false);
                }}
                className="text-sm text-primary hover:underline"
              >
                Already have an account? Log in here
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}