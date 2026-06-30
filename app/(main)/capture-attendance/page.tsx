"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { AttendanceRecord, StoreEntry, StoreDetail, TaftEntry, AttendanceStep, ActionType, AttendanceTab as AttendanceTabKey } from "@/components/capture-attendance/types";
import {
  getBrowserName,
  getDeviceInfo,
  getPublicIP,
  buildMapsUrl,
  nowTimestamp,
  isCloseWindowActive,
  todayISO,
} from "@/components/capture-attendance/helpers";
import { AttendanceTabs } from "@/components/capture-attendance/AttendanceTabs";
import { CaptureTab } from "@/components/capture-attendance/CaptureTab";
import { HistoryTab } from "@/components/capture-attendance/HistoryTab";
import { SelfieCapture } from "@/components/capture-attendance/SelfieCapture";

export default function CaptureAttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isStoreUser, setIsStoreUser] = useState(false);
  const [myStoreName, setMyStoreName] = useState("");
  useSessionGuard();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(userData);
    if (!parsed.attendance_store && !parsed.attendance_store_all) {
      router.push("/dashboard");
      return;
    }
    setUser(parsed);
    fetch("/api/capture-attendance/meta?type=store_list")
      .then((r) => r.json())
      .then((stores: StoreEntry[]) => {
        const match = stores.find((s) => s.store_name?.toLowerCase() === parsed.user_name?.toLowerCase());
        if (match) {
          setIsStoreUser(true);
          setMyStoreName(match.store_name);
        }
      });
  }, []);

  if (!user) return null;
  const isAll = !!user.attendance_store_all;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold text-primary">Capture Attendance</h1>
        <CaptureAttendanceContent isStoreUser={isStoreUser} myStoreName={myStoreName} isAll={isAll} />
      </div>
    </div>
  );
}

