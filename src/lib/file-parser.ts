import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { PdfParseEngine, type PdfSections } from './pdf-parse-engine';

// 文件类型
export type FileType = 'excel' | 'word' | 'pdf';

// 解析结果
export interface FileParseResult {
  success: boolean;
  content?: string;
  structuredData?: any;
  preview?: string;
  error?: string;
  errorType?: 'format' | 'empty' | 'encoding' | 'parse' | 'unknown';
}

// Excel 结构化数据
export interface ExcelStructuredData {
  headers: string[];
  rows: any[][];
  headerSection: { [key: string]: string }[];
  dataSection: any[][];
  footerSection: { [key: string]: string }[];
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
}

// Word 结构化数据
export interface WordStructuredData {
  paragraphs: string[];
  tables: { headers: string[]; rows: any[][] }[];
}

// PDF 结构化数据
export interface PdfStructuredData {
  pages: string[];
  text: string;
  headers: string[];
  rows: any[][];
  headerSection: { [key: string]: string }[];
  dataSection: any[][];
  footerSection: { [key: string]: string }[];
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
}

/**
 * 检测文件类型
 */
export function detectFileType(file: File): FileType | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mime = file.type;

  if (extension === 'xlsx' || extension === 'xls' || 
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel') {
    return 'excel';
  }

  if (extension === 'docx' || 
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'word';
  }

  if (extension === 'pdf' || mime === 'application/pdf') {
    return 'pdf';
  }

  return null;
}

/**
 * 解析 Excel 文件
 */
export async function parseExcel(buffer: Buffer): Promise<FileParseResult> {
  try {
    const workbook = XLSX.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (jsonData.length === 0) {
      return {
        success: false,
        error: 'Excel 文件为空',
        errorType: 'empty',
      };
    }

    // 检测结构
    let headerRow = 1;
    let dataStartRow = 2;
    let dataEndRow = jsonData.length;

    // 找表头行
    for (let i = 0; i < Math.min(30, jsonData.length); i++) {
      const row = jsonData[i];
      let dataColumnCount = 0;
      for (const cell of row) {
        const cellStr = String(cell || '').toLowerCase();
        if (
          cellStr.includes('编码') || 
          cellStr.includes('名称') || 
          cellStr.includes('数量') ||
          cellStr.includes('规格') ||
          cellStr.includes('sku')
        ) {
          dataColumnCount++;
        }
      }
      if (dataColumnCount >= 2) {
        headerRow = i + 1;
        dataStartRow = i + 2;
        break;
      }
    }

    // 找数据结束行
    for (let i = dataStartRow - 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowStr = row.map(cell => String(cell || '')).join(' ');
      if (rowStr.includes('合计')) {
        dataEndRow = i;
        break;
      }
    }

    // 分割三部分
    const headerSection: { [key: string]: string }[] = [];
    for (let i = 0; i < headerRow - 1; i++) {
      const row = jsonData[i];
      if (!row || row.every(cell => !cell)) continue;
      const rowObj: { [key: string]: string } = {};
      for (let j = 0; j < row.length - 1; j += 2) {
        const key = String(row[j] || '').trim();
        const value = String(row[j + 1] || '').trim();
        if (key && value) {
          rowObj[key] = value;
        }
      }
      if (Object.keys(rowObj).length > 0) {
        headerSection.push(rowObj);
      }
    }

    const dataSection = jsonData.slice(headerRow - 1, dataEndRow);
    const headers = dataSection[0] || [];

    const footerSection: { [key: string]: string }[] = [];
    for (let i = dataEndRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.every(cell => !cell)) continue;
      const rowObj: { [key: string]: string } = {};
      for (let j = 0; j < row.length - 1; j += 2) {
        const key = String(row[j] || '').trim();
        const value = String(row[j + 1] || '').trim();
        if (key && value) {
          rowObj[key] = value;
        }
      }
      if (Object.keys(rowObj).length > 0) {
        footerSection.push(rowObj);
      }
    }

    // 生成预览
    const preview = jsonData.slice(0, 15).map(row => 
      row.map(cell => String(cell || '')).join('\t')
    ).join('\n');

    const structuredData: ExcelStructuredData = {
      headers: headers.map(h => String(h || '').trim()),
      rows: jsonData,
      headerSection,
      dataSection,
      footerSection,
      headerRow,
      dataStartRow,
      dataEndRow,
    };

    return {
      success: true,
      content: preview,
      structuredData,
      preview,
    };
  } catch (error) {
    console.error('Excel 解析失败:', error);
    return {
      success: false,
      error: `Excel 解析失败：${error instanceof Error ? error.message : '未知错误'}`,
      errorType: 'parse',
    };
  }
}

/**
 * 解析 Word 文件
 */
export async function parseWord(buffer: Buffer): Promise<FileParseResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'Word 文件内容为空',
        errorType: 'empty',
      };
    }

    // 提取段落
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

    // 生成预览（前 500 字符）
    const preview = text.substring(0, 500);

    const structuredData: WordStructuredData = {
      paragraphs,
      tables: [], // mammoth 不支持表格提取，需要使用其他库
    };

    return {
      success: true,
      content: text,
      structuredData,
      preview,
    };
  } catch (error) {
    console.error('Word 解析失败:', error);
    return {
      success: false,
      error: `Word 解析失败：${error instanceof Error ? error.message : '未知错误'}`,
      errorType: 'parse',
    };
  }
}

