export interface FieldMapping {
  field: string;
  possibleNames: string[];
  type: "string" | "number";
}

export const ORDER_FIELDS: FieldMapping[] = [
  {
    field: "trackingNumber",
    possibleNames: ["运单号", "运单", "单号", "快递单号", "跟踪号", "tracking", "trackingNumber", "waybill", "waybillNo"],
    type: "string"
  },
  {
    field: "customerOrderNumber",
    possibleNames: ["客户单号", "客户订单号", "订单号", "orderNo", "orderNumber", "customerOrder", "订单编号", "外部订单号", "外部编码", "refcode", "ref code", "reference", "产品编码", "外部订单", "客户订单", "外部订单编号"],
    type: "string"
  },
  {
    field: "goodsName",
    possibleNames: ["产品名称", "货物名称", "物品名称", "品名", "goodsName", "productName", "itemName"],
    type: "string"
  },
  {
    field: "senderName",
    possibleNames: ["寄件人", "发件人", "发货人", "sender", "寄件人姓名", "发件人姓名", "发货人姓名", "fromName", "shipper", "发件方", "发货方", "寄件", "发件", "发货"],
    type: "string"
  },
  {
    field: "senderPhone",
    possibleNames: ["寄件人电话", "寄件人手机", "发件人电话", "发货人电话", "senderPhone", "fromPhone", "寄方电话", "shipperTel", "发件电话", "发货电话", "sender tel", "sender telephone", "发货手机号", "发货电话号", "发件手机", "寄件手机"],
    type: "string"
  },
  {
    field: "senderAddress",
    possibleNames: ["寄件地址", "发件地址", "发货地址", "senderAddress", "fromAddress", "寄方地址", "详细地址", "地址", "发件人地址", "发货人地址", "sender address", "寄件人地址", "发货人地址"],
    type: "string"
  },
  {
    field: "receiverName",
    possibleNames: ["收件人", "收货人", "receiver", "receiveName", "toName", "consignee", "收件方", "收货方", "收货", "收件"],
    type: "string"
  },
  {
    field: "storeName",
    possibleNames: ["门店", "仓库", "仓", "店名", "店铺", "门店名称", "收货门店", "门店地址", "store", "warehouse", "storeName", "shopName"],
    type: "string"
  },
  {
    field: "receiverPhone",
    possibleNames: ["收件人电话", "收件人手机", "收货人电话", "receiverPhone", "toPhone", "consigneeTel", "收件电话", "收货电话", "receiver tel", "receiver telephone", "收货手机号", "收货电话号", "收件手机", "收货手机"],
    type: "string"
  },
  {
    field: "receiverAddress",
    possibleNames: ["收件地址", "收货地址", "receiverAddress", "toAddress", "详细地址", "收件人地址", "收货人地址", "receiver address", "收件人地址", "收货人地址"],
    type: "string"
  },
  {
    field: "goodsWeight",
    possibleNames: ["物品重量", "重量", "weight", "goodsWeight", "kg", "体重", "重量(kg)", "weight(kg)", "货物重量", "重 量", "重量kg", "重量KG"],
    type: "number"
  },
  {
    field: "goodsQuantity",
    possibleNames: ["物品数量", "goodsQuantity", "quantity", "数量(件)", "货品数量"],
    type: "number"
  },
  {
    field: "goodsPieces",
    possibleNames: ["物品件数", "件数", "pieces", "goodsPieces", "箱数", "packageCount", "包装件数", "数量", "qty", "quantity", "货品数量"],
    type: "number"
  },
  {
    field: "goodsType",
    possibleNames: ["物品类型", "货物类型", "类型", "goodsType", "itemType", "品类", "温层", "温度要求", "temp zone", "temperature", "冷藏", "常温", "冷冻", "温 度", "温度"],
    type: "string"
  },
  {
    field: "remark",
    possibleNames: ["备注", "备注信息", "remark", "note", "notes", "说明", "注意事项", "附言", "留言", "备注信息"],
    type: "string"
  }
];

export function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[\s\-_（）()/\\]/g, "").trim();
}

export function findFieldMapping(headerName: string): FieldMapping | undefined {
  const normalized = normalizeString(headerName);

  for (const mapping of ORDER_FIELDS) {
    for (const name of mapping.possibleNames) {
      if (normalizeString(name) === normalized) {
        return mapping;
      }
    }
  }

  for (const mapping of ORDER_FIELDS) {
    for (const name of mapping.possibleNames) {
      const normalizedName = normalizeString(name);
      if (normalized.includes(normalizedName) || normalizedName.includes(normalized)) {
        return mapping;
      }
    }
  }

  return undefined;
}

export function mapHeadersToFields(headers: string[]): Map<string, number> {
  const mapping = new Map<string, number>();

  headers.forEach((header, index) => {
    const fieldMapping = findFieldMapping(header);
    if (fieldMapping) {
      mapping.set(fieldMapping.field, index);
    }
  });

  return mapping;
}

export function parseExcelValue(value: unknown, type: "string" | "number"): string | number | null {
  if (value === null || value === undefined || value === "") return null;

  if (type === "number") {
    const num = parseFloat(String(value));
    return isNaN(num) ? 0 : num;
  }

  return String(value).trim() || null;
}

export interface TemplateDetectionResult {
  matchedFields: string[];
  confidence: number;
  suggestedTemplate: string;
}

export function detectTemplate(headers: string[]): TemplateDetectionResult {
  const matchedFields: string[] = [];
  const totalFields = ORDER_FIELDS.length;

  headers.forEach(header => {
    const mapping = findFieldMapping(header);
    if (mapping && !matchedFields.includes(mapping.field)) {
      matchedFields.push(mapping.field);
    }
  });

  const confidence = matchedFields.length / totalFields;

  let suggestedTemplate = "通用模板";
  if (headers.some(h => normalizeString(h).includes("refcode") || normalizeString(h).includes("ref"))) {
    suggestedTemplate = "模板3-英文格式";
  } else if (headers.some(h => normalizeString(h).includes("外部编码") || normalizeString(h).includes("外部订单号"))) {
    suggestedTemplate = "模板1-标准格式";
  } else if (headers.some(h => normalizeString(h).includes("发货人") || normalizeString(h).includes("发货电话"))) {
    suggestedTemplate = "模板2-电商格式";
  } else if (headers.some(h => normalizeString(h).includes("发件方信息") || normalizeString(h).includes("收件方信息"))) {
    suggestedTemplate = "模板4-分组格式";
  } else if (headers.some(h => normalizeString(h).includes("客户单号") || normalizeString(h).includes("重量(kg)"))) {
    suggestedTemplate = "模板5-客户单号格式";
  }

  return { matchedFields, confidence, suggestedTemplate };
}

export function generateHeaderFingerprint(headers: string[]): string {
  const normalizedHeaders = headers
    .map(h => normalizeString(h))
    .filter(h => h.length > 0)
    .sort();
  
  const hash = normalizedHeaders.join("|");
  let hashValue = 0;
  
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    hashValue = ((hashValue << 5) - hashValue) + char;
    hashValue = hashValue & hashValue;
  }
  
  return Math.abs(hashValue).toString(36);
}
