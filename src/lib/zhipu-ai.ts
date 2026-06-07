import * as XLSX from 'xlsx';

const ZHIPU_API_KEY = '1f2a6045292a4a64b2babc25eb2410ae.AURG2MZxiRi6J3kK';
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'GLM-4.7-Flash';

export interface ZhipuMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ZhipuResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ExcelParseResult {
  success: boolean;
  data?: {
    commonInfo?: {
      externalCode?: string;
      storeName?: string;
      receiverName?: string;
      receiverPhone?: string;
      receiverAddress?: string;
    };
    items?: Array<{
      skuCode?: string;
      skuName?: string;
      quantity?: number;
      specification?: string;
      remark?: string;
    }>;
  };
  error?: string;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 将 Excel 数据转换为简化的文本格式，便于发送给大模型
 */
function convertExcelToText(buffer: Buffer, maxRows: number = 50): string {
  const workbook = XLSX.read(buffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // 只取前 maxRows 行，避免 token 超限
  const limitedData = jsonData.slice(0, maxRows);
  
  // 转换为 CSV 格式的文本
  return limitedData.map(row => {
    return row.map(cell => {
      if (cell === null || cell === undefined) return '';
      return String(cell).trim();
    }).join(',');
  }).join('\n');
}

/**
 * 使用智谱 AI 解析 Excel 文件
 */
export async function parseExcelWithAI(buffer: Buffer): Promise<ExcelParseResult> {
  try {
    // 将 Excel 转换为文本
    const excelText = convertExcelToText(buffer, 50);
    
    // 构建提示词
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

    const userPrompt = `请解析以下 Excel 数据：

${excelText}`;

    // 调用智谱 API
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

    const data: ZhipuResponse = await response.json();
    
    // 解析 AI 返回的结果
    const content = data.choices[0]?.message?.content || '';
    
    // 尝试从返回内容中提取 JSON
    let jsonContent = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    try {
      const parsedData = JSON.parse(jsonContent);
      return {
        success: true,
        data: parsedData,
        tokenUsage: {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
        },
      };
    } catch (parseError) {
      console.error('解析 AI 返回的 JSON 失败:', parseError);
      return {
        success: false,
        error: `AI 返回的数据格式不正确：${content.substring(0, 200)}`,
      };
    }
  } catch (error) {
    console.error('使用智谱 AI 解析 Excel 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 使用智谱 AI 自动检测 Excel 格式和字段映射
 */
export async function detectExcelFormat(buffer: Buffer): Promise<{
  success: boolean;
  headerRow?: number;
  dataStartRow?: number;
  fieldMapping?: Record<string, string>;
  skipRows?: number[];
  error?: string;
}> {
  try {
    const excelText = convertExcelToText(buffer, 30);
    
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

    const userPrompt = `请分析以下 Excel 数据的格式：

${excelText}`;

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

    const data: ZhipuResponse = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        ...parsedData,
      };
    }
    
    return {
      success: false,
      error: `AI 返回的数据格式不正确：${content.substring(0, 200)}`,
    };
  } catch (error) {
    console.error('使用智谱 AI 检测 Excel 格式失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}
