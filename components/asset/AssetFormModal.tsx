"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { FieldLabel, inputClass } from "@/components/shared/FormField";
import { ASSET_TYPES, type Asset } from "./types";

interface AssetFormModalProps {
  open: boolean;
  mode: "add" | "edit";
  asset: Partial<Asset>;
  saving: boolean;
  onClose: () => void;
  onSave: (data: Partial<Asset>) => void;
}

/**
 * Mount this with `key={asset.id ?? "new"}` from the parent so the form
 * state resets correctly whenever a different asset (or "add new") is
 * opened, while `open` alone still drives the Modal's open/close animation.
 */
export function AssetFormModal({ open, mode, asset, saving, onClose, onSave }: AssetFormModalProps) {
  const [form, setForm] = useState<Partial<Asset>>(asset);

  const isValid = !!(form.type_asset && form.asset_name && form.link_url);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={FileText}
      title={mode === "add" ? "Tambah Asset" : "Edit Asset"}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            className="ml-auto"
            disabled={!isValid}
            loading={saving}
            onClick={() => onSave(form)}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel required>Tipe Asset</FieldLabel>
          <select
            value={form.type_asset || ""}
            onChange={(e) => setForm({ ...form, type_asset: e.target.value })}
            className={inputClass()}
          >
            <option value="">-- Pilih Tipe --</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel required>Nama Asset</FieldLabel>
          <input
            type="text"
            value={form.asset_name || ""}
            onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
            placeholder="Contoh: Opening Store"
            className={inputClass()}
          />
        </div>

        <div>
          <FieldLabel required>Link URL</FieldLabel>
          <input
            type="url"
            value={form.link_url || ""}
            onChange={(e) => setForm({ ...form, link_url: e.target.value })}
            placeholder="https://drive.google.com/..."
            className={inputClass()}
          />
        </div>
      </div>
    </Modal>
  );
}
