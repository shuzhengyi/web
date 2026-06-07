'use client';

import { useState, useRef } from 'react';
import { ParseRule } from '@/generated/prisma/client';
import { type ParsedItem } from '@/lib/parse-engine';

interface OutboundImportProps {
  rules: ParseRule[];
  onImportComplete: () => void;
}

export default function OutboundImport({ rules, onImportComplete }: OutboundImportProps) {
  const [selectedRule, setSelectedRule] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setShowPreview(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      handleFileSelect(droppedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert('请选择文件');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedRule) {
        formData.append('ruleId', selectedRule);
      }

      const res = await fetch('/api/outbound-orders', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setResult({ success: true, count: data.items?.length || 0 });
        if (data.items?.length > 0) {
          setPreviewData(data.items);
          setShowPreview(true);
        }
      } else {
        alert('导入失败：' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirm = () => {
    setShowPreview(false);
    setResult(null);
    setFile(null);
    onImportComplete();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db]">
      {!showPreview ? (
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#4b5563] mb-2">选择解析规则</label>
            <select
              value={selectedRule}
              onChange={(e) => setSelectedRule(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2] bg-white"
            >
              <option value="">-- 选择规则 --</option>
              {rules.filter(r => r.isActive).map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-[#6b7280]">
              如不选择规则，仅记录导入历史，不解析数据
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-[#4b5563] mb-2">上传文件</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                file
                  ? 'border-[#0fc6c2] bg-[#e8fcfb]'
                  : 'border-[#d1d5db] hover:border-[#0fc6c2] hover:bg-[#f9fafb]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                className="hidden"
              />
              {file ? (
                <div>
                  <svg className="mx-auto h-12 w-12 text-[#0fc6c2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-[#1f2937]">{file.name}</p>
                  <p className="text-xs text-[#6b7280]">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto h-12 w-12 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-[#4b5563]">
                    点击或拖拽文件到此处
                  </p>
                  <p className="text-xs text-[#6b7280]">支持 .xlsx, .xls 格式</p>
                </div>
              )}
            </div>
          </div>

          {result && (
            <div className={`mb-6 p-4 rounded-lg border ${
              result.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm font-medium ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {result.success ? `导入成功！共 ${result.count} 条数据` : '导入失败'}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing || !file}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {importing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  导入中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  开始导入
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-[#1f2937]">导入预览</h3>
            <p className="text-sm text-[#6b7280]">
              共 {previewData.length} 条数据将被导入
            </p>
          </div>

          <div className="border border-[#d1d5db] rounded-lg overflow-x-auto mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f9fafb]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">外部编码</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">收货门店</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">收货人</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">SKU编码</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">SKU名称</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">数量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {previewData.slice(0, 20).map((item, index) => (
                  <tr key={index} className="hover:bg-[#f9fafb]">
                    <td className="px-4 py-2 text-[#1f2937]">{item.externalCode || '-'}</td>
                    <td className="px-4 py-2 text-[#1f2937]">{item.storeName || '-'}</td>
                    <td className="px-4 py-2 text-[#1f2937]">{item.receiverName || '-'}</td>
                    <td className="px-4 py-2 text-[#1f2937]">{item.skuCode}</td>
                    <td className="px-4 py-2 text-[#1f2937]">{item.skuName}</td>
                    <td className="px-4 py-2 text-[#1f2937] font-medium">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 20 && (
              <div className="px-4 py-2 text-sm text-[#6b7280] border-t border-[#e5e7eb]">
                仅显示前 20 条，共 {previewData.length} 条
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] shadow-sm transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              确认完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
