"use client";

import { useState } from "react";
import { Order } from "@/generated/prisma/client";

interface OrderFormData {
  id?: number;
  trackingNumber?: string;
  customerOrderNumber?: string;
  customerCode?: string;
  customerName?: string;
  senderName?: string;
  senderPhone?: string;
  senderCompany?: string;
  senderProvince?: string;
  senderCity?: string;
  senderDistrict?: string;
  senderAddress?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverCompany?: string;
  receiverProvince?: string;
  receiverCity?: string;
  receiverDistrict?: string;
  receiverAddress?: string;
  goodsName?: string;
  goodsType?: string;
  goodsQuantity?: number;
  goodsWeight?: number;
  goodsVolume?: number;
  goodsPieces?: number;
  serviceType?: string;
  paymentType?: string;
  collectionAmount?: number;
  insuredAmount?: number;
  remark?: string;
}

interface OrderFormProps {
  order?: Order | null;
  onSubmit: (data: OrderFormData) => void;
  onCancel: () => void;
}

const provinces = [
  "北京市",
  "天津市",
  "河北省",
  "山西省",
  "内蒙古自治区",
  "辽宁省",
  "吉林省",
  "黑龙江省",
  "上海市",
  "江苏省",
  "浙江省",
  "安徽省",
  "福建省",
  "江西省",
  "山东省",
  "河南省",
  "湖北省",
  "湖南省",
  "广东省",
  "广西壮族自治区",
  "海南省",
  "重庆市",
  "四川省",
  "贵州省",
  "云南省",
  "西藏自治区",
  "陕西省",
  "甘肃省",
  "青海省",
  "宁夏回族自治区",
  "新疆维吾尔自治区",
];

const serviceTypes = ["标准快递", "加急快递", "冷链运输", "大件运输", "同城配送"];
const paymentTypes = ["现金", "在线支付", "到付", "月结"];

const generateTrackingNumber = () => {
  const prefix = "YT";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${dateStr}${timeStr}${random}`;
};

interface InputFieldProps {
  label: string;
  field: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (field: string, value: string) => void;
  readOnly?: boolean;
}

function InputField({ label, field, type = "text", placeholder, value, onChange, readOnly }: InputFieldProps) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${readOnly ? "bg-gray-50 text-gray-700 font-mono" : ""}`}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  field: string;
  options: string[];
  placeholder?: string;
  value: string;
  onChange: (field: string, value: string) => void;
}

function SelectField({ label, field, options, placeholder, value, onChange }: SelectFieldProps) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  field: string;
  placeholder?: string;
  value: number;
  onChange: (field: string, value: number) => void;
}

function NumberField({ label, field, placeholder, value, onChange }: NumberFieldProps) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(field, parseFloat(e.target.value) || 0)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  field: string;
  placeholder?: string;
  value: string;
  onChange: (field: string, value: string) => void;
}

function TextAreaField({ label, field, placeholder, value, onChange }: TextAreaFieldProps) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />
    </div>
  );
}

