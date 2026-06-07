# PDF 解析重构计划 - 基于键值对分割

## 需求分析
新建规则时导入 PDF 文件，需要将 PDF 解析为结构化的三部分（头部、主体、尾部）。头部和尾部区域包含冒号分隔的键值对，需要专门解析这些键值对。仿照 Excel 的解析方式，单独创建一个 PDF 解析类，不影响现有逻辑。

## 当前状态
- `file-parser.ts` 中已有 `parsePdf()` 函数，但文本分割策略不够精确
- PDF 提取的文本中，头部区域是冒号分隔的键值对，需要按 `:` 分割
- 主体表格区域按制表符或空格分割列

## PDF 文本结构（根据截图）

```
黔寨寨贵州烙锅（鞍山首店）-配送单

单据编号: PS2604210007          单据状态: 已发货              复审状态: 未复审
分拣状态: 已分拣                是否需要推送: 无需推送        订单日期: 2026/04/20
预计发货日期: 2026/04/21        期望到货日期: 2026/04/21      发货日期: 2026/04/22
发货操作时间: 2026/04/22 16:32:23  收货机构: 黔寨寨贵州烙锅   订货机构: 黔寨寨贵州烙锅
...

    物品类别    物品编码    物品名称    规格型号    订货单位    发货数量    备注
1   饮品类      ZBWP0001    茶语柠...   750ml*6瓶/件  件      2
2   饮品类      ZBWP0002    茶语柠...   1L*12瓶/件     件      2
...
```

## 方案设计

### 1. 创建新文件 `src/lib/pdf-parse-engine.ts`

新建独立的 PDF 解析引擎类：

**类名**: `PdfParseEngine`

**核心方法**:
- `parse(buffer: Buffer): PdfParseResult` - 主入口
- `extractText(buffer: Buffer): Promise<{ text: string, pages: string[] }>` - 使用 unpdf 提取文本
- `splitToRows(text: string): string[]` - 按换行符分割文本
- `splitRowToCells(row: string): string[]` - 按制表符或多个空格分割行
- `parseKeyValuePairs(cells: string[]): { [key: string]: string }` - 解析键值对（按 `:` 分割）
- `detectHeaderRow(data: any[][]): number` - 检测表头行
- `detectDataEndRow(data: any[][], startRow: number): number` - 检测数据结束行
- `extractHeaderSection(data: any[][], headerRow: number): { [key: string]: string }[]` - 提取头部（解析键值对）
- `extractFooterSection(data: any[][], dataEndRow: number): { [key: string]: string }[]` - 提取尾部（解析键值对）

### 2. 关键解析逻辑

**头部/尾部区域解析**（键值对模式）：
```typescript
parseKeyValuePairs(cells: string[]): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  for (const cell of cells) {
    const colonIndex = cell.indexOf(':');
    if (colonIndex > 0) {
      const key = cell.substring(0, colonIndex).trim();
      const value = cell.substring(colonIndex + 1).trim();
      if (key && value) {
        result[key] = value;
      }
    }
  }
  return result;
}
```

**主体表格解析**：
- 按 `\t` 或 `\s{2,}`（2 个以上空格）分割列
- 与 Excel 处理方式一致

### 3. 修改 `src/lib/file-parser.ts`

简化 `parsePdf()` 函数，改为调用 `PdfParseEngine` 类：
```typescript
export async function parsePdf(buffer: Buffer): Promise<FileParseResult> {
  const engine = new PdfParseEngine();
  const result = await engine.parse(buffer);
  // ... 转换为 FileParseResult 格式
}
```

## 实施步骤

### Step 1: 创建 `src/lib/pdf-parse-engine.ts`
- 定义接口和类
- 实现文本提取、分割、键值对解析
- 实现三区域检测和提取

### Step 2: 重构 `src/lib/file-parser.ts`
- 导入 `PdfParseEngine`
- 简化 `parsePdf()` 函数

### Step 3: 验证
- `npm run build` 检查类型

## 文件清单
- **新建**: `src/lib/pdf-parse-engine.ts`
- **修改**: `src/lib/file-parser.ts`

## 假设与决策
1. 使用 `unpdf` 库提取 PDF 文本
2. 头部/尾部按 `:` 分割键值对
3. 主体表格按制表符/空格分割
4. 不影响现有 Excel 解析逻辑
