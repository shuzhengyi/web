import * as XLSX from 'xlsx';

export interface ParseConfig {
  sheetName?: string;
  // 自动检测时使用
  autoDetect?: boolean;
  // 手动配置时使用
  headerRow?: number;
  dataStartRow?: number;
  dataEndRow?: number;
  // 字段映射（支持单个或多个映射）
  fieldMapping: Record<string, string | { column: string; transform?: string; section?: string } | Array<string | { column: string; transform?: string; section?: string }>>;
  // 矩阵转置配置
  matrixTranspose?: {
    enabled: boolean;
    matrices?: Array<{ name: string; valueName: string; columns: number[] }>; // 支持多个矩阵，每个矩阵有列名和列值名称
  };
  // 卡片分组配置（用于卡片式Excel）
  cardGroup?: {
    enabled: boolean;
    keyword: string; // 分组关键词
    matchMode: 'contains' | 'startsWith' | 'exact'; // 匹配模式
  };
  // 卡片头部字段映射（行偏移 -> 列索引 -> 目标字段名）
  cardHeaderMapping?: {
    [rowOffset: number]: {
      [colIndex: number]: string;
    };
  };
}

export interface ExcelSections {
  headerSection: { [key: string]: string }[];  // 头部信息（键值对数组）
  dataSection: any[][];                        // 主体表格数据
  footerSection: { [key: string]: string }[];  // 尾部信息（键值对数组）
  headerRow: number;                           // 表头行号
  dataStartRow: number;                        // 数据起始行
  dataEndRow: number;                          // 数据结束行
}

export interface ParsedItem {
  externalCode?: string;
  storeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  specification?: string;
  remark?: string;
}

export interface ParseResult {
  success: boolean;
  items: ParsedItem[];
  errors: string[];
  warnings: string[];
  sections?: ExcelSections;  // 返回分好的三部分数据
}

export class ParseEngine {
  private config: ParseConfig;

  constructor(config: ParseConfig) {
    this.config = config;
  }

  /**
   * 解析 Excel，自动分为三部分：头部、主体、尾部
   * 支持多sheet导入，遍历所有sheet并合并结果
   */
  parseExcel(buffer: Buffer): ParseResult {
    const result: ParseResult = {
      success: false,
      items: [],
      errors: [],
      warnings: [],
    };

    try {
      const workbook = XLSX.read(buffer);
      const allItems: ParsedItem[] = [];
      
      // 如果指定了sheet名称，只解析该sheet
      if (this.config.sheetName) {
        const sheetName = this.config.sheetName;
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
          result.errors.push(`找不到工作表：${sheetName}`);
          return result;
        }
        
        const sheetResult = this.parseSingleSheet(worksheet, sheetName);
        allItems.push(...sheetResult.items);
        result.errors.push(...sheetResult.errors);
        result.warnings.push(...sheetResult.warnings);
        result.sections = sheetResult.sections;
      } else {
        // 否则遍历所有sheet
        const sheetNames = workbook.SheetNames;
        
        if (sheetNames.length === 0) {
          result.errors.push('Excel文件中没有工作表');
          return result;
        }
        
        // 如果有多个sheet，给出警告
        if (sheetNames.length > 1) {
          result.warnings.push(`检测到 ${sheetNames.length} 个工作表，将依次导入`);
        }
        
        // 遍历所有sheet
        for (let i = 0; i < sheetNames.length; i++) {
          const sheetName = sheetNames[i];
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) {
            result.errors.push(`找不到工作表：${sheetName}`);
            continue;
          }
          
          const sheetResult = this.parseSingleSheet(worksheet, sheetName);
          allItems.push(...sheetResult.items);
          result.errors.push(...sheetResult.errors);
          result.warnings.push(...sheetResult.warnings);
          
          // 只保留第一个sheet的sections信息（用于预览）
          if (i === 0) {
            result.sections = sheetResult.sections;
          }
        }
      }
      