function CaptureAttendanceContent({
  isStoreUser,
  myStoreName,
  isAll,
}: {
  isStoreUser: boolean;
  myStoreName: string;
  isAll: boolean;
}) {
  const [activeTab, setActiveTab] = useState<AttendanceTabKey>("capture");

  const [stores, setStores] = useState<StoreDetail[]>([]);
  const [storeList, setStoreList] = useState<StoreEntry[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [storeDetail, setStoreDetail] = useState<StoreDetail | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error"; distanceMeters?: number | null } | null>(null);
  const [tafts, setTafts] = useState<TaftEntry[]>([]);
  const [selectedOpenTafts, setSelectedOpenTafts] = useState<string[]>([]);
  const [selectedCloseTafts, setSelectedCloseTafts] = useState<string[]>([]);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [step, setStep] = useState<AttendanceStep>("init");
  const [actionType, setActionType] = useState<ActionType>("open");

  // History state
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [historyStore, setHistoryStore] = useState("");
  const [historyDate, setHistoryDate] = useState(() => todayISO());
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetch("/api/capture-attendance/meta?type=store_list")
      .then((r) => r.json())
      .then((data: StoreDetail[]) => {
        setStores(data);
        setStoreList(data.map((s) => ({ id: s.id, store_name: s.store_name })));
        if (isStoreUser && myStoreName) {
          setSelectedStore(myStoreName);
          setHistoryStore(myStoreName);
          setStoreDetail(data.find((s) => s.store_name?.toLowerCase() === myStoreName.toLowerCase()) || null);
        }
      });
  }, [isStoreUser, myStoreName]);

  useEffect(() => {
    if (selectedStore && stores.length > 0) {
      setStoreDetail(stores.find((s) => s.store_name?.toLowerCase() === selectedStore.toLowerCase()) || null);
    } else {
      setStoreDetail(null);
    }
  }, [selectedStore, stores]);

  const fetchTodayRecord = useCallback(
    async (store: string) => {
      if (!store) {
        setTodayRecord(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/capture-attendance/capture?store_name=${encodeURIComponent(store)}&date=${todayISO()}${isAll ? "&all=true" : ""}`
        );
        const data = await res.json();
        setTodayRecord(Array.isArray(data) && data.length > 0 ? data[0] : null);
      } catch {
        setTodayRecord(null);
      }
    },
    [isAll]
  );

  const fetchHistory = useCallback(
    async (store: string, date: string) => {
      setHistoryLoading(true);
      try {
        const effectiveStore = isAll ? store : myStoreName;
        const storeParam = effectiveStore ? `&store_name=${encodeURIComponent(effectiveStore)}` : "";
        const res = await fetch(`/api/capture-attendance/capture?${storeParam}&date=${date}${isAll ? "&all=true" : ""}`);
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : []);
      } catch {
        setRecords([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [isAll, myStoreName]
  );

  useEffect(() => {
    if (selectedStore) {
      fetchTodayRecord(selectedStore);
      fetch(`/api/capture-attendance/meta?type=taft_list&store_name=${encodeURIComponent(selectedStore)}`)
        .then((r) => r.json())
        .then((data: TaftEntry[]) => setTafts(data || []));
    } else {
      setTodayRecord(null);
      setTafts([]);
    }
    setStep("init");
    setSelfieData(null);
    setCoords(null);
    setGpsStatus("idle");
    setSelectedOpenTafts([]);
    setSelectedCloseTafts([]);
  }, [selectedStore, fetchTodayRecord]);

  useEffect(() => {
    if (isStoreUser && myStoreName) fetchHistory(myStoreName, historyDate);
    else if (isAll) fetchHistory(historyStore, historyDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStoreUser, myStoreName]);

  const toggleOpenTaft = (name: string) =>
    setSelectedOpenTafts((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  const toggleCloseTaft = (name: string) =>
    setSelectedCloseTafts((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const getGPS = async (): Promise<{ lat: number; lng: number } | null> => {
    setGpsStatus("loading");
    setGpsError("");
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsStatus("error");
        setGpsError("Browser tidak mendukung GPS");
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setGpsStatus("ok");
          resolve(c);
        },
        (err) => {
          setGpsStatus("error");
          setGpsError(err.message || "Gagal mendapatkan lokasi");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  const startAction = async (type: ActionType) => {
    setActionType(type);
    setSelfieData(null);
    setCoords(null);
    setGpsStatus("idle");
    if (type === "open") setSelectedOpenTafts([]);
    else setSelectedCloseTafts([]);
    setStep("gps");
    const c = await getGPS();
    if (!c) return;
    setStep("selfie");
  };

  const handleSelfieCapture = (dataUrl: string) => {
    setSelfieData(dataUrl);
    setShowCamera(false);
    setStep("taft");
  };
  const handleTaftNext = () => setStep("confirm");

  const handleSubmit = async () => {
    if (!coords || !selfieData || !selectedStore) return;
    setLoading(true);
    setMsg(null);
    try {
      const ip = await getPublicIP();
      const staffNames = (actionType === "open" ? selectedOpenTafts : selectedCloseTafts).join("; ");
      const body: any = {
        action: actionType,
        store_name: selectedStore,
        device_info: getDeviceInfo(),
        browser: getBrowserName(),
        ip_address: ip,
        is_valid_location: true,
      };
      if (actionType === "open") {
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
      const res = await fetch("/api/capture-attendance/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success) {
        setMsg({
          text: `Absensi ${actionType === "open" ? "OPEN" : "CLOSE"} berhasil disimpan!`,
          type: "success",
          distanceMeters: result.distance_meters ?? null,
        });
        setStep("done");
        await fetchTodayRecord(selectedStore);
        fetchHistory(isAll ? historyStore : myStoreName, historyDate);
      } else {
        setMsg({ text: result.error || "Gagal menyimpan", type: "error" });
        setStep("init");
      }
    } catch {
      setMsg({ text: "Terjadi kesalahan", type: "error" });
      setStep("init");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("init");
    setSelfieData(null);
    setCoords(null);
    setGpsStatus("idle");
    setMsg(null);
  };

  const hasOpen = !!todayRecord?.open_timestamp;
  const hasClose = !!todayRecord?.close_timestamp;
  const timeAllowsClose = isCloseWindowActive(storeDetail?.close_hours || "");
  const canOpen = !hasOpen;
  const canClose = hasOpen && !hasClose && timeAllowsClose;
  const currentSelectedTafts = actionType === "open" ? selectedOpenTafts : selectedCloseTafts;
  const currentToggleTaft = actionType === "open" ? toggleOpenTaft : toggleCloseTaft;

  return (
    <div className="w-full">
      <div className="mb-5">
        <AttendanceTabs active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "capture" && (
        <CaptureTab
          isStoreUser={isStoreUser}
          myStoreName={myStoreName}
          stores={stores}
          selectedStore={selectedStore}
          setSelectedStore={setSelectedStore}
          storeDetail={storeDetail}
          todayRecord={todayRecord}
          step={step}
          actionType={actionType}
          gpsStatus={gpsStatus}
          gpsError={gpsError}
          coords={coords}
          selfieData={selfieData}
          tafts={tafts}
          currentSelectedTafts={currentSelectedTafts}
          currentToggleTaft={currentToggleTaft}
          loading={loading}
          msg={msg}
          hasOpen={hasOpen}
          hasClose={hasClose}
          canOpen={canOpen}
          canClose={canClose}
          timeAllowsClose={timeAllowsClose}
          onStartAction={startAction}
          onOpenCamera={() => setShowCamera(true)}
          onReset={reset}
          onTaftNext={handleTaftNext}
          onBackToTaft={() => setStep("taft")}
          onSubmit={handleSubmit}
        />
      )}

      {activeTab === "history" && (
        <HistoryTab
          isAll={isAll}
          isStoreUser={isStoreUser}
          myStoreName={myStoreName}
          storeList={storeList}
          historyStore={historyStore}
          setHistoryStore={setHistoryStore}
          historyDate={historyDate}
          setHistoryDate={setHistoryDate}
          onSearch={() => fetchHistory(historyStore, historyDate)}
          historyLoading={historyLoading}
          records={records}
        />
      )}

      {showCamera && <SelfieCapture onCapture={handleSelfieCapture} onCancel={() => setShowCamera(false)} />}
    </div>
  );
}