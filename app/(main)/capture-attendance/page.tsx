"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string;
  store_id: string;
  store_name: string;
  device_info: string;
  browser: string;
  ip_address: string;
  is_valid_location: string;
  open_latitude: string;
  open_longitude: string;
  open_maps_url: string;
  open_timestamp: string;
  open_staff_name: string;
  open_selfie: string;
  close_latitude: string;
  close_longitude: string;
  close_maps_url: string;
  close_timestamp: string;
  close_staff_name: string;
  close_selfie: string;
  created_at: string;
  updated_at: string;
}

interface StoreEntry {
  id: string;
  store_name: string;
}

interface StoreDetail {
  id: string;
  store_name: string;
  type_store: string;
  open_hours: string;
  close_hours: string;
  store_wages: string;
}

interface TaftEntry {
  id: string;
  store_name: string;
  taft_name: string;
  start_date: string;
  end_date: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function toDriveProxyUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `/api/drive-image?id=${m[1]}`;
  return url;
}

function isValidSelfie(url: string): boolean {
  if (!url) return false;
  if (url === 'data:,' || url === 'data:') return false;
  if (url.startsWith('data:') && url.length < 100) return false;
  return true;
}

function extractTime(ts: string): string {
  if (!ts) return '-';
  const m = ts.match(/,\s*(\d{2}[.:]\d{2})/);
  if (m) return m[1].replace('.', ':');
  const parts = ts.split(',');
  if (parts.length > 1) return parts[1].trim().substring(0, 5);
  return ts;
}

function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  return 'Unknown';
}

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android Mobile';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS Device';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown Device';
}

async function getPublicIP(): Promise<string> {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const d = await r.json();
    return d.ip || 'unknown';
  } catch { return 'unknown'; }
}

function buildMapsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=17`;
}

function nowTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

function parseHHMM(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function nowMinutesWIB(): number {
  const now = new Date();
  const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  return wib.getHours() * 60 + wib.getMinutes();
}

function isCloseWindowActive(closeHours: string): boolean {
  const target = parseHHMM(closeHours);
  if (target === null) return true;
  const now = nowMinutesWIB();
  return now >= target - 5 && now <= target + 120;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconCamera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconPin = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconSignal = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
);
const IconX = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconCheck = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const IconCheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconAlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconStore = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

// ─── Lazy Image ────────────────────────────────────────────────────────────────
function LazyImg({ src, alt, className, style, fallback }: {
  src: string; alt: string; className?: string; style?: React.CSSProperties; fallback?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '100px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={style}>
      {visible && !errored
        ? <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setErrored(true)} />
        : errored
          ? fallback || <span className="text-gray-300 text-xs flex items-center justify-center w-full h-full">—</span>
          : <div className="w-full h-full bg-gray-100 animate-pulse" />}
    </div>
  );
}

function SelfiePlaceholderSm() {
  return (
    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
      <IconCamera className="w-4 h-4 text-gray-300" />
    </div>
  );
}
function SelfiePlaceholderMd() {
  return (
    <div className="w-full rounded-xl bg-gray-100 flex flex-col items-center justify-center mb-2 border border-gray-200" style={{ aspectRatio: '4/3' }}>
      <IconCamera className="w-6 h-6 text-gray-300 mb-1" />
      <span className="text-[10px] text-gray-400">Foto tidak tersedia</span>
    </div>
  );
}

// ─── Selfie Camera ────────────────────────────────────────────────────────────
const TIMER_OPTIONS = [0, 3, 5, 10] as const;
type TimerOption = typeof TIMER_OPTIONS[number];

function SelfieCapture({ onCapture, onCancel }: { onCapture: (dataUrl: string) => void; onCancel: () => void; }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [timerOption, setTimerOption] = useState<TimerOption>(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user'); // 🆕
  const [flash, setFlash] = useState(false); // 🆕
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null); // 🆕 track stream for switching

  useEffect(() => { startCamera(facingMode); return () => { stopCamera(); clearCountdown(); }; }, []); // eslint-disable-line

  const startCamera = async (mode: 'user' | 'environment' = 'user') => {
    // Stop existing stream first
    streamRef.current?.getTracks().forEach(t => t.stop());
    setError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = s;
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch { setError('Tidak bisa mengakses kamera. Pastikan izin kamera diberikan.'); }
  };

  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); };

  const clearCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  // 🆕 toggle kamera depan/belakang
  const switchCamera = async () => {
    if (countdown !== null) return;
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    await startCamera(newMode);
  };

  // 🆕 flash effect — berkedip saat countdown (hanya kamera belakang)
  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  };

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Kamera belum siap, coba ulangi.');
      setCountdown(null);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror hanya untuk kamera depan
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 1000) {
      setError('Gagal mengambil foto, coba ulangi.');
      setCountdown(null);
      return;
    }
    setPreview(dataUrl);
    setCountdown(null);
    stopCamera();
  }, [facingMode]); // eslint-disable-line

  const capturePhoto = () => {
    clearCountdown();
    if (timerOption === 0) { doCapture(); return; }
    setCountdown(timerOption);
    let remaining = timerOption;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      // 🆕 flash tiap detik hanya di kamera belakang
      if (facingMode === 'environment') triggerFlash();
      if (remaining <= 0) { clearCountdown(); setCountdown(null); doCapture(); }
      else setCountdown(remaining);
    }, 1000);
  };

  const cancelCountdown = () => { clearCountdown(); setCountdown(null); };
  const retake = () => { setPreview(null); setCountdown(null); setError(''); startCamera(facingMode); };
  const confirm = () => { if (preview) onCapture(preview); };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl overflow-hidden w-full shadow-2xl" style={{ maxWidth: 680 }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <IconCamera className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Ambil Selfie</p>
              <p className="text-gray-400 text-[11px]">Posisikan wajah di dalam bingkai</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 🆕 Tombol switch kamera */}
            {!preview && !error && (
              <button
                onClick={switchCamera}
                disabled={countdown !== null}
                title={facingMode === 'user' ? 'Ganti ke kamera belakang' : 'Ganti ke kamera depan'}
                className={`w-8 h-8 rounded-lg bg-gray-700/60 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors ${countdown !== null ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {/* flip/rotate icon */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <button onClick={() => { clearCountdown(); stopCamera(); onCancel(); }}
              className="w-8 h-8 rounded-lg bg-gray-700/60 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
              <IconX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Timer selector */}
        {!preview && !error && (
          <div className="px-5 py-2.5 border-b border-gray-700/40 flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide shrink-0">Timer</span>
            <div className="flex gap-1.5">
              {TIMER_OPTIONS.map(opt => (
                <button key={opt} type="button"
                  onClick={() => { if (countdown !== null) return; setTimerOption(opt); }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all
                    ${timerOption === opt ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
                    ${countdown !== null ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  {opt === 0 ? 'OFF' : `${opt}s`}
                </button>
              ))}
            </div>
            {/* 🆕 label kamera aktif */}
            <span className="ml-auto text-[10px] text-gray-500">
              {facingMode === 'user' ? '📷 Depan' : '📸 Belakang'}
            </span>
          </div>
        )}

        {/* Viewfinder */}
        <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
          {/* 🆕 Flash overlay */}
          {flash && (
            <div className="absolute inset-0 bg-white z-20 pointer-events-none transition-opacity" style={{ opacity: 0.85 }} />
          )}

          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                  <IconAlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 text-sm font-medium mb-1">Kamera tidak tersedia</p>
                <p className="text-gray-500 text-xs">{error}</p>
                <button onClick={retake}
                  className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-xl text-sm hover:bg-gray-600">
                  Coba Lagi
                </button>
              </div>
            </div>
          ) : preview ? (
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted
              className="w-full h-full object-cover"
              // Mirror hanya kamera depan
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
          )}

          {!preview && !error && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative" style={{ width: '45%', aspectRatio: '3/4' }}>
                  <div className="absolute inset-0 border border-white/20 rounded-full" />
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
                </div>
              </div>
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
                    <span className="text-white font-bold" style={{ fontSize: 52, lineHeight: 1 }}>{countdown}</span>
                  </div>
                </div>
              )}
              {countdown === null && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white text-[10px] font-semibold tracking-widest uppercase">Live</span>
                </div>
              )}
            </div>
          )}

          {preview && (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-1.5 bg-green-500/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <IconCheck className="w-3 h-3 text-white" />
                <span className="text-white text-[10px] font-semibold">Preview</span>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Actions — sama seperti sebelumnya */}
        <div className="px-5 py-4 border-t border-gray-700/60 flex gap-3">
          {!preview ? (
            countdown !== null ? (
              <button onClick={cancelCountdown}
                className="flex-1 py-2.5 bg-red-600/80 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                Batalkan ({countdown}s)
              </button>
            ) : (
              <>
                <button onClick={() => { clearCountdown(); stopCamera(); onCancel(); }}
                  className="px-4 py-2.5 bg-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-600 transition-colors">
                  Batal
                </button>
                <button onClick={capturePhoto} disabled={!!error}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
                  <IconCamera className="w-4 h-4" />
                  {timerOption === 0 ? 'Ambil Foto' : `Foto dalam ${timerOption}s`}
                </button>
              </>
            )
          ) : (
            <>
              <button onClick={retake} className="flex-1 py-2.5 bg-gray-700 text-white rounded-xl font-semibold text-sm hover:bg-gray-600 transition-colors">
                Ulangi
              </button>
              <button onClick={confirm} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 flex items-center justify-center gap-2 transition-colors">
                <IconCheck className="w-4 h-4" /> Gunakan Foto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Map Preview ──────────────────────────────────────────────────────────────
function MapPreview({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 160 }}>
      <iframe title="location-map" width="100%" height="160" loading="lazy"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.002},${lat-0.002},${lng+0.002},${lat+0.002}&layer=mapnik&marker=${lat},${lng}`}
        style={{ border: 0 }} />
    </div>
  );
}

// ─── Taft Selector ────────────────────────────────────────────────────────────
function TaftSelector({ tafts, selected, onToggle, label }: {
  tafts: TaftEntry[]; selected: string[]; onToggle: (name: string) => void; label: string;
}) {
  if (tafts.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-[10px] text-gray-500 uppercase tracking-wide font-medium">{label}</label>
        {selected.length > 0 && (
          <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">{selected.length} dipilih</span>
        )}
      </div>
      <div className="space-y-1.5">
        {tafts.map(t => {
          const checked = selected.includes(t.taft_name);
          return (
            <button key={t.id} type="button" onClick={() => onToggle(t.taft_name)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${checked ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
                {checked && <IconCheck className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className={`text-sm font-medium ${checked ? 'text-primary' : 'text-gray-700'}`}>{t.taft_name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CaptureAttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isStoreUser, setIsStoreUser] = useState(false);
  const [myStoreName, setMyStoreName] = useState('');
  useSessionGuard();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.attendance_store && !parsed.attendance_store_all) {
      router.push("/dashboard"); return;
    }
    setUser(parsed);
    fetch('/api/capture-attendance/meta?type=store_list')
      .then(r => r.json())
      .then((stores: StoreEntry[]) => {
        const match = stores.find(s => s.store_name?.toLowerCase() === parsed.user_name?.toLowerCase());
        if (match) { setIsStoreUser(true); setMyStoreName(match.store_name); }
      });
  }, []);

  if (!user) return null;
  const isAll = !!user.attendance_store_all;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Capture Attendance</h1>
        <CaptureSection user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} isAll={isAll} />
      </div>
    </div>
  );
}

// ─── Combined Section ─────────────────────────────────────────────────────────
function CaptureSection({ user, isStoreUser, myStoreName, isAll }: {
  user: any; isStoreUser: boolean; myStoreName: string; isAll: boolean;
}) {
  const [stores, setStores] = useState<StoreDetail[]>([]);
  const [storeList, setStoreList] = useState<StoreEntry[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [storeDetail, setStoreDetail] = useState<StoreDetail | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error'; distanceMeters?: number | null } | null>(null);
  const [tafts, setTafts] = useState<TaftEntry[]>([]);
  const [selectedOpenTafts, setSelectedOpenTafts] = useState<string[]>([]);
  const [selectedCloseTafts, setSelectedCloseTafts] = useState<string[]>([]);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  type Step = 'init' | 'gps' | 'selfie' | 'taft' | 'confirm' | 'done';
  const [step, setStep] = useState<Step>('init');
  const [actionType, setActionType] = useState<'open' | 'close'>('open');

  // History state
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [historyStore, setHistoryStore] = useState('');
  const [historyDate, setHistoryDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/capture-attendance/meta?type=store_list')
      .then(r => r.json())
      .then((data: StoreDetail[]) => {
        setStores(data);
        setStoreList(data.map(s => ({ id: s.id, store_name: s.store_name })));
        if (isStoreUser && myStoreName) {
          setSelectedStore(myStoreName);
          setHistoryStore(myStoreName);
          setStoreDetail(data.find(s => s.store_name?.toLowerCase() === myStoreName.toLowerCase()) || null);
        }
      });
  }, [isStoreUser, myStoreName]);

  useEffect(() => {
    if (selectedStore && stores.length > 0) {
      setStoreDetail(stores.find(s => s.store_name?.toLowerCase() === selectedStore.toLowerCase()) || null);
    } else {
      setStoreDetail(null);
    }
  }, [selectedStore, stores]);

  const fetchTodayRecord = useCallback(async (store: string) => {
    if (!store) { setTodayRecord(null); return; }
    try {
      const today = new Date();
      const todayISO = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const res = await fetch(`/api/capture-attendance/capture?store_name=${encodeURIComponent(store)}&date=${todayISO}${isAll ? '&all=true' : ''}`);
      const data = await res.json();
      setTodayRecord(Array.isArray(data) && data.length > 0 ? data[0] : null);
    } catch { setTodayRecord(null); }
  }, [isAll]);

  const fetchHistory = useCallback(async (store: string, date: string) => {
    setHistoryLoading(true);
    try {
      const effectiveStore = isAll ? store : myStoreName;
      const storeParam = effectiveStore ? `&store_name=${encodeURIComponent(effectiveStore)}` : '';
      const res = await fetch(`/api/capture-attendance/capture?${storeParam}&date=${date}${isAll ? '&all=true' : ''}`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch { setRecords([]); }
    finally { setHistoryLoading(false); }
  }, [isAll, myStoreName]);

  useEffect(() => {
    if (selectedStore) {
      fetchTodayRecord(selectedStore);
      fetch(`/api/capture-attendance/meta?type=taft_list&store_name=${encodeURIComponent(selectedStore)}`)
        .then(r => r.json()).then((data: TaftEntry[]) => setTafts(data || []));
    } else { setTodayRecord(null); setTafts([]); }
    setStep('init'); setSelfieData(null); setCoords(null); setGpsStatus('idle');
    setSelectedOpenTafts([]); setSelectedCloseTafts([]);
  }, [selectedStore, fetchTodayRecord]);

  useEffect(() => {
    if (isStoreUser && myStoreName) fetchHistory(myStoreName, historyDate);
    else if (isAll) fetchHistory(historyStore, historyDate);
  }, [isStoreUser, myStoreName]); // eslint-disable-line

  const toggleOpenTaft = (name: string) => setSelectedOpenTafts(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleCloseTaft = (name: string) => setSelectedCloseTafts(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

  const getGPS = async (): Promise<{ lat: number; lng: number } | null> => {
    setGpsStatus('loading'); setGpsError('');
    return new Promise(resolve => {
      if (!navigator.geolocation) { setGpsStatus('error'); setGpsError('Browser tidak mendukung GPS'); resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        pos => { const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCoords(c); setGpsStatus('ok'); resolve(c); },
        err => { setGpsStatus('error'); setGpsError(err.message || 'Gagal mendapatkan lokasi'); resolve(null); },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  const startAction = async (type: 'open' | 'close') => {
    setActionType(type); setSelfieData(null); setCoords(null); setGpsStatus('idle');
    if (type === 'open') setSelectedOpenTafts([]); else setSelectedCloseTafts([]);
    setStep('gps');
    const c = await getGPS();
    if (!c) return;
    setStep('selfie');
  };

  const handleSelfieCapture = (dataUrl: string) => { setSelfieData(dataUrl); setShowCamera(false); setStep('taft'); };
  const handleTaftNext = () => setStep('confirm');

  const handleSubmit = async () => {
    if (!coords || !selfieData || !selectedStore) return;
    setLoading(true); setMsg(null);
    try {
      const ip = await getPublicIP();
      const staffNames = (actionType === 'open' ? selectedOpenTafts : selectedCloseTafts).join('; ');
      const body: any = {
        action: actionType,
        store_name: selectedStore,
        device_info: getDeviceInfo(),
        browser: getBrowserName(),
        ip_address: ip,
        is_valid_location: true,
      };
      if (actionType === 'open') {
        body.open_latitude = coords.lat;
        body.open_longitude = coords.lng;
        body.open_maps_url = buildMapsUrl(coords.lat, coords.lng);
        body.open_timestamp = nowTimestamp();
        body.open_staff_name = staffNames;
        body.open_selfie = selfieData;
      } else {
        body.close_latitude = coords.lat;
        body.close_longitude = coords.lng;
        body.close_maps_url = buildMapsUrl(coords.lat, coords.lng);
        body.close_timestamp = nowTimestamp();
        body.close_staff_name = staffNames;
        body.close_selfie = selfieData;
      }
      const res = await fetch('/api/capture-attendance/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success) {
        setMsg({
          text: `Absensi ${actionType === 'open' ? 'OPEN' : 'CLOSE'} berhasil disimpan!`,
          type: 'success',
          distanceMeters: result.distance_meters ?? null,
        });
        setStep('done');
        await fetchTodayRecord(selectedStore);
        fetchHistory(isAll ? historyStore : myStoreName, historyDate);
      } else {
        setMsg({ text: result.error || 'Gagal menyimpan', type: 'error' });
        setStep('init');
      }
    } catch {
      setMsg({ text: 'Terjadi kesalahan', type: 'error' });
      setStep('init');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setStep('init'); setSelfieData(null); setCoords(null); setGpsStatus('idle'); setMsg(null); };

  const hasOpen = !!todayRecord?.open_timestamp;
  const hasClose = !!todayRecord?.close_timestamp;
  const timeAllowsClose = isCloseWindowActive(storeDetail?.close_hours || '');
  const canOpen = !hasOpen;
  const canClose = hasOpen && !hasClose && timeAllowsClose;
  const currentSelectedTafts = actionType === 'open' ? selectedOpenTafts : selectedCloseTafts;
  const currentToggleTaft = actionType === 'open' ? toggleOpenTaft : toggleCloseTaft;

  return (
    <div className="w-full center">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-8">

        {/* KOLOM KIRI */}
        <div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            {isStoreUser ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IconStore className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Toko Anda</p>
                  <p className="text-sm font-bold text-gray-900 capitalize">{myStoreName}</p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-1.5">Pilih Toko</label>
                <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                  <option value="">Pilih Toko</option>
                  {stores.map(s => <option key={s.id} value={s.store_name}>{s.store_name}</option>)}
                </select>
              </div>
            )}
            {storeDetail && (storeDetail.open_hours || storeDetail.close_hours) && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4">
                {storeDetail.open_hours && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[10px] text-gray-500">Buka: <span className="font-semibold text-gray-700">{storeDetail.open_hours}</span></span>
                  </div>
                )}
                {storeDetail.close_hours && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[10px] text-gray-500">Tutup: <span className="font-semibold text-gray-700">{storeDetail.close_hours}</span></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedStore && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-3">Status Hari Ini</p>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-3 border-2 transition-colors ${hasOpen ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${hasOpen ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${hasOpen ? 'text-green-700' : 'text-gray-400'}`}>OPEN</span>
                  </div>
                  {hasOpen
                    ? <><p className="text-[11px] font-semibold text-gray-800">{todayRecord!.open_timestamp}</p><p className="text-[10px] text-gray-500 mt-0.5">{todayRecord!.open_staff_name || '-'}</p></>
                    : <p className="text-[11px] text-gray-400">Belum absen</p>}
                </div>
                <div className={`rounded-xl p-3 border-2 transition-colors ${hasClose ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${hasClose ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${hasClose ? 'text-blue-700' : 'text-gray-400'}`}>CLOSE</span>
                  </div>
                  {hasClose
                    ? <><p className="text-[11px] font-semibold text-gray-800">{todayRecord!.close_timestamp}</p><p className="text-[10px] text-gray-500 mt-0.5">{todayRecord!.close_staff_name || '-'}</p></>
                    : <p className="text-[11px] text-gray-400">Belum absen</p>}
                </div>
              </div>
            </div>
          )}

          {selectedStore && todayRecord && (isValidSelfie(todayRecord.open_selfie) || isValidSelfie(todayRecord.close_selfie)) && step === 'init' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-3">Foto Hari Ini</p>
              <div className="grid grid-cols-2 gap-3">
                {isValidSelfie(todayRecord.open_selfie) && (
                  <div>
                    <p className="text-[10px] text-green-600 font-bold mb-1">OPEN</p>
                    <LazyImg src={toDriveProxyUrl(todayRecord.open_selfie)} alt="open selfie" className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }} />
                  </div>
                )}
                {isValidSelfie(todayRecord.close_selfie) && (
                  <div>
                    <p className="text-[10px] text-blue-600 font-bold mb-1">CLOSE</p>
                    <LazyImg src={toDriveProxyUrl(todayRecord.close_selfie)} alt="close selfie" className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedStore && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-12 text-center">
              <p className="text-gray-500 text-sm">Pilih toko untuk mulai absensi</p>
            </div>
          )}
        </div>

        {/* KOLOM KANAN */}
        {selectedStore && (
          <div>
            {step === 'init' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => startAction('open')} disabled={!canOpen}
                  className={`py-5 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all ${canOpen ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-200 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                  <span className="text-lg">🟢</span>
                  <span>OPEN</span>
                  {hasOpen && <span className="text-[9px] font-normal opacity-70">Sudah absen</span>}
                </button>
                <button onClick={() => startAction('close')} disabled={!canClose}
                  className={`py-5 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all ${canClose ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-200 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                  <span className="text-lg">🔵</span>
                  <span>CLOSE</span>
                  {hasClose && <span className="text-[9px] font-normal opacity-70">Sudah absen</span>}
                  {!hasOpen && !hasClose && <span className="text-[9px] font-normal opacity-70">Open dulu</span>}
                  {hasOpen && !hasClose && !timeAllowsClose && storeDetail?.close_hours && (
                    <span className="text-[9px] font-normal opacity-70 text-center px-1">5m sebelum - 2j sesudah {storeDetail.close_hours}</span>
                  )}
                </button>
              </div>
            )}

            {step === 'gps' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 text-center">
                {gpsStatus === 'loading' && <IconSignal className="w-10 h-10 text-primary mx-auto mb-3 animate-pulse" />}
                {gpsStatus === 'error' && <IconAlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />}
                {gpsStatus === 'ok' && <IconPin className="w-10 h-10 text-green-500 mx-auto mb-3" />}
                <p className="font-semibold text-gray-800 mb-1">
                  {gpsStatus === 'loading' ? 'Mengambil lokasi GPS...' : gpsStatus === 'error' ? 'GPS Gagal' : 'Lokasi Didapat'}
                </p>
                {gpsStatus === 'loading' && <p className="text-[11px] text-gray-500">Harap izinkan akses lokasi</p>}
                {gpsStatus === 'error' && (<><p className="text-[11px] text-red-500 mb-3">{gpsError}</p><button onClick={reset} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm">Batal</button></>)}
                {gpsStatus === 'ok' && coords && (<><p className="text-[11px] text-gray-500 mb-2">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p><MapPreview lat={coords.lat} lng={coords.lng} /></>)}
              </div>
            )}

            {step === 'selfie' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 text-center">
                <IconCamera className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="font-semibold text-gray-800 mb-1">Ambil Selfie</p>
                <p className="text-[11px] text-gray-500 mb-4">Foto untuk konfirmasi kehadiran</p>
                <button onClick={() => setShowCamera(true)} className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90">Buka Kamera</button>
                <button onClick={reset} className="block mx-auto mt-2 text-[11px] text-gray-400 hover:text-gray-600">Batal</button>
              </div>
            )}

            {step === 'taft' && (
              <div className="mb-4">
                {selfieData && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4 flex items-center gap-3">
                    <img src={selfieData} alt="selfie" className="w-12 h-12 rounded-xl object-cover" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-700">Foto berhasil diambil</p>
                      <p className="text-[10px] text-gray-400">Lanjut pilih staff yang hadir</p>
                    </div>
                    <IconCheck className="w-4 h-4 text-green-500 ml-auto shrink-0" />
                  </div>
                )}
                <TaftSelector tafts={tafts} selected={currentSelectedTafts} onToggle={currentToggleTaft}
                  label={`Staff ${actionType === 'open' ? 'OPEN' : 'CLOSE'} yang Hadir`} />
                <div className="flex gap-2">
                  <button onClick={reset} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Batal</button>
                  <button onClick={handleTaftNext} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90">Lanjut</button>
                </div>
              </div>
            )}

            {step === 'confirm' && coords && selfieData && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
                <p className="text-sm font-bold text-gray-800 mb-3">Konfirmasi Absensi {actionType === 'open' ? 'OPEN' : 'CLOSE'}</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Foto Selfie</p>
                    <img src={selfieData} alt="selfie" className="w-full rounded-xl object-cover" style={{ aspectRatio: '4/3' }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Lokasi</p>
                    <MapPreview lat={coords.lat} lng={coords.lng} />
                    <p className="text-[9px] text-gray-400 mt-1">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 mb-3 text-[11px] text-gray-600 space-y-1">
                  <div className="flex justify-between"><span>Toko</span><span className="font-medium capitalize">{selectedStore}</span></div>
                  <div className="flex justify-between"><span>Waktu</span><span className="font-medium">{nowTimestamp()}</span></div>
                  {currentSelectedTafts.length > 0 && (
                    <div className="flex justify-between gap-2"><span className="shrink-0">Staff</span><span className="font-medium text-right text-primary">{currentSelectedTafts.join('; ')}</span></div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep('taft')} disabled={loading} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Kembali</button>
                  <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
                    {loading ? 'Menyimpan...' : 'Simpan Absensi'}
                  </button>
                </div>
              </div>
            )}

            {/* ── DONE ── */}
            {step === 'done' && msg?.type === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-4 text-center">
                <IconCheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                <p className="font-bold text-green-800 mb-1">Berhasil!</p>
                <p className="text-[12px] text-green-700 mb-2">{msg.text}</p>
                {/* Tampilkan jarak hanya untuk CLOSE */}
                {actionType === 'close' && msg.distanceMeters !== null && msg.distanceMeters !== undefined && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-4
                    ${msg.distanceMeters <= 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <IconPin className="w-3 h-3" />
                    Jarak open–close: {msg.distanceMeters} m
                    {msg.distanceMeters <= 200 ? ' ✓ Valid' : ' ✗ Terlalu jauh'}
                  </div>
                )}
                <br />
                <button onClick={reset} className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">Selesai</button>
              </div>
            )}

            {msg?.type === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-center">
                <IconAlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-red-700 text-sm font-semibold mb-1">Gagal</p>
                <p className="text-red-600 text-[12px]">{msg.text}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ RIWAYAT ══ */}
      <div className="-mx-6">
        <div className="mx-6 mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">Riwayat Absensi</h2>
        </div>

        <div className="mx-6 mb-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <div className="flex items-center gap-3 flex-wrap">
            {isAll && (
              <>
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Toko</label>
                  <select value={historyStore} onChange={e => setHistoryStore(e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary bg-white">
                    <option value="">Semua Toko</option>
                    {storeList.map(s => <option key={s.id} value={s.store_name}>{s.store_name}</option>)}
                  </select>
                </div>
                <div className="w-px h-4 bg-gray-200" />
              </>
            )}
            {!isAll && isStoreUser && (
              <>
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Toko</label>
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-[11px] font-medium text-gray-700 capitalize">{myStoreName}</span>
                </div>
                <div className="w-px h-4 bg-gray-200" />
              </>
            )}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Tanggal</label>
              <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary bg-white" />
            </div>
            <button onClick={() => fetchHistory(historyStore, historyDate)}
              className="px-3 py-1 bg-primary text-white rounded-lg text-[11px] font-medium hover:bg-primary/90">
              Cari
            </button>
            {records.length > 0 && (
              <span className="ml-auto text-[11px] text-gray-400">{records.length} data</span>
            )}
          </div>
        </div>

        {historyLoading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Memuat data...</div>
        ) : records.length === 0 ? (
          <div className="mx-6 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-12 text-center">
            <p className="text-gray-500 text-sm">Tidak ada data absensi</p>
          </div>
        ) : (
          <div className="bg-white border-y border-gray-200">
            <div className="overflow-x-auto w-full">
              <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr>
                    <th colSpan={2} className="border-b border-r border-gray-200 bg-gray-50" />
                    <th colSpan={3} className="px-2 py-1 text-center border-b border-r border-gray-200 bg-gray-100">
                      <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">OPEN</span>
                    </th>
                    <th colSpan={3} className={`px-2 py-1 text-center border-b border-gray-200 bg-gray-50 ${isAll ? 'border-r' : ''}`}>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">CLOSE</span>
                    </th>
                    {isAll && (
                      <th colSpan={8} className="px-2 py-1 text-center border-b border-gray-200 bg-gray-50">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Info Teknis</span>
                      </th>
                    )}
                  </tr>
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center border-r border-gray-200 w-8">#</th>
                    <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide text-left border-r border-gray-200 w-28">Toko</th>
                    <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-wide text-left border-r border-gray-200 bg-gray-100 w-28">Staff</th>
                    <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-wide text-center border-r border-gray-200 bg-gray-100 w-12">Foto</th>
                    <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-wide text-center border-r border-gray-200 bg-gray-100 w-14">Jam</th>
                    <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide text-left border-r border-gray-200 w-28">Staff</th>
                    <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide text-center border-r border-gray-200 w-12">Foto</th>
                    <th className={`px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide text-center w-14 ${isAll ? 'border-r border-gray-200' : ''}`}>Jam</th>
                    {isAll && (<>
                      <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-left border-r border-gray-200 w-28">Device</th>
                      <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-left border-r border-gray-200 w-20">Browser</th>
                      <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-left border-r border-gray-200 w-28">IP</th>
                      <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center border-r border-gray-200 w-14">Valid</th>
                      <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-left border-r border-gray-200 w-24">Lat Open</th>
                      <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-left border-r border-gray-200 w-24">Lng Open</th>
                      <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center border-r border-gray-200 w-12">Peta O</th>
                      <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center w-12">Peta C</th>
                    </>)}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, idx) => {
                    const isExpanded = expandedId === rec.id;
                    const openProxyUrl  = isValidSelfie(rec.open_selfie)  ? toDriveProxyUrl(rec.open_selfie)  : '';
                    const closeProxyUrl = isValidSelfie(rec.close_selfie) ? toDriveProxyUrl(rec.close_selfie) : '';
                    const openStaff  = rec.open_staff_name?.trim()  || '';
                    const closeStaff = rec.close_staff_name?.trim() || '';
                    const isValid = rec.is_valid_location === 'TRUE' || rec.is_valid_location === 'true' || rec.is_valid_location === '1';
                    const rowBg = isExpanded ? 'bg-blue-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';

                    return (
                      <React.Fragment key={rec.id}>
                        <tr onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                          className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50/30 transition-colors ${rowBg}`}>
                          <td className="px-2 py-2.5 text-[10px] text-gray-400 text-center border-r border-gray-200">{idx + 1}</td>
                          <td className="px-2 py-2.5 border-r border-gray-200">
                            <p className="text-[11px] font-semibold text-gray-800 capitalize">{rec.store_name}</p>
                          </td>
                          <td className="px-2 py-2.5 border-r border-gray-200 bg-gray-50/60 max-w-[112px]">
                            <p className="text-[10px] text-gray-700 truncate">{openStaff || <span className="text-gray-300">—</span>}</p>
                          </td>
                          <td className="px-1 py-1.5 border-r border-gray-200 bg-gray-50/60">
                            <div className="flex justify-center">
                              {openProxyUrl
                                ? <LazyImg src={openProxyUrl} alt="foto open" className="rounded overflow-hidden border border-gray-200 bg-gray-100" style={{ width: 36, height: 36 }} fallback={<SelfiePlaceholderSm />} />
                                : <SelfiePlaceholderSm />}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 border-r border-gray-200 bg-gray-50/60">
                            {rec.open_timestamp ? <p className="text-[10px] font-semibold text-gray-700 whitespace-nowrap">{extractTime(rec.open_timestamp)}</p> : <p className="text-[10px] text-gray-300">—</p>}
                          </td>
                          <td className="px-2 py-2.5 border-r border-gray-200 max-w-[112px]">
                            <p className="text-[10px] text-gray-700 truncate">{closeStaff || <span className="text-gray-300">—</span>}</p>
                          </td>
                          <td className="px-1 py-1.5 border-r border-gray-200">
                            <div className="flex justify-center">
                              {closeProxyUrl
                                ? <LazyImg src={closeProxyUrl} alt="foto close" className="rounded overflow-hidden border border-gray-200 bg-gray-100" style={{ width: 36, height: 36 }} fallback={<SelfiePlaceholderSm />} />
                                : <SelfiePlaceholderSm />}
                            </div>
                          </td>
                          <td className={`px-2 py-2.5 ${isAll ? 'border-r border-gray-200' : ''}`}>
                            {rec.close_timestamp ? <p className="text-[10px] font-semibold text-gray-600 whitespace-nowrap">{extractTime(rec.close_timestamp)}</p> : <p className="text-[10px] text-gray-300">—</p>}
                          </td>
                          {isAll && (<>
                            <td className="px-2 py-2.5 border-r border-gray-200"><p className="text-[10px] text-gray-600 truncate max-w-[100px]">{rec.device_info || '—'}</p></td>
                            <td className="px-2 py-2.5 border-r border-gray-200"><p className="text-[10px] text-gray-600 truncate">{rec.browser || '—'}</p></td>
                            <td className="px-2 py-2.5 border-r border-gray-200"><p className="text-[10px] text-gray-600 font-mono truncate">{rec.ip_address || '—'}</p></td>
                            <td className="px-2 py-2.5 border-r border-gray-200 text-center">
                              {isValid
                                ? <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200"><IconCheck className="w-2.5 h-2.5" /> Ya</span>
                                : <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200"><IconX className="w-2.5 h-2.5" /> Tidak</span>}
                            </td>
                            <td className="px-2 py-2.5 border-r border-gray-200"><p className="text-[10px] text-gray-600 font-mono truncate">{rec.open_latitude || '—'}</p></td>
                            <td className="px-2 py-2.5 border-r border-gray-200"><p className="text-[10px] text-gray-600 font-mono truncate">{rec.open_longitude || '—'}</p></td>
                            <td className="px-2 py-2.5 border-r border-gray-200 text-center">
                              {rec.open_maps_url
                                ? <a href={rec.open_maps_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-gray-500 hover:text-gray-800 inline-flex justify-center"><IconPin className="w-3.5 h-3.5" /></a>
                                : <span className="text-gray-200 inline-flex justify-center"><IconPin className="w-3.5 h-3.5" /></span>}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              {rec.close_maps_url
                                ? <a href={rec.close_maps_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-gray-500 hover:text-gray-800 inline-flex justify-center"><IconPin className="w-3.5 h-3.5" /></a>
                                : <span className="text-gray-200 inline-flex justify-center"><IconPin className="w-3.5 h-3.5" /></span>}
                            </td>
                          </>)}
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <td colSpan={isAll ? 16 : 8} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-6 max-w-md">
                                <div>
                                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">OPEN</p>
                                  {openProxyUrl ? <img src={openProxyUrl} alt="open" className="w-full rounded-lg object-cover mb-2 border border-gray-200" style={{ aspectRatio: '4/3' }} /> : <SelfiePlaceholderMd />}
                                  <p className="text-[10px] text-gray-500"><span className="text-gray-400">Staff: </span><span className="font-medium text-gray-700">{openStaff || <span className="italic text-gray-300">tidak diisi</span>}</span></p>
                                  <p className="text-[10px] text-gray-500 mt-0.5"><span className="text-gray-400">Waktu: </span><span className="font-medium text-gray-700">{rec.open_timestamp || '-'}</span></p>
                                  {rec.open_maps_url && <a href={rec.open_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 hover:underline mt-1"><IconPin className="w-3 h-3" /> Lihat Peta</a>}
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">CLOSE</p>
                                  {closeProxyUrl ? <img src={closeProxyUrl} alt="close" className="w-full rounded-lg object-cover mb-2 border border-gray-200" style={{ aspectRatio: '4/3' }} /> : <SelfiePlaceholderMd />}
                                  <p className="text-[10px] text-gray-500"><span className="text-gray-400">Staff: </span><span className="font-medium text-gray-700">{closeStaff || <span className="italic text-gray-300">tidak diisi</span>}</span></p>
                                  <p className="text-[10px] text-gray-500 mt-0.5"><span className="text-gray-400">Waktu: </span><span className="font-medium text-gray-700">{rec.close_timestamp || '-'}</span></p>
                                  {rec.close_maps_url && <a href={rec.close_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 hover:underline mt-1"><IconPin className="w-3 h-3" /> Lihat Peta</a>}
                                </div>
                              </div>
                              {isAll && (
                                <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-3 gap-x-6 gap-y-1 text-[10px] text-gray-600">
                                  <div><span className="text-gray-400">Device: </span><span className="font-medium">{rec.device_info || '-'}</span></div>
                                  <div><span className="text-gray-400">Browser: </span><span className="font-medium">{rec.browser || '-'}</span></div>
                                  <div><span className="text-gray-400">IP: </span><span className="font-medium font-mono">{rec.ip_address || '-'}</span></div>
                                  <div><span className="text-gray-400">Valid: </span><span className={`font-semibold ${isValid ? 'text-green-700' : 'text-red-500'}`}>{isValid ? 'Ya' : 'Tidak'}</span></div>
                                  <div><span className="text-gray-400">Lat: </span><span className="font-medium font-mono">{rec.open_latitude || '-'}</span></div>
                                  <div><span className="text-gray-400">Lng: </span><span className="font-medium font-mono">{rec.open_longitude || '-'}</span></div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCamera && <SelfieCapture onCapture={handleSelfieCapture} onCancel={() => setShowCamera(false)} />}
    </div>
  );
}