export default function OrderForm({ order, onSubmit, onCancel }: OrderFormProps) {
  const [trackingNumber] = useState(() => order?.trackingNumber || generateTrackingNumber());
  
  const [data, setData] = useState<Order>(() => ({
    trackingNumber: trackingNumber,
    customerOrderNumber: order?.customerOrderNumber || "",
    customerCode: order?.customerCode || "",
    customerName: order?.customerName || "",
    senderName: order?.senderName || "",
    senderPhone: order?.senderPhone || "",
    senderCompany: order?.senderCompany || "",
    senderProvince: order?.senderProvince || "",
    senderCity: order?.senderCity || "",
    senderDistrict: order?.senderDistrict || "",
    senderAddress: order?.senderAddress || "",
    receiverName: order?.receiverName || "",
    receiverPhone: order?.receiverPhone || "",
    receiverCompany: order?.receiverCompany || "",
    receiverProvince: order?.receiverProvince || "",
    receiverCity: order?.receiverCity || "",
    receiverDistrict: order?.receiverDistrict || "",
    receiverAddress: order?.receiverAddress || "",
    goodsName: order?.goodsName || "",
    goodsType: order?.goodsType || "",
    goodsQuantity: order?.goodsQuantity || 0,
    goodsWeight: order?.goodsWeight || 0,
    goodsVolume: order?.goodsVolume || 0,
    goodsPieces: order?.goodsPieces || 0,
    serviceType: order?.serviceType || "",
    paymentType: order?.paymentType || "",
    collectionAmount: order?.collectionAmount || 0,
    insuredAmount: order?.insuredAmount || 0,
    remark: order?.remark || "",
  }));

  const handleChange = (field: keyof Order, value: string | number) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...data, trackingNumber });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            运单号 <span className="text-gray-400">(自动生成)</span>
          </label>
          <input
            type="text"
            value={trackingNumber}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-mono"
          />
        </div>
        <InputField
          label="客户单号"
          field="customerOrderNumber"
          value={data.customerOrderNumber || ""}
          onChange={handleChange}
          placeholder="请输入客户单号"
        />
        <InputField
          label="客户编号"
          field="customerCode"
          value={data.customerCode || ""}
          onChange={handleChange}
          placeholder="请输入客户编号"
        />
        <InputField
          label="客户名称"
          field="customerName"
          value={data.customerName || ""}
          onChange={handleChange}
          placeholder="请输入客户名称"
        />
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">寄件人信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InputField
            label="寄件人"
            field="senderName"
            value={data.senderName || ""}
            onChange={handleChange}
            placeholder="请输入寄件人姓名"
          />
          <InputField
            label="寄件人手机"
            field="senderPhone"
            value={data.senderPhone || ""}
            onChange={handleChange}
            placeholder="请输入手机号码"
          />
          <InputField
            label="寄件公司"
            field="senderCompany"
            value={data.senderCompany || ""}
            onChange={handleChange}
            placeholder="请输入公司名称"
          />
          <SelectField
            label="寄件省份"
            field="senderProvince"
            value={data.senderProvince || ""}
            onChange={handleChange}
            options={provinces}
            placeholder="请选择省份"
          />
          <SelectField
            label="寄件城市"
            field="senderCity"
            value={data.senderCity || ""}
            onChange={handleChange}
            options={provinces}
            placeholder="请选择城市"
          />
          <InputField
            label="寄件区县"
            field="senderDistrict"
            value={data.senderDistrict || ""}
            onChange={handleChange}
            placeholder="请输入区县"
          />
          <div className="lg:col-span-2">
            <TextAreaField
              label="详细地址"
              field="senderAddress"
              value={data.senderAddress || ""}
              onChange={handleChange}
              placeholder="请输入详细地址"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">收件人信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InputField
            label="收件人"
            field="receiverName"
            value={data.receiverName || ""}
            onChange={handleChange}
            placeholder="请输入收件人姓名"
          />
          <InputField
            label="收件人手机"
            field="receiverPhone"
            value={data.receiverPhone || ""}
            onChange={handleChange}
            placeholder="请输入手机号码"
          />
          <InputField
            label="收件公司"
            field="receiverCompany"
            value={data.receiverCompany || ""}
            onChange={handleChange}
            placeholder="请输入公司名称"
          />
          <SelectField
            label="收件省份"
            field="receiverProvince"
            value={data.receiverProvince || ""}
            onChange={handleChange}
            options={provinces}
            placeholder="请选择省份"
          />
          <SelectField
            label="收件城市"
            field="receiverCity"
            value={data.receiverCity || ""}
            onChange={handleChange}
            options={provinces}
            placeholder="请选择城市"
          />
          <InputField
            label="收件区县"
            field="receiverDistrict"
            value={data.receiverDistrict || ""}
            onChange={handleChange}
            placeholder="请输入区县"
          />
          <div className="lg:col-span-2">
            <TextAreaField
              label="详细地址"
              field="receiverAddress"
              value={data.receiverAddress || ""}
              onChange={handleChange}
              placeholder="请输入详细地址"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">物品信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InputField
            label="物品名称"
            field="goodsName"
            value={data.goodsName || ""}
            onChange={handleChange}
            placeholder="请输入物品名称"
          />
          <InputField
            label="物品类型"
            field="goodsType"
            value={data.goodsType || ""}
            onChange={handleChange}
            placeholder="请输入物品类型"
          />
          <NumberField
            label="物品数量"
            field="goodsQuantity"
            value={data.goodsQuantity || 0}
            onChange={handleChange}
            placeholder="0"
          />
          <NumberField
            label="物品重量(kg)"
            field="goodsWeight"
            value={data.goodsWeight || 0}
            onChange={handleChange}
            placeholder="0"
          />
          <NumberField
            label="物品体积(m³)"
            field="goodsVolume"
            value={data.goodsVolume || 0}
            onChange={handleChange}
            placeholder="0"
          />
          <NumberField
            label="物品件数"
            field="goodsPieces"
            value={data.goodsPieces || 0}
            onChange={handleChange}
            placeholder="0"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">服务信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectField
            label="服务类型"
            field="serviceType"
            value={data.serviceType || ""}
            onChange={handleChange}
            options={serviceTypes}
            placeholder="请选择服务类型"
          />
          <SelectField
            label="支付方式"
            field="paymentType"
            value={data.paymentType || ""}
            onChange={handleChange}
            options={paymentTypes}
            placeholder="请选择支付方式"
          />
          <NumberField
            label="代收金额"
            field="collectionAmount"
            value={data.collectionAmount || 0}
            onChange={handleChange}
            placeholder="0"
          />
          <NumberField
            label="保价金额"
            field="insuredAmount"
            value={data.insuredAmount || 0}
            onChange={handleChange}
            placeholder="0"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <TextAreaField
          label="备注"
          field="remark"
          value={data.remark || ""}
          onChange={handleChange}
          placeholder="请输入备注信息"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
        >
          {order?.id ? "保存修改" : "创建订单"}
        </button>
      </div>
    </form>
  );
}