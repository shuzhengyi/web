"use client";

import { useState, useEffect, useCallback } from "react";
import { Order } from "@/generated/prisma/client";
import OrderTable from "@/components/OrderTable";
import OrderImportButton from "@/components/OrderImportButton";
import OrderExportButton from "@/components/OrderExportButton";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'import' | 'list'>('import');

  const [filters, setFilters] = useState({
    customerOrderNumber: "",
    receiverName: "",
    startTime: "",
    endTime: "",
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (filters.customerOrderNumber) {
        params.set("customerOrderNumber", filters.customerOrderNumber);
      }
      if (filters.receiverName) {
        params.set("receiverName", filters.receiverName);
      }
      if (filters.startTime) {
        params.set("startTime", filters.startTime);
      }
      if (filters.endTime) {
        params.set("endTime", filters.endTime);
      }

      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch {
      console.error("获取订单失败");
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setPage(1);
    fetchOrders();
  };

  const handleClearFilters = () => {
    setFilters({
      customerOrderNumber: "",
      receiverName: "",
      startTime: "",
      endTime: "",
    });
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <header className="bg-white border-b border-[#e5e7eb] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-[#1f2937]">运单管理</h1>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <button className="inline-flex items-center px-4 py-2 border border-[#d1d5db] text-sm font-medium rounded-md text-[#4b5563] bg-white hover:bg-[#f3f4f6] transition-colors">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  下载模板 ▼
                </button>
                <div className="absolute right-0 mt-2 w-64 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">模板列表</div>
                    <a href="/api/orders/import/template?type=template1" className="flex items-center px-4 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                      <span className="w-6 h-6 flex items-center justify-center bg-[#e8fcfb] text-[#0fc6c2] rounded text-xs mr-2 font-medium">1</span>
                      模板1 - 标准格式
                    </a>
                    <a href="/api/orders/import/template?type=template2" className="flex items-center px-4 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                      <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-600 rounded text-xs mr-2 font-medium">2</span>
                      模板2 - 电商格式
                    </a>
                    <a href="/api/orders/import/template?type=template3" className="flex items-center px-4 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                      <span className="w-6 h-6 flex items-center justify-center bg-purple-100 text-purple-600 rounded text-xs mr-2 font-medium">3</span>
                      模板3 - 英文格式
                    </a>
                    <a href="/api/orders/import/template?type=template4" className="flex items-center px-4 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                      <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-600 rounded text-xs mr-2 font-medium">4</span>
                      模板4 - 分组格式
                    </a>
                    <a href="/api/orders/import/template?type=template5" className="flex items-center px-4 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6] transition-colors">
                      <span className="w-6 h-6 flex items-center justify-center bg-cyan-100 text-cyan-600 rounded text-xs mr-2 font-medium">5</span>
                      模板5 - 客户单号格式
                    </a>
                  </div>
                </div>
              </div>
              <OrderExportButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-md ${
              activeTab === 'import'
                ? 'border-[#0fc6c2] text-[#0fc6c2] bg-white'
                : 'border-transparent text-[#6b7280] hover:text-[#374151] hover:bg-[#f3f4f6]'
            }`}
          >
            文件导入
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-md ${
              activeTab === 'list'
                ? 'border-[#0fc6c2] text-[#0fc6c2] bg-white'
                : 'border-transparent text-[#6b7280] hover:text-[#374151] hover:bg-[#f3f4f6]'
            }`}
          >
            运单列表
          </button>
        </div>

        {activeTab === 'import' && (
          <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[#1f2937]">批量订单导入</h2>
                <p className="text-sm text-[#6b7280] mt-1">支持 Excel 文件导入，自动识别多种模板格式</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-[#4b5563]">选择模板:</label>
                <select
                  className="px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2] bg-white"
                  defaultValue="auto"
                >
                  <option value="auto">自动识别</option>
                  <option value="template1">模板1 - 标准格式</option>
                  <option value="template2">模板2 - 电商格式</option>
                  <option value="template3">模板3 - 英文格式</option>
                  <option value="template4">模板4 - 分组格式</option>
                  <option value="template5">模板5 - 客户单号格式</option>
                </select>
              </div>
            </div>
            <OrderImportButton onImportComplete={fetchOrders} />
            <div className="mt-4 p-4 bg-[#e8fcfb] rounded-lg border border-[#b2f2ef]">
              <h3 className="text-sm font-medium text-[#0d7572] mb-2">功能说明</h3>
              <ul className="text-sm text-[#0fc6c2] space-y-1">
                <li>• 支持上传 Excel 文件 (.xlsx / .xls)</li>
                <li>• 支持拖拽上传和点击上传两种方式</li>
                <li>• 自动识别至少 5 种不同的模板格式</li>
                <li>• 支持手动调整字段映射关系</li>
                <li>• 模板记忆功能：自动保存映射规则，下次使用相同模板自动应用</li>
                <li>• 支持 1000 条以上数据导入</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db]">
              <div className="px-4 py-4 border-b border-[#e5e7eb] sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-[#6b7280]">共 {total} 条订单</p>
                </div>

                <div className="mt-4 border-t border-[#e5e7eb] pt-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#4b5563]">外部编码:</label>
                      <input
                        type="text"
                        value={filters.customerOrderNumber}
                        onChange={(e) => handleFilterChange("customerOrderNumber", e.target.value)}
                        className="px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2] bg-white"
                        placeholder="客户单号"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#4b5563]">收件人:</label>
                      <input
                        type="text"
                        value={filters.receiverName}
                        onChange={(e) => handleFilterChange("receiverName", e.target.value)}
                        className="px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2] bg-white"
                        placeholder="收件人姓名"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#4b5563]">开始时间:</label>
                      <input
                        type="datetime-local"
                        value={filters.startTime}
                        onChange={(e) => handleFilterChange("startTime", e.target.value)}
                        className="px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2] bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#4b5563]">结束时间:</label>
                      <input
                        type="datetime-local"
                        value={filters.endTime}
                        onChange={(e) => handleFilterChange("endTime", e.target.value)}
                        className="px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2] bg-white"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={searchLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                    >
                      {searchLoading && (
                        <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      查询
                    </button>
                    <button
                      onClick={handleClearFilters}
                      className="px-4 py-2 text-sm font-medium text-[#4b5563] bg-[#f3f4f6] border border-[#d1d5db] rounded-md hover:bg-[#e5e7eb] transition-colors"
                    >
                      清除筛选
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 py-5 sm:px-6">
                {loading ? (
                  <div className="text-center py-12 text-[#6b7280]">加载中...</div>
                ) : (
                  <OrderTable orders={orders} />
                )}
              </div>

              <div className="px-4 py-3 border-t border-[#e5e7eb] sm:px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#6b7280]">每页显示:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2]"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-[#6b7280]">条</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm border border-[#d1d5db] rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f4f6] transition-colors"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-[#4b5563]">
                    第 {page} / {totalPages || 1} 页
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages || 1, page + 1))}
                    disabled={page === (totalPages || 1)}
                    className="px-4 py-2 text-sm border border-[#d1d5db] rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f4f6] transition-colors"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
        )}
      </main>
    </div>
  );
}
