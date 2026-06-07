'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { type ParsedItem } from '@/lib/parse-engine';
import * as XLSX from 'xlsx';

// 温层有效值
const VALID_TEMPERATURE_ZONES = ['常温', '冷藏', '冷冻', '深冷'];

// 表格列定义
interface ColumnDef {
  key: keyof ParsedItem;
  label: string;
  width: number;
  editable: boolean;
  required?: boolean;
  type?: 'text' | 'number' | 'phone' | 'temperature';
}

const COLUMNS: ColumnDef[] = [
  { key: 'externalCode', label: '外部编码', width: 120, editable: true, required: true },
  { key: 'storeName', label: '收货门店', width: 150, editable: true },
  { key: 'receiverName', label: '收货人', width: 100, editable: true },
  { key: 'receiverPhone', label: '收货电话', width: 130, editable: true, type: 'phone' },
  { key: 'receiverAddress', label: '收货地址', width: 200, editable: true },
  { key: 'skuCode', label: 'SKU编码', width: 120, editable: true, required: true },
  { key: 'skuName', label: 'SKU名称', width: 180, editable: true, required: true },
  { key: 'quantity', label: '数量', width: 80, editable: true, required: true, type: 'number' },
  { key: 'specification', label: '规格', width: 120, editable: true },
  { key: 'remark', label: '备注', width: 150, editable: true },
];

// 校验错误
interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
  type: 'required' | 'phone' | 'number' | 'temperature' | 'duplicate';
}

interface DataPreviewEditorProps {
  initialData: ParsedItem[];
  existingExternalCodes: string[]; // 已存在的外部编码
  onSave: (data: ParsedItem[]) => void;
  onCancel: () => void;
  groupedByStore?: boolean; // 是否按门店分组展示
}

