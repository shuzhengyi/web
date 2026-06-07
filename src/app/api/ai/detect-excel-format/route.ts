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

    const systemPrompt = `你是一个专业的 Excel 数据解析助手。请分析提供的 Excel 数据，将其分为三个部分并进行字段映射：

## 数据结构说明
Excel 数据通常包含三个部分：

### 1. 头部（header）- 表头行之前的区域
- 位置：表格主体数据之前的行
- 常见字段：门店名称、仓库名称、发货单位等
- 格式：通常是"标签：值"的键值对形式

### 2. 主体（data）- 表格主体区域
- 位置：从表头行开始到"合计"行之前
- 表头行：包含"物品编码"、"物品名称"、"数量"、"规格"等列名的行
- 数据行：表头行之后的具体数据行
- 常见字段：
  - 物品编码 / SKU编码 / 编码
  - 物品名称 / SKU名称 / 名称
  - 数量 / 发货数量
  - 规格 / 规格型号
  - 备注

### 3. 尾部（footer）- "合计"行之后的区域
- 位置：包含"合计"行及其之后的行
- 常见字段：
  - 单据号 / 订单号 / 外部编码（通常以PS开头或较长字符串）
  - 收货人 / 收件人 / 联系人
  - 电话 / 手机 / 联系电话（通常是11位手机号）
  - 地址 / 收货地址 / 详细地址（包含省市区等）
  - 备注 / 说明

## 返回格式要求
请以 JSON 格式返回分析结果：
{
  "headerRow": 3,
  "dataStartRow": 4,
  "fieldMapping": {
    "skuCode": "物品编码",
    "skuName": "物品名称",
    "quantity": "数量",
    "specification": "规格",
    "externalCode": "单据号",
    "storeName": "调入门店",
    "receiverName": "收货人",
    "receiverPhone": "电话",
    "receiverAddress": "收货地址",
    "remark": "备注"
  },
  "fieldSections": {
    "skuCode": "data",
    "skuName": "data",
    "quantity": "data",
    "specification": "data",
    "externalCode": "footer",
    "storeName": "header",
    "receiverName": "footer",
    "receiverPhone": "footer",
    "receiverAddress": "footer",
    "remark": "data"
  },
  "skipRows": [10]
}

## 重要规则
1. 只返回 JSON，不要其他说明文字
2. fieldMapping 的值必须是 Excel 中实际出现的列名或标签名
3. fieldSections 标明每个字段属于哪个区域（header/data/footer）
4. 如果某个字段在数据中不存在，可以不包含在 fieldMapping 中
5. 行号从 1 开始计数
6. "合计"行应该被识别并包含在 skipRows 中`;

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
