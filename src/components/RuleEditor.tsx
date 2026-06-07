'use client';

import { useState, useEffect } from 'react';
import { ParseRule } from '@/generated/prisma/client';
import { ParseEngine, type ParseConfig, type ParseResult } from '@/lib/parse-engine';
import { parseExcelWithAI, detectExcelFormat } from '@/lib/zhipu-ai';
import * as XLSX from 'xlsx';

interface RuleEditorProps {
  rule: ParseRule | null;
  onClose: () => void;
  onSaveComplete: (savedRule?: ParseRule) => void;
  onParseComplete?: (data: ParseResult, config: ParseConfig) => void;
  mode?: 'create' | 'edit'; // create: 新增规则, edit: 编辑规则
  file?: File | null; // 从外部传入的文件，用于预览
}

interface FieldMapping {
  targetField: string;
  sourceColumn: string;
  transform?: string;
  section?: 'header' | 'data' | 'footer';  // 数据分类：头部、主体、尾部
  id?: string; // 用于标识多个映射的唯一ID
}

interface ExtraFieldConfig {
  row: number;
  col: number;
}

const TARGET_FIELDS = [
  { key: 'externalCode', label: '外部编码', required: false, defaultSection: 'data' as const },
  { key: 'storeName', label: '收货门店', required: false, defaultSection: 'data' as const },
  { key: 'receiverName', label: '收货人姓名', required: false, defaultSection: 'data' as const },
  { key: 'receiverPhone', label: '收货人电话', required: false, defaultSection: 'data' as const },
  { key: 'receiverAddress', label: '收货人地址', required: false, defaultSection: 'data' as const },
  { key: 'skuCode', label: 'SKU 编码', required: true, defaultSection: 'data' as const },
  { key: 'skuName', label: 'SKU 名称', required: true, defaultSection: 'data' as const },
  { key: 'quantity', label: '发货数量', required: true, defaultSection: 'data' as const },
  { key: 'specification', label: '规格型号', required: false, defaultSection: 'data' as const },
  { key: 'remark', label: '备注', required: false, defaultSection: 'data' as const },
];

