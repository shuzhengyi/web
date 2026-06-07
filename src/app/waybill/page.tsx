"use client";

import { useState, useEffect, useCallback } from "react";
import { Order } from "@/generated/prisma/client";
import OrderTable from "@/components/OrderTable";
import OrderImportButton from "@/components/OrderImportButton";
import OrderExportButton from "@/components/OrderExportButton";
import AppLayout from "@/components/AppLayout";

export default function WaybillPage() {
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
    if (activeTab === 'list') {
      fetchOrders();
    }
  }, [activeTab, fetchOrders]);

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
    <AppLayout>
      <div className="min-h-full bg-[#f5f7fa]">
        {/* 顶部标题栏 */}
        <header className="bg-white border-b border-[#e8e8e8] shadow-sm">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-[#333]">运单管理</h1>
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <button className="inline-flex items-center px-4 py-2 border border-[#e8e8e8] text-sm font-medium rounded text-[#666] bg-white hover:bg-[#f5f5f5] transition-colors">
                    下载模板
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-1.5 w-64 bg-white border border-[#e8e8e8] rounded-md shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="py-2">
                      <div className="px-4 py-2 text-xs font-semibold text-[#999] uppercase tracking-wider">模板列表</div>
                      <a href="/api/orders/import/template?type=template1" className="flex items-center px-4 py-2 text-sm text-[#666] hover:bg-[#f5f5f5]">
                        <span className="w-6 h-6 flex items-center justify-center bg-[#0fc6c2] text-white rounded text-xs mr-2">1</span>
                        模板1 - 标准格式
                      </a>
                      <a href="/api/orders/import/template?type=template2" className="flex items-center px-4 py-2 text-sm text-[#666] hover:bg-[#f5f5f5]">
                        <span className="w-6 h-6 flex items-center justify-center bg-[#0fc6c2] text-white rounded text-xs mr-2">2</span>
                        模板2 - 电商格式
                      </a>
                      <a href="/api/orders/import/template?type=template3" className="flex items-center px-4 py-2 text-sm text-[#666] hover:bg-[#f5f5f5]">
                        <span className="w-6 h-6 flex items-center justify-center bg-[#0fc6c2] text-white rounded text-xs mr-2">3</span>
                        模板3 - 英文格式
                      </a>
                      <a href="/api/orders/import/template?type=template4" className="flex items-center px-4 py-2 text-sm text-[#666] hover:bg-[#f5f5f5]">
                        <span className="w-6 h-6 flex items-center justify-center bg-[#0fc6c2] text-white rounded text-xs mr-2">4</span>
                        模板4 - 分组格式
                      </a>
                      <a href="/api/orders/import/template?type=template5" className="flex items-center px-4 py-2 text-sm text-[#666] hover:bg-[#f5f5f5]">
                        <span className="w-6 h-6 flex items-center justify-center bg-[#0fc6c2] text-white rounded text-xs mr-2">5</span>
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

        {/* 主内容区域 */}
        <main className="p-4">
          {/* 标签切换 */}
          <div className="mb-4">
            <div className="flex items-center gap-0 border-b border-[#e8e8e8]">
              <button
                onClick={() => setActiveTab('import')}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'import'
                    ? 'border-[#0fc6c2] text-[#0fc6c2]'
                    : 'border-transparent text-[#666] hover:text-[#333]'
                }`}
              >
                运单导入
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'list'
                    ? 'border-[#0fc6c2] text-[#0fc6c2]'
                    : 'border-transparent text-[#666] hover:text-[#333]'
                }`}
              >
                运单列表
              </button>
            </div>
          </div>

          {/* 运单导入 */}
          {activeTab === 'import' && (
            <div className="bg-white rounded-lg border border-[#e8e8e8] shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold text-[#333]">运单批量导入</h2>
                  <p className="text-sm text-[#999] mt-1">支持 Excel 文件导入，快速创建批量运单</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-[#666]">选择模板:</label>
                  <select
                    className="px-3 py-1.5 border border-[#e8e8e8] rounded text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0fc6c2]"
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
              <div className="mt-4 p-4 bg-[#e8f5f5] rounded-lg">
                <h3 className="text-sm font-medium text-[#0fc6c2] mb-2">功能说明</h3>
                <ul className="text-sm text-[#666] space-y-1">
                  <li>• 支持上传 Excel 文件 (.xlsx / .xls)</li>
                  <li>• 支持拖拽上传和点击上传两种方式</li>
                  <li>• 自动识别多种模板格式</li>
                  <li>• 支持手动调整字段映射关系</li>
                  <li>• 模板记忆功能：自动保存映射规则，下次使用相同模板自动应用</li>
                  <li>• 支持 1000 条以上数据导入</li>
                </ul>
              </div>
            </div>
          )}

          {/* 运单列表 */}
          {activeTab === 'list' && (
            <div className="bg-white rounded-lg border border-[#e8e8e8] shadow-sm">
              <div className="px-4 py-3 border-b border-[#e8e8e8]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-[#666]">共 <span className="text-[#333] font-medium">{total}</span> 条运单</p>
                </div>

                <div className="mt-3 border-t border-[#f0f0f0] pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#666]">外部编码:</label>
                      <input
                        type="text"
                        value={filters.customerOrderNumber}
                        onChange={(e) => handleFilterChange("customerOrderNumber", e.target.value)}
                        className="px-3 py-1.5 border border-[#e8e8e8] rounded text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] w-36"
                        placeholder="客户单号"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#666]">收件人:</label>
                      <input
                        type="text"
                        value={filters.receiverName}
                        onChange={(e) => handleFilterChange("receiverName", e.target.value)}
                        className="px-3 py-1.5 border border-[#e8e8e8] rounded text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] w-36"
                        placeholder="收件人姓名"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#666]">开始时间:</label>
                      <input
                        type="datetime-local"
                        value={filters.startTime}
                        onChange={(e) => handleFilterChange("startTime", e.target.value)}
                        className="px-3 py-1.5 border border-[#e8e8e8] rounded text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0fc6c2]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#666]">结束时间:</label>
                      <input
                        type="datetime-local"
                        value={filters.endTime}
                        onChange={(e) => handleFilterChange("endTime", e.target.value)}
                        className="px-3 py-1.5 border border-[#e8e8e8] rounded text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0fc6c2]"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={searchLoading}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-[#0fc6c2] border border-[#0fc6c2] rounded hover:bg-[#0db5b1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                      {searchLoading && (
                        <svg className="animate-spin -ml-0.5 mr-0.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      查询
                    </button>
                    <button
                      onClick={handleClearFilters}
                      className="px-4 py-1.5 text-sm font-medium text-[#666] bg-white border border-[#e8e8e8] rounded hover:bg-[#f5f5f5] transition-colors"
                    >
                      清除筛选
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 py-4">
                {loading ? (
                  <div className="text-center py-8 text-[#999]">加载中...</div>
                ) : (
                  <OrderTable orders={orders} />
                )}
              </div>

              <div className="px-4 py-3 border-t border-[#e8e8e8] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#666]">每页显示:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-3 py-1 border border-[#e8e8e8] rounded text-sm text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0fc6c2]"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-[#666]">条</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-[#e8e8e8] rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f5f5f5] transition-colors"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-[#666]">
                    第 <span className="text-[#333] font-medium">{page}</span> / <span className="text-[#333] font-medium">{totalPages || 1}</span> 页
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages || 1, page + 1))}
                    disabled={page === (totalPages || 1)}
                    className="px-3 py-1 text-sm border border-[#e8e8e8] rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f5f5f5] transition-colors"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
