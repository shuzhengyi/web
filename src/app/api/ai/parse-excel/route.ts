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

    const limitedData = jsonData.slice(0, 50);
    const excelText = limitedData.map((row: any[]) => {
      return row.map((cell: any) => {
        if (cell === null || cell === undefined) return '';
        return String(cell).trim();
      }).join(',');
    }).join('\n');

    const systemPrompt = `你是一个专业的 Excel 数据解析助手。你的任务是从 Excel 数据中提取关键信息。

请分析提供的 Excel 数据，并提取以下信息：
1. 外部编码/单号（通常以 PS 开头）
2. 收货门店/仓库（如"湖南仓"等）
3. 收货人姓名
4. 收货人电话（11 位手机号）
5. 收货人地址
6. SKU 编码/物品编码
7. SKU 名称/物品名称
8. 发货数量
9. 规格型号

请以 JSON 格式返回解析结果，格式如下：
{
  "commonInfo": {
    "externalCode": "外部编码",
    "storeName": "门店名称",
    "receiverName": "收货人姓名",
    "receiverPhone": "收货人电话",
    "receiverAddress": "收货人地址"
  },
  "items": [
    {
      "skuCode": "SKU 编码",
      "skuName": "SKU 名称",
      "quantity": 10,
      "specification": "规格型号"
    }
  ]
}

注意：
- 只返回 JSON，不要其他说明文字
- 确保 JSON 格式正确，可以被解析
- 如果某些字段找不到，返回 null 或空字符串
- 数量必须是数字`;

    const userPrompt = `请解析以下 Excel 数据：\n\n${excelText}`;

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
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`智谱 API 调用失败：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    let jsonContent = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }

    try {
      const parsedData = JSON.parse(jsonContent);
      return NextResponse.json({
        success: true,
        data: parsedData,
        tokenUsage: {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
        },
      });
    } catch (parseError) {
      console.error('解析 AI 返回的 JSON 失败:', parseError);
      return NextResponse.json({
        success: false,
        error: `AI 返回的数据格式不正确：${content.substring(0, 200)}`,
      });
    }
  } catch (error) {
    console.error('解析 Excel 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
