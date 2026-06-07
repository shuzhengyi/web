const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join('D:/AI/github/traeweb1/模板/12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx');

class ParseEngine {
  constructor(config) {
    this.config = config;
  }

  parseExcel(buffer) {
    const result = {
      success: false,
      items: [],
      errors: [],
      warnings: [],
    };

    try {
      const workbook = XLSX.read(buffer);
      const sheetName = this.config.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        result.errors.push(`找不到工作表: ${sheetName}`);
        return result;
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const commonInfo = this.extractCommonInfo(jsonData);
      result.items = this.parseRows(jsonData, commonInfo);
      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push(`解析Excel文件失败: ${error.message}`);
    }

    return result;
  }

  extractCommonInfo(rows) {
    const info = {};

    if (this.config.externalCodeRow !== undefined && this.config.externalCodeColumn !== undefined) {
      const row = rows[this.config.externalCodeRow - 1];
      if (row) {
        info.externalCode = String(row[this.config.externalCodeColumn - 1] || '').trim();
      }
    }

    return info;
  }

  parseRows(rows, commonInfo) {
    const items = [];
    const headers = rows[this.config.headerRow - 1] || [];
    const headerMap = this.buildHeaderMap(headers);

    console.log('=== 表头信息 ===');
    headers.forEach((header, index) => {
      if (header) {
        console.log(`${index + 1}: "${header}"`);
      }
    });

    for (let i = this.config.dataStartRow - 1; i < rows.length; i++) {
      if (this.config.skipRows?.includes(i + 1)) {
        console.log(`跳过第 ${i + 1} 行`);
        continue;
      }
      
      const row = rows[i];
      if (!row || row.every(cell => !cell)) {
        console.log(`跳过空行 ${i + 1}`);
        continue;
      }

      try {
        const item = this.parseRow(row, headerMap, commonInfo);
        if (item) {
          items.push(item);
        }
      } catch (error) {
        console.warn(`解析第 ${i + 1} 行失败:`, error);
      }
    }

    return items;
  }

  buildHeaderMap(headers) {
    const headerMap = new Map();
    
    headers.forEach((header, index) => {
      if (header) {
        const headerStr = String(header).trim();
        headerMap.set(headerStr, index);
        
        const simplified = headerStr.replace(/[\s\u3000]/g, '');
        if (simplified !== headerStr) {
          headerMap.set(simplified, index);
        }
      }
    });

    return headerMap;
  }

  parseRow(row, headerMap, commonInfo) {
    const item = { ...commonInfo };

    for (const [targetField, mapping] of Object.entries(this.config.fieldMapping)) {
      let columnName;
      let transform;
      
      if (typeof mapping === 'string') {
        columnName = mapping;
      } else {
        columnName = mapping.column;
        transform = mapping.transform;
      }

      let colIndex = headerMap.get(columnName);
      
      if (colIndex === undefined) {
        const simplified = columnName.replace(/[\s\u3000]/g, '');
        colIndex = headerMap.get(simplified);
      }

      if (colIndex !== undefined) {
        let value = row[colIndex];
        
        if (transform) {
          value = this.applyTransform(value, transform);
        }

        item[targetField] = value;
      } else {
        console.log(`找不到列: ${columnName}`);
      }
    }

    if (!item.skuCode || !item.skuName || item.quantity === undefined) {
      return null;
    }

    return {
      externalCode: item.externalCode || '',
      skuCode: String(item.skuCode),
      skuName: String(item.skuName),
      quantity: Number(item.quantity) || 0,
    };
  }

  applyTransform(value, transform) {
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

  static autoDetectFormat(buffer) {
    try {
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      let headerRow = 2;
      let dataStartRow = 3;
      let externalCodeRow;
      let externalCodeColumn;
      const skipRows = [];
      const fieldMapping = {
        skuCode: { column: '物品编码', transform: 'trim' },
        skuName: { column: '物品名称', transform: 'trim' },
        quantity: { column: '发货数量', transform: 'number' },
      };

      for (let i = 0; i < Math.min(20, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row) continue;

        for (let j = 0; j < (row.length || 0); j++) {
          const cell = String(row[j] || '').trim();
          
          if ((cell.includes('PS') || cell.includes('PS25')) && cell.length >= 12) {
            externalCodeRow = i + 1;
            externalCodeColumn = j + 1;
          }
          
          if (cell.includes('配送单号') || cell.includes('发货单号') || cell.includes('单据号')) {
            externalCodeRow = i + 1;
            externalCodeColumn = j + 2;
          }

          if (cell.includes('物品编码') || cell.includes('SKU编码') || cell.includes('商品编码')) {
            headerRow = i + 1;
            fieldMapping.skuCode.column = cell;
          }

          if (cell.includes('物品名称') || cell.includes('SKU名称') || cell.includes('商品名称')) {
            headerRow = i + 1;
            fieldMapping.skuName.column = cell;
          }

          if (cell === '发货数量' || cell.includes('发货数量') && !cell.includes('辅助') && !cell.includes('单位')) {
            headerRow = i + 1;
            fieldMapping.quantity.column = cell;
          }

          if (cell === '合计' || cell === '汇总') {
            skipRows.push(i + 1);
          }
        }
      }

      dataStartRow = headerRow + 1;

      const skuCodeIndex = jsonData[headerRow - 1]?.findIndex(h => 
        String(h || '').includes('物品编码') || String(h || '').includes('SKU编码') || String(h || '').includes('商品编码')
      );

      for (let i = dataStartRow; i <= jsonData.length; i++) {
        const row = jsonData[i - 1];
        if (!row || row.every(cell => !cell)) {
          continue;
        }

        if (skuCodeIndex !== undefined && skuCodeIndex >= 0) {
          const skuCode = String(row[skuCodeIndex] || '').trim();
          if (skuCode && !/^\d+$/.test(skuCode) && skuCode.length >= 5) {
            continue;
          } else if (!skuCode || skuCode.length < 5) {
            skipRows.push(i);
          }
        }
      }

      const finalSkipRows = skipRows.filter(r => r !== headerRow && r !== externalCodeRow);

      return {
        headerRow,
        dataStartRow,
        fieldMapping,
        externalCodeRow,
        externalCodeColumn,
        skipRows: [...new Set(finalSkipRows)],
      };
    } catch (error) {
      console.error('自动检测格式失败:', error);
      return null;
    }
  }
}

const buffer = fs.readFileSync(filePath);

const autoConfig = ParseEngine.autoDetectFormat(buffer);
console.log('=== 自动检测配置 ===');
console.log(JSON.stringify(autoConfig, null, 2));

const config = {
  headerRow: 4,
  dataStartRow: 5,
  fieldMapping: {
    skuCode: { column: '物品编码', transform: 'trim' },
    skuName: { column: '物品名称', transform: 'trim' },
    quantity: { column: '发货数量', transform: 'number' },
  },
  externalCodeRow: 8,
  externalCodeColumn: 2,
  skipRows: [7, 8],
};

console.log('\n=== 使用手动配置解析 ===');
const engine = new ParseEngine(config);
const result = engine.parseExcel(buffer);

console.log('\n=== 解析结果 ===');
console.log('成功:', result.success);
console.log('错误:', result.errors);
console.log('警告:', result.warnings);
console.log('\n解析出的物品:');
result.items.forEach((item, index) => {
  console.log(`${index + 1}. 配送单号: ${item.externalCode}, 物品编码: ${item.skuCode}, 物品名称: ${item.skuName}, 数量: ${item.quantity}`);
});
