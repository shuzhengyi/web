import { extractText, getDocumentProxy } from 'unpdf';

export interface PdfSections {
  headerSection: { [key: string]: string }[];
  dataSection: any[][];
  footerSection: { [key: string]: string }[];
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  rows: any[][];
  headers: string[];
  text: string;
  pages: string[];
}

export interface PdfParseResult {
  success: boolean;
  sections?: PdfSections;
  error?: string;
}

/**
 * 文本项，包含坐标信息
 */
interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PdfParseEngine {

  /**
   * 解析 PDF 文件
   */
  async parse(buffer: Buffer): Promise<PdfParseResult> {
    try {
      // 1. 提取文本项（带坐标）
      const { textItems, pages } = await this.extractTextWithPosition(buffer);

      if (!textItems || textItems.length === 0) {
        return {
          success: false,
          error: 'PDF 文件内容为空或无法提取文本',
        };
      }

      console.log('[PdfParseEngine] 提取到', textItems.length, '个文本项');
      console.log('[PdfParseEngine] 前 10 个文本项:', JSON.stringify(textItems.slice(0, 10)));

      // 2. 根据 Y 坐标分组为行，X 坐标排序为列
      const data = this.groupByRow(textItems);

      console.log('[PdfParseEngine] 分组后行数:', data.length);
      console.log('[PdfParseEngine] 前 10 行:', JSON.stringify(data.slice(0, 10)));

      // 3. 检测表头行和数据范围
      const headerRow = this.detectHeaderRow(data);
      const dataStartRow = headerRow + 1;
      const dataEndRow = this.detectDataEndRow(data, dataStartRow);

      console.log('[PdfParseEngine] 表头行:', headerRow, '数据起始:', dataStartRow, '数据结束:', dataEndRow);

      // 4. 分割三部分
      const headerSection = this.extractHeaderSection(data, headerRow);
      const dataSection = data.slice(headerRow - 1, dataEndRow);
      const headers = dataSection.length > 0 ? dataSection[0] : [];
      const footerSection = this.extractFooterSection(data, dataEndRow);

      // 合并所有文本
      const fullText = textItems.map(item => item.str).join(' ');

      const sections: PdfSections = {
        headerSection,
        dataSection,
        footerSection,
        headerRow,
        dataStartRow,
        dataEndRow,
        rows: data,
        headers: headers.map(h => String(h || '').trim()),
        text: fullText,
        pages,
      };

      return { success: true, sections };
    } catch (error) {
      console.error('PDF 解析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF 解析失败',
      };
    }
  }

  /**
   * 提取 PDF 文本项（带坐标）
   * 使用 pdf.js 底层 API 获取每个文本块的坐标
   */
  private async extractTextWithPosition(buffer: Buffer): Promise<{ textItems: TextItem[]; pages: string[] }> {
    const pdfDoc = await getDocumentProxy(new Uint8Array(buffer));
    const numPages = pdfDoc.numPages;

    const allTextItems: TextItem[] = [];
    const pages: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const pageHeight = viewport.height;

      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      let pageItems: TextItem[] = [];

      for (const item of items) {
        if (!item.str || !item.str.trim()) continue;

        const transform = item.transform as number[];
        const x = transform[4];
        // PDF 坐标原点在左下角，转换为左上角
        const y = pageHeight - transform[5];
        const width = item.width || 0;
        const height = Math.abs(transform[3]) || item.height || 0;

        pageItems.push({ str: item.str.trim(), x, y, width, height });
      }

      allTextItems.push(...pageItems);

      // 按 Y 排序后构建页面文本
      const sorted = [...pageItems].sort((a, b) => a.y - b.y);
      let prevY = -1;
      let rowStrs: string[] = [];
      let pageText = '';

      for (const item of sorted) {
        if (prevY !== -1 && Math.abs(item.y - prevY) > 5) {
          if (rowStrs.length > 0) {
            pageText += rowStrs.join(' ') + '\n';
          }
          rowStrs = [];
        }
        rowStrs.push(item.str);
        prevY = item.y;
      }
      if (rowStrs.length > 0) {
        pageText += rowStrs.join(' ');
      }

      pages.push(pageText.trim());
    }

    return { textItems: allTextItems, pages };
  }

  /**
   * 按 Y 坐标分组为行，按 X 坐标排序为列
   */
  private groupByRow(textItems: TextItem[]): any[][] {
    if (textItems.length === 0) return [];

    // 先按 Y 排序
    const sorted = [...textItems].sort((a, b) => a.y - b.y);

    const rows: TextItem[][] = [];
    const rowTolerance = 8; // 行高容差

    for (const item of sorted) {
      let foundRow = false;
      for (const row of rows) {
        const avgY = row.reduce((sum, r) => sum + r.y, 0) / row.length;
        if (Math.abs(item.y - avgY) < rowTolerance) {
          row.push(item);
          foundRow = true;
          break;
        }
      }
      if (!foundRow) {
        rows.push([item]);
      }
    }

    // 每行按 X 坐标排序，提取文本
    return rows.map(row => {
      row.sort((a, b) => a.x - b.x);
      return row.map(item => item.str);
    });
  }

  /**
   * 检测表头行
   * 查找包含表格列标题关键词的行
   */
  private detectHeaderRow(data: any[][]): number {
    for (let i = 0; i < Math.min(50, data.length); i++) {
      const row = data[i];
      let dataColumnCount = 0;
      const keywords = ['编码', '名称', '数量', '规格', 'sku', '类别', '单位', '备注', '型号'];

      for (const cell of row) {
        const cellStr = String(cell || '').toLowerCase();
        for (const keyword of keywords) {
          if (cellStr.includes(keyword)) {
            dataColumnCount++;
            break;
          }
        }
      }
      // 至少 2 个列标题关键词匹配
      if (dataColumnCount >= 2) {
        console.log('[PdfParseEngine] 找到表头行', i + 1, ':', row);
        return i + 1; // 1-based
      }
    }
    console.log('[PdfParseEngine] 未找到表头行，使用默认值 1');
    return 1;
  }

  /**
   * 检测数据结束行
   */
  private detectDataEndRow(data: any[][], startRow: number): number {
    for (let i = startRow - 1; i < data.length; i++) {
      const rowStr = data[i].join(' ');
      if (rowStr.includes('合计') || rowStr.includes('总计')) {
        return i;
      }
    }
    return data.length;
  }

  /**
   * 解析键值对（按冒号分割）
   */
  private parseKeyValuePairs(cells: string[]): { [key: string]: string } {
    const result: { [key: string]: string } = {};
    for (const cell of cells) {
      const colonIndex = cell.indexOf(':');
      if (colonIndex > 0) {
        const key = cell.substring(0, colonIndex).trim();
        const value = cell.substring(colonIndex + 1).trim();
        if (key && value) {
          result[key] = value;
        }
      }
    }
    return result;
  }

  /**
   * 提取头部信息
   */
  private extractHeaderSection(data: any[][], headerRow: number): { [key: string]: string }[] {
    const headerSection: { [key: string]: string }[] = [];
    for (let i = 0; i < headerRow - 1; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const rowStr = row.join(' ');
      if (rowStr.includes(':')) {
        const cells = row.filter(cell => String(cell).includes(':'));
        if (cells.length > 0) {
          const rowObj = this.parseKeyValuePairs(cells.map(c => String(c)));
          if (Object.keys(rowObj).length > 0) {
            headerSection.push(rowObj);
          }
          continue;
        }
      }

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
    return headerSection;
  }

  /**
   * 提取尾部信息
   */
  private extractFooterSection(data: any[][], dataEndRow: number): { [key: string]: string }[] {
    const footerSection: { [key: string]: string }[] = [];
    for (let i = dataEndRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every(cell => !cell)) continue;

      const cells = row.filter(cell => String(cell).includes(':'));
      if (cells.length > 0) {
        const rowObj = this.parseKeyValuePairs(cells.map(c => String(c)));
        if (Object.keys(rowObj).length > 0) {
          footerSection.push(rowObj);
        }
        continue;
      }

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
    return footerSection;
  }
}
