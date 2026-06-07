'use client';

import { useState, useRef, useCallback } from 'react';
import { ParseRule } from '@/generated/prisma/client';
import { type ParsedItem, ParseEngine } from '@/lib/parse-engine';
import RuleEditor from './RuleEditor';
import DataPreviewEditor from './DataPreviewEditor';

// 文件类型
type FileType = 'excel' | 'word' | 'pdf';

// 导入状态
type ImportStep = 'upload' | 'select-rule' | 'ai-analyzing' | 'confirm-rule' | 'parsing' | 'preview' | 'result';

// 导入结果
interface ImportResult {
  success: boolean;
  items?: ParsedItem[];
  error?: string;
  errorType?: 'format' | 'empty' | 'encoding' | 'parse' | 'unknown';
  rawFileInfo?: {
    name: string;
    size: number;
    type: string;
    preview?: string;
  };
}

// 进度信息
interface ProgressInfo {
  percent: number;
  current: number;
  total: number;
  message: string;
}

interface FileImporterProps {
  rules: ParseRule[];
  onImportComplete: () => void;
  onRefreshRules: () => void;
}

// 支持的文件类型
const ACCEPTED_FILE_TYPES: Record<FileType, { extensions: string[]; mimes: string[] }> = {
  excel: {
    extensions: ['.xlsx', '.xls'],
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
  },
  word: {
    extensions: ['.docx'],
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  pdf: {
    extensions: ['.pdf'],
    mimes: ['application/pdf'],
  },
};

export default function FileImporter({ rules, onImportComplete, onRefreshRules }: FileImporterProps) {
  // 状态
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<ParseRule | null>(null);
  const [aiSuggestedRule, setAiSuggestedRule] = useState<Partial<ParseRule> | null>(null);
  const [progress, setProgress] = useState<ProgressInfo>({ percent: 0, current: 0, total: 0, message: '' });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ParsedItem[]>([]);
  const [rawFilePreview, setRawFilePreview] = useState<string>('');
  const [existingCodes, setExistingCodes] = useState<string[]>([]);
  const [groupedByStore, setGroupedByStore] = useState(false); // 是否按门店分组显示
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 检测文件类型
  const detectFileType = (file: File): FileType | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const mime = file.type;

    for (const [type, config] of Object.entries(ACCEPTED_FILE_TYPES)) {
      if (config.extensions.includes(extension) || config.mimes.includes(mime)) {
        return type as FileType;
      }
    }
    return null;
  };

  // 验证文件
  const validateFile = (file: File): { valid: boolean; error?: string; errorType?: ImportResult['errorType'] } => {
    // 检查文件类型
    const type = detectFileType(file);
    if (!type) {
      return { 
        valid: false, 
        error: '不支持的文件格式。请上传 Excel（.xlsx/.xls）、Word（.docx）或 PDF 文件。',
        errorType: 'format'
      };
    }

    // 检查文件大小（最大 50MB）
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: '文件大小超过限制（最大 50MB）。',
        errorType: 'format'
      };
    }

    // 检查文件是否为空
    if (file.size === 0) {
      return { 
        valid: false, 
        error: '文件为空，请选择有效的文件。',
        errorType: 'empty'
      };
    }

    return { valid: true };
  };

  // 处理文件选择
  const handleFileSelect = useCallback((selectedFile: File) => {
    const validation = validateFile(selectedFile);
    if (!validation.valid) {
      setResult({
        success: false,
        error: validation.error,
        errorType: validation.errorType,
        rawFileInfo: {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
        }
      });
      setStep('result');
      return;
    }

    setFile(selectedFile);
    setFileType(detectFileType(selectedFile));
    setResult(null);
    setStep('select-rule');
    setSelectedRuleId('');
    setAiSuggestedRule(null);
  }, []);

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  // 文件输入变化
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  // 选择已有规则并解析
  const handleUseExistingRule = async () => {
    if (!selectedRuleId) {
      alert('请选择一个规则');
      return;
    }
    await executeParse(selectedRuleId);
  };

  // 新建规则 - AI 预处理
  const handleCreateNewRule = async () => {
    if (!file) {
      alert('请先上传文件');
      return;
    }

    // 直接打开规则编辑器（新建模式），不再经过 confirm-rule 步骤
    setEditingRule(null);
    setShowRuleEditor(true);
  };

  // 执行解析
  const executeParse = async (ruleId: string) => {
    if (!file) return;

    // 先读取文件获取实际行数
    let totalRows = 100; // 默认值
    try {
      const buffer = await file.arrayBuffer();
      if (fileType === 'excel') {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer);
        const sheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        // 减去表头行
        totalRows = Math.max(0, jsonData.length - 1);
      }
    } catch (e) {
      console.error('读取文件行数失败:', e);
    }

    setStep('parsing');
    setProgress({ percent: 0, current: 0, total: totalRows, message: '准备解析...' });

    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ruleId', ruleId);

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newPercent = Math.min(prev.percent + 10, 90);
          const newCurrent = Math.round((newPercent / 100) * prev.total);
          return {
            ...prev,
            percent: newPercent,
            current: Math.min(newCurrent, prev.total),
            message: `正在解析文件... ${newPercent}%`
          };
        });
      }, 200);

      // 预览模式：不保存到数据库
      formData.append('preview', 'true');
      
      console.log('=== 开始导入文件 ===');
      console.log('文件:', file.name, '大小:', file.size);
      console.log('规则ID:', ruleId);
      
      const res = await fetch('/api/outbound-orders', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      clearInterval(progressInterval);

      const data = await res.json();
      
      console.log('=== API返回结果 ===');
      console.log('成功:', data.success);
      console.log('数据条数:', data.items?.length || 0);
      console.log('全部响应:', data);

      if (data.success) {
        const items = data.items || [];
        console.log('=== 设置预览数据 ===');
        console.log('解析到的数据:', items);
        setProgress({ percent: 100, current: items.length, total: items.length, message: '解析完成' });
        setPreviewData(items);
        // 获取已存在的外部编码
        try {
          const codesRes = await fetch('/api/outbound-orders?mode=external-codes');
          const codesData = await codesRes.json();
          if (codesData.success) {
            setExistingCodes(codesData.codes || []);
          }
        } catch (e) {
          console.error('获取已存在编码失败:', e);
        }
        // 进入预览编辑页面，不再直接显示结果
        setStep('preview');
      } else {
        // 解析失败
        const buffer = await file.arrayBuffer();
        const preview = await generateFilePreview(file, buffer);
        
        setResult({
          success: false,
          error: data.error || data.details || '解析失败',
          errorType: 'parse',
          rawFileInfo: {
            name: file.name,
            size: file.size,
            type: file.type,
            preview,
          }
        });
        setStep('result');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setResult({
          success: false,
          error: '解析已取消',
          errorType: 'unknown',
        });
      } else {
        console.error('解析失败:', error);
        setResult({
          success: false,
          error: error.message || '解析失败',
          errorType: 'unknown',
        });
      }
      setStep('result');
    }
  };

  // 保存数据到数据库
  const handleSaveData = async (savedData: ParsedItem[]) => {
    try {
      setProgress({ percent: 0, current: 0, total: savedData.length, message: '准备保存...' });
      setStep('parsing');
      
      const res = await fetch('/api/outbound-orders/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: savedData,
          fileName: file?.name,
          fileType,
          ruleId: selectedRuleId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setProgress({ percent: 100, current: savedData.length, total: savedData.length, message: '保存完成' });
        setResult({
          success: true,
          items: savedData,
        });
        setStep('result');
      } else {
        setResult({
          success: false,
          error: data.error || '保存失败',
          errorType: 'unknown',
        });
        setStep('result');
      }
    } catch (error: any) {
      console.error('保存失败:', error);
      setResult({
        success: false,
        error: error.message || '保存失败',
        errorType: 'unknown',
      });
      setStep('result');
    }
  };

  // 生成文件预览
  const generateFilePreview = async (file: File, buffer: ArrayBuffer): Promise<string> => {
    try {
      if (fileType === 'excel') {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer);
        const sheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        const preview = jsonData.slice(0, 10).map(row => 
          row.map(cell => String(cell || '')).join('\t')
        ).join('\n');
        return preview;
      } else if (fileType === 'pdf') {
        return '[PDF 文件内容需要 PDF 解析器]';
      } else if (fileType === 'word') {
        return '[Word 文件内容需要 Word 解析器]';
      }
      return '';
    } catch (error) {
      console.error('生成预览失败:', error);
      return '';
    }
  };

  // 取消解析
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    resetImporter();
  };

  // 重置导入器
  const resetImporter = () => {
    setStep('upload');
    setFile(null);
    setFileType(null);
    setSelectedRuleId('');
    setAiSuggestedRule(null);
    setProgress({ percent: 0, current: 0, total: 0, message: '' });
    setResult(null);
    setPreviewData([]);
    setRawFilePreview('');
    setShowRuleEditor(false);
    setEditingRule(null);
    setGroupedByStore(false);
  };

  // 规则编辑器保存完成
  const handleRuleSaveComplete = async (savedRule?: ParseRule) => {
    setShowRuleEditor(false);
    onRefreshRules();
    
    if (savedRule) {
      // 使用新保存的规则执行解析
      await executeParse(String(savedRule.id));
    } else {
      setStep('select-rule');
    }
  };

  // 渲染上传区域
  const renderUploadStep = () => (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] p-6">
      <h3 className="text-lg font-medium text-[#1f2937] mb-4">上传文件</h3>
      
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
          file
            ? 'border-[#0fc6c2] bg-[#e8fcfb]'
            : 'border-[#d1d5db] hover:border-[#0fc6c2] hover:bg-[#f9fafb]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.docx,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        
        <svg className="mx-auto h-16 w-16 text-[#9ca3af] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        
        <p className="text-base font-medium text-[#4b5563] mb-2">
          点击或拖拽文件到此处
        </p>
        <p className="text-sm text-[#6b7280]">
          支持 Excel（.xlsx/.xls）、Word（.docx）、PDF 文件，最大 50MB
        </p>
      </div>
    </div>
  );

  // 渲染选择规则步骤
  const renderSelectRuleStep = () => (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-[#1f2937]">选择解析规则</h3>
        <div className="flex items-center gap-2 text-sm text-[#6b7280]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{file?.name}</span>
          <span className="text-[#9ca3af]">({file && (file.size / 1024).toFixed(2)} KB)</span>
        </div>
      </div>

      {/* 已有规则列表 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#4b5563] mb-2">选择已有规则</label>
        <select
          value={selectedRuleId}
          onChange={(e) => setSelectedRuleId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2] bg-white"
        >
          <option value="">-- 选择规则 --</option>
          {rules.filter(r => r.isActive).map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.name} {rule.description ? `- ${rule.description}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleUseExistingRule}
          disabled={!selectedRuleId}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          使用此规则解析
        </button>
        
        <div className="flex items-center text-[#9ca3af]">或</div>
        
        <button
          onClick={handleCreateNewRule}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#0fc6c2] bg-white border border-[#0fc6c2] rounded-md hover:bg-[#f0fdfa] shadow-sm transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建规则（AI 辅助）
        </button>
        
        <button
          onClick={resetImporter}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#6b7280] bg-white border border-[#d1d5db] rounded-md hover:bg-[#f9fafb] shadow-sm transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );

  // 渲染 AI 分析步骤
  const renderAiAnalyzingStep = () => (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] p-6">
      <h3 className="text-lg font-medium text-[#1f2937] mb-4">AI 正在分析文件</h3>
      
      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-[#6b7280] mb-2">
          <span>{progress.message}</span>
          <span>{progress.percent}%</span>
        </div>
        <div className="w-full bg-[#e5e7eb] rounded-full h-2.5">
          <div 
            className="bg-[#0fc6c2] h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-8 w-8 text-[#0fc6c2]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleCancel}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#6b7280] bg-white border border-[#d1d5db] rounded-md hover:bg-[#f9fafb] shadow-sm transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );

  // 渲染解析进度步骤
  const renderParsingStep = () => (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] p-6">
      <h3 className="text-lg font-medium text-[#1f2937] mb-4">正在解析文件</h3>
      
      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-[#6b7280] mb-2">
          <span>{progress.message}</span>
          <span>{progress.percent}%</span>
        </div>
        <div className="w-full bg-[#e5e7eb] rounded-full h-3">
          <div 
            className="bg-[#0fc6c2] h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
      
      {/* 处理条数 */}
      {progress.total > 0 && (
        <div className="text-sm text-[#6b7280] mb-4">
          已处理 {progress.current} / {progress.total} 条数据
        </div>
      )}
      
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-8 w-8 text-[#0fc6c2]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleCancel}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 shadow-sm transition-colors"
        >
          取消解析
        </button>
      </div>
    </div>
  );

  // 渲染结果步骤
  const renderResultStep = () => (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] p-6">
      {result?.success ? (
        <>
          {/* 成功结果 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#1f2937]">导入成功</h3>
              <p className="text-sm text-[#6b7280]">共导入 {result.items?.length || 0} 条数据</p>
            </div>
          </div>
          
          {/* 预览数据表格 */}
          {previewData.length > 0 && (
            <div className="border border-[#d1d5db] rounded-lg overflow-x-auto mb-6">
              <table className="min-w-full text-sm">
                <thead className="bg-[#f9fafb]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase">外部编码</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase">收货门店</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase">收货人</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase">SKU编码</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase">SKU名称</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase">数量</th>
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
          )}
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                resetImporter();
                onImportComplete();
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] shadow-sm transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              完成
            </button>
            <button
              onClick={resetImporter}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#6b7280] bg-white border border-[#d1d5db] rounded-md hover:bg-[#f9fafb] shadow-sm transition-colors"
            >
              继续导入
            </button>
          </div>
        </>
      ) : (
        <>
          {/* 失败结果 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#1f2937]">导入失败</h3>
              <p className="text-sm text-red-600">{result?.error || '未知错误'}</p>
            </div>
          </div>
          
          {/* 原始文件信息 */}
          {result?.rawFileInfo && (
            <div className="bg-[#f9fafb] rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-[#374151] mb-2">原始文件信息</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-[#6b7280]">文件名：</span>{result.rawFileInfo.name}</div>
                <div><span className="text-[#6b7280]">大小：</span>{(result.rawFileInfo.size / 1024).toFixed(2)} KB</div>
                <div><span className="text-[#6b7280]">类型：</span>{result.rawFileInfo.type || '未知'}</div>
              </div>
              {result.rawFileInfo.preview && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-[#374151] mb-2">文件预览</h4>
                  <pre className="bg-white border border-[#e5e7eb] rounded p-3 text-xs overflow-auto max-h-40 font-mono">
                    {result.rawFileInfo.preview}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                setEditingRule(null);
                setShowRuleEditor(true);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] shadow-sm transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              手动配置规则
            </button>
            <button
              onClick={resetImporter}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#6b7280] bg-white border border-[#d1d5db] rounded-md hover:bg-[#f9fafb] shadow-sm transition-colors"
            >
              重新上传
            </button>
          </div>
        </>
      )}
      
    </div>
  );

  // 主渲染
  return (
    <div>
      {step === 'upload' && renderUploadStep()}
      {step === 'select-rule' && renderSelectRuleStep()}
      {step === 'ai-analyzing' && renderAiAnalyzingStep()}
      {step === 'confirm-rule' && !showRuleEditor && (
        <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] p-6">
          <h3 className="text-lg font-medium text-[#1f2937] mb-4">确认解析规则</h3>
          
          {aiSuggestedRule ? (
            <div className="mb-6">
              <p className="text-sm text-[#6b7280] mb-4">AI 已为您生成推荐规则，请确认或调整：</p>
              <div className="bg-[#f9fafb] rounded-lg p-4">
                <div className="font-medium text-[#1f2937] mb-2">{aiSuggestedRule.name}</div>
                <div className="text-sm text-[#6b7280]">{aiSuggestedRule.description}</div>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-sm text-[#6b7280]">AI 未能自动生成规则，请手动配置：</p>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                setEditingRule(aiSuggestedRule as ParseRule);
                setShowRuleEditor(true);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] shadow-sm transition-colors"
            >
              编辑规则
            </button>
            <button
              onClick={resetImporter}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#6b7280] bg-white border border-[#d1d5db] rounded-md hover:bg-[#f9fafb] shadow-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
      {step === 'confirm-rule' && showRuleEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <RuleEditor
              rule={editingRule}
              mode={editingRule ? 'edit' : 'create'}
              onClose={() => {
                setShowRuleEditor(false);
                setStep('select-rule');
              }}
              onSaveComplete={handleRuleSaveComplete}
              onParseComplete={(data, config) => {
                // 直接进入预览步骤
                setPreviewData(data.items);
                setGroupedByStore(false); // 不启用分组显示
                setShowRuleEditor(false);
                setStep('preview');
              }}
            />
          </div>
        </div>
      )}
      {step === 'parsing' && renderParsingStep()}
      {step === 'preview' && (
        <DataPreviewEditor
          initialData={previewData}
          existingExternalCodes={existingCodes}
          groupedByStore={groupedByStore}
          onSave={(savedData) => {
            // 调用保存API
            handleSaveData(savedData);
          }}
          onCancel={() => {
            resetImporter();
          }}
        />
      )}
      {step === 'result' && renderResultStep()}
      
      {/* 规则编辑器弹窗 - 在所有步骤中都可以显示 */}
      {showRuleEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <RuleEditor
              rule={editingRule}
              mode={editingRule ? 'edit' : 'create'}
              file={file}
              onClose={() => setShowRuleEditor(false)}
              onSaveComplete={handleRuleSaveComplete}
              onParseComplete={(data, config) => {
                // 直接进入预览步骤
                setPreviewData(data.items);
                setGroupedByStore(false); // 不启用分组显示
                setShowRuleEditor(false);
                setStep('preview');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}