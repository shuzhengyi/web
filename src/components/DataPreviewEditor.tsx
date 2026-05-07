'use client';

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

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

interface SubmitResult {
  success: boolean;
  successCount: number;
  failCount: number;
  errors: ValidationError[];
  duplicates: DuplicateInfo[];
  message: string;
}

interface DataPreviewEditorProps {
  data: any[];
  headers: string[];
  errors: ValidationError[];
  duplicates: DuplicateInfo[];
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
}

const fieldDisplayNames: Record<string, string> = {
  customerOrderNumber: '客户单号',
  goodsName: '产品名称',
  senderName: '发件人',
  senderPhone: '发件电话',
  senderAddress: '发件地址',
  receiverName: '收件人',
  receiverPhone: '收件电话',
  receiverAddress: '收件地址',
  goodsWeight: '重量',
  goodsPieces: '件数',
  goodsType: '温层',
  remark: '备注'
};

const requiredFields = ['senderName', 'senderPhone', 'senderAddress', 'receiverName', 'receiverPhone', 'receiverAddress', 'goodsWeight', 'customerOrderNumber'];

const numericFields = ['goodsWeight', 'goodsQuantity'];

const validGoodsTypes = ['常温', '冷藏', '冷冻', 'normal', 'cold', 'frozen'];

const allFields = [
  'customerOrderNumber',
  'goodsName',
  'senderName',
  'senderPhone',
  'senderAddress',
  'receiverName',
  'receiverPhone',
  'receiverAddress',
  'goodsWeight',
  'goodsPieces',
  'goodsType',
  'remark'
];

function validateCell(field: string, value: any): string | null {
  const val = value ?? '';
  
  if (requiredFields.includes(field) && !val) {
    return `${fieldDisplayNames[field] || field}不能为空`;
  }
  
  if (field === 'senderPhone' || field === 'receiverPhone') {
    const phone = String(val).replace(/\s/g, '');
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return '电话号码格式错误，应为11位手机号';
    }
  }
  
  if (numericFields.includes(field)) {
    const num = parseFloat(String(val));
    if (val && (isNaN(num) || num <= 0)) {
      return `${fieldDisplayNames[field] || field}必须为正数`;
    }
    if ((field === 'goodsPieces' || field === 'goodsQuantity') && val && !Number.isInteger(num)) {
      return `${fieldDisplayNames[field] || field}必须为整数`;
    }
  }
  
  if (field === 'goodsType' && val) {
    const typeStr = String(val).toLowerCase();
    if (!validGoodsTypes.some(t => typeStr.includes(t.toLowerCase()))) {
      return '温层必须为：常温、冷藏或冷冻';
    }
  }
  
  return null;
}

