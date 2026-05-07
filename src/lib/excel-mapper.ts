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
    possibleNames: ["客户单号", "客户订单号", "订单号", "orderNo", "orderNumber", "customerOrder", "订单编号"],
    type: "string"
  },
  {
    field: "customerCode",
    possibleNames: ["客户编号", "客户代码", "code", "customerCode", "会员编号", "商户编号"],
    type: "string"
  },
  {
    field: "customerName",
    possibleNames: ["客户名称", "客户名", "customerName", "客户", "商家名称"],
    type: "string"
  },
  {
    field: "senderName",
    possibleNames: ["寄件人", "发件人", "发货人", "sender", "寄件人姓名", "发件人姓名", "fromName", "shipper"],
    type: "string"
  },
  {
    field: "senderPhone",
    possibleNames: ["寄件人电话", "寄件人手机", "发件人电话", "发货人电话", "senderPhone", "fromPhone", "寄方电话", "shipperTel"],
    type: "string"
  },
  {
    field: "senderCompany",
    possibleNames: ["寄件公司", "发件公司", "发货公司", "senderCompany", "fromCompany", "寄方公司", "shipperCompany"],
    type: "string"
  },
  {
    field: "senderProvince",
    possibleNames: ["寄件省份", "发件省份", "发货省份", "senderProvince", "fromProvince", "寄方省份", "senderState", "省"],
    type: "string"
  },
  {
    field: "senderCity",
    possibleNames: ["寄件城市", "发件城市", "发货城市", "senderCity", "fromCity", "寄方城市", "市"],
    type: "string"
  },
  {
    field: "senderDistrict",
    possibleNames: ["寄件区县", "发件区县", "发货区县", "senderDistrict", "fromDistrict", "寄方区县", "区"],
    type: "string"
  },
  {
    field: "senderAddress",
    possibleNames: ["寄件地址", "发件地址", "发货地址", "senderAddress", "fromAddress", "寄方地址", "详细地址", "地址"],
    type: "string"
  },
  {
    field: "receiverName",
    possibleNames: ["收件人", "收货人", "receiver", "receiveName", "toName", "consignee"],
    type: "string"
  },
  {
    field: "receiverPhone",
    possibleNames: ["收件人电话", "收件人手机", "收货人电话", "receiverPhone", "toPhone", "consigneeTel"],
    type: "string"
  },
  {
    field: "receiverCompany",
    possibleNames: ["收件公司", "收货公司", "receiverCompany", "toCompany", "consigneeCompany"],
    type: "string"
  },
  {
    field: "receiverProvince",
    possibleNames: ["收件省份", "收货省份", "receiverProvince", "toProvince", "省"],
    type: "string"
  },
  {
    field: "receiverCity",
    possibleNames: ["收件城市", "收货城市", "receiverCity", "toCity", "市"],
    type: "string"
  },
  {
    field: "receiverDistrict",
    possibleNames: ["收件区县", "收货区县", "receiverDistrict", "toDistrict", "区"],
    type: "string"
  },
  {
    field: "receiverAddress",
    possibleNames: ["收件地址", "收货地址", "receiverAddress", "toAddress", "详细地址"],
    type: "string"
  },
  {
    field: "goodsName",
    possibleNames: ["物品名称", "品名", "货物名称", "goodsName", "itemName", "商品名称", "货品名"],
    type: "string"
  },
  {
    field: "goodsType",
    possibleNames: ["物品类型", "货物类型", "类型", "goodsType", "itemType", "品类"],
    type: "string"
  },
  {
    field: "goodsQuantity",
    possibleNames: ["物品数量", "数量", "goodsQuantity", "quantity", "qty", "件数"],
    type: "number"
  },
  {
    field: "goodsWeight",
    possibleNames: ["物品重量", "重量", "weight", "goodsWeight", "kg", "体重"],
    type: "number"
  },
  {
    field: "goodsVolume",
    possibleNames: ["物品体积", "体积", "volume", "goodsVolume", "方", "立方米"],
    type: "number"
  },
  {
    field: "goodsPieces",
    possibleNames: ["物品件数", "件数", "pieces", "goodsPieces", "箱数", "packageCount"],
    type: "number"
  },
  {
    field: "serviceType",
    possibleNames: ["服务类型", "服务", "serviceType", "快递类型", "运输方式", "shippingType"],
    type: "string"
  },
  {
    field: "paymentType",
    possibleNames: ["支付方式", "付款方式", "paymentType", "payType", "付款类型", "支付类型"],
    type: "string"
  },
  {
    field: "collectionAmount",
    possibleNames: ["代收金额", "代收费", "collectionAmount", "cod", "到付金额", "代收款"],
    type: "number"
  },
  {
    field: "insuredAmount",
    possibleNames: ["保价金额", "保价", "insuredAmount", "insurance", "保险金额", "声明价值"],
    type: "number"
  },
  {
    field: "remark",
    possibleNames: ["备注", "备注信息", "remark", "note", "notes", "说明", "注意事项"],
    type: "string"
  }
];

export function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[\s\-_（）()]/g, "").trim();
}

export function findFieldMapping(headerName: string): FieldMapping | undefined {
  const normalized = normalizeString(headerName);
  return ORDER_FIELDS.find(mapping =>
    mapping.possibleNames.some(name => normalizeString(name) === normalized)
  );
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
