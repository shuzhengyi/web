const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join('D:/AI/github/traeweb1/模板/12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx');

try {
  const buffer = fs.readFileSync(filePath);
  
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
    skipRows: [7],
  };

  const workbook = XLSX.read(buffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log('=== 文件结构分析 ===');
  console.log('总行数:', jsonData.length);
  
  console.log('\n=== 第4行（表头）===');
  const headers = jsonData[3];
  headers.forEach((header, index) => {
    if (header) {
      console.log(`${index + 1}: "${header}"`);
    }
  });

  console.log('\n=== 第5行（数据）===');
  const dataRow = jsonData[4];
  dataRow.forEach((cell, index) => {
    if (cell) {
      console.log(`${index + 1}: "${cell}"`);
    }
  });

  console.log('\n=== 第8行（配送单号）===');
  const externalRow = jsonData[7];
  externalRow.forEach((cell, index) => {
    if (cell) {
      console.log(`${index + 1}: "${cell}"`);
    }
  });

  console.log('\n=== 解析结果 ===');
  const headerMap = new Map();
  headers.forEach((header, index) => {
    if (header) {
      headerMap.set(String(header).trim(), index);
    }
  });

  const items = [];
  for (let i = 4; i < jsonData.length - 1; i++) {
    const row = jsonData[i];
    if (!row || row.every(cell => !cell)) continue;
    
    const skuCodeIndex = headerMap.get('物品编码');
    const skuNameIndex = headerMap.get('物品名称');
    const quantityIndex = headerMap.get('发货数量');
    
    if (skuCodeIndex !== undefined && skuNameIndex !== undefined) {
      const skuCode = String(row[skuCodeIndex] || '').trim();
      const skuName = String(row[skuNameIndex] || '').trim();
      const quantity = Number(row[quantityIndex]) || 0;
      
      if (skuCode && skuName) {
        items.push({
          externalCode: String(externalRow[1] || '').trim(),
          skuCode,
          skuName,
          quantity,
        });
      }
    }
  }

  console.log('解析出的物品：');
  items.forEach((item, index) => {
    console.log(`${index + 1}. 配送单号: ${item.externalCode}, 物品编码: ${item.skuCode}, 物品名称: ${item.skuName}, 数量: ${item.quantity}`);
  });

} catch (error) {
  console.error('Error:', error.message);
}
