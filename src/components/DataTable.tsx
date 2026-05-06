"use client";

import { useState } from "react";
import ItemForm from "./ItemForm";

interface Item {
  id: number;
  name: string;
  category: string | null;
  quantity: number;
  price: number;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DataTableProps {
  items: Item[];
  onDelete: (id: number) => void;
  onEdit: (item: Item) => void;
}

export default function DataTable({ items, onDelete, onEdit }: DataTableProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这条数据吗？")) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        暂无数据，请添加或导入数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              名称
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              分类
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              数量
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              单价
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">{item.id}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {item.category || "-"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
              <td className="px-4 py-3 text-sm text-gray-900">
                ¥{item.price.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {item.status === "active" ? "活跃" : "停用"}
                </span>
              </td>
              <td className="px-4 py-3 text-sm space-x-2">
                <button
                  onClick={() => onEdit(item)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                >
                  {deletingId === item.id ? "删除中..." : "删除"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
