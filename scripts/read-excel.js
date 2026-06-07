const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('D:/AI/github/traeweb1/模板/12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx');

try {
  const wb = XLSX.readFile(filePath);
  console.log('Sheet names:', wb.SheetNames);
  
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, {header: 1});
  
  console.log('\nFirst 30 rows:');
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i];
    const str = JSON.stringify(row);
    console.log(`${i + 1}:`, str.length > 200 ? str.substring(0, 200) + '...' : str);
  }
  
  console.log('\nTotal rows:', data.length);
} catch (error) {
  console.error('Error reading file:', error.message);
}
