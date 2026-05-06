"use client";

import { useState, useRef } from "react";

interface ImportButtonProps {
  onImportComplete: () => void;
}

export default function ImportButton({ onImportComplete }: ImportButtonProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    total: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "导入失败");
        return;
      }

      setResult(data);
      onImportComplete();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
          id="import-file"
        />
        <label
          htmlFor="import-file"
          className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
            importing
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {importing ? "导入中..." : "导入 Excel"}
        </label>
      </div>
      {result && (
        <p className="text-sm text-green-600">
          导入成功：共 {result.total} 条，成功 {result.imported} 条
          {result.skipped > 0 ? `，跳过 ${result.skipped} 条` : ""}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