export default function DataPreviewEditor({
  initialData,
  existingExternalCodes,
  onSave,
  onCancel,
  groupedByStore = false,
}: DataPreviewEditorProps) {
  const [data, setData] = useState<ParsedItem[]>(initialData);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showErrorPanel, setShowErrorPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list'); // 列表视图或分组视图
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 获取所有外部编码（含同批次）
  const allExternalCodes = useMemo(() => {
    const codes: string[] = [];
    data.forEach(item => {
      if (item.externalCode) codes.push(item.externalCode);
    });
    return codes;
  }, [data]);

  // 按门店分组的数据
  const groupedData = useMemo(() => {
    const groups: { storeName: string; items: ParsedItem[]; totalQuantity: number }[] = [];
    const storeMap = new Map<string, ParsedItem[]>();
    
    data.forEach(item => {
      const key = item.storeName || '未分组';
      if (!storeMap.has(key)) {
        storeMap.set(key, []);
      }
      storeMap.get(key)!.push(item);
    });
    
    storeMap.forEach((items, storeName) => {
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      groups.push({ storeName, items, totalQuantity });
    });
    
    return groups;
  }, [data]);

  // 校验单行数据
  const validateRow = useCallback((item: ParsedItem, rowIndex: number): ValidationError[] => {
    const errors: ValidationError[] = [];

    // 必填校验
    if (!item.externalCode || item.externalCode.trim() === '') {
      errors.push({ rowIndex, field: 'externalCode', message: '外部编码不能为空', type: 'required' });
    }
    if (!item.skuCode || item.skuCode.trim() === '') {
      errors.push({ rowIndex, field: 'skuCode', message: 'SKU编码不能为空', type: 'required' });
    }
    if (!item.skuName || item.skuName.trim() === '') {
      errors.push({ rowIndex, field: 'skuName', message: 'SKU名称不能为空', type: 'required' });
    }
    if (item.quantity === undefined || item.quantity === null) {
      errors.push({ rowIndex, field: 'quantity', message: '数量不能为空', type: 'required' });
    }

    // 电话格式校验
    if (item.receiverPhone && item.receiverPhone.trim() !== '') {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(item.receiverPhone.trim())) {
        errors.push({ rowIndex, field: 'receiverPhone', message: '电话格式错误（应为11位手机号）', type: 'phone' });
      }
    }

    // 数量校验（非正数）
    if (item.quantity !== undefined && item.quantity !== null) {
      const num = Number(item.quantity);
      if (isNaN(num) || num <= 0) {
        errors.push({ rowIndex, field: 'quantity', message: '数量必须为正数', type: 'number' });
      }
    }

    // 温层校验（如果有温层字段）
    const tempField = (item as any).temperatureZone;
    if (tempField && tempField.trim() !== '' && !VALID_TEMPERATURE_ZONES.includes(tempField.trim())) {
      errors.push({ rowIndex, field: 'temperatureZone', message: `温层值必须在 [${VALID_TEMPERATURE_ZONES.join(', ')}] 范围内`, type: 'temperature' });
    }

    return errors;
  }, []);

  // 校验重复外部编码（只检查与数据库的重复，同批次内允许重复）
  const validateDuplicates = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];

    // 只检查与数据库的重复，同批次内允许重复
    data.forEach((item, index) => {
      if (item.externalCode && existingExternalCodes.includes(item.externalCode)) {
        errors.push({
          rowIndex: index,
          field: 'externalCode',
          message: `外部编码 "${item.externalCode}" 已存在于数据库中`,
          type: 'duplicate',
        });
      }
    });

    return errors;
  }, [data, existingExternalCodes]);

  // 执行全部校验
  const runValidation = useCallback(() => {
    const allErrors: ValidationError[] = [];
    data.forEach((item, index) => {
      allErrors.push(...validateRow(item, index));
    });
    allErrors.push(...validateDuplicates());
    setValidationErrors(allErrors);
    return allErrors;
  }, [data, validateRow, validateDuplicates]);

  // 数据变化时自动校验
  useEffect(() => {
    runValidation();
  }, [runValidation]);

  // 获取单元格错误
  const getCellErrors = (rowIndex: number, field: string): ValidationError[] => {
    return validationErrors.filter(e => e.rowIndex === rowIndex && e.field === field);
  };

  // 判断单元格是否有错误
  const hasCellError = (rowIndex: number, field: string): boolean => {
    return getCellErrors(rowIndex, field).length > 0;
  };

  // 开始编辑单元格
  const startEdit = (rowIndex: number, col: ColumnDef) => {
    if (!col.editable) return;
    const value = data[rowIndex][col.key];
    setEditingCell({ row: rowIndex, col: col.key as string });
    setEditValue(value !== undefined && value !== null ? String(value) : '');
  };

  // 完成编辑
  const finishEdit = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const colDef = COLUMNS.find(c => c.key === col);
    
    setData(prev => {
      const newData = [...prev];
      const item = { ...newData[row] };
      
      if (colDef?.type === 'number') {
        const num = parseFloat(editValue);
        (item as any)[col] = isNaN(num) ? 0 : num;
      } else {
        (item as any)[col] = editValue;
      }
      
      newData[row] = item;
      return newData;
    });
    
    setEditingCell(null);
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // 删除行
  const deleteRow = (rowIndex: number) => {
    setData(prev => prev.filter((_, i) => i !== rowIndex));
  };

  // 新增空行
  const addEmptyRow = () => {
    const emptyItem: ParsedItem = {
      externalCode: '',
      storeName: '',
      receiverName: '',
      receiverPhone: '',
      receiverAddress: '',
      skuCode: '',
      skuName: '',
      quantity: 0,
      specification: '',
      remark: '',
    };
    setData(prev => [...prev, emptyItem]);
  };

  // 导出 Excel
  const exportExcel = () => {
    const exportData = data.map(item => ({
      '外部编码': item.externalCode || '',
      '收货门店': item.storeName || '',
      '收货人': item.receiverName || '',
      '收货电话': item.receiverPhone || '',
      '收货地址': item.receiverAddress || '',
      'SKU编码': item.skuCode || '',
      'SKU名称': item.skuName || '',
      '数量': item.quantity || 0,
      '规格': item.specification || '',
      '备注': item.remark || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '数据预览');
    
    // 设置列宽
    const colWidths = [
      { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
      { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 10 },
      { wch: 15 }, { wch: 20 },
    ];
    worksheet['!cols'] = colWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `数据预览_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 保存数据
  const handleSave = () => {
    const errors = runValidation();
    if (errors.length > 0) {
      setShowErrorPanel(true);
      return;
    }
    onSave(data);
  };

  // 错误统计
  const errorStats = useMemo(() => {
    const stats = {
      required: 0,
      phone: 0,
      number: 0,
      temperature: 0,
      duplicate: 0,
      total: validationErrors.length,
    };
    validationErrors.forEach(e => {
      stats[e.type]++;
    });
    return stats;
  }, [validationErrors]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] flex flex-col h-[calc(100vh-200px)]">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb] bg-[#f9fafb]">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium text-[#1f2937]">数据预览与编辑</h3>
          <span className="text-sm text-[#6b7280]">共 {data.length} 条</span>
          {groupedByStore && (
            <div className="flex items-center gap-1 bg-white border border-[#d1d5db] rounded overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#0fc6c2] text-white'
                    : 'text-[#6b7280] hover:bg-[#f3f4f6]'
                }`}
              >
                列表视图
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-[#0fc6c2] text-white'
                    : 'text-[#6b7280] hover:bg-[#f3f4f6]'
                }`}
              >
                分组视图 ({groupedData.length}个门店)
              </button>
            </div>
          )}
          {validationErrors.length > 0 && (
            <button
              onClick={() => setShowErrorPanel(!showErrorPanel)}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {validationErrors.length} 个错误
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addEmptyRow}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-[#0fc6c2] bg-white border border-[#0fc6c2] rounded hover:bg-[#f0fdfa] transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增行
          </button>
          <button
            onClick={exportExcel}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-[#6b7280] bg-white border border-[#d1d5db] rounded hover:bg-[#f9fafb] transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 Excel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center px-4 py-1.5 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded hover:bg-[#0dafab] transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            确认保存
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-[#6b7280] bg-white border border-[#d1d5db] rounded hover:bg-[#f9fafb] transition-colors"
          >
            取消
          </button>
        </div>
      </div>

      {/* 错误面板 */}
      {showErrorPanel && validationErrors.length > 0 && (
        <div className="border-b border-[#e5e7eb] bg-red-50 px-4 py-3 max-h-48 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-red-700">校验错误汇总</h4>
            <button
              onClick={() => setShowErrorPanel(false)}
              className="text-red-400 hover:text-red-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="text-xs text-red-600 mb-2">
            必填缺失: {errorStats.required} | 电话错误: {errorStats.phone} | 数量错误: {errorStats.number} | 温层错误: {errorStats.temperature} | 重复编码: {errorStats.duplicate}
          </div>
          <div className="space-y-1">
            {validationErrors.map((error, idx) => (
              <div
                key={idx}
                className="text-xs text-red-600 cursor-pointer hover:bg-red-100 rounded px-2 py-1"
                onClick={() => {
                  // 滚动到对应行
                  const rowElement = document.getElementById(`row-${error.rowIndex}`);
                  if (rowElement) {
                    rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    rowElement.classList.add('bg-yellow-100');
                    setTimeout(() => rowElement.classList.remove('bg-yellow-100'), 2000);
                  }
                }}
              >
                第 {error.rowIndex + 1} 行 - {COLUMNS.find(c => c.key === error.field)?.label || error.field}: {error.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 表格区域 */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        {viewMode === 'grouped' && groupedByStore ? (
          <div className="p-4 space-y-4">
            {groupedData.map((group, groupIndex) => (
              <div key={group.storeName} className="border border-[#d1d5db] rounded-lg overflow-hidden">
                {/* 门店标题栏 */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#0fc6c2] text-white">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{group.storeName}</span>
                    <span className="text-xs opacity-80">({group.items.length}种商品)</span>
                  </div>
                  <span className="text-sm">总计: {group.totalQuantity} 件</span>
                </div>
                {/* 门店商品列表 */}
                <table className="min-w-full text-sm">
                  <thead className="bg-[#f3f4f6]">
                    <tr>
                      <th className="px-3 py-2 text-xs font-medium text-[#6b7280] border-b border-r border-[#d1d5db] w-12 text-center">
                        序号
                      </th>
                      {COLUMNS.filter(col => col.key !== 'storeName').map(col => (
                        <th
                          key={col.key as string}
                          className="px-3 py-2 text-xs font-medium text-[#6b7280] border-b border-r border-[#d1d5db] text-left whitespace-nowrap"
                          style={{ minWidth: col.width }}
                        >
                          {col.label}
                          {col.required && <span className="text-red-500 ml-0.5">*</span>}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-xs font-medium text-[#6b7280] border-b border-l border-[#d1d5db] w-16 text-center">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {group.items.map((item, itemIndex) => {
                      const globalIndex = data.findIndex(d => d === item);
                      const rowHasError = validationErrors.some(e => e.rowIndex === globalIndex);
                      return (
                        <tr
                          key={globalIndex}
                          id={`row-${globalIndex}`}
                          className={`hover:bg-[#f9fafb] transition-colors ${rowHasError ? 'bg-red-50/30' : ''}`}
                        >
                          <td className="px-2 py-1.5 text-xs text-[#9ca3af] border-r border-[#e5e7eb] text-center">
                            {itemIndex + 1}
                          </td>
                          {COLUMNS.filter(col => col.key !== 'storeName').map(col => {
                            const isEditing = editingCell?.row === globalIndex && editingCell?.col === col.key;
                            const cellErrors = getCellErrors(globalIndex, col.key as string);
                            const hasError = cellErrors.length > 0;
                            const value = item[col.key];

                            return (
                              <td
                                key={col.key as string}
                                className={`px-2 py-1.5 border-r border-[#e5e7eb] relative ${
                                  hasError ? 'bg-red-50' : ''
                                } ${col.editable ? 'cursor-pointer' : ''}`}
                                style={{ minWidth: col.width }}
                                onClick={() => !isEditing && startEdit(globalIndex, col)}
                              >
                                {isEditing ? (
                                  <input
                                    ref={inputRef}
                                    type={col.type === 'number' ? 'number' : 'text'}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={finishEdit}
                                    onKeyDown={handleKeyDown}
                                    className="w-full px-1 py-0.5 text-sm border border-[#0fc6c2] rounded outline-none bg-white"
                                    autoFocus
                                  />
                                ) : (
                                  <div className="relative">
                                    <span className={`text-[#1f2937] ${hasError ? 'text-red-700' : ''}`}>
                                      {value !== undefined && value !== null && value !== ''
                                        ? String(value)
                                        : <span className="text-[#d1d5db]">-</span>
                                      }
                                    </span>
                                    {hasError && (
                                      <div className="absolute -top-1 -right-1">
                                        <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {hasError && !isEditing && (
                                  <div className="text-[10px] text-red-600 mt-0.5 leading-tight break-all">
                                    {cellErrors.map(e => e.message).join('; ')}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 border-l border-[#e5e7eb] text-center">
                            <button
                              onClick={() => deleteRow(globalIndex)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="删除行"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <table className="min-w-full text-sm border-collapse">
            {/* 固定表头 */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#f3f4f6]">
                <th className="sticky left-0 z-20 bg-[#f3f4f6] px-2 py-2 text-xs font-medium text-[#6b7280] border-b border-r border-[#d1d5db] w-12 text-center">
                  序号
                </th>
                {COLUMNS.map(col => (
                  <th
                    key={col.key as string}
                    className="px-3 py-2 text-xs font-medium text-[#6b7280] border-b border-r border-[#d1d5db] text-left whitespace-nowrap"
                    style={{ minWidth: col.width }}
                  >
                    {col.label}
                    {col.required && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                ))}
                <th className="sticky right-0 z-20 bg-[#f3f4f6] px-2 py-2 text-xs font-medium text-[#6b7280] border-b border-l border-[#d1d5db] w-16 text-center">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {data.map((item, rowIndex) => {
                const rowHasError = validationErrors.some(e => e.rowIndex === rowIndex);
                return (
                  <tr
                    key={rowIndex}
                    id={`row-${rowIndex}`}
                    className={`hover:bg-[#f9fafb] transition-colors ${rowHasError ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs text-[#9ca3af] border-r border-[#e5e7eb] text-center">
                      {rowIndex + 1}
                    </td>
                    {COLUMNS.map(col => {
                      const isEditing = editingCell?.row === rowIndex && editingCell?.col === col.key;
                      const cellErrors = getCellErrors(rowIndex, col.key as string);
                      const hasError = cellErrors.length > 0;
                      const value = item[col.key];

                      return (
                        <td
                          key={col.key as string}
                          className={`px-2 py-1.5 border-r border-[#e5e7eb] relative ${
                            hasError ? 'bg-red-50' : ''
                          } ${col.editable ? 'cursor-pointer' : ''}`}
                          style={{ minWidth: col.width }}
                          onClick={() => !isEditing && startEdit(rowIndex, col)}
                        >
                          {isEditing ? (
                            <input
                              ref={inputRef}
                              type={col.type === 'number' ? 'number' : 'text'}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={finishEdit}
                              onKeyDown={handleKeyDown}
                              className="w-full px-1 py-0.5 text-sm border border-[#0fc6c2] rounded outline-none bg-white"
                              autoFocus
                            />
                          ) : (
                            <div className="relative">
                              <span className={`text-[#1f2937] ${hasError ? 'text-red-700' : ''}`}>
                                {value !== undefined && value !== null && value !== ''
                                  ? String(value)
                                  : <span className="text-[#d1d5db]">-</span>
                              }
                            </span>
                            {hasError && (
                              <div className="absolute -top-1 -right-1">
                                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        )}
                        {/* 错误提示 */}
                        {hasError && !isEditing && (
                          <div className="text-[10px] text-red-600 mt-0.5 leading-tight break-all">
                            {cellErrors.map(e => e.message).join('; ')}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 bg-white px-2 py-1.5 border-l border-[#e5e7eb] text-center">
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="删除行"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        )}
      </div>

      {/* 底部统计 */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#e5e7eb] bg-[#f9fafb] text-xs text-[#6b7280]">
        <div>
          共 {data.length} 行 | 
          {validationErrors.length > 0 ? (
            <span className="text-red-600 ml-1">{validationErrors.length} 个错误待修复</span>
          ) : (
            <span className="text-green-600 ml-1">数据校验通过</span>
          )}
        </div>
        <div className="flex gap-4">
          <span>必填缺失: {errorStats.required}</span>
          <span>电话错误: {errorStats.phone}</span>
          <span>数量错误: {errorStats.number}</span>
          <span>重复编码: {errorStats.duplicate}</span>
        </div>
      </div>
    </div>
  );
}