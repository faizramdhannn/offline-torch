"use client";

import {
  Store,
  Signal,
  MapPin,
  AlertCircle,
  Camera,
  CheckCircle2,
  LogIn,
  LogOut,
  Loader2,
} from "lucide-react";
import { ActionType, AttendanceRecord, AttendanceStep, StoreDetail, TaftEntry } from "./types";
import { isValidSelfie, toDriveProxyUrl, nowTimestamp } from "./helpers";
import { LazyImg } from "./LazyImg";
import { MapPreview } from "./MapPreview";
import { TaftSelector } from "./TaftSelector";
import { Button } from "@/components/shared/Button";

interface CaptureTabProps {
  isStoreUser: boolean;
  myStoreName: string;
  stores: StoreDetail[];
  selectedStore: string;
  setSelectedStore: (v: string) => void;
  storeDetail: StoreDetail | null;
  todayRecord: AttendanceRecord | null;
  step: AttendanceStep;
  actionType: ActionType;
  gpsStatus: "idle" | "loading" | "ok" | "error";
  gpsError: string;
  coords: { lat: number; lng: number } | null;
  selfieData: string | null;
  tafts: TaftEntry[];
  currentSelectedTafts: string[];
  currentToggleTaft: (name: string) => void;
  loading: boolean;
  msg: { text: string; type: "success" | "error"; distanceMeters?: number | null } | null;
  hasOpen: boolean;
  hasClose: boolean;
  canOpen: boolean;
  canClose: boolean;
  timeAllowsClose: boolean;
  onStartAction: (type: ActionType) => void;
  onOpenCamera: () => void;
  onReset: () => void;
  onTaftNext: () => void;
  onBackToTaft: () => void;
  onSubmit: () => void;
}