/**
 * 解析 PDF 文件
 */
export async function parsePdf(buffer: Buffer): Promise<FileParseResult> {
  try {
    const engine = new PdfParseEngine();
    const result = await engine.parse(buffer);

    if (!result.success || !result.sections) {
      return {
        success: false,
        error: result.error || 'PDF 文件解析失败',
        errorType: 'parse',
      };
    }

    const sections = result.sections;

    // 生成预览（前 15 行）
    const preview = sections.dataSection.slice(0, 15).map(row =>
      row.map(cell => String(cell || '')).join('\t')
    ).join('\n');

    return {
      success: true,
      content: sections.text,
      structuredData: sections as PdfStructuredData,
      preview,
    };
  } catch (error) {
    console.error('PDF 解析失败:', error);
    return {
      success: false,
      error: `PDF 解析失败：${error instanceof Error ? error.message : '未知错误'}`,
      errorType: 'parse',
    };
  }
}

/**
 * 统一解析文件
 */
export async function parseFile(file: File, buffer: Buffer): Promise<FileParseResult> {
  const fileType = detectFileType(file);

  if (!fileType) {
    return {
      success: false,
      error: '不支持的文件格式',
      errorType: 'format',
    };
  }

  if (file.size === 0) {
    return {
      success: false,
      error: '文件为空',
      errorType: 'empty',
    };
  }

  switch (fileType) {
    case 'excel':
      return parseExcel(buffer);
    case 'word':
      return parseWord(buffer);
    case 'pdf':
      return parsePdf(buffer);
    default:
      return {
        success: false,
        error: '未知文件类型',
        errorType: 'unknown',
      };
  }
}

/**
 * 使用 AI 分析文件内容并生成推荐规则
 */
export async function analyzeFileWithAI(
  fileType: FileType,
  content: string,
  structuredData?: any
): Promise<{
  success: boolean;
  suggestedRule?: {
    name: string;
    description: string;
    fileType: string;
    isActive: boolean;
    config: any;
  };
  error?: string;
}> {
  // 这里可以调用智谱 AI 进行分析
  // 目前返回基于结构化数据的简单规则

  if (fileType === 'excel' && structuredData) {
    const excelData = structuredData as ExcelStructuredData;
    
    // 从表头提取字段映射
    const fieldMapping: Record<string, { column: string; transform?: string }> = {};
    
    excelData.headers.forEach((header: string, index: number) => {
      if (header.includes('物品编码') || header.includes('SKU 编码') || header.includes('编码')) {
        fieldMapping.skuCode = { column: header, transform: 'trim' };
      }
      if (header.includes('物品名称') || header.includes('SKU 名称') || header.includes('名称')) {
        fieldMapping.skuName = { column: header, transform: 'trim' };
      }
      if ((header.includes('数量') || header.includes('发货数量')) && 
          !header.includes('辅助') && !header.includes('单位')) {
        fieldMapping.quantity = { column: header, transform: 'number' };
      }
      if (header.includes('规格') || header.includes('型号')) {
        fieldMapping.specification = { column: header, transform: 'trim' };
      }
    });

    // 从头部和尾部提取公共信息映射
    const allKeyValuePairs: { [key: string]: string } = {};
    excelData.headerSection.forEach(section => Object.assign(allKeyValuePairs, section));
    excelData.footerSection.forEach(section => Object.assign(allKeyValuePairs, section));

    for (const [key, value] of Object.entries(allKeyValuePairs)) {
      if (key.includes('单号') || key.includes('单据')) {
        fieldMapping.externalCode = { column: key, transform: 'trim' };
      }
      if (key.includes('门店') || key.includes('仓库') || key.includes('仓') || 
          key.includes('店名') || key.includes('店铺') || key.includes('门店名称')) {
        fieldMapping.storeName = { column: key, transform: 'trim' };
      }
      if (key.includes('收货人') || key.includes('收件人') || key.includes('收货') || key.includes('联系人')) {
        fieldMapping.receiverName = { column: key, transform: 'trim' };
      }
      if (key.includes('电话') || key.includes('手机') || key.includes('联系电话') || key.includes('手机号')) {
        fieldMapping.receiverPhone = { column: key, transform: 'trim' };
      }
      if (key.includes('地址')) {
        fieldMapping.receiverAddress = { column: key, transform: 'trim' };
      }
    }

    return {
      success: true,
      suggestedRule: {
        name: '自动生成规则',
        description: '基于文件结构自动生成的解析规则',
        fileType: 'excel',
        isActive: true,
        config: {
          headerRow: excelData.headerRow,
          dataStartRow: excelData.dataStartRow,
          fieldMapping,
        },
      },
    };
  }

  // Word 和 PDF 暂不支持自动规则生成
  return {
    success: false,
    error: `${fileType === 'word' ? 'Word' : 'PDF'} 文件暂不支持自动规则生成，请手动配置`,
  };
}