      result.items = allItems;
      console.log('[parseExcel] 解析完成，共', allItems.length, '条数据');
      console.log('[parseExcel] 卡片分组配置:', JSON.stringify(this.config.cardGroup));
      // 只有当没有错误且有解析到数据时，才认为成功
      result.success = result.errors.length === 0 && allItems.length > 0;
    } catch (error) {
      result.errors.push(`解析 Excel 文件失败：${(error as Error).message}`);
    }

    return result;
  }
  
  /**
   * 解析单个工作表
   */
  private parseSingleSheet(worksheet: XLSX.WorkSheet, sheetName: string): ParseResult {
    const result: ParseResult = {
      success: false,
      items: [],
      errors: [],
      warnings: [],
    };
    
    try {
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log(`[parseSingleSheet] 工作表: ${sheetName}, 行数: ${jsonData.length}`);
      
      // 检查是否启用了卡片分组模式
      if (this.config.cardGroup?.enabled && this.config.cardGroup.keyword) {
        console.log('[parseSingleSheet] 使用卡片分组模式');
        // 使用卡片分组解析
        const items = this.parseWithCardGroup(jsonData);
        result.items = items;
        result.success = true;  // 添加这行
        
        console.log(`[parseSingleSheet] 卡片分组解析完成，解析到 ${items.length} 条记录`);
        
        if (items.length === 0) {
          result.warnings.push(`工作表 "${sheetName}" 没有解析到数据`);
        }
      } else {
        // 使用普通三部分结构解析
        const sections = this.detectSections(jsonData);
        result.sections = sections;
        
        // 从头部和尾部提取公共信息
        const commonInfo = this.extractCommonInfoFromSections(sections);
        
        // 解析主体表格数据
        const items = this.parseDataSection(sections, commonInfo);
        result.items = items;
        
        if (items.length === 0) {
          result.warnings.push(`工作表 "${sheetName}" 没有解析到数据`);
        }
      }
      
      // 如果该sheet没有数据，给出警告
      if (result.items.length === 0) {
        result.warnings.push(`工作表 "${sheetName}" 没有解析到数据`);
      }
      
      result.success = true;
    } catch (error) {
      result.errors.push(`解析工作表 "${sheetName}" 失败：${(error as Error).message}`);
    }
    
    return result;
  }

  /**
   * 使用卡片分组模式解析 Excel
   * 适用于卡片式布局的Excel，每个卡片包含独立的调拨/订单信息
   */
  private parseWithCardGroup(rows: any[][]): ParsedItem[] {
    const items: ParsedItem[] = [];
    const { keyword, matchMode } = this.config.cardGroup!;
    const headerMapping = this.config.cardHeaderMapping || {};
    
    console.log(`[parseWithCardGroup] ========== 开始卡片分组解析 ==========`);
    console.log(`[parseWithCardGroup] 关键词: "${keyword}"，匹配模式: ${matchMode}`);
    console.log(`[parseWithCardGroup] 头部映射:`, JSON.stringify(headerMapping));
    console.log(`[parseWithCardGroup] 字段映射:`, JSON.stringify(this.config.fieldMapping));
    
    // 1. 找到所有卡片起始行（包含关键词的行）
    const cardStartRows: number[] = [];
    console.log(`[parseWithCardGroup] 数据行数: ${rows.length}`);
    
    // 预处理关键词：移除空白字符
    const cleanKeyword = keyword.replace(/\s+/g, '');
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowStr = String(row[0] || '').trim();
      
      // 调试：打印前20行的第一列内容
      if (i < 25) {
        console.log(`[parseWithCardGroup] 行${i}: "${rowStr}"`);
      }
      
      // 预处理行内容：移除空白字符和特殊符号
      const cleanRowStr = rowStr.replace(/[\s\u3000\u00A0]/g, '');
      
      let isMatch = false;
      switch (matchMode) {
        case 'contains':
          // 尝试原始匹配和预处理后匹配
          isMatch = rowStr.includes(keyword) || cleanRowStr.includes(cleanKeyword);
          break;
        case 'startsWith':
          isMatch = rowStr.startsWith(keyword);
          break;
        case 'exact':
          isMatch = rowStr === keyword;
          break;
      }
      
      if (isMatch) {
        cardStartRows.push(i);
        console.log(`[parseWithCardGroup] 找到匹配行 ${i}: "${rowStr}"`);
      }
    }
    
    console.log(`[parseWithCardGroup] 共找到 ${cardStartRows.length} 个卡片，起始行:`, cardStartRows);
    
    if (cardStartRows.length === 0) {
      console.warn('没有找到任何卡片，请检查关键词配置');
      return items;
    }
    
    // 2. 解析每个卡片
    for (let i = 0; i < cardStartRows.length; i++) {
      const cardStartRow = cardStartRows[i];
      const cardEndRow = i < cardStartRows.length - 1 ? cardStartRows[i + 1] : rows.length;
      
      console.log(`[parseWithCardGroup] 处理卡片 ${i + 1}: 起始行 ${cardStartRow}, 结束行 ${cardEndRow}`);
      
      // 提取卡片公共信息
      const cardCommonInfo = this.extractCardHeaderInfo(rows, cardStartRow, cardEndRow, headerMapping);
      console.log(`[parseWithCardGroup] 卡片 ${i + 1} 公共信息:`, cardCommonInfo);
      
      // 找到商品数据区域
      const dataStartRow = this.findCardDataStartRow(rows, cardStartRow, cardEndRow);
      console.log(`[parseWithCardGroup] 卡片 ${i + 1} 商品数据起始行: ${dataStartRow}`);
      
      if (dataStartRow === -1) {
        console.warn(`[parseWithCardGroup] 卡片 ${i + 1} 没有找到商品数据区域`);
        continue;
      }
      
      // 解析商品数据
      for (let rowIdx = dataStartRow; rowIdx < cardEndRow; rowIdx++) {
        const row = rows[rowIdx];
        if (!row || row.every(cell => !cell)) continue;
        
        // 获取第一列的值
        const rowStr = String(row[0] || '').trim();
        
        // 跳过真正的表头行（整行都是文本描述，不包含SKU编码格式）
        // 通过检查是否同时包含多个关键词来判断是否是表头行
        const isLikelyHeader = 
          (rowStr.includes('商品') || rowStr.includes('物品')) &&
          (rowStr.includes('编码') || rowStr.includes('名称') || rowStr.includes('规格') || rowStr.includes('数量'));
        
        if (isLikelyHeader) {
          continue;
        }
        
        // 跳过合计行
        if (rowStr.includes('合计') || rowStr.includes('总计')) {
          continue;
        }
        
        // 跳过空行或只有单个值的行
        if (!rowStr || rowStr.length < 2) {
          continue;
        }
        
        const item = this.parseCardDataRow(row, cardCommonInfo, rows[dataStartRow - 1]);
        if (item) {
          items.push(item);
          console.log(`[parseWithCardGroup] 解析商品行: ${JSON.stringify(item)}`);
        }
      }
    }
    
    return items;
  }
  
  /**
   * 提取卡片头部信息
   */
  private extractCardHeaderInfo(
    rows: any[][],
    cardStartRow: number,
    cardEndRow: number,
    headerMapping: { [rowOffset: number]: { [colIndex: number]: string } }
  ): Partial<ParsedItem> {
    const info: Partial<ParsedItem> = {};
    
    console.log(`[extractCardHeaderInfo] 卡片起始行: ${cardStartRow}, 结束行: ${cardEndRow}`);
    
    // 如果没有配置headerMapping，使用默认规则
    const useDefaultMapping = Object.keys(headerMapping).length === 0;
    
    if (useDefaultMapping) {
      // 默认映射规则：遍历卡片头部区域的所有行，提取门店、收货人、电话、地址信息
      for (let rowOffset = 1; rowOffset <= 5 && (cardStartRow + rowOffset) < cardEndRow; rowOffset++) {
        const rowIdx = cardStartRow + rowOffset;
        const row = rows[rowIdx];
        if (!row) continue;
        
        console.log(`[extractCardHeaderInfo] 检查行 ${rowIdx}:`, row);
        
        // 遍历这一行的所有单元格，查找标签和对应的值
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = String(row[colIndex] || '').trim();
          if (!cellValue) continue;
          
          console.log(`[extractCardHeaderInfo]   列${colIndex}: "${cellValue}"`);
          
          // 检查是否是标签，如果是，取下一个单元格的值
          if (cellValue.includes('调入门店') || cellValue.includes('门店')) {
            // 门店标签，取下一个单元格的值
            if (colIndex + 1 < row.length) {
              const storeValue = String(row[colIndex + 1] || '').trim();
              if (storeValue && !info.storeName) {
                info.storeName = storeValue;
                console.log(`[extractCardHeaderInfo]     -> 设置 storeName: "${storeValue}"`);
              }
            }
          } else if (cellValue.includes('收货人') || cellValue.includes('姓名') || cellValue.includes('联系人')) {
            // 收货人标签，取下一个单元格的值
            if (colIndex + 1 < row.length) {
              const receiverValue = String(row[colIndex + 1] || '').trim();
              if (receiverValue && !info.receiverName) {
                info.receiverName = receiverValue;
                console.log(`[extractCardHeaderInfo]     -> 设置 receiverName: "${receiverValue}"`);
              }
            }
          } else if (cellValue.includes('电话') || cellValue.includes('手机')) {
            // 电话标签，取下一个单元格的值
            if (colIndex + 1 < row.length) {
              const phoneValue = String(row[colIndex + 1] || '').trim();
              if (phoneValue && !info.receiverPhone) {
                // 尝试匹配手机号
                const phoneMatch = phoneValue.match(/1[3-9]\d{9}/);
                info.receiverPhone = phoneMatch ? phoneMatch[0] : phoneValue;
                console.log(`[extractCardHeaderInfo]     -> 设置 receiverPhone: "${info.receiverPhone}"`);
              }
            }
          } else if (cellValue.includes('地址')) {
            // 地址标签，取下一个单元格的值
            if (colIndex + 1 < row.length) {
              const addressValue = String(row[colIndex + 1] || '').trim();
              if (addressValue && !info.receiverAddress) {
                info.receiverAddress = addressValue;
                console.log(`[extractCardHeaderInfo]     -> 设置 receiverAddress: "${addressValue}"`);
              }
            }
          }
          
          // 如果所有字段都找到了，提前退出
          if (info.storeName && info.receiverName && info.receiverPhone && info.receiverAddress) {
            break;
          }
        }
        
        if (info.storeName && info.receiverName && info.receiverPhone && info.receiverAddress) {
          break;
        }
      }
      
      console.log(`[extractCardHeaderInfo] 最终提取结果:`, info);
      return info;
    }
    
    // 遍历卡片头部映射配置
    for (const [rowOffsetStr, colMapping] of Object.entries(headerMapping)) {
      const rowOffset = parseInt(rowOffsetStr, 10);
      const rowIdx = cardStartRow + rowOffset;
      
      if (rowIdx >= cardEndRow || rowIdx < 0 || rowIdx >= rows.length) {
        continue;
      }
      
      const row = rows[rowIdx];
      if (!row) continue;
      
      for (const [colIndexStr, targetField] of Object.entries(colMapping)) {
        const colIndex = parseInt(colIndexStr, 10);
        const value = row[colIndex];
        
        if (value !== undefined && value !== null && value !== '') {
          // 根据目标字段类型处理值
          switch (targetField) {
            case 'quantity':
              info[targetField as keyof ParsedItem] = Number(value) || 0;
              break;
            default:
              info[targetField as keyof ParsedItem] = String(value).trim();
          }
        }
      }
    }
    
    return info;
  }
  
  /**
   * 找到卡片中商品数据的起始行
   */
  private findCardDataStartRow(rows: any[][], cardStartRow: number, cardEndRow: number): number {
    console.log(`[findCardDataStartRow] 查找商品数据起始行: cardStartRow=${cardStartRow}, cardEndRow=${cardEndRow}`);
    
    // 找到包含"商品编码"或类似关键词的行
    for (let i = cardStartRow; i < cardEndRow; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const rowStr = String(row[0] || '').trim();
      console.log(`[findCardDataStartRow] 检查行 ${i}: "${rowStr}"`);
      
      if (rowStr.includes('商品编码') || rowStr.includes('编码')) {
        console.log(`[findCardDataStartRow] 找到商品表头行 ${i}，返回数据起始行 ${i + 1}`);
        // 返回下一行（数据行）
        return i + 1;
      }
    }
    
    console.log(`[findCardDataStartRow] 未找到商品表头行`);
    
    return -1;
  }
  
  /**
   * 解析卡片中的数据行
   * 在卡片模式下，直接使用列索引获取数据
   */
  private parseCardDataRow(row: any[], commonInfo: Partial<ParsedItem>, headerRow: string[]): ParsedItem | null {
    const item: ParsedItem = {
      skuCode: '',
      skuName: '',
      specification: '',
      quantity: 0,
      ...commonInfo as ParsedItem,
    };
    
    // 在卡片模式下，直接使用列索引获取数据
    // 列0=物品编码/商品编码，列1=商品名称，列2=规格，列3=数量
    if (row[0]) item.skuCode = String(row[0]).trim();
    if (row[1]) item.skuName = String(row[1]).trim();
    if (row[2]) item.specification = String(row[2]).trim();
    if (row[3]) item.quantity = Number(row[3]) || 0;
    
    // 处理组合字段（根据规则配置）
    this.applyFieldMappingForCardMode(item, row, commonInfo, headerRow);
    
    // 验证必填字段
    if (!item.skuCode && !item.skuName) {
      console.log(`[parseCardDataRow] 跳过无效行：skuCode=${item.skuCode}, skuName=${item.skuName}`);
      return null;
    }
    
    return item;
  }
  
  /**
   * 在卡片模式下应用字段映射配置
   */
  private applyFieldMappingForCardMode(
    item: ParsedItem, 
    row: any[], 
    commonInfo: Partial<ParsedItem>, 
    headerRow: string[]
  ) {
    if (!this.config.fieldMapping) return;
    
    for (const [targetField, mapping] of Object.entries(this.config.fieldMapping)) {
      // 跳过已经设置的字段
      if (targetField === 'skuCode' || targetField === 'skuName' || 
          targetField === 'specification' || targetField === 'quantity') {
        continue;
      }
      
      const mappings = Array.isArray(mapping) ? mapping : [mapping];
      const parts: string[] = [];
      
      for (const m of mappings) {
        const columnIdentifier = typeof m === 'string' ? m : m.column;
        const section = typeof m === 'string' ? 'data' : (m.section || 'data');
        
        // 尝试找到对应的列索引
        let value: string | undefined;
        
        // 如果是头部字段，从 commonInfo 中获取
        if (section === 'header') {
          // 根据配置的列名查找对应的字段值
          if (columnIdentifier.includes('门店')) {
            value = String(commonInfo.storeName || '').trim();
          } else if (columnIdentifier.includes('收货人')) {
            value = String(commonInfo.receiverName || '').trim();
          } else if (columnIdentifier.includes('电话')) {
            value = String(commonInfo.receiverPhone || '').trim();
          } else if (columnIdentifier.includes('地址')) {
            value = String(commonInfo.receiverAddress || '').trim();
          }
        } else {
          // 如果是数字，直接作为列索引
          const colNum = parseInt(columnIdentifier, 10);
          if (!isNaN(colNum) && colNum > 0 && colNum <= row.length) {
            value = String(row[colNum - 1] || '').trim();
          } else if (headerRow) {
            // 尝试通过表头名称查找列索引
            const colIndex = headerRow.findIndex(h => 
              String(h || '').trim().includes(columnIdentifier) ||
              String(h || '').trim() === columnIdentifier
            );
            if (colIndex >= 0 && colIndex < row.length) {
              value = String(row[colIndex] || '').trim();
            }
          }
          
          // 如果还没找到，尝试从数据行的第一列获取（物品编码）
          if (!value && columnIdentifier.includes('编码')) {
            value = String(row[0] || '').trim();
          }
        }
        
        if (value && value.length > 0) {
          parts.push(value);
        }
      }
      
      if (parts.length > 0) {
        (item as any)[targetField] = parts.join('-');
      }
    }
  }

  /**
   * 自动检测 Excel 的三部分结构
   */
  private detectSections(rows: any[][]): ExcelSections {
    let headerRow = 1;
    let dataStartRow = 2;
    let dataEndRow = rows.length;

    // 优先使用规则配置中的 headerRow 和 dataStartRow
    if (this.config.headerRow !== undefined && this.config.headerRow > 0) {
      headerRow = this.config.headerRow;
      dataStartRow = this.config.dataStartRow !== undefined && this.config.dataStartRow > headerRow 
        ? this.config.dataStartRow 
        : headerRow + 1;
    } else {
      // 1. 找到表头行（包含至少 2 个数据列特征的行）
      // 数据列特征：包含"编码"、"名称"、"数量"、"规格"、"单位"等关键词
      for (let i = 0; i < Math.min(30, rows.length); i++) {
        const row = rows[i];
        
        // 统计有多少列包含数据特征
        let dataColumnCount = 0;
        for (const cell of row) {
          const cellStr = String(cell || '').toLowerCase();
          if (
            cellStr.includes('编码') || 
            cellStr.includes('名称') || 
            cellStr.includes('数量') ||
            cellStr.includes('规格') ||
            cellStr.includes('单位') ||
            cellStr.includes('sku') ||
            cellStr.includes('物品') ||
            cellStr.includes('商品')
          ) {
            dataColumnCount++;
          }
        }
        
        // 如果有至少 2 列包含数据特征，认为是表头行
        if (dataColumnCount >= 2) {
          headerRow = i + 1;
          dataStartRow = i + 2;
          break;
        }
      }
    }

    // 2. 找到数据结束行（"合计"行）
    for (let i = dataStartRow - 1; i < rows.length; i++) {
      const row = rows[i];
      const rowStr = row.map(cell => String(cell || '')).join(' ');
      
      if (rowStr.includes('合计')) {
        dataEndRow = i;
        break;
      }
    }

    // 3. 分割三部分
    const headerSection = this.parseKeyValueSection(rows, 0, headerRow - 1);
    const dataSection = rows.slice(headerRow - 1, dataEndRow);
    const footerSection = this.parseKeyValueSection(rows, dataEndRow, rows.length);

    return {
      headerSection,
      dataSection,
      footerSection,
      headerRow,
      dataStartRow,
      dataEndRow,
    };
  }

  /**
   * 解析键值对区域（头部或尾部）
   * 将"标题 - 内容"对转换为对象数组
   * 支持处理合并单元格的情况
   */
  private parseKeyValueSection(rows: any[][], startRow: number, endRow: number): { [key: string]: string }[] {
    const result: { [key: string]: string }[] = [];
    
    // 用于处理跨行的键值对（合并单元格）
    let pendingKey: string | null = null;
    let pendingKeyValuePairs: { [key: string]: string } = {};
    
    for (let i = startRow; i < endRow && i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(cell => !cell)) {
        // 如果是空行但有pendingKey，继续等待值
        continue;
      }
      
      const rowObj: { [key: string]: string } = {};
      
      // 方法0: 先检查是否有pending的键，尝试在当前行找值
      if (pendingKey) {
        for (let j = 0; j < row.length; j++) {
          const value = String(row[j] || '').trim();
          if (value && !this.isLikelyKey(value)) {
            // 当前单元格是值而不是键
            pendingKeyValuePairs[pendingKey] = value;
            pendingKey = null;
            break;
          }
        }
      }
      
      // 收集当前行所有非空单元格
      const nonEmptyCells: { index: number; value: string }[] = [];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        if (cell) {
          nonEmptyCells.push({ index: j, value: cell });
        }
      }
      
      // 方法1: 成对读取：标题、内容、标题、内容...（适用于两列布局）
      if (nonEmptyCells.length >= 2) {
        for (let j = 0; j < nonEmptyCells.length - 1; j += 2) {
          const key = nonEmptyCells[j].value;
          const value = nonEmptyCells[j + 1].value;
          
          // 判断是否是有效的键值对
          if (this.isLikelyKey(key) && !this.isLikelyKey(value)) {
            rowObj[key] = value;
          } else if (this.isLikelyKey(key) && this.isLikelyKey(value)) {
            // 两个都是键，可能是跨行合并，记录第一个键
            pendingKey = key;
            pendingKeyValuePairs[key] = '';
          }
        }
        
        // 如果最后一个单元格是键且没有值，记录下来
        if (nonEmptyCells.length % 2 === 1) {
          const lastCell = nonEmptyCells[nonEmptyCells.length - 1];
          if (this.isLikelyKey(lastCell.value)) {
            pendingKey = lastCell.value;
            pendingKeyValuePairs[lastCell.value] = '';
          }
        }
      }
      
      // 方法2: 单列布局（键和值在同一单元格，用冒号分隔）
      if (Object.keys(rowObj).length === 0) {
        for (const cellInfo of nonEmptyCells) {
          const cell = cellInfo.value;
          if (cell.includes('：') || cell.includes(':') || cell.includes('：')) {
            const parts = cell.split(/[:：]/);
            if (parts.length >= 2) {
              const key = parts[0].trim();
              const value = parts.slice(1).join(':').trim();
              if (key && value) {
                rowObj[key] = value;
              }
            }
          }
        }
      }
      
      // 方法3: 三列布局（序号、键、值）
      if (Object.keys(rowObj).length === 0 && nonEmptyCells.length >= 3) {
        const firstCell = nonEmptyCells[0].value;
        if (firstCell === '' || /^\d+[\.\-、]?$/.test(firstCell)) {
          const possibleKey = nonEmptyCells[1].value;
          const possibleValue = nonEmptyCells[2].value;
          if (possibleKey && possibleValue) {
            rowObj[possibleKey] = possibleValue;
          }
        }
      }
      
      // 方法4: 如果还是没有找到，尝试简单的两列布局（第一个非空是键，第二个非空是值）
      if (Object.keys(rowObj).length === 0 && nonEmptyCells.length >= 2) {
        const first = nonEmptyCells[0].value;
        const second = nonEmptyCells[1].value;
        if (first && second) {
          rowObj[first] = second;
        }
      }
      
      if (Object.keys(rowObj).length > 0) {
        result.push(rowObj);
      }
    }
    
    // 处理剩余的pending键值对
    if (Object.keys(pendingKeyValuePairs).length > 0) {
      result.push(pendingKeyValuePairs);
    }
    
    return result;
  }
  
  /**
   * 判断一个字符串是否可能是键（标签）
   */
  private isLikelyKey(str: string): boolean {
    const keyKeywords = [
      '单号', '单据', '订单号', '外部编码',
      '门店', '仓库', '仓', '店名', '店铺', '门店名称', '收货门店',
      '收货人', '收件人', '收货', '联系人', '收件方', '收货方',
      '电话', '手机', '联系电话', '手机号', '收货电话', '联系手机',
      '地址', '收货地址', '收件地址', '详细地址',
      '备注', '说明',
      '日期', '时间', '创建日期', '创建时间',
      '上游', '上游单据',
      '创建人', '机构',
      '合计', '总计'
    ];
    
    return keyKeywords.some(keyword => str.includes(keyword));
  }

  /**
   * 从三部分数据中提取公共信息
   * 优先使用用户配置的规则，只有在没有配置时才使用默认的自动检测
   */
  private extractCommonInfoFromSections(sections: ExcelSections): Partial<ParsedItem> {
    const info: Partial<ParsedItem> = {};
    
    // 合并头部和尾部的所有键值对
    const allKeyValuePairs: { [key: string]: string } = {};
    const allKeyValuePairsIgnoreCase: { [key: string]: { key: string; value: string } } = {};
    
    sections.headerSection.forEach(section => {
      Object.assign(allKeyValuePairs, section);
      for (const [k, v] of Object.entries(section)) {
        allKeyValuePairsIgnoreCase[k.toLowerCase()] = { key: k, value: v };
      }
    });
    
    sections.footerSection.forEach(section => {
      Object.assign(allKeyValuePairs, section);
      for (const [k, v] of Object.entries(section)) {
        allKeyValuePairsIgnoreCase[k.toLowerCase()] = { key: k, value: v };
      }
    });

    // 需要提取的字段列表（仅用于自动检测）
    const fieldsToExtract: (keyof ParsedItem)[] = [
      'externalCode', 'storeName', 'receiverName', 'receiverPhone', 'receiverAddress'
    ];

    // 遍历每个需要提取的字段
    for (const targetField of fieldsToExtract) {
      // 1. 首先检查用户配置的字段映射（优先使用）
      const configMapping = this.config.fieldMapping[targetField];
      if (configMapping) {
        const mappings = Array.isArray(configMapping) ? configMapping : [configMapping];
        const values: string[] = [];
        
        for (const mapping of mappings) {
          const configColumn = typeof mapping === 'string' 
            ? mapping 
            : (mapping as { column: string }).column;
          
          let value: string | undefined;
          
          // 尝试精确匹配用户配置的列名
          if (allKeyValuePairs[configColumn]) {
            value = allKeyValuePairs[configColumn];
            value = this.applyTransform(value, typeof mapping !== 'string' ? mapping.transform : undefined);
          } 
          // 尝试忽略大小写匹配
          else {
            const lowerConfigColumn = configColumn.toLowerCase();
            if (allKeyValuePairsIgnoreCase[lowerConfigColumn]) {
              value = allKeyValuePairsIgnoreCase[lowerConfigColumn].value;
              value = this.applyTransform(value, typeof mapping !== 'string' ? mapping.transform : undefined);
            } 
            // 尝试包含匹配（用户配置的列名可能是关键词）
            else {
              for (const [key, kvValue] of Object.entries(allKeyValuePairs)) {
                if (key.includes(configColumn) || configColumn.includes(key)) {
                  value = this.applyTransform(kvValue, typeof mapping !== 'string' ? mapping.transform : undefined);
                  break;
                }
              }
            }
          }
          
          if (value) {
            values.push(value);
          }
        }
        
        if (values.length > 0) {
          info[targetField] = values.join('-');
        }
        continue;
      }

      // 2. 如果用户没有配置，则使用自动检测（基于关键词匹配）
      const autoDetectResult = this.autoDetectField(targetField, allKeyValuePairs);
      if (autoDetectResult) {
        info[targetField] = autoDetectResult;
      }
    }

    return info;
  }
  
  /**
   * 自动检测字段值（当用户没有配置时使用）
   */
  private autoDetectField(targetField: keyof ParsedItem, keyValuePairs: { [key: string]: string }): string | undefined {
    const fieldKeywords: Record<keyof ParsedItem, string[]> = {
      externalCode: ['单号', '单据', '订单号', '外部编码'],
      storeName: ['门店', '仓库', '仓', '店名', '店铺', '门店名称', '收货门店'],
      receiverName: ['收货人', '收件人', '收货', '联系人', '收件方', '收货方'],
      receiverPhone: ['电话', '手机', '联系电话', '手机号', '收货电话', '联系手机'],
      receiverAddress: ['地址', '收货地址', '收件地址', '详细地址'],
      skuCode: ['物品编码', 'SKU编码', '编码', 'SKU'],
      skuName: ['物品名称', 'SKU名称', '名称', '货品名称'],
      quantity: ['数量', '发货数量', '件数'],
      specification: ['规格', '型号', '规格型号'],
      remark: ['备注', '说明'],
    };
    
    const keywords = fieldKeywords[targetField] || [];
    
    for (const [key, value] of Object.entries(keyValuePairs)) {
      if (keywords.some(kw => key.includes(kw))) {
        // 根据字段类型进行验证
        if (targetField === 'externalCode') {
          if (value.startsWith('PS') || value.length >= 12) {
            return value;
          }
        } else if (targetField === 'receiverPhone') {
          const phonePattern = /1[3-9]\d{9}/;
          const cleanValue = String(value).replace(/[\s\-_\(\)]/g, '');
          const match = cleanValue.match(phonePattern);
          if (match) {
            return match[0];
          }
        } else if (targetField === 'receiverAddress') {
          if (value.length > 5 || value.includes('省') || value.includes('市') || value.includes('区')) {
            return value;
          }
        } else {
          return value;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * 应用转换函数
   */
  private applyTransform(value: any, transform?: string): any {
    if (!transform) return value;
    
    switch (transform) {
      case 'trim':
        return String(value || '').trim();
      case 'number':
        const num = parseFloat(String(value || ''));
        return isNaN(num) ? 0 : num;
      case 'phone': {
        const phonePattern = /1[3-9]\d{9}/;
        const cleanValue = String(value || '').replace(/[\s\-_\(\)]/g, '');
        const match = cleanValue.match(phonePattern);
        return match ? match[0] : value;
      }
      default:
        return value;
    }
  }

  /**
   * 解析主体表格数据
   */
  private parseDataSection(sections: ExcelSections, commonInfo: Partial<ParsedItem>): ParsedItem[] {
    const items: ParsedItem[] = [];
    const headers = sections.dataSection[0] || [];
    const headerMap = this.buildHeaderMap(headers);

    // 如果启用了矩阵转置
    if (this.config.matrixTranspose?.enabled && this.config.matrixTranspose.matrices && this.config.matrixTranspose.matrices.length > 0) {
      const { matrices } = this.config.matrixTranspose;
      
      // 获取每个矩阵的列名称列表
      const matrixColumns: Array<{ matrixName: string; columns: { name: string; index: number }[] }> = [];
      for (const matrix of matrices) {
        const cols: { name: string; index: number }[] = [];
        for (const index of matrix.columns) {
          if (index >= 0 && index < headers.length) {
            const colName = String(headers[index] || '').trim();
            if (colName) {
              cols.push({ name: colName, index });
            }
          } else if (index >= headers.length) {
            // 列索引超出范围，跳过但记录警告
            console.warn(`矩阵 "${matrix.name}" 的列索引 ${index} 超出范围（最大索引：${headers.length - 1}）`);
          }
        }
        if (cols.length > 0) {
          matrixColumns.push({ matrixName: matrix.name, columns: cols });
        }
      }

      // 如果没有有效的矩阵列，回退到正常解析
      if (matrixColumns.length === 0) {
        console.warn('没有找到有效的矩阵列，回退到正常解析');
        return this.parseDataSectionNormal(sections, commonInfo, headers, headerMap);
      }

      // 遍历数据行，每行转置为多个组合行
      for (let i = 1; i < sections.dataSection.length; i++) {
        const row = sections.dataSection[i];
        if (!row || row.every(cell => !cell)) continue;

        // 先解析基础字段（非矩阵相关）
        const baseItem = this.parseRowBase(row, headerMap, matrices);
        if (!baseItem || !baseItem.skuCode || !baseItem.skuName) {
          // SKU编码或名称为空，跳过该行
          continue;
        }

        // 生成所有矩阵的笛卡尔积组合
        const combinations = this.generateMatrixCombinations(matrixColumns, row);
        
        if (combinations.length === 0) {
          // 没有生成任何组合，可能是矩阵配置问题
          continue;
        }
        
        for (const combo of combinations) {
          // 计算数量（从组合的值中获取有效的数字值）
          let quantity = 0;
          for (const val of combo.values) {
            if (val !== undefined && val !== null && val !== '') {
              const numVal = typeof val === 'number' ? val : (Number(val) || 0);
              if (numVal > 0) {
                quantity = numVal;
                break;
              }
            }
          }
          
          if (quantity > 0) {
            // 构建矩阵值字符串（所有矩阵值用 "-" 连接）
            const matrixValues = combo.labels.join('-');
            
            // 创建包含矩阵值的项
            const itemWithMatrix: ParsedItem = {
              ...commonInfo as ParsedItem,
              ...baseItem as ParsedItem,
              storeName: matrixValues, // 将所有矩阵标签合并作为门店名称
              quantity,
            };
            
            // 根据字段映射处理矩阵虚拟列
            this.applyMatrixFieldMapping(itemWithMatrix, combo.labels, matrices);
            
            items.push(itemWithMatrix);
          }
        }
      }
    } else {
      // 正常解析流程
      return this.parseDataSectionNormal(sections, commonInfo, headers, headerMap);
    }

    return items;
  }

  /**
   * 正常解析流程（非矩阵转置）
   */
  private parseDataSectionNormal(sections: ExcelSections, commonInfo: Partial<ParsedItem>, headers: any[], headerMap: Map<string, number>): ParsedItem[] {
    const items: ParsedItem[] = [];
    
    for (let i = 1; i < sections.dataSection.length; i++) {
      const row = sections.dataSection[i];
      if (!row || row.every(cell => !cell)) continue;

      const item = this.parseRow(row, headerMap, commonInfo);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * 生成多个矩阵的笛卡尔积组合
   */
  private generateMatrixCombinations(
    matrixColumns: Array<{ matrixName: string; columns: { name: string; index: number }[] }>,
    row: any[]
  ): Array<{ labels: string[]; values: any[] }> {
    if (matrixColumns.length === 0) {
      return [];
    }

    // 递归生成笛卡尔积
    const combinations: Array<{ labels: string[]; values: any[] }> = [];
    
    const backtrack = (matrixIndex: number, currentLabels: string[], currentValues: any[]) => {
      if (matrixIndex === matrixColumns.length) {
        combinations.push({ labels: [...currentLabels], values: [...currentValues] });
        return;
      }

      const currentMatrix = matrixColumns[matrixIndex];
      for (const col of currentMatrix.columns) {
        const value = row[col.index];
        currentLabels.push(col.name);
        currentValues.push(value);
        backtrack(matrixIndex + 1, currentLabels, currentValues);
        currentLabels.pop();
        currentValues.pop();
      }
    };

    backtrack(0, [], []);
    return combinations;
  }

  /**
   * 解析行的基础字段（不包含门店和数量）
   */
  private parseRowBase(row: any[], headerMap: Map<string, number>, matrices?: Array<{ name: string; valueName: string; columns: number[] }>): Partial<ParsedItem> | null {
    const item: Partial<ParsedItem> = {};

    for (const [targetField, mapping] of Object.entries(this.config.fieldMapping)) {
      // 跳过数量字段和门店字段，由矩阵转置时处理
      if (targetField === 'quantity' || targetField === 'storeName') {
        continue;
      }

      // 检查是否是矩阵虚拟列
      const matrixNames = matrices ? matrices.map(m => m.name) : [];
      const matrixValueNames = matrices ? matrices.map(m => m.valueName) : [];
      
      const mappings = Array.isArray(mapping) ? mapping : [mapping];
      const values: any[] = [];
      
      for (const m of mappings) {
        let columnIdentifier: string;
        let transform: string | undefined;
        
        if (typeof m === 'string') {
          columnIdentifier = m;
        } else {
          columnIdentifier = m.column;
          transform = m.transform;
        }

        // 如果是矩阵虚拟列，跳过（由 applyMatrixFieldMapping 处理）
        if (matrixNames.includes(columnIdentifier) || matrixValueNames.includes(columnIdentifier)) {
          continue;
        }

        let colIndex: number | undefined;
        
        const possibleColNum = parseInt(columnIdentifier, 10);
        if (!isNaN(possibleColNum) && possibleColNum > 0) {
          colIndex = possibleColNum - 1;
        } else {
          colIndex = headerMap.get(columnIdentifier);
          if (colIndex === undefined) {
            const simplified = columnIdentifier.replace(/[\s\u3000]/g, '');
            colIndex = headerMap.get(simplified);
          }
        }

        if (colIndex !== undefined && colIndex >= 0 && colIndex < row.length) {
          let value = row[colIndex];
          if (transform) {
            value = this.applyTransform(value, transform);
          }
          if (value !== undefined && value !== null && value !== '') {
            values.push(value);
          }
        }
      }
      
      if (values.length > 0) {
        item[targetField as keyof ParsedItem] = values.join('-');
      }
    }

    return item;
  }

  /**
   * 应用矩阵虚拟列的字段映射
   */
  private applyMatrixFieldMapping(
    item: ParsedItem,
    matrixLabels: string[],
    matrices: Array<{ name: string; valueName: string; columns: number[] }>
  ): void {
    for (const [targetField, mapping] of Object.entries(this.config.fieldMapping)) {
      // 跳过 quantity 和 storeName，它们已经在 parseDataSection 中设置
      if (targetField === 'quantity' || targetField === 'storeName') {
        continue;
      }
      
      const mappings = Array.isArray(mapping) ? mapping : [mapping];
      const additionalValues: any[] = [];
      
      for (const m of mappings) {
        let columnIdentifier: string;
        
        if (typeof m === 'string') {
          columnIdentifier = m;
        } else {
          columnIdentifier = m.column;
        }

        // 检查是否是矩阵名称（用于设置门店名称）
        let matchedMatrix = false;
        for (let i = 0; i < matrices.length; i++) {
          const matrix = matrices[i];
          
          // 只有当 columnIdentifier === matrix.name 时才获取门店名称
          // matrix.valueName（如"数量")已经在 parseDataSection 中处理
          if (columnIdentifier === matrix.name) {
            const matrixValue = matrixLabels[i];
            if (matrixValue) {
              additionalValues.push(matrixValue);
            }
            matchedMatrix = true;
            break;
          }
        }
        
        // 如果已经匹配到矩阵名称，跳过后续判断
        if (matchedMatrix) {
          continue;
        }
        
        // 检查是否是组合后的门店列名称
        const combinedStoreName = matrices.map(m => m.name).join('-');
        if (columnIdentifier === combinedStoreName) {
          additionalValues.push(matrixLabels.join('-'));
        }
      }
      
      // 如果有额外的矩阵值，追加到已有值上
      if (additionalValues.length > 0) {
        const existingValue = item[targetField as keyof ParsedItem];
        if (existingValue) {
          // 已有值，追加矩阵值
          item[targetField as keyof ParsedItem] = `${existingValue}-${additionalValues.join('-')}`;
        } else {
          // 没有已有值，直接设置矩阵值
          item[targetField as keyof ParsedItem] = additionalValues.join('-');
        }
      }
    }
  }

  private buildHeaderMap(headers: any[]): Map<string, number> {
    const headerMap = new Map<string, number>();
    
    headers.forEach((header, index) => {
      if (header) {
        const headerStr = String(header).trim();
        headerMap.set(headerStr, index);
        
        // 同时存储简化版（无空格）
        const simplified = headerStr.replace(/[\s\u3000]/g, '');
        if (simplified !== headerStr) {
          headerMap.set(simplified, index);
        }
      }
    });

    return headerMap;
  }

  private parseRow(row: any[], headerMap: Map<string, number>, commonInfo: Partial<ParsedItem>): ParsedItem | null {
    const item: Partial<ParsedItem> = { ...commonInfo };

    for (const [targetField, mapping] of Object.entries(this.config.fieldMapping)) {
      const mappings = Array.isArray(mapping) ? mapping : [mapping];
      const values: any[] = [];
      
      for (const m of mappings) {
        let columnIdentifier: string;
        let transform: string | undefined;
        
        if (typeof m === 'string') {
          columnIdentifier = m;
        } else {
          columnIdentifier = m.column;
          transform = m.transform;
        }

        let colIndex: number | undefined;
        
        // 首先检查是否是数字（列号，从 1 开始）
        const possibleColNum = parseInt(columnIdentifier, 10);
        if (!isNaN(possibleColNum) && possibleColNum > 0) {
          colIndex = possibleColNum - 1;
        } else {
          // 否则按列名查找
          colIndex = headerMap.get(columnIdentifier);
          
          if (colIndex === undefined) {
            const simplified = columnIdentifier.replace(/[\s\u3000]/g, '');
            colIndex = headerMap.get(simplified);
          }
        }

        if (colIndex !== undefined && colIndex >= 0 && colIndex < row.length) {
          let value = row[colIndex];
          
          if (transform) {
            value = this.applyTransform(value, transform);
          }
          
          if (value !== undefined && value !== null && value !== '') {
            values.push(value);
          }
        }
      }
      
      if (values.length > 0) {
        if (targetField === 'quantity') {
          item[targetField as keyof ParsedItem] = values.reduce((sum, val) => sum + Number(val), 0);
        } else {
          item[targetField as keyof ParsedItem] = values.join('-');
        }
      }
    }

    // 验证必填字段
    if (!item.skuCode || !item.skuName || item.quantity === undefined) {
      return null;
    }

    return {
      externalCode: item.externalCode || '',
      storeName: item.storeName,
      receiverName: item.receiverName,
      receiverPhone: item.receiverPhone,
      receiverAddress: item.receiverAddress,
      skuCode: String(item.skuCode),
      skuName: String(item.skuName),
      quantity: Number(item.quantity) || 0,
      specification: item.specification,
      remark: item.remark,
    };
  }

  private applyTransform(value: any, transform: string): any {
    switch (transform) {
      case 'trim':
        return String(value || '').trim();
      case 'number':
        return Number(value) || 0;
      case 'string':
        return String(value || '');
      default:
        return value;
    }
  }

  /**
   * 自动检测 Excel 格式
   */
  static autoDetectFormat(buffer: Buffer): {
    success: boolean;
    sections?: ExcelSections;
    fieldMapping?: Record<string, { column: string; transform?: string }>;
    error?: string;
  } {
    try {
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const engine = new ParseEngine({ fieldMapping: {} });
      const sections = engine.detectSections(jsonData);

      // 从表头提取字段映射
      const headers = sections.dataSection[0] || [];
      const fieldMapping: Record<string, { column: string; transform?: string }> = {};

      headers.forEach((header: any, index: number) => {
        const headerStr = String(header || '').trim();
        
        if (headerStr.includes('物品编码') || headerStr.includes('SKU 编码') || headerStr.includes('商品编码')) {
          fieldMapping.skuCode = { column: headerStr, transform: 'trim' };
        }
        
        if (headerStr.includes('物品名称') || headerStr.includes('SKU 名称') || headerStr.includes('商品名称')) {
          fieldMapping.skuName = { column: headerStr, transform: 'trim' };
        }
        
        if ((headerStr.includes('数量') || headerStr.includes('发货数量')) && 
            !headerStr.includes('辅助') && !headerStr.includes('单位')) {
          fieldMapping.quantity = { column: headerStr, transform: 'number' };
        }
        
        if (headerStr.includes('规格') || headerStr.includes('型号')) {
          fieldMapping.specification = { column: headerStr, transform: 'trim' };
        }
      });

      return {
        success: true,
        sections,
        fieldMapping,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}