export function CaptureTab({
  isStoreUser,
  myStoreName,
  stores,
  selectedStore,
  setSelectedStore,
  storeDetail,
  todayRecord,
  step,
  actionType,
  gpsStatus,
  gpsError,
  coords,
  selfieData,
  tafts,
  currentSelectedTafts,
  currentToggleTaft,
  loading,
  msg,
  hasOpen,
  hasClose,
  canOpen,
  canClose,
  timeAllowsClose,
  onStartAction,
  onOpenCamera,
  onReset,
  onTaftNext,
  onBackToTaft,
  onSubmit,
}: CaptureTabProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {/* KOLOM KIRI */}
      <div>
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {isStoreUser ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Store className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Toko Anda</p>
                <p className="text-sm font-bold capitalize text-gray-900">{myStoreName}</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Pilih Toko
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Pilih Toko</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.store_name}>
                    {s.store_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {storeDetail && (storeDetail.open_hours || storeDetail.close_hours) && (
            <div className="mt-3 flex gap-4 border-t border-gray-100 pt-3">
              {storeDetail.open_hours && (
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-gray-500">
                    Buka: <span className="font-semibold text-gray-700">{storeDetail.open_hours}</span>
                  </span>
                </div>
              )}
              {storeDetail.close_hours && (
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-gray-500">
                    Tutup: <span className="font-semibold text-gray-700">{storeDetail.close_hours}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedStore && (
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-gray-500">Status Hari Ini</p>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`rounded-xl border-2 p-3 transition-colors ${
                  hasOpen ? "border-green-400 bg-green-50" : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${hasOpen ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${hasOpen ? "text-green-700" : "text-gray-400"}`}>
                    Open
                  </span>
                </div>
                {hasOpen ? (
                  <>
                    <p className="text-[11px] font-semibold text-gray-800">{todayRecord!.open_timestamp}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{todayRecord!.open_staff_name || "-"}</p>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-400">Belum absen</p>
                )}
              </div>
              <div
                className={`rounded-xl border-2 p-3 transition-colors ${
                  hasClose ? "border-blue-400 bg-blue-50" : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${hasClose ? "bg-blue-500" : "bg-gray-300"}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${hasClose ? "text-blue-700" : "text-gray-400"}`}>
                    Close
                  </span>
                </div>
                {hasClose ? (
                  <>
                    <p className="text-[11px] font-semibold text-gray-800">{todayRecord!.close_timestamp}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{todayRecord!.close_staff_name || "-"}</p>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-400">Belum absen</p>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedStore &&
          todayRecord &&
          (isValidSelfie(todayRecord.open_selfie) || isValidSelfie(todayRecord.close_selfie)) &&
          step === "init" && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-gray-500">Foto Hari Ini</p>
              <div className="grid grid-cols-2 gap-3">
                {isValidSelfie(todayRecord.open_selfie) && (
                  <div>
                    <p className="mb-1 text-[10px] font-bold text-green-600">Open</p>
                    <LazyImg
                      src={toDriveProxyUrl(todayRecord.open_selfie)}
                      alt="open selfie"
                      className="w-full overflow-hidden rounded-xl"
                      style={{ aspectRatio: "4/3" }}
                    />
                  </div>
                )}
                {isValidSelfie(todayRecord.close_selfie) && (
                  <div>
                    <p className="mb-1 text-[10px] font-bold text-blue-600">Close</p>
                    <LazyImg
                      src={toDriveProxyUrl(todayRecord.close_selfie)}
                      alt="close selfie"
                      className="w-full overflow-hidden rounded-xl"
                      style={{ aspectRatio: "4/3" }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

        {!selectedStore && (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-12 text-center shadow-sm">
            <p className="text-sm text-gray-500">Pilih toko untuk mulai absensi</p>
          </div>
        )}
      </div>

      {/* KOLOM KANAN */}
      {selectedStore && (
        <div>
          {step === "init" && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => onStartAction("open")}
                disabled={!canOpen}
                className={`flex flex-col items-center gap-2 rounded-2xl py-5 text-sm font-bold transition-all ${
                  canOpen
                    ? "bg-green-500 text-white shadow-lg shadow-green-200 hover:bg-green-600 active:scale-95"
                    : "cursor-not-allowed bg-gray-100 text-gray-400"
                }`}
              >
                <LogIn className="h-5 w-5" />
                <span>OPEN</span>
                {hasOpen && <span className="text-[9px] font-normal opacity-70">Sudah absen</span>}
              </button>
              <button
                onClick={() => onStartAction("close")}
                disabled={!canClose}
                className={`flex flex-col items-center gap-2 rounded-2xl py-5 text-sm font-bold transition-all ${
                  canClose
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-200 hover:bg-blue-600 active:scale-95"
                    : "cursor-not-allowed bg-gray-100 text-gray-400"
                }`}
              >
                <LogOut className="h-5 w-5" />
                <span>CLOSE</span>
                {hasClose && <span className="text-[9px] font-normal opacity-70">Sudah absen</span>}
                {!hasOpen && !hasClose && <span className="text-[9px] font-normal opacity-70">Open dulu</span>}
                {hasOpen && !hasClose && !timeAllowsClose && storeDetail?.close_hours && (
                  <span className="px-1 text-center text-[9px] font-normal opacity-70">
                    5m sebelum - 2j sesudah {storeDetail.close_hours}
                  </span>
                )}
              </button>
            </div>
          )}

          {step === "gps" && (
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              {gpsStatus === "loading" && <Signal className="mx-auto mb-3 h-10 w-10 animate-pulse text-primary" />}
              {gpsStatus === "error" && <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />}
              {gpsStatus === "ok" && <MapPin className="mx-auto mb-3 h-10 w-10 text-green-500" />}
              <p className="mb-1 font-semibold text-gray-800">
                {gpsStatus === "loading" ? "Mengambil lokasi GPS..." : gpsStatus === "error" ? "GPS Gagal" : "Lokasi Didapat"}
              </p>
              {gpsStatus === "loading" && <p className="text-[11px] text-gray-500">Harap izinkan akses lokasi</p>}
              {gpsStatus === "error" && (
                <>
                  <p className="mb-3 text-[11px] text-red-500">{gpsError}</p>
                  <button onClick={onReset} className="rounded-xl bg-gray-200 px-4 py-2 text-sm text-gray-700">
                    Batal
                  </button>
                </>
              )}
              {gpsStatus === "ok" && coords && (
                <>
                  <p className="mb-2 text-[11px] text-gray-500">
                    {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </p>
                  <MapPreview lat={coords.lat} lng={coords.lng} />
                </>
              )}
            </div>
          )}

          {step === "selfie" && (
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <Camera className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="mb-1 font-semibold text-gray-800">Ambil Selfie</p>
              <p className="mb-4 text-[11px] text-gray-500">Foto untuk konfirmasi kehadiran</p>
              <button
                onClick={onOpenCamera}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Buka Kamera
              </button>
              <button onClick={onReset} className="mx-auto mt-2 block text-[11px] text-gray-400 hover:text-gray-600">
                Batal
              </button>
            </div>
          )}

          {step === "taft" && (
            <div className="mb-4">
              {selfieData && (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  <img src={selfieData} alt="selfie" className="h-12 w-12 rounded-xl object-cover" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-700">Foto berhasil diambil</p>
                    <p className="text-[10px] text-gray-400">Lanjut pilih staff yang hadir</p>
                  </div>
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-500" />
                </div>
              )}
              <TaftSelector
                tafts={tafts}
                selected={currentSelectedTafts}
                onToggle={currentToggleTaft}
                label={`Staff ${actionType === "open" ? "OPEN" : "CLOSE"} yang Hadir`}
              />
              <div className="flex gap-2">
                <button onClick={onReset} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700">
                  Batal
                </button>
                <button
                  onClick={onTaftNext}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90"
                >
                  Lanjut
                </button>
              </div>
            </div>
          )}

          {step === "confirm" && coords && selfieData && (
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-bold text-gray-800">
                Konfirmasi Absensi {actionType === "open" ? "OPEN" : "CLOSE"}
              </p>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[10px] text-gray-500">Foto Selfie</p>
                  <img src={selfieData} alt="selfie" className="w-full rounded-xl object-cover" style={{ aspectRatio: "4/3" }} />
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-gray-500">Lokasi</p>
                  <MapPreview lat={coords.lat} lng={coords.lng} />
                  <p className="mt-1 text-[9px] text-gray-400">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </p>
                </div>
              </div>
              <div className="mb-3 space-y-1 rounded-xl bg-gray-50 p-3 text-[11px] text-gray-600">
                <div className="flex justify-between">
                  <span>Toko</span>
                  <span className="font-medium capitalize">{selectedStore}</span>
                </div>
                <div className="flex justify-between">
                  <span>Waktu</span>
                  <span className="font-medium">{nowTimestamp()}</span>
                </div>
                {currentSelectedTafts.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0">Staff</span>
                    <span className="text-right font-medium text-primary">{currentSelectedTafts.join("; ")}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onBackToTaft}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700"
                >
                  Kembali
                </button>
                <button
                  onClick={onSubmit}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Menyimpan..." : "Simpan Absensi"}
                </button>
              </div>
            </div>
          )}

          {step === "done" && msg?.type === "success" && (
            <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-green-600" />
              <p className="mb-1 font-bold text-green-800">Berhasil!</p>
              <p className="mb-2 text-[12px] text-green-700">{msg.text}</p>
              {actionType === "close" && msg.distanceMeters !== null && msg.distanceMeters !== undefined && (
                <div
                  className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    msg.distanceMeters <= 200 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  <MapPin className="h-3 w-3" />
                  Jarak open–close: {msg.distanceMeters} m
                  {msg.distanceMeters <= 200 ? " · Valid" : " · Terlalu jauh"}
                </div>
              )}
              <Button onClick={onReset} variant="primary" className="mx-auto block">
                Selesai
              </Button>
            </div>
          )}

          {msg?.type === "error" && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <p className="mb-1 text-sm font-semibold text-red-700">Gagal</p>
              <p className="text-[12px] text-red-600">{msg.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}