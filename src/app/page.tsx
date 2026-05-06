"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable from "@/components/DataTable";
import ImportButton from "@/components/ImportButton";
import ExportButton from "@/components/ExportButton";
import ItemForm from "@/components/ItemForm";

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

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/items?page=${page}&pageSize=${pageSize}`
      );
      const data = await response.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      console.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (response.ok) {
        fetchItems();
      }
    } catch {
      console.error("删除失败");
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormSubmit = async (
    data: Omit<Item, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      if (editingItem) {
        const response = await fetch(`/api/items/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("更新失败");
      } else {
        const response = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("创建失败");
      }
      setShowForm(false);
      setEditingItem(null);
      fetchItems();
    } catch {
      alert("操作失败，请重试");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">数据管理</h1>
          <p className="mt-2 text-sm text-gray-600">
            支持 Excel 导入导出的全栈数据管理系统
          </p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setShowForm(!showForm);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {showForm ? "收起表单" : "新增数据"}
                </button>
                <ImportButton onImportComplete={fetchItems} />
                <ExportButton />
              </div>
              <p className="text-sm text-gray-500">共 {total} 条数据</p>
            </div>
          </div>

          {showForm && (
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingItem ? "编辑数据" : "新增数据"}
              </h3>
              <ItemForm
                item={editingItem}
                onSubmit={handleFormSubmit}
                onCancel={handleCancel}
              />
            </div>
          )}

          <div className="px-4 py-5 sm:px-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">加载中...</div>
            ) : (
              <DataTable
                items={items}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            )}
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 sm:px-6 flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-700">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
