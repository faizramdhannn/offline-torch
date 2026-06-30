"use client";

import React, { useState } from "react";
import { Check, X, MapPin } from "lucide-react";
import { AttendanceRecord } from "./types";
import { extractTime, isValidSelfie, toDriveProxyUrl } from "./helpers";
import { LazyImg, SelfiePlaceholderSm, SelfiePlaceholderMd } from "./LazyImg";

const thClass =
  "px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
const thSubClass =
  "px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap";
const tdClass = "px-2 py-1.5 text-[10px] text-gray-700";

export function AttendanceTable({ records, isAll }: { records: AttendanceRecord[]; isAll: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: isAll ? 760 : 480 }}>
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              <th colSpan={2} className="border-b border-r border-gray-200 bg-gray-50" />
              <th colSpan={3} className="border-b border-r border-gray-200 bg-gray-100 px-2 py-1 text-center">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Open</span>
              </th>
              <th
                colSpan={3}
                className={`border-b border-gray-200 bg-gray-50 px-2 py-1 text-center ${isAll ? "border-r" : ""}`}
              >
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Close</span>
              </th>
              {isAll && (
                <th colSpan={6} className="border-b border-gray-200 bg-gray-50 px-2 py-1 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Info Teknis</span>
                </th>
              )}
            </tr>
            <tr className="border-b border-gray-200">
              <th className={`${thClass} w-7 border-r border-gray-200 text-center`}>#</th>
              <th className={`${thClass} w-24 border-r border-gray-200 text-left`}>Toko</th>
              <th className={`${thSubClass} w-24 border-r border-gray-200 bg-gray-100 text-left text-gray-600`}>
                Staff
              </th>
              <th className={`${thSubClass} w-10 border-r border-gray-200 bg-gray-100 text-center text-gray-600`}>
                Foto
              </th>
              <th className={`${thSubClass} w-12 border-r border-gray-200 bg-gray-100 text-center text-gray-600`}>
                Jam
              </th>
              <th className={`${thClass} w-24 border-r border-gray-200 text-left`}>Staff</th>
              <th className={`${thClass} w-10 border-r border-gray-200 text-center`}>Foto</th>
              <th className={`${thClass} w-12 text-center ${isAll ? "border-r border-gray-200" : ""}`}>Jam</th>
              {isAll && (
                <>
                  <th className={`${thSubClass} w-20 border-r border-gray-200 text-left`}>Device</th>
                  <th className={`${thSubClass} w-16 border-r border-gray-200 text-left`}>Browser</th>
                  <th className={`${thSubClass} w-10 border-r border-gray-200 text-center`}>Valid</th>
                  <th className={`${thSubClass} w-20 border-r border-gray-200 text-left`}>IP</th>
                  <th className={`${thSubClass} w-10 border-r border-gray-200 text-center`}>Peta O</th>
                  <th className={`${thSubClass} w-10 text-center`}>Peta C</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((rec, idx) => {
              const isExpanded = expandedId === rec.id;
              const openProxyUrl = isValidSelfie(rec.open_selfie) ? toDriveProxyUrl(rec.open_selfie) : "";
              const closeProxyUrl = isValidSelfie(rec.close_selfie) ? toDriveProxyUrl(rec.close_selfie) : "";
              const openStaff = rec.open_staff_name?.trim() || "";
              const closeStaff = rec.close_staff_name?.trim() || "";
              const isValid =
                rec.is_valid_location === "TRUE" || rec.is_valid_location === "true" || rec.is_valid_location === "1";
              const rowBg = isExpanded ? "bg-blue-50/30" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/40";

              return (
                <React.Fragment key={rec.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50/30 ${rowBg}`}
                  >
                    <td className={`${tdClass} border-r border-gray-200 text-center text-gray-400`}>{idx + 1}</td>
                    <td className={`${tdClass} max-w-[96px] truncate border-r border-gray-200 font-semibold capitalize text-gray-800`}>
                      {rec.store_name}
                    </td>
                    <td className={`${tdClass} max-w-[96px] truncate border-r border-gray-200 bg-gray-50/60`}>
                      {openStaff || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="border-r border-gray-200 bg-gray-50/60 px-1 py-1">
                      <div className="flex justify-center">
                        {openProxyUrl ? (
                          <LazyImg
                            src={openProxyUrl}
                            alt="foto open"
                            className="overflow-hidden rounded border border-gray-200 bg-gray-100"
                            style={{ width: 28, height: 28 }}
                            fallback={<SelfiePlaceholderSm />}
                          />
                        ) : (
                          <SelfiePlaceholderSm />
                        )}
                      </div>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap border-r border-gray-200 bg-gray-50/60 font-semibold`}>
                      {rec.open_timestamp ? extractTime(rec.open_timestamp) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`${tdClass} max-w-[96px] truncate border-r border-gray-200`}>
                      {closeStaff || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="border-r border-gray-200 px-1 py-1">
                      <div className="flex justify-center">
                        {closeProxyUrl ? (
                          <LazyImg
                            src={closeProxyUrl}
                            alt="foto close"
                            className="overflow-hidden rounded border border-gray-200 bg-gray-100"
                            style={{ width: 28, height: 28 }}
                            fallback={<SelfiePlaceholderSm />}
                          />
                        ) : (
                          <SelfiePlaceholderSm />
                        )}
                      </div>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap font-semibold text-gray-600 ${isAll ? "border-r border-gray-200" : ""}`}>
                      {rec.close_timestamp ? extractTime(rec.close_timestamp) : <span className="text-gray-300">—</span>}
                    </td>
                    {isAll && (
                      <>
                        <td className={`${tdClass} max-w-[80px] truncate border-r border-gray-200 text-gray-600`}>
                          {rec.device_info || "—"}
                        </td>
                        <td className={`${tdClass} max-w-[64px] truncate border-r border-gray-200 text-gray-600`}>
                          {rec.browser || "—"}
                        </td>
                        <td className="border-r border-gray-200 px-2 py-1.5 text-center">
                          {isValid ? (
                            <span className="inline-flex items-center gap-0.5 rounded border border-green-200 bg-green-50 px-1 py-0.5 text-[9px] font-semibold text-green-700">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 rounded border border-red-200 bg-red-50 px-1 py-0.5 text-[9px] font-semibold text-red-500">
                              <X className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </td>
                        <td className={`${tdClass} max-w-[80px] truncate border-r border-gray-200 font-mono text-gray-600`}>
                          {rec.ip_address || "—"}
                        </td>
                        <td className="border-r border-gray-200 px-2 py-1.5 text-center">
                          {rec.open_maps_url ? (
                            <a
                              href={rec.open_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex justify-center text-gray-500 hover:text-gray-800"
                            >
                              <MapPin className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="inline-flex justify-center text-gray-200">
                              <MapPin className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {rec.close_maps_url ? (
                            <a
                              href={rec.close_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex justify-center text-gray-500 hover:text-gray-800"
                            >
                              <MapPin className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="inline-flex justify-center text-gray-200">
                              <MapPin className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <td colSpan={isAll ? 14 : 8} className="px-6 py-4">
                        <div className="grid max-w-md grid-cols-2 gap-6">
                          <div>
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">Open</p>
                            {openProxyUrl ? (
                              <img
                                src={openProxyUrl}
                                alt="open"
                                className="mb-2 w-full rounded-lg border border-gray-200 object-cover"
                                style={{ aspectRatio: "4/3" }}
                              />
                            ) : (
                              <SelfiePlaceholderMd />
                            )}
                            <p className="text-[10px] text-gray-500">
                              <span className="text-gray-400">Staff: </span>
                              <span className="font-medium text-gray-700">
                                {openStaff || <span className="italic text-gray-300">tidak diisi</span>}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[10px] text-gray-500">
                              <span className="text-gray-400">Waktu: </span>
                              <span className="font-medium text-gray-700">{rec.open_timestamp || "-"}</span>
                            </p>
                            {rec.open_maps_url && (
                              <a
                                href={rec.open_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 hover:underline"
                              >
                                <MapPin className="h-3 w-3" /> Lihat Peta
                              </a>
                            )}
                          </div>
                          <div>
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">Close</p>
                            {closeProxyUrl ? (
                              <img
                                src={closeProxyUrl}
                                alt="close"
                                className="mb-2 w-full rounded-lg border border-gray-200 object-cover"
                                style={{ aspectRatio: "4/3" }}
                              />
                            ) : (
                              <SelfiePlaceholderMd />
                            )}
                            <p className="text-[10px] text-gray-500">
                              <span className="text-gray-400">Staff: </span>
                              <span className="font-medium text-gray-700">
                                {closeStaff || <span className="italic text-gray-300">tidak diisi</span>}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[10px] text-gray-500">
                              <span className="text-gray-400">Waktu: </span>
                              <span className="font-medium text-gray-700">{rec.close_timestamp || "-"}</span>
                            </p>
                            {rec.close_maps_url && (
                              <a
                                href={rec.close_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 hover:underline"
                              >
                                <MapPin className="h-3 w-3" /> Lihat Peta
                              </a>
                            )}
                          </div>
                        </div>
                        {isAll && (
                          <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-1 border-t border-gray-200 pt-3 text-[10px] text-gray-600">
                            <div>
                              <span className="text-gray-400">Device: </span>
                              <span className="font-medium">{rec.device_info || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Browser: </span>
                              <span className="font-medium">{rec.browser || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">IP: </span>
                              <span className="font-mono font-medium">{rec.ip_address || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Valid: </span>
                              <span className={`font-semibold ${isValid ? "text-green-700" : "text-red-500"}`}>
                                {isValid ? "Ya" : "Tidak"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400">Lat: </span>
                              <span className="font-mono font-medium">{rec.open_latitude || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Lng: </span>
                              <span className="font-mono font-medium">{rec.open_longitude || "-"}</span>
                            </div>
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
  );
}