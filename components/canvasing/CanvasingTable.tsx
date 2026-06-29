"use client";

import { Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import { Canvasing } from "@/types";
import { StatusBadge } from "./DomainBadges";

interface CanvasingTableProps {
  items: Canvasing[];
  onRowClick: (entry: Canvasing) => void;
  onEdit: (entry: Canvasing) => void;
  onDelete: (id: string) => void;
  canEdit: (entry: Canvasing) => boolean;
  isOwner: boolean;
  toTitleCase: (s: string) => string;
}

const HEADERS = [
  "Store", "Name", "CP", "Category",
  "Sub Category", "Canvasser", "Visit At", "Status", "Images", "",
];

/**
 * Data table for the canvasing list view.
 * Edit/Delete actions appear on row hover.
 * Row click opens the detail popup.
 */
export function CanvasingTable({
  items,
  onRowClick,
  onEdit,
  onDelete,
  canEdit,
  isOwner,
  toTitleCase,
}: CanvasingTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            {HEADERS.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item, index) => {
            const images = item.image_url
              ? item.image_url.split(";").filter((u) => u.trim())
              : [];
            const editable = canEdit(item);

            return (
              <tr
                key={index}
                className="group cursor-pointer transition-colors hover:bg-gray-50/80"
                onClick={() => onRowClick(item)}
              >
                <td className="px-4 py-3 font-medium text-gray-700">
                  {toTitleCase(item.store)}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">
                  {item.name}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {item.contact_person || "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{item.category}</td>
                <td className="px-4 py-3 text-gray-600">
                  {item.sub_category}
                </td>
                <td className="px-4 py-3 text-gray-600">{item.canvasser}</td>
                <td className="px-4 py-3 tabular-nums text-gray-500">
                  {item.visit_at}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.result_status} />
                </td>
                <td className="px-4 py-3">
                  {images.length > 0 ? (
                    <div className="flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-500">{images.length}</span>
                    </div>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editable && (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!isOwner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}