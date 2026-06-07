import { NextResponse } from 'next/server';

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || '';
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'GLM-4.7-Flash';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: '请选择文件' }, { status: 400 });
    }

    if (!ZHIPU_API_KEY) {
      return NextResponse.json({ success: false, error: '未配置 AI API Key' }, { status: 500 });
    }

    // 动态导入 xlsx（服务端）
    const XLSX = await import('xlsx');

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const limitedData = jsonData.slice(0, 30);
    const excelText = limitedData.map((row: any[]) => {
      return row.map((cell: any) => {
        if (cell === null || cell === undefined) return '';
        return String(cell).trim();
      }).join(',');
    }).join('\n');

    const systemPrompt = `你是一个专业的 Excel 格式分析助手。请分析提供的 Excel 数据，找出：
1. 表头行（包含"物品编码"、"物品名称"、"数量"等字段的行）
2. 数据起始行（表头的下一行）
3. 字段映射（每个字段在第几列）
4. 需要跳过的行（如"合计"、"汇总"等）

请以 JSON 格式返回分析结果：
{
  "headerRow": 2,
  "dataStartRow": 3,
  "fieldMapping": {
    "skuCode": "物品编码",
    "skuName": "物品名称",
    "quantity": "发货数量",
    "specification": "规格型号",
    "externalCode": "单据号",
    "storeName": "门店",
    "receiverName": "收货人",
    "receiverPhone": "电话",
    "receiverAddress": "地址"
  },
  "skipRows": [7, 8]
}

注意：
- 只返回 JSON，不要其他说明文字
- 字段映射的值是表头中的列名
- 行号从 1 开始计数`;

    const userPrompt = `请分析以下 Excel 数据的格式：\n\n${excelText}`;

    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`智谱 API 调用失败：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ success: true, ...parsedData });
    }

    return NextResponse.json({
      success: false,
      error: `AI 返回的数据格式不正确：${content.substring(0, 200)}`,
    });
  } catch (error) {
    console.error('检测 Excel 格式失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
