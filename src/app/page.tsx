"use client";

import { useState, useEffect, useCallback } from "react";
import { Order } from "@/generated/prisma/client";
import OrderTable from "@/components/OrderTable";
import OrderImportButton from "@/components/OrderImportButton";
import OrderExportButton from "@/components/OrderExportButton";
import DownloadTemplateButton from "@/components/DownloadTemplateButton";
import OrderForm from "@/components/OrderForm";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [keyword, setKeyword] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/orders?page=${page}&pageSize=${pageSize}&keyword=${encodeURIComponent(keyword)}`
      );
      const data = await response.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch {
      console.error("获取订单失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这条订单吗？")) return;
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (response.ok) {
        fetchOrders();
      }
    } catch {
      console.error("删除失败");
    }
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setShowForm(true);
  };

  const handleFormSubmit = async (data: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
    try {
      if (editingOrder) {
        const response = await fetch(`/api/orders/${editingOrder.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("更新失败");
      } else {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("创建失败");
      }
      setShowForm(false);
      setEditingOrder(null);
      fetchOrders();
    } catch {
      alert("操作失败，请重试");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingOrder(null);
  };

  const handleSearch = () => {
    setPage(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-800">物流订单管理系统</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setShowForm(!showForm);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                {showForm ? "收起表单" : "新增订单"}
              </button>
              <OrderImportButton onImportComplete={fetchOrders} />
              <div className="relative group">
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  下载模板 ▼
                </button>
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">模板列表</div>
                    <a href="/api/orders/import/template?type=template1" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded text-xs mr-2">1</span>
                      模板1 - 标准格式
                    </a>
                    <a href="/api/orders/import/template?type=template2" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-600 rounded text-xs mr-2">2</span>
                      模板2 - 发货人格式
                    </a>
                    <a href="/api/orders/import/template?type=template3" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <span className="w-6 h-6 flex items-center justify-center bg-purple-100 text-purple-600 rounded text-xs mr-2">3</span>
                      模板3 - 英文格式
                    </a>
                    <a href="/api/orders/import/template?type=template4" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-600 rounded text-xs mr-2">4</span>
                      模板4 - 合并单元格
                    </a>
                    <div className="border-t border-gray-100 my-2"></div>
                    <button
                      onClick={async () => {
                        const response = await fetch("/api/orders/import/template", { method: "POST" });
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "all_templates.xlsx";
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      }}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-600 rounded text-xs mr-2">📦</span>
                      下载全部模板
                    </button>
                  </div>
                </div>
              </div>
              <OrderExportButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {showForm && (
          <div className="mb-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {editingOrder ? "编辑订单" : "新增订单"}
            </h2>
            <OrderForm
              order={editingOrder}
              onSubmit={handleFormSubmit}
              onCancel={handleCancel}
            />
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-4 border-b border-gray-200 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="搜索运单号、客户单号、寄件人、收件人..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700"
                >
                  搜索
                </button>
              </div>
              <p className="text-sm text-gray-500">共 {total} 条订单</p>
            </div>
          </div>

          <div className="px-4 py-5 sm:px-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">加载中...</div>
            ) : (
              <OrderTable
                orders={orders}
                onEdit={handleEdit}
                onDelete={handleDelete}
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
      </main>
    </div>
  );
}