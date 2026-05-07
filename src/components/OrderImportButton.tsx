import { useState, useRef } from "react";

interface OrderImportButtonProps {
  onImportComplete: () => void;
  onRefresh?: () => void;
}

export default function OrderImportButton({ onImportComplete, onRefresh }: OrderImportButtonProps) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/orders/import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert(`成功导入 ${result.count} 条订单`);
        onImportComplete();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        alert("导入失败，请重试");
      }
    } catch {
      alert("导入失败，请重试");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "导入中..." : "导入订单"}
      </button>
    </div>
  );
}