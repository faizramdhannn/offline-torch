"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { FileIcon } from "./FileIcon";
import { getTypeBadgeVariant, type Asset } from "./types";

interface AssetCardProps {
  asset: Asset;
  canEdit: boolean;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

export function AssetCard({ asset, canEdit, onEdit, onDelete }: AssetCardProps) {
  return (
    <div className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-150 hover:border-primary/30 hover:shadow-md">
      <a
        href={asset.link_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-2.5 px-3 pb-3 pt-4 text-center"
      >
        <FileIcon url={asset.link_url} size={40} />
        <div className="min-w-0 w-full">
          <p
            className="truncate text-[11px] font-semibold text-gray-800"
            title={asset.asset_name}
          >
            {asset.asset_name}
          </p>
          <div className="mt-1.5 flex justify-center">
            <Badge variant={getTypeBadgeVariant(asset.type_asset)} dot>
              {asset.type_asset}
            </Badge>
          </div>
        </div>
        <ExternalLink className="h-3 w-3 text-gray-300 transition-colors group-hover:text-primary" />
      </a>

      {canEdit && (
        <div className="flex border-t border-gray-100 bg-gray-50/60">
          <button
            type="button"
            onClick={() => onEdit(asset)}
            className="flex flex-1 items-center justify-center gap-1 border-r border-gray-100 py-1.5 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Pencil className="h-2.5 w-2.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(asset)}
            className="flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-2.5 w-2.5" /> Hapus
          </button>
        </div>
      )}
    </div>
  );
}
