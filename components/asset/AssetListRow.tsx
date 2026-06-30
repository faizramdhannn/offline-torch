"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { FileIcon } from "./FileIcon";
import { getTypeBadgeVariant, type Asset } from "./types";

interface AssetListRowProps {
  asset: Asset;
  canEdit: boolean;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

export function AssetListRow({ asset, canEdit, onEdit, onDelete }: AssetListRowProps) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-gray-50 px-4 py-2.5 transition-colors last:border-0 hover:bg-gray-50/80">
      <FileIcon url={asset.link_url} size={28} />

      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-gray-800" title={asset.asset_name}>
          {asset.asset_name}
        </p>
        <Badge variant={getTypeBadgeVariant(asset.type_asset)} dot className="mt-0.5">
          {asset.type_asset}
        </Badge>
      </div>

      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(asset)}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Pencil className="h-2.5 w-2.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(asset)}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-2.5 w-2.5" /> Hapus
          </button>
        </div>
      ) : (
        <span />
      )}

      <a
        href={asset.link_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex shrink-0 items-center text-gray-300 transition-colors hover:text-primary"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
