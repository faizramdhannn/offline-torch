"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "-- Pilih --",
  disabled = false,
  className = "",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  // wrapperRef hanya membungkus BUTTON (bukan panel dropdown), supaya
  // getBoundingClientRect tidak pernah ikut terpengaruh oleh tinggi panel
  // itu sendiri — panel dropdown di-render lewat portal ke document.body,
  // jadi benar-benar terpisah dari flow layout field ini.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  const updateDropdownPosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = () => updateDropdownPosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open]);

  // Ukur posisi SEBELUM browser paint (bukan useEffect biasa), supaya tidak
  // ada frame di mana panel sempat dirender di posisi salah / mempengaruhi
  // tinggi elemen lain lebih dulu.
  useEffect(() => {
    if (open) {
      updateDropdownPosition();
      inputRef.current?.focus();
    }
  }, [open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setSearch("");
  };

  const panel = open && (
    <div
      ref={panelRef}
      style={dropdownStyle}
      className="bg-white border border-gray-300 rounded shadow-lg"
    >
      <div className="p-2 border-b border-gray-100">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari artikel..."
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <ul className="max-h-48 overflow-y-auto">
        <li
          onClick={() => handleSelect("")}
          className="px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 cursor-pointer"
        >
          {placeholder}
        </li>
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-gray-400 text-center">Tidak ditemukan</li>
        ) : (
          filtered.map((o, idx) => (
            <li
              key={`${o.value}-${idx}`}
              onClick={() => handleSelect(o.value)}
              className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-primary/10
                ${o.value === value ? "bg-primary/10 font-semibold text-primary" : "text-gray-700"}
              `}
            >
              {o.label}
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((prev) => !prev); }}
        className={`w-full flex items-center justify-between px-2 py-1.5 border rounded text-xs text-left bg-white focus:outline-none focus:ring-2 focus:ring-primary
          ${disabled ? "bg-gray-200 cursor-not-allowed border-gray-200 text-gray-400" : "border-gray-300 hover:border-primary cursor-pointer"}
          ${open ? "ring-2 ring-primary border-primary" : ""}
        `}
      >
        <span className={value ? "text-gray-800" : "text-gray-400"}>
          {value ? selectedLabel : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-1 shrink-0">
          {value && !disabled && (
            <span
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 cursor-pointer leading-none"
              title="Clear"
            >
              ✕
            </span>
          )}
          <span className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>

      {mounted && panel && createPortal(panel, document.body)}
    </div>
  );
}
