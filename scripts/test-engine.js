const fs = require('fs');
const path = require('path');

const filePath = path.join('D:/AI/github/traeweb1/模板/12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx');

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
  skipRows: [7, 8],
};

const parseConfig = require('../dist/lib/parse-engine').ParseEngine.autoDetectFormat(buffer);
console.log('自动检测的配置:', JSON.stringify(parseConfig, null, 2));

const engine = new (require('../dist/lib/parse-engine').ParseEngine)(config);
const result = engine.parseExcel(buffer);

console.log('\n=== 解析结果 ===');
console.log('成功:', result.success);
console.log('错误:', result.errors);
console.log('警告:', result.warnings);
console.log('\n解析出的物品:');
result.items.forEach((item, index) => {
  console.log(`${index + 1}. 配送单号: ${item.externalCode}, 物品编码: ${item.skuCode}, 物品名称: ${item.skuName}, 数量: ${item.quantity}`);
});