export default function DataPreviewEditor({ 
  data, 
  headers, 
  errors, 
  duplicates: initialDuplicates, 
  onClose, 
  onImport 
}: DataPreviewEditorProps) {
  const processedData = data.map(row => ({
    ...row,
    goodsPieces: row.goodsPieces || row.goodsQuantity || 1
  }));
  const [rows, setRows] = useState<any[]>(processedData);
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [rowErrors, setRowErrors] = useState<Map<number, Map<string, string>>>(new Map());
  const [backendErrors, setBackendErrors] = useState<Map<number, Map<string, string>>>(new Map());
  const [tooltipData, setTooltipData] = useState<{ row: number; field: string; x: number; y: number } | null>(null);
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [showSubmitProgress, setShowSubmitProgress] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [showSubmitResult, setShowSubmitResult] = useState(false);

  const checkCurrentDuplicates = useCallback(() => {
    const currentDuplicates: DuplicateInfo[] = [];
    const seenCodes = new Map<string, number>();
    
    for (let i = 0; i < rows.length; i++) {
      const code = rows[i].customerOrderNumber;
      if (code) {
        if (seenCodes.has(code)) {
          currentDuplicates.push({ row: i + 1, duplicateWith: seenCodes.get(code)! + 1, type: 'batch' });
        } else {
          seenCodes.set(code, i);
        }
      }
    }
    
    return currentDuplicates;
  }, [rows]);

  const validateAllRows = useCallback(() => {
    const newErrors = new Map<number, Map<string, string>>();
    
    rows.forEach((row, index) => {
      const fieldErrors = new Map<string, string>();
      
      if (backendErrors.has(index)) {
        const existingErrors = backendErrors.get(index)!;
        existingErrors.forEach((message, field) => {
          fieldErrors.set(field, message);
        });
      }
      
      allFields.forEach(field => {
        const error = validateCell(field, row[field]);
        if (error) {
          fieldErrors.set(field, error);
        }
      });
      
      if (fieldErrors.size > 0) {
        newErrors.set(index, fieldErrors);
      }
    });
    
    setRowErrors(newErrors);
  }, [rows, backendErrors]);

  useEffect(() => {
    validateAllRows();
  }, [validateAllRows]);

  const getFieldError = (rowIndex: number, field: string): string | null => {
    const rowMap = rowErrors.get(rowIndex);
    if (rowMap) {
      return rowMap.get(field) || null;
    }
    return null;
  };

  const hasRowErrors = (rowIndex: number): boolean => {
    return rowErrors.has(rowIndex);
  };

  const getRowDuplicates = (rowIndex: number) => {
    const currentDuplicates = checkCurrentDuplicates();
    return currentDuplicates.filter(d => d.row === rowIndex + 1);
  };

  const handleCellClick = (rowIndex: number, field: string, value: any) => {
    setEditingCell({ row: rowIndex, field });
    setEditValue(value ?? '');
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const newRows = [...rows];
      const value = editValue === '' ? null : editValue;
      newRows[editingCell.row][editingCell.field] = value;
      setRows(newRows);
      
      if (backendErrors.has(editingCell.row)) {
        const newBackendErrors = new Map(backendErrors);
        const rowErrors = new Map(newBackendErrors.get(editingCell.row)!);
        rowErrors.delete(editingCell.field);
        if (rowErrors.size === 0) {
          newBackendErrors.delete(editingCell.row);
        } else {
          newBackendErrors.set(editingCell.row, rowErrors);
        }
        setBackendErrors(newBackendErrors);
      }
      
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (confirm('确定要删除这一行吗？')) {
      const newRows = rows.filter((_, i) => i !== rowIndex);
      setRows(newRows);
      
      const newBackendErrors = new Map<number, Map<string, string>>();
      backendErrors.forEach((errors, idx) => {
        if (idx < rowIndex) {
          newBackendErrors.set(idx, errors);
        } else if (idx > rowIndex) {
          newBackendErrors.set(idx - 1, errors);
        }
      });
      setBackendErrors(newBackendErrors);
    }
  };

  const handleAddRow = () => {
    const newRow: any = {};
    allFields.forEach(field => {
      newRow[field] = null;
    });
    setRows([...rows, newRow]);
  };

  const handleExport = () => {
    const exportData = rows.map(row => {
      const exportRow: any = {};
      allFields.forEach(field => {
        exportRow[fieldDisplayNames[field] || field] = row[field] ?? '';
      });
      return exportRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '订单数据');
    XLSX.writeFile(workbook, '订单数据_修改.xlsx');
  };

  const handleSubmit = async () => {
    const invalidCount = rows.filter((_, i) => hasRowErrors(i)).length;
    const currentDuplicates = checkCurrentDuplicates();
    
    if (invalidCount > 0 || currentDuplicates.length > 0) {
      setSubmitResult({
        success: false,
        successCount: 0,
        failCount: invalidCount + currentDuplicates.length,
        errors: Array.from(rowErrors.entries()).flatMap(([rowIndex, fieldErrors]) => 
          Array.from(fieldErrors.entries()).map(([field, message]) => ({
            row: rowIndex + 1,
            field,
            message
          }))
        ),
        duplicates: currentDuplicates,
        message: invalidCount > 0 ? '有错误的行不允许提交，请先修正错误' : '存在重复的客户单号，请先处理重复数据'
      });
      setShowSubmitResult(true);
      return;
    }

    setShowSubmitProgress(true);
    setSubmitProgress({ current: 0, total: rows.length, percent: 0 });

    try {
      const interval = setInterval(() => {
        setSubmitProgress(prev => {
          const next = Math.min(prev.current + Math.ceil(rows.length / 10), rows.length);
          return {
            current: next,
            total: rows.length,
            percent: Math.round((next / rows.length) * 100)
          };
        });
        if (submitProgress.current >= rows.length) {
          clearInterval(interval);
        }
      }, 200);

      const formData = new FormData();
      formData.append('importData', JSON.stringify(rows));

      const response = await fetch('/api/orders/import', {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);
      setSubmitProgress({ current: rows.length, total: rows.length, percent: 100 });

      if (response.ok) {
        const result = await response.json();
        setSubmitResult({
          success: result.success,
          successCount: result.successCount,
          failCount: result.failCount,
          errors: result.errors || [],
          duplicates: result.duplicates || [],
          message: result.message || '提交成功'
        });
      } else {
        const error = await response.json();
        setSubmitResult({
          success: false,
          successCount: 0,
          failCount: rows.length,
          errors: error.errors || [],
          duplicates: error.duplicates || [],
          message: error.message || '提交失败'
        });
      }

      setTimeout(() => {
        setShowSubmitProgress(false);
        setShowSubmitResult(true);
      }, 500);

    } catch (error) {
      setShowSubmitProgress(false);
      setSubmitResult({
        success: false,
        successCount: 0,
        failCount: rows.length,
        errors: [],
        duplicates: [],
        message: `提交失败: ${(error as Error).message}`
      });
      setShowSubmitResult(true);
    }
  };

  const handleResultClose = () => {
    setShowSubmitResult(false);
    
    if (submitResult?.success) {
      setBackendErrors(new Map());
      onImport(rows);
    } else if (submitResult) {
      const newBackendErrors = new Map<number, Map<string, string>>();
      
      submitResult.errors.forEach(error => {
        const rowIndex = error.row - 1;
        if (!newBackendErrors.has(rowIndex)) {
          newBackendErrors.set(rowIndex, new Map<string, string>());
        }
        newBackendErrors.get(rowIndex)!.set(error.field, error.message);
      });
      
      submitResult.duplicates.forEach(dup => {
        const rowIndex = dup.row - 1;
        if (!newBackendErrors.has(rowIndex)) {
          newBackendErrors.set(rowIndex, new Map<string, string>());
        }
        const message = dup.type === 'batch' 
          ? `客户单号与第${dup.duplicateWith}行重复` 
          : '客户单号在数据库中已存在';
        newBackendErrors.get(rowIndex)!.set('customerOrderNumber', message);
      });
      
      setBackendErrors(newBackendErrors);
    }
    
    setSubmitResult(null);
  };

  const handleMouseEnter = (e: React.MouseEvent, rowIndex: number, field: string) => {
    const fieldError = getFieldError(rowIndex, field);
    if (fieldError) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipData({
        row: rowIndex,
        field,
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltipData(null);
  };

  const validCount = rows.filter((_, i) => !hasRowErrors(i)).length;
  const invalidCount = rows.length - validCount;

  const allErrorsList: { row: number; field: string; message: string }[] = [];
  rowErrors.forEach((fields, rowIndex) => {
    fields.forEach((message, field) => {
      allErrorsList.push({ row: rowIndex + 1, field, message });
    });
  });

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-xl font-bold">数据预览与编辑</h2>
              <div className="flex items-center gap-4 mt-1 text-sm">
                <span className="text-green-600">正常: {validCount} 条</span>
                <span className="text-red-600">错误: {invalidCount} 条</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddRow}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                + 新增行
              </button>
              <button
                onClick={handleExport}
                className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
              >
                导出Excel
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto overflow-x-auto">
              <table className="w-full border-collapse min-w-[1400px]">
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th className="border px-3 py-2 text-sm font-medium text-gray-500 bg-gray-50 w-14">序号</th>
                    {allFields.map(field => (
                      <th key={field} className="border px-3 py-2 text-sm font-medium text-gray-500 bg-gray-50 min-w-[140px] sticky top-0">
                        {fieldDisplayNames[field] || field}
                        {requiredFields.includes(field) && <span className="text-red-500 ml-1">*</span>}
                      </th>
                    ))}
                    <th className="border px-3 py-2 text-sm font-medium text-gray-500 bg-gray-50 min-w-[200px]">错误信息</th>
                    <th className="border px-3 py-2 text-sm font-medium text-gray-500 bg-gray-50 w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const hasError = hasRowErrors(rowIndex);
                    const rowDuplicates = getRowDuplicates(rowIndex);

                    return (
                      <tr key={rowIndex} className={hasError || rowDuplicates.length > 0 ? 'bg-red-50' : ''}>
                        <td className="border px-3 py-2 text-center text-sm font-medium">
                          {rowIndex + 1}
                          {rowDuplicates.length > 0 && (
                            <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1 rounded">重复</span>
                          )}
                        </td>
                        {allFields.map(field => {
                          const fieldError = getFieldError(rowIndex, field);
                          const isEditing = editingCell?.row === rowIndex && editingCell?.field === field;

                          return (
                            <td key={field} className="border px-2 py-1 relative">
                              {isEditing ? (
                                <input
                                  type={numericFields.includes(field) ? 'number' : 'text'}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleKeyDown}
                                  autoFocus
                                  className="w-full px-2 py-1 text-sm border-2 border-blue-500 rounded focus:outline-none"
                                  placeholder={fieldDisplayNames[field]}
                                />
                              ) : (
                                <div
                                  onClick={() => handleCellClick(rowIndex, field, row[field])}
                                  onMouseEnter={(e) => handleMouseEnter(e, rowIndex, field)}
                                  onMouseLeave={handleMouseLeave}
                                  className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-blue-50 min-h-[28px] rounded transition-colors ${
                                    fieldError ? 'bg-red-100 border border-red-300' : 'hover:border-blue-300'
                                  }`}
                                >
                                  {row[field] ?? (requiredFields.includes(field) ? <span className="text-gray-300 italic">必填</span> : '')}
                                </div>
                              )}
                              {fieldError && tooltipData?.row === rowIndex && tooltipData?.field === field && (
                                <div 
                                  className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg z-20 whitespace-nowrap"
                                >
                                  {fieldError}
                                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                    <div className="border-4 border-transparent border-t-gray-800"></div>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="border px-2 py-1">
                          <div className="max-h-24 overflow-y-auto">
                            {rowErrors.has(rowIndex) && Array.from(rowErrors.get(rowIndex)!.values()).map((error, idx) => (
                              <div key={idx} className="text-xs text-red-600 mb-1">
                                • {error}
                              </div>
                            ))}
                            {rowDuplicates.length > 0 && rowDuplicates.map((dup, idx) => (
                              <div key={`dup-${idx}`} className="text-xs text-orange-600 mb-1">
                                • {dup.type === 'batch' ? `客户单号与第${dup.duplicateWith}行重复` : '客户单号在数据库中已存在'}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="border px-2 py-1 text-center">
                          <button
                            onClick={() => handleDeleteRow(rowIndex)}
                            className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t p-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {invalidCount > 0 ? (
                <span className="text-red-600 font-medium">有错误的行不允许提交，请先修正错误</span>
              ) : (
                <span>数据校验通过，可以提交</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || invalidCount > 0}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? '提交中...' : '提交下单'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSubmitProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-96 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">正在提交订单...</h3>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${submitProgress.percent}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {submitProgress.current} / {submitProgress.total} ({submitProgress.percent}%)
            </p>
          </div>
        </div>
      )}

      {showSubmitResult && submitResult && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="text-center mb-4">
              <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                submitResult.success ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {submitResult.success ? (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                submitResult.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {submitResult.success ? '提交成功' : '提交失败'}
              </h3>
              <p className="text-gray-600">{submitResult.message}</p>
            </div>
            
            <div className="flex items-center justify-center gap-8 mb-4">
              <div>
                <div className="text-2xl font-bold text-green-600">{submitResult.successCount}</div>
                <div className="text-sm text-gray-500">成功</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{submitResult.failCount}</div>
                <div className="text-sm text-gray-500">失败</div>
              </div>
            </div>
            
            {(!submitResult.success && (submitResult.errors.length > 0 || submitResult.duplicates.length > 0)) && (
              <div className="flex-1 overflow-auto bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-gray-700 mb-3">错误详情</h4>
                <div className="space-y-2">
                  {submitResult.errors.map((error, index) => (
                    <div key={`error-${index}`} className="text-sm text-red-600 flex items-start gap-2">
                      <span className="font-medium">第{error.row}行</span>
                      <span className="text-gray-500">{fieldDisplayNames[error.field] || error.field}:</span>
                      <span>{error.message}</span>
                    </div>
                  ))}
                  {submitResult.duplicates.map((dup, index) => (
                    <div key={`dup-${index}`} className="text-sm text-orange-600 flex items-start gap-2">
                      <span className="font-medium">第{dup.row}行</span>
                      <span>{dup.type === 'batch' ? `客户单号与第${dup.duplicateWith}行重复` : '客户单号在数据库中已存在'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={handleResultClose}
              className={`px-6 py-2 rounded font-medium transition-colors ${
                submitResult.success 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {submitResult.success ? '确定' : '返回修改'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