export default function RuleEditor({ rule, onClose, onSaveComplete, mode = 'create', onParseComplete, file }: RuleEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fileType, setFileType] = useState('excel');
  const [isActive, setIsActive] = useState(true);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [rawFileData, setRawFileData] = useState<any[][]>([]);
  // 三部分预览数据
  const [headerSectionData, setHeaderSectionData] = useState<{ [key: string]: string }[]>([]);
  const [dataSectionData, setdataSectionData] = useState<any[][]>([]);
  const [footerSectionData, setFooterSectionData] = useState<{ [key: string]: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 手动设置主体起始行（1-based）
  const [manualHeaderRow, setManualHeaderRow] = useState<number | null>(null);
  // 矩阵转置配置
  interface MatrixConfig {
    id: string;
    name: string; // 矩阵的列名（如"门店"）
    valueName: string; // 列值对应的名称（如"门店名称"）
    columns: number[];
  }
  const [matrixTransposeEnabled, setMatrixTransposeEnabled] = useState(false);
  const [matrices, setMatrices] = useState<MatrixConfig[]>([{ id: '1', name: '门店', valueName: '门店名称', columns: [] }]); // 支持多个矩阵
  
  // 卡片分组配置
  interface CardHeaderMapping {
    [rowOffset: number]: {
      [colIndex: number]: string;
    };
  }
  const [cardGroupEnabled, setCardGroupEnabled] = useState(false);
  const [cardGroupKeyword, setCardGroupKeyword] = useState('');
  const [cardGroupMatchMode, setCardGroupMatchMode] = useState<'contains' | 'startsWith' | 'exact'>('contains');
  const [cardHeaderMapping, setCardHeaderMapping] = useState<CardHeaderMapping>({});

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setFileType(rule.fileType);
      setIsActive(rule.isActive);
      
      const config = rule.config as any;
      if (config) {
        const mappings: FieldMapping[] = [];
        if (config.fieldMapping) {
          for (const [targetField, mapping] of Object.entries(config.fieldMapping)) {
            // 查找对应的字段信息以获取默认 section
            const fieldInfo = TARGET_FIELDS.find(f => f.key === targetField);
            const defaultSection = fieldInfo?.defaultSection || 'data';
            
            if (Array.isArray(mapping)) {
              mapping.forEach((m, index) => {
                if (typeof m === 'string') {
                  mappings.push({ 
                    targetField, 
                    sourceColumn: m,
                    section: defaultSection,
                    id: `${targetField}-${index}`
                  });
                } else {
                  const config = m as { column: string; transform?: string; section?: 'data' | 'header' | 'footer' };
                  mappings.push({ 
                    targetField, 
                    sourceColumn: config.column, 
                    transform: config.transform,
                    section: config.section || defaultSection,
                    id: `${targetField}-${index}`
                  });
                }
              });
            } else if (typeof mapping === 'string') {
              mappings.push({ 
                targetField, 
                sourceColumn: mapping,
                section: defaultSection,
                id: `${targetField}-0`
              });
            } else {
              const m = mapping as { column: string; transform?: string; section?: 'data' | 'header' | 'footer' };
              mappings.push({ 
                targetField, 
                sourceColumn: m.column, 
                transform: m.transform,
                section: m.section || defaultSection,
                id: `${targetField}-0`
              });
            }
          }
        }
        
        // 确保所有目标字段都有映射（包括未配置的字段）
        for (const field of TARGET_FIELDS) {
          if (!mappings.find(m => m.targetField === field.key)) {
            mappings.push({
              targetField: field.key,
              sourceColumn: '',
              transform: field.key === 'quantity' ? 'number' : 'trim',
              section: field.defaultSection,
              id: `${field.key}-0`
            });
          }
        }
        
        setFieldMappings(mappings);
        
        // 加载矩阵转置配置
        if (config.matrixTranspose) {
          setMatrixTransposeEnabled(config.matrixTranspose.enabled || false);
          if (config.matrixTranspose.matrices && Array.isArray(config.matrixTranspose.matrices)) {
            setMatrices(config.matrixTranspose.matrices.map((m: any, index: number) => ({
              id: m.id || `matrix-${index}`,
              name: m.name || `矩阵${index + 1}`,
              valueName: m.valueName || m.name || `矩阵${index + 1}名称`,
              columns: m.columns || []
            })));
          }
        }
        
        // 加载卡片分组配置
        if (config.cardGroup) {
          setCardGroupEnabled(config.cardGroup.enabled || false);
          setCardGroupKeyword(config.cardGroup.keyword || '');
          setCardGroupMatchMode(config.cardGroup.matchMode || 'contains');
        }
        
        // 加载卡片头部字段映射
        if (config.cardHeaderMapping) {
          setCardHeaderMapping(config.cardHeaderMapping);
        }
      }
    } else {
      setFieldMappings(TARGET_FIELDS.map(f => ({ 
        targetField: f.key, 
        sourceColumn: '',
        transform: f.key === 'quantity' ? 'number' : 'trim',
        section: f.defaultSection,
        id: `${f.key}-0` // 添加唯一ID
      })));
    }
  }, [rule]);

  // 当外部传入文件时，自动进行预览
  useEffect(() => {
    if (file && !previewFile) {
      handleFileUpload(file);
    }
  }, [file]);

  const handleFileUpload = async (file: File) => {
    setPreviewFile(file);
    setLoading(true);
    setParsedPreview([]);

    try {
      const buffer = await file.arrayBuffer();
      let jsonData: any[][] = [];
      
      // 根据文件类型选择不同的解析方式
      if (file.name.endsWith('.pdf')) {
        // PDF 文件解析 - 通过 API 解析
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/parse-rules/preview-pdf', {
          method: 'POST',
          body: formData,
        });
        
        const result = await res.json();
        if (result.success && result.data) {
          // PDF 返回的是结构化数据（包含 headerSection, dataSection, footerSection）
          const pdfData = result.data;
          
          // 设置三部分数据
          if (pdfData.headerSection) {
            setHeaderSectionData(pdfData.headerSection);
          }
          if (pdfData.dataSection) {
            setdataSectionData(pdfData.dataSection);
          }
          if (pdfData.footerSection) {
            setFooterSectionData(pdfData.footerSection);
          }
          
          // 设置原始文件数据为完整的行数据
          jsonData = pdfData.rows || [];
        } else {
          console.error('PDF 解析失败:', result.error);
          // 显示错误提示
          alert('PDF 文件解析失败: ' + (result.error || '未知错误'));
        }
      } else if (file.name.endsWith('.docx')) {
        // Word 文件解析
        const { default: mammoth } = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        const text = result.value;
        
        // 将文本按行分割
        const lines = text.split('\n').filter(line => line.trim());
        jsonData = lines.map(line => {
          if (line.includes('\t')) {
            return line.split('\t').map(cell => cell.trim());
          } else {
            return line.split(/\s{2,}/).map(cell => cell.trim());
          }
        });
      } else {
        // Excel 文件解析
        const workbook = XLSX.read(buffer);
        const sheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheet];
        
        jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          raw: false
        }) as any[][];
      }
      
      // 进一步处理，确保所有行的长度一致
      if (jsonData.length > 0) {
        let maxLength = 0;
        jsonData.forEach(row => {
          if (row.length > maxLength) {
            maxLength = row.length;
          }
        });
        
        jsonData.forEach((row, index) => {
          while (row.length < maxLength) {
            row.push('');
          }
        });
      }
      
      setRawFileData(jsonData);
      updatePreviewFromData(jsonData);
    } catch (error) {
      console.error('预览文件失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const updatePreviewFromData = (data: any[][]) => {
    if (data.length === 0) return;
    
    let maxColumns = 0;
    data.forEach(row => {
      if (row.length > maxColumns) {
        maxColumns = row.length;
      }
    });
    
    // 显示所有列，使用列号作为标识
    const columns: string[] = [];
    for (let i = 0; i < maxColumns; i++) {
      columns.push(''); // 先用空字符串填充
    }
    
    // 确定表头行：优先使用手动设置，否则自动检测
    let headerRowIndex = 0;
    if (manualHeaderRow && manualHeaderRow > 0 && manualHeaderRow <= data.length) {
      // 手动设置的行号是1-based，转换为0-based
      headerRowIndex = manualHeaderRow - 1;
    } else {
      // 智能检测表头行：寻找最可能是表头的行
      let bestScore = -Infinity;
      let bestRow = 0;
      
      for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row || row.every(cell => !cell)) continue;
        
        let score = 0;
        let nonEmptyCount = 0;
        let textCount = 0;
        let numberCount = 0;
        
        for (const cell of row) {
          const cellStr = String(cell || '').trim();
          if (cellStr) {
            nonEmptyCount++;
            // 判断是否为纯数字
            if (/^\d+(\.\d+)?$/.test(cellStr)) {
              numberCount++;
            }
            // 包含中文或字母的更可能是表头
            if (/[\u4e00-\u9fa5a-zA-Z]/.test(cellStr)) {
              textCount++;
              score += 3; // 文本单元格权重更高
            }
            // 包含常见表头词的额外加分
            if (cellStr.includes('编码') || cellStr.includes('名称') || cellStr.includes('数量') || 
                cellStr.includes('状态') || cellStr.includes('规格') || cellStr.includes('类型') ||
                cellStr.includes('单位') || cellStr.includes('状态') || cellStr.includes('备注')) {
              score += 5;
            }
          }
        }
        
        // 非空单元格数量加分
        score += nonEmptyCount;
        
        // 如果该行纯数字单元格占比超过50%，大幅减分（数据行可能性大）
        if (nonEmptyCount > 0 && numberCount / nonEmptyCount > 0.5) {
          score -= 20;
        }
        
        // 靠前的行有小幅加分（表头通常在前面）
        if (i < 5) {
          score += (5 - i);
        }
        
        // 更新最佳匹配
        if (score > bestScore) {
          bestScore = score;
          bestRow = i;
        }
      }
      
      headerRowIndex = bestRow;
    }
    
    // 使用找到的表头行
    const headers = data[headerRowIndex] || [];
    for (let i = 0; i < maxColumns; i++) {
      if (headers[i] !== undefined && String(headers[i]).trim()) {
        columns[i] = String(headers[i]).trim();
      }
    }
    
    // 额外扫描表尾行（合计之后的行），将"标题 - 内容"对中的标题也作为列名选项
    // 这样可以让用户在下拉框中选择表尾的字段（如单据号、收货人等）
    let foundTotal = false;
    for (let i = headerRowIndex + 1; i < Math.min(30, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      
      const rowStr = row.join(' ');
      
      // 找到"合计"行后，后面的行都是表尾
      if (rowStr.includes('合计')) {
        foundTotal = true;
        continue;
      }
      
      if (foundTotal) {
        // 扫描表尾行中的"标题 - 内容"对
        for (let j = 0; j < row.length; j++) {
          const cell = String(row[j] || '').trim();
          // 如果是标题（包含常见标签关键词），将其作为列名选项
          if (cell && (
            cell.includes('单号') || cell.includes('单据') ||
            cell.includes('收货人') || cell.includes('收件人') ||
            cell.includes('地址') || cell.includes('电话') ||
            cell.includes('门店') || cell.includes('仓库') || cell.includes('仓') ||
            cell.includes('备注') || cell.includes('上游') || cell.includes('时间')
          )) {
            // 如果这个位置还没有列名，使用标题作为列名
            if (!columns[j]) {
              columns[j] = cell;
            }
          }
        }
      }
    }
    
    setPreviewColumns(columns);
    
    // 按三部分分割数据
    let dataEndRow = data.length;
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const rowStr = data[i].join(' ');
      if (rowStr.includes('合计')) {
        dataEndRow = i;
        break;
      }
    }
    
    // 解析头部键值对
    const headerSection: { [key: string]: string }[] = [];
    for (let i = 0; i < headerRowIndex; i++) {
      const row = data[i];
      if (!row || row.every(cell => !cell)) continue;
      
      const rowObj: { [key: string]: string } = {};
      
      // 收集所有非空单元格
      const nonEmptyCells: string[] = [];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        if (cell) {
          nonEmptyCells.push(cell);
        }
      }
      
      // 简单直接的成对读取
      for (let j = 0; j < nonEmptyCells.length - 1; j += 2) {
        const key = nonEmptyCells[j];
        const value = nonEmptyCells[j + 1];
        if (key && value) {
          rowObj[key] = value;
        }
      }
      
      if (Object.keys(rowObj).length > 0) {
        headerSection.push(rowObj);
      }
    }
    setHeaderSectionData(headerSection);
    
    // 主体表格数据
    const dataSection = data.slice(headerRowIndex, dataEndRow);
    setdataSectionData(dataSection);
    
    // 解析尾部键值对（从合计行之后开始）
    const footerSection: { [key: string]: string }[] = [];
    for (let i = dataEndRow + 1; i < data.length; i++) {  // 从 dataEndRow+1 开始，跳过合计行
      const row = data[i];
      if (!row || row.every(cell => !cell)) continue;
      
      const rowObj: { [key: string]: string } = {};
      
      // 收集所有非空单元格
      const nonEmptyCells: { cell: string; index: number }[] = [];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        if (cell) {
          nonEmptyCells.push({ cell, index: j });
        }
      }
      
      // 简单直接的成对读取：第一个非空是键，第二个非空是值
      for (let j = 0; j < nonEmptyCells.length - 1; j += 2) {
        const key = nonEmptyCells[j].cell;
        const value = nonEmptyCells[j + 1].cell;
        if (key && value) {
          rowObj[key] = value;
        }
      }
      
      // 如果成对读取失败，尝试连续读取（键在位置0，值在位置1，键在位置2，值在位置3...）
      if (Object.keys(rowObj).length === 0 && nonEmptyCells.length >= 2) {
        for (let j = 0; j < nonEmptyCells.length - 1; j++) {
          const current = nonEmptyCells[j].cell;
          const next = nonEmptyCells[j + 1].cell;
          // 如果当前单元格看起来像键（包含常见关键词），下一个单元格是值
          if (current.includes('单号') || current.includes('单据') ||
              current.includes('收货人') || current.includes('收件人') ||
              current.includes('电话') || current.includes('手机') ||
              current.includes('地址') || current.includes('门店') ||
              current.includes('仓库') || current.includes('备注') ||
              current.includes('日期') || current.includes('时间') ||
              current.includes('创建') || current.includes('上游')) {
            rowObj[current] = next;
            j++; // 跳过下一个，因为它已经是值了
          }
        }
      }
      
      if (Object.keys(rowObj).length > 0) {
        footerSection.push(rowObj);
      }
    }
    setFooterSectionData(footerSection);
    
    // 显示前 20 行数据供预览（保持兼容）
    const preview = data.slice(0, 20);
    setPreviewData(preview);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleMappingChange = (index: number, field: keyof FieldMapping, value: string) => {
    setFieldMappings(prev => {
      const newMappings = [...prev];
      const currentMapping = { ...newMappings[index] };
      
      // 如果改变 section，清空 sourceColumn
      if (field === 'section' && currentMapping.section !== value) {
        currentMapping.sourceColumn = '';
      }
      
      // 类型断言：确保 section 值是有效的联合类型
      if (field === 'section') {
        currentMapping[field] = value as 'data' | 'header' | 'footer';
      } else {
        currentMapping[field] = value;
      }
      newMappings[index] = currentMapping;
      return newMappings;
    });
  };

  // 根据选择的 section 过滤下拉框选项
  const getSectionOptions = (section: 'header' | 'data' | 'footer' | undefined) => {
    if (section === 'header') {
      return headerSectionData.flatMap(s => Object.keys(s)).filter(k => k && k.trim());
    } else if (section === 'footer') {
      return footerSectionData.flatMap(s => Object.keys(s)).filter(k => k && k.trim());
    } else if (section === 'data') {
      const options = previewColumns.filter(c => c && c.trim());
      
      // 如果启用了矩阵转置，添加虚拟列名
      if (matrixTransposeEnabled) {
        // 添加每个矩阵的名称作为虚拟列
        matrices.forEach(matrix => {
          if (matrix.name && !options.includes(matrix.name)) {
            options.push(matrix.name);
          }
          if (matrix.valueName && !options.includes(matrix.valueName)) {
            options.push(matrix.valueName);
          }
        });
        
        // 添加组合后的门店列名称
        const storeColumnNames = matrices.map(m => m.name).filter(Boolean);
        if (storeColumnNames.length > 0) {
          const combinedStoreName = storeColumnNames.join('-');
          if (!options.includes(combinedStoreName)) {
            options.push(combinedStoreName);
          }
        }
        
        // 添加数量列名称
        if (!options.includes('数量')) {
          options.push('数量');
        }
      }
      
      return options;
    }
    return [];
  };

  const buildConfig = (): ParseConfig => {
    const fieldMapping: any = {};
    
    // 按目标字段分组处理
    const mappingsByTarget: { [key: string]: FieldMapping[] } = {};
    for (const mapping of fieldMappings) {
      if (!mappingsByTarget[mapping.targetField]) {
        mappingsByTarget[mapping.targetField] = [];
      }
      mappingsByTarget[mapping.targetField].push(mapping);
    }
    
    for (const [targetField, mappings] of Object.entries(mappingsByTarget)) {
      const validMappings = mappings.filter(m => m.sourceColumn);
      if (validMappings.length > 0) {
        if (validMappings.length === 1) {
          // 单个映射，保存为对象
          fieldMapping[targetField] = {
            column: validMappings[0].sourceColumn,
            transform: validMappings[0].transform || 'trim',
            section: validMappings[0].section || 'data'
          };
        } else {
          // 多个映射，保存为数组
          fieldMapping[targetField] = validMappings.map(m => ({
            column: m.sourceColumn,
            transform: m.transform || 'trim',
            section: m.section || 'data'
          }));
        }
      }
    }

    // 确定表头行：优先使用手动设置，否则自动检测
    let headerRowIndex = 1;
    if (manualHeaderRow && manualHeaderRow > 0) {
      // 使用手动设置的行号
      headerRowIndex = manualHeaderRow;
    } else if (rawFileData.length > 0) {
      // 自动检测表头行
      for (let i = 0; i < Math.min(20, rawFileData.length); i++) {
        const row = rawFileData[i];
        const rowStr = row.join(' ');
        if (rowStr.includes('物品编码') || rowStr.includes('物品名称') || rowStr.includes('数量') || rowStr.includes('SKU')) {
          headerRowIndex = i + 1;
          break;
        }
      }
    }

    const config: ParseConfig = {
      headerRow: headerRowIndex,
      dataStartRow: headerRowIndex + 1,
      fieldMapping,
    };

    // 添加矩阵转置配置
    const validMatrices = matrices.filter(m => m.columns.length > 0);
    if (matrixTransposeEnabled && validMatrices.length > 0) {
      config.matrixTranspose = {
        enabled: true,
        matrices: validMatrices.map(m => ({
          name: m.name || '矩阵',
          valueName: m.valueName || m.name || '矩阵值',
          columns: m.columns,
        })),
      };
    }
    
    // 添加卡片分组配置
    if (cardGroupEnabled && cardGroupKeyword) {
      config.cardGroup = {
        enabled: true,
        keyword: cardGroupKeyword,
        matchMode: cardGroupMatchMode,
      };
      
      // 添加卡片头部字段映射
      if (Object.keys(cardHeaderMapping).length > 0) {
        config.cardHeaderMapping = cardHeaderMapping;
      }
    }

    return config;
  };

  /**
   * 预览卡片分组效果
   */
  const handleCardGroupPreview = () => {
    if (!previewFile) {
      alert('请先上传文件');
      return;
    }
    
    if (!cardGroupKeyword) {
      alert('请输入分组关键词');
      return;
    }

    setLoading(true);
    
    console.log('=== 卡片分组预览调试 ===');
    console.log('文件名:', previewFile.name);
    console.log('关键词:', cardGroupKeyword);
    console.log('匹配模式:', cardGroupMatchMode);
    console.log('卡片头部映射:', JSON.stringify(cardHeaderMapping));
    
    previewFile.arrayBuffer().then(data => {
      try {
        // 使用 Uint8Array，xlsx 库支持多种输入格式
        const uint8Array = new Uint8Array(data);
        
        // 使用 ParseEngine 进行解析
        const config: ParseConfig = {
          fieldMapping: {},
          cardGroup: {
            enabled: true,
            keyword: cardGroupKeyword,
            matchMode: cardGroupMatchMode,
          },
          cardHeaderMapping: cardHeaderMapping,
        };
        
        console.log('解析配置:', JSON.stringify(config, null, 2));
        
        const engine = new ParseEngine(config);
        // xlsx 库的 read 方法支持 Uint8Array
        const result = engine.parseExcel(uint8Array as any);
        
        console.log('解析结果:', result);
        
        if (result.success && result.items.length > 0) {
          // 只显示第一个分组的数据
          const firstGroupStoreName = result.items[0]?.storeName;
          const firstGroupItems = result.items.filter(item => item.storeName === firstGroupStoreName);
          
          // 更新模板预览区域的数据（三部分展示）
          if (firstGroupItems.length > 0) {
            const firstItem = firstGroupItems[0];
            // 更新头部信息
            const headerData: { [key: string]: string }[] = [
              { '调入门店': firstItem.storeName || '' },
              { '收货人': firstItem.receiverName || '' },
              { '电话': firstItem.receiverPhone || '' },
              { '收货地址': firstItem.receiverAddress || '' },
            ];
            setHeaderSectionData(headerData);
            
            // 更新主体数据
            const bodyData = firstGroupItems.map((item, idx) => [
              idx + 1,
              item.skuCode || '',
              item.skuName || '',
              item.specification || '',
              item.quantity || 0,
            ]);
            // 添加表头行
            setdataSectionData([['行号', '物品编码', '物品名称', '规格', '数量'], ...bodyData]);
            
            // 清空尾部信息
            setFooterSectionData([]);
          }
          
          setLoading(false);
        } else {
          console.log('解析失败:', result.errors, result.warnings);
          alert('未能识别到卡片分组，请检查关键词配置');
          setLoading(false);
        }
      } catch (error) {
        console.error('卡片分组预览失败:', error);
        alert('卡片分组预览失败：' + (error as Error).message);
        setLoading(false);
      }
    });
  };

  /**
   * 本地自动映射 - 不调用AI，使用本地规则进行字段匹配
   */
  const handleLocalAutoDetect = () => {
    if (!previewFile) {
      alert('请先上传文件进行预览');
      return;
    }

    setLoading(true);
    try {
      const buffer = previewFile.arrayBuffer();
      
      buffer.then(data => {
        const workbook = XLSX.read(data);
        const sheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheet];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // 更新预览数据
        setRawFileData(jsonData);
        updatePreviewFromData(jsonData);
        
        // 等待状态更新
        setTimeout(() => {
          // 使用已经解析好的三部分数据
          const allKeyValuePairs: { [key: string]: string } = {};
          headerSectionData.forEach(section => Object.assign(allKeyValuePairs, section));
          footerSectionData.forEach(section => Object.assign(allKeyValuePairs, section));
          
          const newMappings = [...fieldMappings];
          const dataHeaders = dataSectionData.length > 0 ? dataSectionData[0] : [];
          
          // 定义字段匹配配置
          const fieldMatchConfig = [
            { key: 'externalCode', keywords: ['单号', '单据', '订单号', '外部编码'], sectionType: 'footer' as const },
            { key: 'storeName', keywords: ['门店', '仓库', '仓', '店名', '店铺', '门店名称', '收货门店'], sectionType: 'header' as const },
            { key: 'receiverName', keywords: ['收货人', '收件人', '收货', '联系人', '收件方', '收货方'], sectionType: 'footer' as const },
            { key: 'receiverPhone', keywords: ['电话', '手机', '联系电话', '手机号', '收货电话', '联系手机'], sectionType: 'footer' as const },
            { key: 'receiverAddress', keywords: ['地址', '收货地址', '收件地址', '详细地址'], sectionType: 'footer' as const },
            { key: 'skuCode', keywords: ['物品编码', 'SKU编码', '编码', 'SKU'], sectionType: 'data' as const },
            { key: 'skuName', keywords: ['物品名称', 'SKU名称', '名称', '货品名称'], sectionType: 'data' as const },
            { key: 'quantity', keywords: ['数量', '发货数量', '件数'], sectionType: 'data' as const },
            { key: 'specification', keywords: ['规格', '型号', '规格型号'], sectionType: 'data' as const },
            { key: 'remark', keywords: ['备注', '说明'], sectionType: 'data' as const },
          ];
          
          // 遍历每个字段进行匹配
          for (const config of fieldMatchConfig) {
            if (newMappings.find(m => m.targetField === config.key)?.sourceColumn) {
              continue;
            }
            
            const targetIndex = TARGET_FIELDS.findIndex(f => f.key === config.key);
            if (targetIndex < 0) continue;
            
            if (config.sectionType === 'data') {
              for (const header of dataHeaders) {
                const headerStr = String(header || '').trim();
                if (headerStr && config.keywords.some(k => headerStr.includes(k))) {
                  newMappings[targetIndex] = {
                    ...newMappings[targetIndex],
                    sourceColumn: headerStr,
                    transform: config.key === 'quantity' ? 'number' : 'trim',
                    section: 'data'
                  };
                  break;
                }
              }
            } else {
              for (const [key, value] of Object.entries(allKeyValuePairs)) {
                if (config.keywords.some(k => key.includes(k))) {
                  let valid = true;
                  if (config.key === 'externalCode' && !(value.startsWith('PS') || value.length >= 12)) {
                    valid = false;
                  }
                  if (config.key === 'receiverPhone') {
                    const phonePattern = /1[3-9]\d{9}/;
                    const cleanValue = String(value).replace(/[\s\-_\(\)]/g, '');
                    valid = phonePattern.test(cleanValue);
                  }
                  if (config.key === 'receiverAddress' && value.length <= 5 && 
                      !value.includes('省') && !value.includes('市') && !value.includes('区')) {
                    valid = false;
                  }
                  
                  if (valid) {
                    const isInHeader = headerSectionData.some(s => s[key] !== undefined);
                    newMappings[targetIndex] = {
                      ...newMappings[targetIndex],
                      sourceColumn: key,
                      transform: 'trim',
                      section: isInHeader ? 'header' : 'footer'
                    };
                    break;
                  }
                }
              }
            }
          }
          
          setFieldMappings(newMappings);
          setLoading(false);
          alert('自动映射完成！已使用本地规则匹配字段。');
        }, 100);
      }).catch(error => {
        console.error('自动映射失败:', error);
        setLoading(false);
        alert(`自动映射失败：${error.message}`);
      });
    } catch (error) {
      console.error('自动映射失败:', error);
      setLoading(false);
      alert(`自动映射失败：${(error as Error).message}`);
    }
  };

  /**
   * AI自动映射 - 调用大模型进行字段匹配，失败后回退到本地自动映射
   */
  const handleAutoDetect = async () => {
    if (!previewFile) {
      alert('请先上传文件进行预览');
      return;
    }

    setLoading(true);
    try {
      const buffer = await previewFile.arrayBuffer();
      
      // 调用智谱 AI 进行字段映射分析
      const aiResult = await detectExcelFormat(Buffer.from(buffer));
      
      if (!aiResult.success) {
        // AI调用失败，回退到本地自动映射
        alert(`AI 调用失败：${aiResult.error}\n将使用本地规则进行自动映射...`);
        // 手动触发本地自动映射
        handleLocalAutoDetect();
        return;
      }

      // 使用 AI 结果进行字段映射
      const workbook = XLSX.read(buffer);
      const sheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheet];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // 更新预览数据（这会解析三部分结构并设置到状态中）
      setRawFileData(jsonData);
      updatePreviewFromData(jsonData);
      
      // 等待状态更新后再继续
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 使用已经解析好的三部分数据（从状态中获取）
      const allKeyValuePairs: { [key: string]: string } = {};
      headerSectionData.forEach(section => Object.assign(allKeyValuePairs, section));
      footerSectionData.forEach(section => Object.assign(allKeyValuePairs, section));
      
      // 初始化新的映射
      const newMappings = [...fieldMappings];
      
      // 1. 首先应用AI返回的字段映射
      if (aiResult.fieldMapping) {
        for (const [targetKey, columnName] of Object.entries(aiResult.fieldMapping)) {
          const index = TARGET_FIELDS.findIndex(f => f.key === targetKey);
          if (index >= 0) {
            // 判断字段属于哪个区域
            let section: 'header' | 'data' | 'footer' = 'data';
            
            // 检查是否在头部或尾部
            const lowerColumnName = String(columnName).toLowerCase();
            const isInHeader = headerSectionData.some(s => 
              Object.keys(s).some(k => k.toLowerCase() === lowerColumnName || 
                                      k.toLowerCase().includes(lowerColumnName) ||
                                      String(columnName).includes(k))
            );
            const isInFooter = footerSectionData.some(s => 
              Object.keys(s).some(k => k.toLowerCase() === lowerColumnName || 
                                      k.toLowerCase().includes(lowerColumnName) ||
                                      String(columnName).includes(k))
            );
            
            if (isInHeader) {
              section = 'header';
            } else if (isInFooter) {
              section = 'footer';
            }
            
            newMappings[index] = {
              ...newMappings[index],
              sourceColumn: String(columnName),
              transform: targetKey === 'quantity' ? 'number' : 'trim',
              section
            };
          }
        }
      }
      
      // 2. AI可能没有识别全部字段，补充本地自动检测
      
      // 获取数据表头（从已解析的状态中获取）
      const dataHeaders = dataSectionData.length > 0 ? dataSectionData[0] : [];
      
      // 定义字段匹配配置
      const fieldMatchConfig = [
        { key: 'externalCode', keywords: ['单号', '单据', '订单号', '外部编码'], sectionType: 'footer' as const },
        { key: 'storeName', keywords: ['门店', '仓库', '仓', '店名', '店铺', '门店名称', '收货门店'], sectionType: 'header' as const },
        { key: 'receiverName', keywords: ['收货人', '收件人', '收货', '联系人', '收件方', '收货方'], sectionType: 'footer' as const },
        { key: 'receiverPhone', keywords: ['电话', '手机', '联系电话', '手机号', '收货电话', '联系手机'], sectionType: 'footer' as const },
        { key: 'receiverAddress', keywords: ['地址', '收货地址', '收件地址', '详细地址'], sectionType: 'footer' as const },
        { key: 'skuCode', keywords: ['物品编码', 'SKU编码', '编码', 'SKU'], sectionType: 'data' as const },
        { key: 'skuName', keywords: ['物品名称', 'SKU名称', '名称', '货品名称'], sectionType: 'data' as const },
        { key: 'quantity', keywords: ['数量', '发货数量', '件数'], sectionType: 'data' as const },
        { key: 'specification', keywords: ['规格', '型号', '规格型号'], sectionType: 'data' as const },
        { key: 'remark', keywords: ['备注', '说明'], sectionType: 'data' as const },
      ];
      
      // 遍历每个字段进行匹配
      for (const config of fieldMatchConfig) {
        if (newMappings.find(m => m.targetField === config.key)?.sourceColumn) {
          continue; // 已经有映射了，跳过
        }
        
        const targetIndex = TARGET_FIELDS.findIndex(f => f.key === config.key);
        if (targetIndex < 0) continue;
        
        if (config.sectionType === 'data') {
          // 在数据表头中查找
          for (const header of dataHeaders) {
            const headerStr = String(header || '').trim();
            if (headerStr && config.keywords.some(k => headerStr.includes(k))) {
              newMappings[targetIndex] = {
                ...newMappings[targetIndex],
                sourceColumn: headerStr,
                transform: config.key === 'quantity' ? 'number' : 'trim',
                section: 'data'
              };
              break;
            }
          }
        } else {
          // 在头部或尾部键值对中查找
          for (const [key, value] of Object.entries(allKeyValuePairs)) {
            if (config.keywords.some(k => key.includes(k))) {
              // 特殊验证
              let valid = true;
              if (config.key === 'externalCode' && !(value.startsWith('PS') || value.length >= 12)) {
                valid = false;
              }
              if (config.key === 'receiverPhone') {
                const phonePattern = /1[3-9]\d{9}/;
                const cleanValue = String(value).replace(/[\s\-_\(\)]/g, '');
                valid = phonePattern.test(cleanValue);
              }
              if (config.key === 'receiverAddress' && value.length <= 5 && 
                  !value.includes('省') && !value.includes('市') && !value.includes('区')) {
                valid = false;
              }
              
              if (valid) {
                const isInHeader = headerSectionData.some(s => s[key] !== undefined);
                newMappings[targetIndex] = {
                  ...newMappings[targetIndex],
                  sourceColumn: key,
                  transform: 'trim',
                  section: isInHeader ? 'header' : 'footer'
                };
                break;
              }
            }
          }
        }
      }
      
      setFieldMappings(newMappings);
      alert('AI 自动映射完成！已使用大模型智能匹配字段。');
    } catch (error) {
      console.error('AI 自动映射失败:', error);
      alert(`AI 自动映射失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestWithAI = async () => {
    if (!previewFile) {
      alert('请先上传文件进行预览');
      return;
    }

    setLoading(true);
    try {
      const buffer = await previewFile.arrayBuffer();
      
      // 使用智谱 AI 解析
      const aiResult = await parseExcelWithAI(Buffer.from(buffer));
      
      if (!aiResult.success || !aiResult.data) {
        alert(`AI 解析失败：${aiResult.error}`);
        return;
      }

      // 显示解析结果
      const commonInfo: any = aiResult.data?.commonInfo || {};
      const items: any[] = aiResult.data?.items || [];
      
      const parsedData = items.map((item: any, index: number) => ({
        '#': index + 1,
        externalCode: commonInfo.externalCode || '-',
        storeName: commonInfo.storeName || '-',
        receiverName: commonInfo.receiverName || '-',
        receiverPhone: commonInfo.receiverPhone || '-',
        receiverAddress: commonInfo.receiverAddress || '-',
        skuCode: item.skuCode || '-',
        skuName: item.skuName || '-',
        quantity: item.quantity || 0,
        specification: item.specification || '-',
        remark: item.remark || '-',
      }));
      
      setParsedPreview(parsedData);
      
      let message = `AI 解析成功！共解析出 ${items.length} 条数据`;
      if (aiResult.tokenUsage) {
        message += `\nToken 使用：${aiResult.tokenUsage.total_tokens}`;
      }
      alert(message);
    } catch (error) {
      console.error('AI 解析失败:', error);
      alert(`AI 解析失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = () => {
    if (!previewFile) {
      alert('请先上传文件进行预览');
      return;
    }

    const config = buildConfig();
    const engine = new ParseEngine(config);
    
    previewFile.arrayBuffer().then(buffer => {
      const result = engine.parseExcel(Buffer.from(buffer));
      if (result.success) {
        setParsedPreview(result.items);
        alert(`解析成功！共 ${result.items.length} 条数据`);
        console.log('解析结果:', result.items);
      } else {
        alert(`解析失败：${result.errors.join(', ')}`);
      }
    });
  };

  const handleSave = async () => {
    if (!name) {
      alert('请输入规则名称');
      return;
    }

    setSaving(true);
    try {
      const config = buildConfig();
      const url = rule ? `/api/parse-rules/${rule.id}` : '/api/parse-rules';
      const method = rule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          fileType,
          config,
          isActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // 返回保存的规则信息
        const savedRule = data.rule as ParseRule | undefined;
        onSaveComplete(savedRule);
        
        // 如果有上传的文件且需要直接解析，调用解析回调
        if (onParseComplete && previewFile) {
          try {
            const parseConfig = buildConfig();
            const engine = new ParseEngine(parseConfig);
            const arrayBuffer = await previewFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await engine.parseExcel(buffer);
            onParseComplete(result, parseConfig);
          } catch (parseError) {
            console.error('解析失败:', parseError);
          }
        }
      } else {
        alert('保存失败：' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存规则失败:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            {rule ? '编辑规则' : '新建规则'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  规则名称 *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入规则名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="规则描述"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  启用规则
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  上传文件预览
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.docx,.pdf"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {loading && (
                  <div className="mt-2 text-sm text-gray-500">加载中...</div>
                )}
              </div>

              {/* 手动设置主体起始行 */}
              {mode === 'create' && rawFileData.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    主体起始行（表头行）
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={rawFileData.length}
                      value={manualHeaderRow || ''}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || null;
                        setManualHeaderRow(value);
                        // 不再立即重新解析，等待用户点击确认
                      }}
                      placeholder="输入行号"
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-28"
                    />
                    <button
                      onClick={() => {
                        // 点击确认后重新解析预览
                        updatePreviewFromData(rawFileData);
                      }}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
                    >
                      确认
                    </button>
                    <span className="text-xs text-gray-500">
                      当前文件共 {rawFileData.length} 行
                    </span>
                  </div>
                </div>
              )}

              {/* 矩阵转置配置 */}
              {((mode === 'create' && rawFileData.length > 0) || (mode === 'edit' && matrixTransposeEnabled)) && (
                <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  {mode === 'create' ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="matrixTranspose"
                          checked={matrixTransposeEnabled}
                          onChange={(e) => {
                            setMatrixTransposeEnabled(e.target.checked);
                            if (!e.target.checked) {
                              setMatrices([{ id: '1', name: '门店', valueName: '门店名称', columns: [] }]);
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="matrixTranspose" className="text-sm font-medium text-gray-700">
                          启用矩阵转置（SKU×矩阵）
                        </label>
                      </div>
                      {matrixTransposeEnabled && (
                        <div className="ml-6 space-y-3">
                          {/* 矩阵列表 */}
                          {matrices.map((matrix, matrixIndex) => (
                            <div key={matrix.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                              <div className="flex items-center gap-2 mb-3">
                                <input
                                  type="text"
                                  value={matrix.name}
                                  onChange={(e) => {
                                    const newMatrices = [...matrices];
                                    newMatrices[matrixIndex].name = e.target.value;
                                    setMatrices(newMatrices);
                                  }}
                                  placeholder="列名"
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                                <input
                                  type="text"
                                  value={matrix.valueName || ''}
                                  onChange={(e) => {
                                    const newMatrices = [...matrices];
                                    newMatrices[matrixIndex].valueName = e.target.value;
                                    setMatrices(newMatrices);
                                  }}
                                  placeholder="列值名称"
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                                {matrices.length > 1 && (
                                  <button
                                    onClick={() => setMatrices(matrices.filter((_, i) => i !== matrixIndex))}
                                    className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 text-sm font-bold"
                                    title="删除矩阵"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                              
                              {/* 已选择的列 */}
                              <div className="mb-2">
                                <label className="block text-xs text-gray-500 mb-2">已选择的列：</label>
                                <div className="flex flex-wrap gap-2">
                                  {matrix.columns.length === 0 ? (
                                    <span className="text-xs text-gray-400">点击下方加号添加列</span>
                                  ) : (
                                    matrix.columns.map((colIndex) => (
                                      <div key={colIndex} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm">
                                        <span>[{colIndex}] {previewColumns[colIndex] || '(空)'}</span>
                                        <button
                                          onClick={() => {
                                            const newMatrices = [...matrices];
                                            newMatrices[matrixIndex].columns = matrix.columns.filter(i => i !== colIndex);
                                            setMatrices(newMatrices);
                                          }}
                                          className="ml-1 w-4 h-4 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 text-xs"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              
                              {/* 可添加的列 */}
                              <div>
                                <label className="block text-xs text-gray-500 mb-2">可用列（点击+添加）：</label>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                  {previewColumns.map((col, index) => {
                                    // 检查该列是否已被任何矩阵选中
                                    const isSelected = matrices.some(m => m.columns.includes(index));
                                    return (
                                      <button
                                        key={index}
                                        onClick={() => {
                                          if (isSelected) {
                                            // 如果已选中，从当前矩阵移除
                                            if (matrix.columns.includes(index)) {
                                              const newMatrices = [...matrices];
                                              newMatrices[matrixIndex].columns = matrix.columns.filter(i => i !== index);
                                              setMatrices(newMatrices);
                                            }
                                          } else {
                                            // 如果未选中，添加到当前矩阵
                                            const newMatrices = [...matrices];
                                            newMatrices[matrixIndex].columns = [...matrix.columns, index].sort((a, b) => a - b);
                                            setMatrices(newMatrices);
                                          }
                                        }}
                                        disabled={isSelected && !matrix.columns.includes(index)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors ${
                                          isSelected && !matrix.columns.includes(index)
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : isSelected
                                              ? 'bg-green-100 text-green-700 border border-green-300'
                                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-500'
                                        }`}
                                      >
                                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                                          isSelected && !matrix.columns.includes(index)
                                            ? 'bg-gray-300 text-gray-500'
                                            : isSelected
                                              ? 'bg-green-500 text-white'
                                              : 'bg-green-500 text-white'
                                        }`}>
                                          {isSelected && !matrix.columns.includes(index) ? '✓' : isSelected ? '✓' : '+'}
                                        </span>
                                        <span>[{index}] {col || '(空)'}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* 添加矩阵按钮 */}
                          <button
                            onClick={() => {
                              const newId = String(Date.now());
                              const newMatrixNum = matrices.length + 1;
                              setMatrices([...matrices, { id: newId, name: `矩阵${newMatrixNum}`, valueName: `矩阵${newMatrixNum}名称`, columns: [] }]);
                            }}
                            className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-green-500 hover:text-green-500 hover:bg-green-50 transition-colors"
                          >
                            <span className="w-5 h-5 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 text-xs font-bold">+</span>
                            <span>添加矩阵</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    // 编辑模式：文本展示矩阵转置规则
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="matrixTranspose"
                          checked={matrixTransposeEnabled}
                          disabled
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="matrixTranspose" className="text-sm font-medium text-gray-700">
                          矩阵转置规则
                        </label>
                      </div>
                      {matrixTransposeEnabled && matrices.length > 0 && (
                        <div className="ml-6 space-y-2">
                          {matrices.map((matrix, matrixIndex) => (
                            <div key={matrix.id} className="flex items-center gap-3 text-sm">
                              <span className="text-gray-700">
                                <span className="font-medium">{matrix.name}</span>
                                {matrix.valueName && <span className="text-gray-500 ml-1">({matrix.valueName})</span>}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="text-blue-600">
                                {matrix.columns.length > 0
                                  ? matrix.columns.map(colIndex => {
                                      const colName = previewColumns[colIndex];
                                      if (colName) {
                                        return `[${colIndex}] ${colName}`;
                                      } else {
                                        return `列${colIndex + 1}`;
                                      }
                                    }).join(', ')
                                  : '未配置'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* 卡片分组模式配置 */}
              {((mode === 'create' && rawFileData.length > 0) || (mode === 'edit' && cardGroupEnabled)) && (
                <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  {mode === 'create' ? (
                    // 创建模式：可编辑表单
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="cardGroup"
                          checked={cardGroupEnabled}
                          onChange={(e) => setCardGroupEnabled(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="cardGroup" className="text-sm font-medium text-gray-700">
                          卡片分组模式（用于卡片式Excel）
                        </label>
                      </div>
                      
                      {cardGroupEnabled && (
                        <div className="ml-6 space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-600 mb-1">分组关键词</label>
                              <input
                                type="text"
                                value={cardGroupKeyword}
                                onChange={(e) => setCardGroupKeyword(e.target.value)}
                                placeholder="例如：调拨记录 #"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div className="w-40">
                              <label className="block text-xs text-gray-600 mb-1">匹配模式</label>
                              <select
                                value={cardGroupMatchMode}
                                onChange={(e) => setCardGroupMatchMode(e.target.value as 'contains' | 'startsWith' | 'exact')}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="contains">包含</option>
                                <option value="startsWith">开头匹配</option>
                                <option value="exact">精确匹配</option>
                              </select>
                            </div>
                          </div>
                          
                          {/* 卡片头部字段映射 */}
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">卡片头部字段映射</div>
                            <div className="text-xs text-gray-500 mb-2">
                              配置卡片中公共信息所在的行偏移和列索引。
                              例如：第1行(偏移1)的第2列(索引1)对应"收货门店"。
                            </div>
                            <div className="space-y-2">
                              {/* 预设的常用映射 */}
                              <div className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-gray-200">
                                <span className="text-gray-600 w-24">调入门店：</span>
                                <span className="text-gray-400 w-20">行偏移：</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={cardHeaderMapping[1]?.[1] ? 1 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    if (val) {
                                      setCardHeaderMapping(prev => ({
                                        ...prev,
                                        [val]: { ...(prev[val] || {}), [1]: 'storeName' }
                                      }));
                                    }
                                  }}
                                  placeholder="1"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                                <span className="text-gray-400 w-16">列索引：</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={cardHeaderMapping[1]?.[1] === 'storeName' ? 1 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    if (val !== undefined) {
                                      setCardHeaderMapping(prev => {
                                        const newMapping = { ...prev };
                                        if (!newMapping[1]) newMapping[1] = {};
                                        newMapping[1][val] = 'storeName';
                                        return newMapping;
                                      });
                                    }
                                  }}
                                  placeholder="1"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-gray-200">
                                <span className="text-gray-600 w-24">收货人：</span>
                                <span className="text-gray-400 w-20">行偏移：</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={cardHeaderMapping[1]?.[3] ? 1 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    if (val) {
                                      setCardHeaderMapping(prev => ({
                                        ...prev,
                                        [val]: { ...(prev[val] || {}), [3]: 'receiverName' }
                                      }));
                                    }
                                  }}
                                  placeholder="1"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                                <span className="text-gray-400 w-16">列索引：</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={cardHeaderMapping[1]?.[3] === 'receiverName' ? 3 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    if (val !== undefined) {
                                      setCardHeaderMapping(prev => {
                                        const newMapping = { ...prev };
                                        if (!newMapping[1]) newMapping[1] = {};
                                        newMapping[1][val] = 'receiverName';
                                        return newMapping;
                                      });
                                    }
                                  }}
                                  placeholder="3"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-gray-200">
                                <span className="text-gray-600 w-24">电话：</span>
                                <span className="text-gray-400 w-20">行偏移：</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={cardHeaderMapping[1]?.[5] ? 1 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    if (val) {
                                      setCardHeaderMapping(prev => ({
                                        ...prev,
                                        [val]: { ...(prev[val] || {}), [5]: 'receiverPhone' }
                                      }));
                                    }
                                  }}
                                  placeholder="1"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                                <span className="text-gray-400 w-16">列索引：</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={cardHeaderMapping[1]?.[5] === 'receiverPhone' ? 5 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    if (val !== undefined) {
                                      setCardHeaderMapping(prev => {
                                        const newMapping = { ...prev };
                                        if (!newMapping[1]) newMapping[1] = {};
                                        newMapping[1][val] = 'receiverPhone';
                                        return newMapping;
                                      });
                                    }
                                  }}
                                  placeholder="5"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-gray-200">
                                <span className="text-gray-600 w-24">收货地址：</span>
                                <span className="text-gray-400 w-20">行偏移：</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={cardHeaderMapping[2]?.[1] ? 2 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    if (val) {
                                      setCardHeaderMapping(prev => ({
                                        ...prev,
                                        [val]: { ...(prev[val] || {}), [1]: 'receiverAddress' }
                                      }));
                                    }
                                  }}
                                  placeholder="2"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                                <span className="text-gray-400 w-16">列索引：</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={cardHeaderMapping[2]?.[1] === 'receiverAddress' ? 1 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    if (val !== undefined) {
                                      setCardHeaderMapping(prev => {
                                        const newMapping = { ...prev };
                                        if (!newMapping[2]) newMapping[2] = {};
                                        newMapping[2][val] = 'receiverAddress';
                                        return newMapping;
                                      });
                                    }
                                  }}
                                  placeholder="1"
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            </div>
                            </div>
                            
                            {/* 确认分组按钮 */}
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={handleCardGroupPreview}
                                disabled={!cardGroupKeyword}
                                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                确认分组
                              </button>
                            </div>
                          </div>
                      )}
                    </>
                  ) : (
                    // 编辑模式：文本展示卡片分组规则
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="cardGroup"
                          checked={cardGroupEnabled}
                          disabled
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="cardGroup" className="text-sm font-medium text-gray-700">
                          卡片分组规则
                        </label>
                      </div>
                      {cardGroupEnabled && (
                        <div className="ml-6 space-y-2 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-600">关键词：</span>
                            <span className="text-blue-600 font-medium">{cardGroupKeyword}</span>
                            <span className="text-gray-400">({cardGroupMatchMode === 'contains' ? '包含' : cardGroupMatchMode === 'startsWith' ? '开头匹配' : '精确匹配'})</span>
                          </div>
                          {Object.keys(cardHeaderMapping).length > 0 && (
                            <div className="mt-2">
                              <span className="text-gray-600">头部字段映射：</span>
                              <div className="mt-1 ml-4 text-xs text-gray-500">
                                {Object.entries(cardHeaderMapping).map(([rowOffset, colMapping]) => (
                                  Object.entries(colMapping).map(([colIndex, field]) => {
                                    const fieldLabel = field === 'storeName' ? '收货门店' : field === 'receiverName' ? '收货人' : field === 'receiverPhone' ? '电话' : field === 'receiverAddress' ? '收货地址' : field;
                                    return (
                                      <div key={`${rowOffset}-${colIndex}`}>
                                        行偏移 {rowOffset} → 列 {colIndex} → {fieldLabel}
                                      </div>
                                    );
                                  })
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  字段映射
                </label>
                <div className="space-y-2 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {TARGET_FIELDS.map((targetField, fieldIndex) => {
                    // 获取该目标字段的所有映射
                    const fieldMappingsForTarget = fieldMappings.filter(m => m.targetField === targetField.key);
                    
                    return (
                      <div key={fieldIndex} className="space-y-2">
                        {fieldMappingsForTarget.map((mapping, mappingIndex) => {
                          const fieldInfo = targetField;
                          const sectionLabel = mapping.section === 'header' ? '头部' : 
                                               mapping.section === 'footer' ? '尾部' : '主体';
                          const transformLabel = mapping.transform === 'trim' ? '去空格' : 
                                                mapping.transform === 'number' ? '数字' : 
                                                mapping.transform === 'string' ? '字符串' : '无';
                          const actualIndex = fieldMappings.findIndex(m => m.id === mapping.id);
                          
                          // 编辑模式：只读文本展示
                          if (mode === 'edit') {
                            return (
                              <div key={mapping.id || actualIndex} className="flex items-center gap-4 text-sm">
                                <div className="flex-1 text-gray-700">
                                  {fieldInfo?.label}
                                  {mappingIndex > 0 && <span className="text-blue-500 ml-1">({mappingIndex + 1})</span>}
                                  {fieldInfo?.required && <span className="text-red-500 ml-1">*</span>}
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                  <span className="bg-gray-100 px-2 py-1 rounded">{sectionLabel}</span>
                                  <span>→</span>
                                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                    {mapping.sourceColumn || '-- 未配置 --'}
                                  </span>
                                  {mapping.transform && (
                                    <>
                                      <span>(</span>
                                      <span className="text-green-600">{transformLabel}</span>
                                      <span>)</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          
                          // 新增模式：可编辑表单
                          return (
                            <div key={mapping.id || actualIndex} className="grid grid-cols-5 gap-2 items-center">
                              <div className="text-sm text-gray-700">
                                {fieldInfo?.label}
                                {mappingIndex > 0 && <span className="text-blue-500 ml-1">({mappingIndex + 1})</span>}
                                {fieldInfo?.required && <span className="text-red-500 ml-1">*</span>}
                              </div>
                              {/* 数据分类选择 */}
                              <select
                                value={mapping.section || 'data'}
                                onChange={(e) => handleMappingChange(actualIndex, 'section', e.target.value as 'header' | 'data' | 'footer')}
                                className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="header">头部</option>
                                <option value="data">主体</option>
                                <option value="footer">尾部</option>
                              </select>
                              {/* 字段选择 - 根据选择的分类动态显示选项 */}
                              <select
                                value={mapping.sourceColumn}
                                onChange={(e) => handleMappingChange(actualIndex, 'sourceColumn', e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">-- 选择 --</option>
                                {getSectionOptions(mapping.section).map((option, i) => (
                                  <option key={i} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center gap-1">
                                <select
                                  value={mapping.transform || ''}
                                  onChange={(e) => handleMappingChange(actualIndex, 'transform', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 flex-1"
                                >
                                  <option value="">无</option>
                                  <option value="trim">去空格</option>
                                  <option value="number">数字</option>
                                  <option value="string">字符串</option>
                                </select>
                                {/* 每个字段都显示加号按钮 */}
                                {mappingIndex === fieldMappingsForTarget.length - 1 && (
                                  <button
                                    onClick={() => {
                                      // 添加新的映射
                                      const newMapping: FieldMapping = {
                                        targetField: targetField.key,
                                        sourceColumn: '',
                                        transform: targetField.key === 'quantity' ? 'number' : 'trim',
                                        section: targetField.defaultSection,
                                        id: `${targetField.key}-${Date.now()}`
                                      };
                                      setFieldMappings([...fieldMappings, newMapping]);
                                    }}
                                    className="w-6 h-6 flex items-center justify-center bg-green-500 text-white rounded-full hover:bg-green-600 text-sm font-bold"
                                    title="添加映射"
                                  >
                                    +
                                  </button>
                                )}
                                {/* 如果有多个映射，显示减号按钮 */}
                                {fieldMappingsForTarget.length > 1 && mappingIndex > 0 && (
                                  <button
                                    onClick={() => {
                                      // 删除该映射
                                      setFieldMappings(fieldMappings.filter(m => m.id !== mapping.id));
                                    }}
                                    className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 text-sm font-bold"
                                    title="删除映射"
                                  >
                                    -
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              {parsedPreview.length > 0 ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    解析结果（共 {parsedPreview.length} 条）
                  </label>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">外部编码</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">SKU 编码</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">SKU 名称</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">数量</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">规格型号</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {parsedPreview.slice(0, 10).map((item, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{item.externalCode || '-'}</td>
                            <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{item.skuCode}</td>
                            <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{item.skuName}</td>
                            <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{item.quantity}</td>
                            <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{item.specification || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedPreview.length > 10 && (
                      <div className="px-6 py-2 text-sm text-gray-500 border-t border-gray-200">
                        仅显示前 10 条，共 {parsedPreview.length} 条
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    模板预览（按三部分展示）
                  </label>
                  
                  {/* 头部信息 */}
                  {headerSectionData.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-6 bg-blue-500 rounded"></div>
                        <h3 className="text-base font-semibold text-gray-800">头部信息</h3>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">字段</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">内容</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {headerSectionData.map((section, sectionIdx) => (
                              Object.entries(section).map(([key, value], idx) => (
                                <tr key={`${sectionIdx}-${idx}`}>
                                  <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap bg-gray-50">{key}</td>
                                  <td className="px-3 py-2 text-gray-600">{value}</td>
                                </tr>
                              ))
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* 主体表格 */}
                  {dataSectionData.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-6 bg-green-500 rounded"></div>
                        <h3 className="text-base font-semibold text-gray-800">主体表格（{dataSectionData.length - 1} 行数据）</h3>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">行号</th>
                              {dataSectionData[0].map((col, i) => (
                                <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                  {String(col || '') || `列${i + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {dataSectionData.slice(1, 11).map((row, i) => (
                              <tr key={i}>
                                <td className="px-3 py-1.5 text-gray-400 text-xs whitespace-nowrap">{i + 1}</td>
                                {row.map((cell: any, j: number) => (
                                  <td key={j} className="px-3 py-1.5 text-gray-500 whitespace-nowrap max-w-[200px] truncate">
                                    {String(cell || '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {dataSectionData.length > 11 && (
                          <div className="px-6 py-2 text-sm text-gray-500 border-t border-gray-200">
                            仅显示前 10 行，共 {dataSectionData.length - 1} 行数据
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* 尾部信息 */}
                  {footerSectionData.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-6 bg-purple-500 rounded"></div>
                        <h3 className="text-base font-semibold text-gray-800">尾部信息</h3>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">字段</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">内容</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {footerSectionData.map((section, sectionIdx) => (
                              Object.entries(section).map(([key, value], idx) => (
                                <tr key={`${sectionIdx}-${idx}`}>
                                  <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap bg-gray-50">{key}</td>
                                  <td className="px-3 py-2 text-gray-600">{value}</td>
                                </tr>
                              ))
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {headerSectionData.length === 0 && dataSectionData.length === 0 && footerSectionData.length === 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                      <div className="px-6 py-8 text-center text-gray-500">
                        请上传文件以预览数据
                      </div>
                    </div>
                  )}
                </>
              )}

              {previewFile && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAutoDetect}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {loading ? '映射中...' : 'AI 自动映射'}
                  </button>
                  <button
                    onClick={handleLocalAutoDetect}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? '映射中...' : '自动映射'}
                  </button>
                  <button
                    onClick={handleTest}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    测试解析
                  </button>
                  <button
                    onClick={handleTestWithAI}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {loading ? '解析中...' : 'AI 测试解析'}
                  </button>
                  {parsedPreview.length > 0 && (
                    <button
                      onClick={() => setParsedPreview([])}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      隐藏解析结果
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
