"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import Popup from "@/components/Popup";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import { Button } from "@/components/shared/Button";
import { DropZone } from "@/components/request-tracking/DropZone";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

interface TrackingItem {
  id: string;
  date: string;
  assigned_to: string;
  expedition: string;
  sender: string;
  receiver: string;
  weight: string;
  reason: string;
  type_reason?: string;
  sales_order?: string;
  link_tracking: string;
  request_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  tracking_number?: string;
  has_processed?: string;
}

export default function RequestTrackingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<TrackingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.request_tracking && !parsedUser.tracking_edit) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData(parsedUser);
  }, [id]);

  const fetchData = async (currentUser: any) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        username: currentUser?.user_name || "",
        userName: currentUser?.name || "",
        isTrackingEdit: String(!!currentUser?.tracking_edit),
      });
      const res = await fetch(`/api/request-tracking?${params}`);
      if (res.ok) {
        const list: TrackingItem[] = await res.json();
        const found = list.find((r) => String(r.id) === String(id));
        setItem(found || null);
      } else {
        setItem(null);
      }
    } catch (error) {
      console.error("Failed to fetch tracking request:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!item || !uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("id", item.id);
      fd.append("update_by", user.user_name);
      fd.append("file", uploadFile);
      const res = await fetch("/api/request-tracking", { method: "PUT", body: fd });
      if (res.ok) {
        const result = await res.json();
        setPopupMessage(
          result.tracking_number
            ? `Upload berhasil! No. Resi: ${result.tracking_number}`
            : "File berhasil diupload (nomor resi tidak terdeteksi)"
        );
        setPopupType("success");
        setShowPopup(true);
        setUploadFile(null);
        if (uploadFileRef.current) uploadFileRef.current.value = "";
        try {
          await fetch("/api/push-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requesterUsername: item.request_by,
              title: "Resi Sudah Diupload",
              body: `Resi ${result.tracking_number || "-"} sudah diinput oleh ${user.user_name}`,
            }),
          });
        } catch {}
        try {
          await fetch("/api/activity-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user: user.user_name, method: "PUT", activity_log: `Uploaded tracking file for ID: ${item.id}`, entity_type: "request_tracking", entity_id: String(item.id) }),
          });
        } catch {}
        fetchData(user);
      } else {
        setPopupMessage("Gagal upload file");
        setPopupType("error");
        setShowPopup(true);
      }
    } catch {
      setPopupMessage("Gagal upload file");
      setPopupType("error");
      setShowPopup(true);
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/request-tracking" label="Shipment request" />;

  const canEdit = !!user.request_tracking;
  const canUpload = !!user.tracking_edit;
  const status = item.link_tracking ? "completed" : "pending";

  return (
    <DetailShell
      title={`${item.expedition} → ${item.assigned_to}`}
      subtitle="Detail Shipment Request"
      backHref="/request-tracking"
      onEdit={canEdit ? () => router.push("/request-tracking") : undefined}
      editLabel="Kelola di List"
    >
      <DetailSection title="Informasi Pengiriman">
        <DetailField label="Tanggal" value={item.date} />
        <DetailField label="Assigned To" value={item.assigned_to} />
        <DetailField label="Ekspedisi" value={item.expedition} />
        <DetailField label="Berat" value={item.weight ? `${item.weight} kg` : "-"} />
        <DetailField label="Pengirim" value={item.sender} />
        <DetailField label="Penerima" value={item.receiver} />
        <DetailField
          label="Status"
          value={
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}>
              {status === "completed" ? "Selesai" : "Pending"}
            </span>
          }
        />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Detail Tambahan">
        <DetailField label="Alasan" value={item.reason} />
        <DetailField label="Tipe Alasan" value={item.type_reason} />
        <DetailField label="Sales Order" value={item.sales_order} />
        <DetailField label="No. Resi" value={item.tracking_number} />
        <DetailField
          label="Link Resi"
          value={
            item.link_tracking ? (
              <a href={item.link_tracking} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Lihat resi
              </a>
            ) : "-"
          }
        />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Metadata">
        <DetailField label="Request By" value={item.request_by} />
        <DetailField label="Created At" value={item.created_at} />
        <DetailField label="Update By" value={item.update_by} />
        <DetailField label="Update At" value={item.update_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      {canUpload && status === "pending" && (
        <>
          <div className="border-t border-dashed border-gray-200" />
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Upload Resi
            </label>
            <DropZone file={uploadFile} onFile={setUploadFile} inputRef={uploadFileRef} />
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              loading={uploading}
              icon={Upload}
              className="mt-2 w-full justify-center"
            >
              {uploading ? "Mengupload..." : "Upload"}
            </Button>
          </div>
        </>
      )}

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="request_tracking" entityId={String(item.id)} />

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </DetailShell>
  );
}
