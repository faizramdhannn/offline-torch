"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, Check, AlertCircle, RefreshCw, Aperture } from "lucide-react";

const TIMER_OPTIONS = [0, 3, 5, 10] as const;
type TimerOption = (typeof TIMER_OPTIONS)[number];

export function SelfieCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [timerOption, setTimerOption] = useState<TimerOption>(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [flash, setFlash] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
      clearCountdown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async (mode: "user" | "environment" = "user") => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setError("Tidak bisa mengakses kamera. Pastikan izin kamera diberikan.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const clearCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const switchCamera = async () => {
    if (countdown !== null) return;
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    await startCamera(newMode);
  };

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  };

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Kamera belum siap, coba ulangi.");
      setCountdown(null);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (!dataUrl || dataUrl === "data:," || dataUrl.length < 1000) {
      setError("Gagal mengambil foto, coba ulangi.");
      setCountdown(null);
      return;
    }
    setPreview(dataUrl);
    setCountdown(null);
    stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const capturePhoto = () => {
    clearCountdown();
    if (timerOption === 0) {
      doCapture();
      return;
    }
    setCountdown(timerOption);
    let remaining = timerOption;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (facingMode === "environment") triggerFlash();
      if (remaining <= 0) {
        clearCountdown();
        setCountdown(null);
        doCapture();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    clearCountdown();
    setCountdown(null);
  };
  const retake = () => {
    setPreview(null);
    setCountdown(null);
    setError("");
    startCamera(facingMode);
  };
  const confirm = () => {
    if (preview) onCapture(preview);
  };
  const close = () => {
    clearCountdown();
    stopCamera();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4">
      <div className="w-full overflow-hidden rounded-2xl bg-gray-900 shadow-2xl" style={{ maxWidth: 680 }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Camera className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Ambil Selfie</p>
              <p className="text-[11px] text-gray-400">Posisikan wajah di dalam bingkai</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!preview && !error && (
              <button
                onClick={switchCamera}
                disabled={countdown !== null}
                title={facingMode === "user" ? "Ganti ke kamera belakang" : "Ganti ke kamera depan"}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/60 text-gray-400 transition-colors hover:bg-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/60 text-gray-400 transition-colors hover:bg-gray-600 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Timer selector */}
        {!preview && !error && (
          <div className="flex items-center gap-2 border-b border-gray-700/40 px-5 py-2.5">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">Timer</span>
            <div className="flex gap-1.5">
              {TIMER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (countdown !== null) return;
                    setTimerOption(opt);
                  }}
                  disabled={countdown !== null}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                    timerOption === opt ? "bg-primary text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {opt === 0 ? "OFF" : `${opt}s`}
                </button>
              ))}
            </div>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-500">
              <Aperture className="h-3 w-3" />
              {facingMode === "user" ? "Depan" : "Belakang"}
            </span>
          </div>
        )}

        {/* Viewfinder */}
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {flash && <div className="pointer-events-none absolute inset-0 z-20 bg-white" style={{ opacity: 0.85 }} />}

          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <p className="mb-1 text-sm font-medium text-red-400">Kamera tidak tersedia</p>
                <p className="text-xs text-gray-500">{error}</p>
                <button onClick={retake} className="mt-4 rounded-xl bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600">
                  Coba Lagi
                </button>
              </div>
            </div>
          ) : preview ? (
            <img src={preview} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          )}

          {!preview && !error && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative" style={{ width: "45%", aspectRatio: "3/4" }}>
                  <div className="absolute inset-0 rounded-full border border-white/20" />
                  <div className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-white" />
                  <div className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-white" />
                  <div className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-white" />
                  <div className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-white" />
                </div>
              </div>
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/30 bg-black/50 backdrop-blur-sm">
                    <span className="font-bold text-white" style={{ fontSize: 52, lineHeight: 1 }}>
                      {countdown}
                    </span>
                  </div>
                </div>
              )}
              {countdown === null && (
                <div className="absolute left-4 top-4 flex items-center gap-1.5">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white">Live</span>
                </div>
              )}
            </div>
          )}

          {preview && (
            <div className="absolute right-4 top-4">
              <div className="flex items-center gap-1.5 rounded-full bg-green-500/90 px-2.5 py-1 backdrop-blur-sm">
                <Check className="h-3 w-3 text-white" />
                <span className="text-[10px] font-semibold text-white">Preview</span>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Actions */}
        <div className="flex gap-3 border-t border-gray-700/60 px-5 py-4">
          {!preview ? (
            countdown !== null ? (
              <button
                onClick={cancelCountdown}
                className="flex-1 rounded-xl bg-red-600/80 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Batalkan ({countdown}s)
              </button>
            ) : (
              <>
                <button
                  onClick={close}
                  className="rounded-xl bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  onClick={capturePhoto}
                  disabled={!!error}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  <Camera className="h-4 w-4" />
                  {timerOption === 0 ? "Ambil Foto" : `Foto dalam ${timerOption}s`}
                </button>
              </>
            )
          ) : (
            <>
              <button
                onClick={retake}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-600"
              >
                <RefreshCw className="h-4 w-4" />
                Ulangi
              </button>
              <button
                onClick={confirm}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-600"
              >
                <Check className="h-4 w-4" /> Gunakan Foto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}