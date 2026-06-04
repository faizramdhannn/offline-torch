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

// ─── Drive Image Proxy Helper ──────────────────────────────────────────────────
function toDriveProxyUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `/api/drive-image?id=${m[1]}`;
  return url;
}

// ─── Selfie Validity Check ─────────────────────────────────────────────────────
function isValidSelfie(url: string): boolean {
  if (!url) return false;
  if (url === 'data:,' || url === 'data:') return false;
  if (url.startsWith('data:') && url.length < 100) return false;
  return true;
}

// ─── Extract time from timestamp ──────────────────────────────────────────────
function extractTime(ts: string): string {
  if (!ts) return '-';
  const m = ts.match(/,\s*(\d{2}[.:]\d{2})/);
  if (m) return m[1].replace('.', ':');
  const parts = ts.split(',');
  if (parts.length > 1) return parts[1].trim().substring(0, 5);
  return ts;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconCamera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconPin = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconSignal = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconAlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconStore = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

// ─── Lazy Image ────────────────────────────────────────────────────────────────
function LazyImg({
  src, alt, className, style, fallback,
}: {
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
      {visible && !errored ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setErrored(true)} />
      ) : errored ? (
        fallback || <span className="text-gray-300 text-xs flex items-center justify-center w-full h-full">—</span>
      ) : (
        <div className="w-full h-full bg-gray-100 animate-pulse" />
      )}
    </div>
  );
}

// ─── Selfie Placeholder ────────────────────────────────────────────────────────
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

// ─── Time Window Helpers ───────────────────────────────────────────────────────
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
  return now >= target - 1 && now <= target + 1;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
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
  } catch {
    return 'unknown';
  }
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

function formatTimestamp(ts: string): string {
  if (!ts) return '-';
  return ts;
}

// ─── Selfie Camera Component ───────────────────────────────────────────────────
function SelfieCapture({ onCapture, onCancel }: { onCapture: (dataUrl: string) => void; onCancel: () => void; }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setError('Tidak bisa mengakses kamera. Pastikan izin kamera diberikan.');
    }
  };

  const stopCamera = () => { stream?.getTracks().forEach(t => t.stop()); };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPreview(dataUrl);
    stopCamera();
  };

  const retake = () => { setPreview(null); startCamera(); };
  const confirm = () => { if (preview) onCapture(preview); };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl overflow-hidden w-full max-w-2xl">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Ambil Selfie</p>
          <button onClick={() => { stopCamera(); onCancel(); }} className="text-gray-400 hover:text-white p-1">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
              <div>
                <IconAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          ) : preview ? (
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          )}
          {!preview && !error && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 border-2 border-white/30 rounded-xl" />
              <div className="absolute top-6 left-6 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
              <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
              <div className="absolute bottom-6 left-6 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
              <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="p-4 flex gap-3">
          {!preview ? (
            <button onClick={capturePhoto} disabled={!!error}
              className="flex-1 py-3 bg-white text-gray-900 rounded-xl font-bold text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2">
              <IconCamera className="w-4 h-4" /> Ambil Foto
            </button>
          ) : (
            <>
              <button onClick={retake} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-semibold text-sm hover:bg-gray-600">Ulangi</button>
              <button onClick={confirm} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600">Gunakan</button>
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
      <iframe
        title="location-map"
        width="100%"
        height="160"
        loading="lazy"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.002},${lat - 0.002},${lng + 0.002},${lat + 0.002}&layer=mapnik&marker=${lat},${lng}`}
        style={{ border: 0 }}
      />
    </div>
  );
}

// ─── Taft Multi-Select ────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<'capture' | 'history'>('capture');
  useSessionGuard();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.attendance_store && !parsed.attendance_store_all) {
      router.push("/dashboard");
      return;
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-primary">Capture Attendance</h1>
          <div className="flex gap-0.5 bg-white rounded-lg p-0.5 shadow border border-gray-100">
            {(['capture', 'history'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-gray-900 hover:text-gray-700 hover:bg-gray-50'}`}>
                {tab === 'capture' ? 'Absensi' : 'Riwayat'}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'capture' && <CaptureTab user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} isAll={isAll} />}
        {activeTab === 'history' && <HistoryTab user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} isAll={isAll} />}
      </div>
    </div>
  );
}

