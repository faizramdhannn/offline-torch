"use client";

import { useState, useCallback, useEffect } from "react";
import { FileUp, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function DropZone({
  file,
  onFile,
  inputRef,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);
  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isImage = file && file.type.startsWith("image/");

  useEffect(() => {
    if (!file || !isImage) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" onChange={handleInputChange} className="hidden" />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-2.5">
          {preview ? (
            <img src={preview} alt="preview" className="h-10 w-10 shrink-0 rounded-lg border border-green-200 object-cover" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-green-200 bg-green-100">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-green-800">{file.name}</p>
            <p className="text-[11px] text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            title="Hapus file"
            className="shrink-0 rounded-lg p-1.5 text-green-700 transition-colors hover:bg-green-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "flex select-none flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-6 transition-all duration-200 cursor-pointer",
            dragging ? "border-primary/50 bg-primary/5" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
          )}
        >
          <FileUp className={cn("h-6 w-6 transition-colors", dragging ? "text-primary" : "text-gray-400")} />
          <p className={cn("text-xs font-medium transition-colors", dragging ? "text-primary" : "text-gray-600")}>
            {dragging ? "Lepaskan file di sini" : "Drag & drop atau klik untuk pilih"}
          </p>
          <p className="text-[11px] text-gray-400">Gambar atau PDF</p>
        </div>
      )}
    </div>
  );
}
