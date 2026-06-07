'use client';

import { useState, useRef, useCallback } from 'react';
import DataPreviewEditor from './DataPreviewEditor';
import { ORDER_FIELDS } from '@/lib/excel-mapper';
import { saveMappingRule, getMappingRule } from '@/lib/template-memory';

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface DuplicateInfo {
  row: number;
  duplicateWith: number;
  type: 'batch' | 'database';
}

interface OrderImportButtonProps {
  onImportComplete: () => void;
  onRefresh?: () => void;
}

export default function OrderImportButton({ onImportComplete, onRefresh }: OrderImportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewErrors, setPreviewErrors] = useState<ValidationError[]>([]);
  const [previewDuplicates, setPreviewDuplicates] = useState<DuplicateInfo[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [showProgress, setShowProgress] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentMapping, setCurrentMapping] = useState<Record<string, string>>({});
  const [availableFields] = useState(ORDER_FIELDS);
  const [saveTemplateFlag, setSaveTemplateFlag] = useState(false);
  const [autoDetectedTemplate, setAutoDetectedTemplate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadedFile(file);
    setShowProgress(true);
    setProgress({ current: 0, total: 100, percent: 0 });
    setAutoDetectedTemplate(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('previewOnly', 'true');

      const response = await fetch('/api/orders/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setPreviewData(result.data);
        setPreviewHeaders(result.headers);
        setPreviewErrors(result.errors);
        setPreviewDuplicates(result.duplicates);

        const matchedRule = getMappingRule(result.headers);
        if (matchedRule) {
          setCurrentMapping(matchedRule.mapping);
          setAutoDetectedTemplate(matchedRule.templateName);
        } else {
          const autoMapping: Record<string, string> = {};
          result.headers.forEach((header: string) => {
            const field = availableFields.find(f => 
              f.possibleNames.some(name => {
                const normalizedName = name.toLowerCase().replace(/[\s\-_（）()/\\]/g, "").trim();
                const normalizedHeader = header.toLowerCase().replace(/[\s\-_（）()/\\]/g, "").trim();
                return normalizedName.includes(normalizedHeader) || normalizedHeader.includes(normalizedName);
              })
            );
            if (field) {
              autoMapping[header] = field.field;
            }
          });
          setCurrentMapping(autoMapping);
        }

        setShowProgress(false);
        setShowMappingModal(true);
      } else {
        const error = await response.json();
        
        if (error.detectedHeaders && error.detectedHeaders.length > 0) {
          setPreviewHeaders(error.detectedHeaders);
          setCurrentMapping({});
          setShowProgress(false);
          setShowMappingModal(true);
        } else {
          alert(error.error || '导入失败');
          setShowProgress(false);
        }
      }
    } catch (error) {
      alert(`导入失败: ${(error as Error).message}`);
      setShowProgress(false);
    }
  }, [availableFields]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('border-blue-500', 'bg-blue-50');
    }
  };

  const handleDragLeave = () => {
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      handleFileSelect(file);
    } else {
      alert('请上传 Excel 文件 (.xlsx 或 .xls)');
    }
  };

  const handleFieldMappingChange = (header: string, fieldName: string) => {
    setCurrentMapping(prev => ({
      ...prev,
      [header]: fieldName
    }));
  };

  const handleConfirmMapping = () => {
    if (saveTemplateFlag) {
      const templateName = autoDetectedTemplate || '自定义模板';
      saveMappingRule(previewHeaders, currentMapping, templateName);
    } else if (Object.keys(currentMapping).length > 0) {
      saveMappingRule(previewHeaders, currentMapping, autoDetectedTemplate || '自定义模板');
    }
    
    setShowMappingModal(false);
    setShowPreview(true);
  };

  const handleConfirmImport = async (data: any[]) => {
    setShowPreview(false);
    setUploadedFile(null);
    onImportComplete();
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        
        <div
          ref={dropZoneRef}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-gray-50 transition-all"
        >
          <div className="flex flex-col items-center">
            <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-medium text-gray-700">
              {uploadedFile ? `已选择: ${uploadedFile.name}` : '点击或拖拽上传 Excel 文件'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              支持 .xlsx 和 .xls 格式，支持多种模板自动识别，自动记忆映射规则
            </p>
          </div>
        </div>
      </div>

      {showProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">正在处理文件...</h3>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-center text-sm">
              {progress.current} / {progress.total} ({progress.percent}%)
            </p>
          </div>
        </div>
      )}

      {showMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-bold">模板映射</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {autoDetectedTemplate ? (
                    <span className="text-green-600">✓ 自动匹配到模板: {autoDetectedTemplate}</span>
                  ) : (
                    '确认或调整列映射关系'
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-3 py-1 text-sm bg-gray-300 rounded hover:bg-gray-400"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <h3 className="font-medium text-gray-700">Excel 列名</h3>
                <h3 className="font-medium text-gray-700">系统字段</h3>
              </div>
              <div className="space-y-2">
                {previewHeaders.map((header, index) => (
                  <div key={index} className="grid grid-cols-2 gap-4 items-center">
                    <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200">
                      {header}
                    </div>
                    <select
                      value={currentMapping[header] || ''}
                      onChange={(e) => handleFieldMappingChange(header, e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- 请选择 --</option>
                      {availableFields.map(field => (
                        <option key={field.field} value={field.field}>
                          {field.field}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t p-4">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={saveTemplateFlag}
                  onChange={(e) => setSaveTemplateFlag(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">保存此模板映射（下次自动应用）</span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmMapping}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  确认映射
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <DataPreviewEditor
          initialData={previewData}
          existingExternalCodes={[]}
          onSave={handleConfirmImport}
          onCancel={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
