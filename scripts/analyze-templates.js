const XLSX = require('xlsx');
const path = require('path');

const templatesDir = 'C:\\Users\\admin\\Desktop\\AI考试模板';

const templates = [
  'template1-standard.xlsx',
  'template2-ecommerce.xlsx',
  'template3-english.xlsx',
  'template4-grouped.xlsx',
  'template5-multisheet.xlsx'
];

console.log('=== Excel模板分析结果 ===\n');

templates.forEach(templateFile => {
  const filePath = path.join(templatesDir, templateFile);
  console.log(`\n📊 ${templateFile}:`);

  try {
    const workbook = XLSX.readFile(filePath, { cellNF: true, cellDates: true });
    console.log(`   工作表数量: ${workbook.SheetNames.length}`);
    console.log(`   工作表名称: ${JSON.stringify(workbook.SheetNames)}`);

    workbook.SheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');

      console.log(`\n   📑 工作表 ${index + 1}: "${sheetName}"`);
      console.log(`   范围: ${worksheet['!ref']}`);

      const headers = [];
      const rawData = [];

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        const headerValue = cell ? String(cell.v || '').trim() : '';
        headers.push(headerValue);
      }

      for (let R = range.s.r; R <= Math.min(range.e.r, 2); ++R) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
          const value = cell ? String(cell.v || '') : '';
          row.push(value);
        }
        rawData.push(row);
      }

      console.log(`\n   前3行数据:`);
      rawData.forEach((row, idx) => {
        console.log(`   ${idx}: [${row.join(' | ')}]`);
      });

      if (worksheet['!merges']) {
        console.log(`\n   合并单元格: ${JSON.stringify(worksheet['!merges'])}`);
      }

      console.log('\n   ---');
    });

  } catch (error) {
    console.log(`   ❌ 读取失败: ${error.message}`);
  }
});

console.log('\n=== 分析完成 ===');