// ─── Capture Tab ───────────────────────────────────────────────────────────────
function CaptureTab({ user, isStoreUser, myStoreName, isAll }: { user: any; isStoreUser: boolean; myStoreName: string; isAll: boolean }) {
  const [stores, setStores] = useState<StoreDetail[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [storeDetail, setStoreDetail] = useState<StoreDetail | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
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

  useEffect(() => {
    fetch('/api/capture-attendance/meta?type=store_list')
      .then(r => r.json())
      .then((data: StoreDetail[]) => {
        setStores(data);
        if (isStoreUser && myStoreName) {
          setSelectedStore(myStoreName);
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

  useEffect(() => {
    if (selectedStore) {
      fetchTodayRecord(selectedStore);
      fetch(`/api/capture-attendance/meta?type=taft_list&store_name=${encodeURIComponent(selectedStore)}`)
        .then(r => r.json()).then((data: TaftEntry[]) => setTafts(data || []));
    } else {
      setTodayRecord(null); setTafts([]);
    }
    setStep('init'); setSelfieData(null); setCoords(null); setGpsStatus('idle');
    setSelectedOpenTafts([]); setSelectedCloseTafts([]);
  }, [selectedStore, fetchTodayRecord]);

  const toggleOpenTaft = (name: string) => setSelectedOpenTafts(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleCloseTaft = (name: string) => setSelectedCloseTafts(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

  const getGPS = async (): Promise<{ lat: number; lng: number } | null> => {
    setGpsStatus('loading'); setGpsError('');
    return new Promise((resolve) => {
      if (!navigator.geolocation) { setGpsStatus('error'); setGpsError('Browser tidak mendukung GPS'); resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus('ok'); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        (err) => { setGpsStatus('error'); setGpsError(err.message || 'Gagal mendapatkan lokasi'); resolve(null); },
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
      const staffNames = actionType === 'open' ? selectedOpenTafts.join('; ') : selectedCloseTafts.join('; ');
      const body: any = { action: actionType, store_name: selectedStore, device_info: getDeviceInfo(), browser: getBrowserName(), ip_address: ip, is_valid_location: true };
      if (actionType === 'open') {
        body.open_latitude = coords.lat; body.open_longitude = coords.lng;
        body.open_maps_url = buildMapsUrl(coords.lat, coords.lng);
        body.open_timestamp = nowTimestamp(); body.open_staff_name = staffNames; body.open_selfie = selfieData;
      } else {
        body.close_latitude = coords.lat; body.close_longitude = coords.lng;
        body.close_maps_url = buildMapsUrl(coords.lat, coords.lng);
        body.close_timestamp = nowTimestamp(); body.close_staff_name = staffNames; body.close_selfie = selfieData;
      }
      const res = await fetch('/api/capture-attendance/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await res.json();
      if (result.success) {
        setMsg({ text: `Absensi ${actionType === 'open' ? 'OPEN' : 'CLOSE'} berhasil disimpan!`, type: 'success' });
        setStep('done'); await fetchTodayRecord(selectedStore);
      } else {
        setMsg({ text: result.error || 'Gagal menyimpan', type: 'error' }); setStep('init');
      }
    } catch { setMsg({ text: 'Terjadi kesalahan', type: 'error' }); setStep('init'); }
    finally { setLoading(false); }
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
    <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* KOLOM KIRI */}
      <div>
        
      {/* Store Selector */}
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
              <option value="">-- Pilih Toko --</option>
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
        <>
          {/* Today Status */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-3">Status Hari Ini</p>
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl p-3 border-2 transition-colors ${hasOpen ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${hasOpen ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${hasOpen ? 'text-green-700' : 'text-gray-400'}`}>OPEN</span>
                </div>
                {hasOpen ? (
                  <><p className="text-[11px] font-semibold text-gray-800">{formatTimestamp(todayRecord!.open_timestamp)}</p><p className="text-[10px] text-gray-500 mt-0.5">{todayRecord!.open_staff_name || '-'}</p></>
                ) : <p className="text-[11px] text-gray-400">Belum absen</p>}
              </div>
              <div className={`rounded-xl p-3 border-2 transition-colors ${hasClose ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${hasClose ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${hasClose ? 'text-blue-700' : 'text-gray-400'}`}>CLOSE</span>
                </div>
                {hasClose ? (
                  <><p className="text-[11px] font-semibold text-gray-800">{formatTimestamp(todayRecord!.close_timestamp)}</p><p className="text-[10px] text-gray-500 mt-0.5">{todayRecord!.close_staff_name || '-'}</p></>
                ) : <p className="text-[11px] text-gray-400">Belum absen</p>}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {step === 'init' && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => startAction('open')} disabled={!canOpen}
                className={`py-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all ${canOpen ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-200 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                <span>OPEN</span>
                {hasOpen && <span className="text-[9px] font-normal opacity-70">Sudah absen</span>}
              </button>
              <button onClick={() => startAction('close')} disabled={!canClose}
                className={`py-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 transition-all ${canClose ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-200 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                <span>CLOSE</span>
                {hasClose && <span className="text-[9px] font-normal opacity-70">Sudah absen</span>}
                {!hasOpen && !hasClose && <span className="text-[9px] font-normal opacity-70">Open dulu</span>}
                {hasOpen && !hasClose && !timeAllowsClose && storeDetail?.close_hours && (
                  <span className="text-[9px] font-normal opacity-70 text-center px-1">±1m dari {storeDetail.close_hours}</span>
                )}
              </button>
            </div>
          )}

          {/* Step: GPS */}
          {step === 'gps' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 text-center">
              {gpsStatus === 'loading' && <IconSignal className="w-10 h-10 text-primary mx-auto mb-3 animate-pulse" />}
              {gpsStatus === 'error' && <IconAlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />}
              {gpsStatus === 'ok' && <IconPin className="w-10 h-10 text-green-500 mx-auto mb-3" />}
              <p className="font-semibold text-gray-800 mb-1">
                {gpsStatus === 'loading' ? 'Mengambil lokasi GPS...' : gpsStatus === 'error' ? 'GPS Gagal' : 'Lokasi Didapat'}
              </p>
              {gpsStatus === 'loading' && <p className="text-[11px] text-gray-500">Harap izinkan akses lokasi saat diminta browser</p>}
              {gpsStatus === 'error' && (
                <><p className="text-[11px] text-red-500 mb-3">{gpsError}</p>
                <button onClick={reset} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm">Batal</button></>
              )}
              {gpsStatus === 'ok' && coords && (
                <><p className="text-[11px] text-gray-500 mb-2">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p><MapPreview lat={coords.lat} lng={coords.lng} /></>
              )}
            </div>
          )}

          {/* Step: Selfie */}
          {step === 'selfie' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 text-center">
              <IconCamera className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="font-semibold text-gray-800 mb-1">Ambil Selfie</p>
              <p className="text-[11px] text-gray-500 mb-4">Foto untuk konfirmasi kehadiran Anda</p>
              <button onClick={() => setShowCamera(true)} className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90">Buka Kamera</button>
              <button onClick={reset} className="block mx-auto mt-2 text-[11px] text-gray-400 hover:text-gray-600">Batal</button>
            </div>
          )}

          {/* Step: Taft */}
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
              <TaftSelector tafts={tafts} selected={currentSelectedTafts} onToggle={currentToggleTaft} label={`Staff ${actionType === 'open' ? 'OPEN' : 'CLOSE'} yang Hadir`} />
              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Batal</button>
                <button onClick={handleTaftNext} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90">Lanjut</button>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
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

          {/* Step: Done */}
          {step === 'done' && msg?.type === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-4 text-center">
              <IconCheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-green-800 mb-1">Berhasil!</p>
              <p className="text-[12px] text-green-700 mb-4">{msg.text}</p>
              <button onClick={reset} className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">Selesai</button>
            </div>
          )}

          {/* Error */}
          {msg?.type === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-center">
              <IconAlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700 text-sm font-semibold mb-1">Gagal</p>
              <p className="text-red-600 text-[12px]">{msg.text}</p>
            </div>
          )}

          {/* Today's selfie previews */}
          {todayRecord && (isValidSelfie(todayRecord.open_selfie) || isValidSelfie(todayRecord.close_selfie)) && step === 'init' && (
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
        </>
      )}

      {!selectedStore && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-12 text-center">
          <p className="text-gray-500 text-sm">Pilih toko untuk mulai absensi</p>
          </div>
        )}
      </div>

    </div>
      {showCamera && <SelfieCapture onCapture={handleSelfieCapture} onCancel={() => setShowCamera(false)} />}
    </div>
  );
}

// ─── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab({ user, isStoreUser, myStoreName, isAll }: { user: any; isStoreUser: boolean; myStoreName: string; isAll: boolean }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stores, setStores] = useState<StoreEntry[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/capture-attendance/meta?type=store_list')
      .then(r => r.json())
      .then((data: StoreEntry[]) => {
        setStores(data);
        if (isStoreUser && myStoreName) setSelectedStore(myStoreName);
      });
  }, [isStoreUser, myStoreName]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const storeParam = selectedStore ? `&store_name=${encodeURIComponent(selectedStore)}` : '';
      const res = await fetch(`/api/capture-attendance/capture?${storeParam}&date=${selectedDate}${isAll ? '&all=true' : ''}`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [selectedStore, selectedDate, isAll]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Column widths (px) ──
  const W_NO    = 32;
  const W_TOKO  = 110;
  const W_STAFF = 120;
  const W_FOTO  = 50;
  const W_JAM   = 60;
  // Admin-only extra columns
  const W_DEV   = 105;
  const W_BROW  = 80;
  const W_IP    = 115;
  const W_VALID = 60;
  const W_LAT   = 95;
  const W_LNG   = 95;
  const W_PETA  = 48;

  const baseCols = `${W_NO}px ${W_TOKO}px ${W_STAFF}px ${W_FOTO}px ${W_JAM}px ${W_STAFF}px ${W_FOTO}px ${W_JAM}px`;
  const adminCols = isAll
    ? ` ${W_DEV}px ${W_BROW}px ${W_IP}px ${W_VALID}px ${W_LAT}px ${W_LNG}px ${W_PETA}px ${W_PETA}px`
    : '';
  const gridCols = baseCols + adminCols;

  const baseMinW = W_NO + W_TOKO + W_STAFF + W_FOTO + W_JAM + W_STAFF + W_FOTO + W_JAM;
  const adminMinW = isAll ? W_DEV + W_BROW + W_IP + W_VALID + W_LAT + W_LNG + W_PETA + W_PETA : 0;
  const minWidth = baseMinW + adminMinW;

  return (
    // ⬇ -mx-6 + px-6 makes the section break out of the parent p-6 padding
    // so the table card can truly go edge-to-edge
    <div className="-mx-6">
      {/* Filter bar */}
      <div className="mx-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Toko filter — always visible */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Toko</label>
            {isStoreUser ? (
              <span className="px-2 py-1 bg-gray-100 rounded-lg text-[11px] font-medium text-gray-700 capitalize">{myStoreName}</span>
            ) : (
              <select
                value={selectedStore}
                onChange={e => setSelectedStore(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              >
                <option value="">Semua Toko</option>
                {stores.map(s => (
                  <option key={s.id} value={s.store_name}>{s.store_name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Tanggal</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            />
          </div>

          <button
            onClick={fetchHistory}
            className="px-3 py-1 bg-primary text-white rounded-lg text-[11px] font-medium hover:bg-primary/90"
          >
            Cari
          </button>

          {records.length > 0 && (
            <span className="ml-auto text-[11px] text-gray-400">{records.length} data</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Memuat data...</div>
      ) : records.length === 0 ? (
        <div className="mx-6 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-12 text-center">
          <p className="text-gray-500 text-sm">Tidak ada data absensi</p>
        </div>
      ) : (
        /* Table — full width edge-to-edge, scroll horizontally when needed */
        <div className="bg-white border-y border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="w-max min-w-full">

              {/* ── HEADER ROW 1 — group labels ── */}
              <div
                className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-10"
                style={{ gridTemplateColumns: gridCols }}
              >
                {/* # + Toko */}
                <div className="col-span-2 border-r border-gray-200" />

                {/* OPEN group */}
                <div className="col-span-3 border-r border-gray-200 bg-gray-100">
                  <div className="px-2 py-1 text-center">
                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">OPEN</span>
                  </div>
                </div>

                {/* CLOSE group */}
                <div className={`col-span-3 bg-gray-50 ${isAll ? 'border-r border-gray-200' : ''}`}>
                  <div className="px-2 py-1 text-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">CLOSE</span>
                  </div>
                </div>

                {/* Admin extra */}
                {isAll && (
                  <div className="col-span-8 bg-gray-50">
                    <div className="px-2 py-1 text-center">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Info Teknis</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── HEADER ROW 2 — column labels ── */}
              <div
                className="grid bg-gray-50 border-b border-gray-200 sticky top-[25px] z-10"
                style={{ gridTemplateColumns: gridCols }}
              >
                <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center border-r border-gray-200">#</div>
                <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Toko</div>
                {/* OPEN sub-headers */}
                <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-wide bg-gray-100 border-r border-gray-200">Staff</div>
                <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-wide text-center bg-gray-100 border-r border-gray-200">Foto</div>
                <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-wide text-center bg-gray-100 border-r border-gray-200">Jam</div>
                {/* CLOSE sub-headers */}
                <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Staff</div>
                <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide text-center border-r border-gray-200">Foto</div>
                <div className={`px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide text-center ${isAll ? 'border-r border-gray-200' : ''}`}>Jam</div>
                {/* Admin extra sub-headers */}
                {isAll && (
                  <>
                    <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200">Device</div>
                    <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200">Browser</div>
                    <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200">IP</div>
                    <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center border-r border-gray-200">Valid</div>
                    <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200">Lat Open</div>
                    <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-200">Lng Open</div>
                    <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center border-r border-gray-200">Peta O</div>
                    <div className="px-2 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center">Peta C</div>
                  </>
                )}
              </div>

              {/* ── DATA ROWS ── */}
              <div>
                {records.map((rec, idx) => {
                  const isExpanded = expandedId === rec.id;
                  const openProxyUrl  = isValidSelfie(rec.open_selfie)  ? toDriveProxyUrl(rec.open_selfie)  : '';
                  const closeProxyUrl = isValidSelfie(rec.close_selfie) ? toDriveProxyUrl(rec.close_selfie) : '';
                  const openStaff  = rec.open_staff_name?.trim()  || '';
                  const closeStaff = rec.close_staff_name?.trim() || '';
                  const isValid =
                    rec.is_valid_location === 'TRUE' ||
                    rec.is_valid_location === 'true' ||
                    rec.is_valid_location === '1';

                  return (
                    <div key={rec.id} className="border-b border-gray-100 last:border-b-0">
                      {/* Main data row */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                        className={`w-full grid text-left transition-colors items-center ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/70'}`}
                        style={{ gridTemplateColumns: gridCols }}
                      >
                        {/* # */}
                        <div className="px-2 py-2.5 text-[10px] text-gray-400 text-center border-r border-gray-200">
                          {idx + 1}
                        </div>

                        {/* Toko */}
                        <div className="px-2 py-2.5 border-r border-gray-200">
                          <p className="text-[11px] font-semibold text-gray-800 capitalize truncate">{rec.store_name}</p>
                        </div>

                        {/* OPEN — Staff */}
                        <div className="px-2 py-2.5 border-r border-gray-200 bg-gray-50/60">
                          <p className="text-[10px] text-gray-700 truncate leading-tight" style={{ maxWidth: W_STAFF - 16 }}>
                            {openStaff || <span className="text-gray-300">—</span>}
                          </p>
                        </div>

                        {/* OPEN — Foto */}
                        <div className="px-1 py-1.5 flex justify-center border-r border-gray-200 bg-gray-50/60">
                          {openProxyUrl ? (
                            <LazyImg
                              src={openProxyUrl}
                              alt="foto open"
                              className="rounded overflow-hidden border border-gray-200 bg-gray-100"
                              style={{ width: 36, height: 36 }}
                              fallback={<SelfiePlaceholderSm />}
                            />
                          ) : <SelfiePlaceholderSm />}
                        </div>

                        {/* OPEN — Jam */}
                        <div className="px-2 py-2.5 border-r border-gray-200 bg-gray-50/60">
                          {rec.open_timestamp
                            ? <p className="text-[10px] font-semibold text-gray-700 whitespace-nowrap">{extractTime(rec.open_timestamp)}</p>
                            : <p className="text-[10px] text-gray-300">—</p>
                          }
                        </div>

                        {/* CLOSE — Staff */}
                        <div className="px-2 py-2.5 border-r border-gray-200">
                          <p className="text-[10px] text-gray-700 truncate leading-tight" style={{ maxWidth: W_STAFF - 16 }}>
                            {closeStaff || <span className="text-gray-300">—</span>}
                          </p>
                        </div>

                        {/* CLOSE — Foto */}
                        <div className="px-1 py-1.5 flex justify-center border-r border-gray-200">
                          {closeProxyUrl ? (
                            <LazyImg
                              src={closeProxyUrl}
                              alt="foto close"
                              className="rounded overflow-hidden border border-gray-200 bg-gray-100"
                              style={{ width: 36, height: 36 }}
                              fallback={<SelfiePlaceholderSm />}
                            />
                          ) : <SelfiePlaceholderSm />}
                        </div>

                        {/* CLOSE — Jam */}
                        <div className={`px-2 py-2.5 ${isAll ? 'border-r border-gray-200' : ''}`}>
                          {rec.close_timestamp
                            ? <p className="text-[10px] font-semibold text-gray-600 whitespace-nowrap">{extractTime(rec.close_timestamp)}</p>
                            : <p className="text-[10px] text-gray-300">—</p>
                          }
                        </div>

                        {/* Admin extra columns */}
                        {isAll && (
                          <>
                            {/* Device */}
                            <div className="px-2 py-2.5 border-r border-gray-200">
                              <p className="text-[10px] text-gray-600 truncate">{rec.device_info || '—'}</p>
                            </div>

                            {/* Browser */}
                            <div className="px-2 py-2.5 border-r border-gray-200">
                              <p className="text-[10px] text-gray-600 truncate">{rec.browser || '—'}</p>
                            </div>

                            {/* IP */}
                            <div className="px-2 py-2.5 border-r border-gray-200">
                              <p className="text-[10px] text-gray-600 font-mono truncate">{rec.ip_address || '—'}</p>
                            </div>

                            {/* Valid Lokasi */}
                            <div className="px-2 py-2.5 flex justify-center border-r border-gray-200">
                              {isValid
                                ? <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300">
                                    <IconCheck className="w-2.5 h-2.5" /> Ya
                                  </span>
                                : <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                    <IconX className="w-2.5 h-2.5" /> Tidak
                                  </span>
                              }
                            </div>

                            {/* Lat Open */}
                            <div className="px-2 py-2.5 border-r border-gray-200">
                              <p className="text-[10px] text-gray-600 font-mono truncate">{rec.open_latitude || '—'}</p>
                            </div>

                            {/* Lng Open */}
                            <div className="px-2 py-2.5 border-r border-gray-200">
                              <p className="text-[10px] text-gray-600 font-mono truncate">{rec.open_longitude || '—'}</p>
                            </div>

                            {/* Peta Open */}
                            <div className="px-2 py-2.5 flex justify-center border-r border-gray-200">
                              {rec.open_maps_url
                                ? <a href={rec.open_maps_url} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-gray-500 hover:text-gray-800">
                                    <IconPin className="w-3.5 h-3.5" />
                                  </a>
                                : <span className="text-gray-200"><IconPin className="w-3.5 h-3.5" /></span>
                              }
                            </div>

                            {/* Peta Close */}
                            <div className="px-2 py-2.5 flex justify-center">
                              {rec.close_maps_url
                                ? <a href={rec.close_maps_url} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-gray-500 hover:text-gray-800">
                                    <IconPin className="w-3.5 h-3.5" />
                                  </a>
                                : <span className="text-gray-200"><IconPin className="w-3.5 h-3.5" /></span>
                              }
                            </div>
                          </>
                        )}
                      </button>

                      {/* ── Expanded photo detail ── */}
                      {isExpanded && (
                        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
                          <div className="grid grid-cols-2 gap-6 max-w-md">
                            {/* OPEN detail */}
                            <div>
                              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">OPEN</p>
                              {openProxyUrl ? (
                                <img src={openProxyUrl} alt="open" className="w-full rounded-lg object-cover mb-2 border border-gray-200" style={{ aspectRatio: '4/3' }} />
                              ) : <SelfiePlaceholderMd />}
                              <p className="text-[10px] text-gray-500">
                                <span className="text-gray-400">Staff: </span>
                                <span className="font-medium text-gray-700">{openStaff || <span className="italic text-gray-300">tidak diisi</span>}</span>
                              </p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                <span className="text-gray-400">Waktu: </span>
                                <span className="font-medium text-gray-700">{rec.open_timestamp || '-'}</span>
                              </p>
                              {rec.open_maps_url && (
                                <a href={rec.open_maps_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 hover:underline mt-1">
                                  <IconPin className="w-3 h-3" /> Lihat Peta
                                </a>
                              )}
                            </div>
                            {/* CLOSE detail */}
                            <div>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">CLOSE</p>
                              {closeProxyUrl ? (
                                <img src={closeProxyUrl} alt="close" className="w-full rounded-lg object-cover mb-2 border border-gray-200" style={{ aspectRatio: '4/3' }} />
                              ) : <SelfiePlaceholderMd />}
                              <p className="text-[10px] text-gray-500">
                                <span className="text-gray-400">Staff: </span>
                                <span className="font-medium text-gray-700">{closeStaff || <span className="italic text-gray-300">tidak diisi</span>}</span>
                              </p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                <span className="text-gray-400">Waktu: </span>
                                <span className="font-medium text-gray-700">{rec.close_timestamp || '-'}</span>
                              </p>
                              {rec.close_maps_url && (
                                <a href={rec.close_maps_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 hover:underline mt-1">
                                  <IconPin className="w-3 h-3" /> Lihat Peta
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Admin-only extra info (expanded) */}
                          {isAll && (
                            <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-3 gap-x-6 gap-y-1 text-[10px] text-gray-600">
                              <div><span className="text-gray-400">Device: </span><span className="font-medium">{rec.device_info || '-'}</span></div>
                              <div><span className="text-gray-400">Browser: </span><span className="font-medium">{rec.browser || '-'}</span></div>
                              <div><span className="text-gray-400">IP: </span><span className="font-medium font-mono">{rec.ip_address || '-'}</span></div>
                              <div>
                                <span className="text-gray-400">Valid Lokasi: </span>
                                <span className={`font-semibold ${isValid ? 'text-gray-700' : 'text-gray-400'}`}>
                                  {isValid ? 'Ya' : 'Tidak'}
                                </span>
                              </div>
                              <div><span className="text-gray-400">Lat Open: </span><span className="font-medium font-mono">{rec.open_latitude || '-'}</span></div>
                              <div><span className="text-gray-400">Lng Open: </span><span className="font-medium font-mono">{rec.open_longitude || '-'}</span></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}