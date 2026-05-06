import * as XLSX from "xlsx";

export interface ItemRow {
  name: string;
  category: string;
  quantity: number;
  price: number;
  description: string;
  status: string;
}

const HEADER_MAP: Record<string, keyof ItemRow> = {
  "名称": "name",
  "分类": "category",
  "数量": "quantity",
  "单价": "price",
  "描述": "description",
  "状态": "status",
};

const REVERSE_HEADER_MAP: Record<keyof ItemRow, string> = {
  name: "名称",
  category: "分类",
  quantity: "数量",
  price: "单价",
  description: "描述",
  status: "状态",
};

export function parseExcelBuffer(buffer: ArrayBuffer): ItemRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData: Record<string, string | number>[] = XLSX.utils.sheet_to_json(worksheet);

  return jsonData.map((row) => {
    const item: ItemRow = {
      name: "",
      category: "",
      quantity: 0,
      price: 0,
      description: "",
      status: "active",
    };

    for (const [cnHeader, enField] of Object.entries(HEADER_MAP)) {
      if (row[cnHeader] !== undefined) {
        const value = row[cnHeader];
        if (enField === "quantity" || enField === "price") {
          (item as Record<string, unknown>)[enField] = Number(value) || 0;
        } else {
          (item as Record<string, unknown>)[enField] = String(value);
        }
      }
    }

    return item;
  });
}

export function buildExcelBuffer(data: ItemRow[]): Buffer {
  const headerRow = Object.values(REVERSE_HEADER_MAP);
  const rows = data.map((item) => {
    const row: Record<string, string | number> = {};
    for (const [enField, cnHeader] of Object.entries(REVERSE_HEADER_MAP)) {
      row[cnHeader] = item[enField as keyof ItemRow];
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headerRow });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "数据");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return Buffer.from(excelBuffer);
}
