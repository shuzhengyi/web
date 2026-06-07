'use client';

import React, { useState } from 'react';
import { OutboundOrder, OutboundItem } from '@/generated/prisma/client';

interface OutboundTableProps {
  orders: (OutboundOrder & { items: OutboundItem[] })[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理', class: 'bg-yellow-100 text-yellow-700' },
  { value: 'processing', label: '处理中', class: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: '已完成', class: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: '已取消', class: 'bg-red-100 text-red-700' },
];

export default function OutboundTable({
  orders,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: OutboundTableProps) {
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const getStatusInfo = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/outbound-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
      }
    } catch (error) {
      console.error('更新状态失败:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个出库单吗？')) return;

    try {
      const res = await fetch(`/api/outbound-orders/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db]">
      <div className="px-6 py-4 border-b border-[#e5e7eb] flex justify-between items-center">
        <h2 className="text-lg font-semibold text-[#1f2937]">
          出库单列表
          <span className="ml-2 text-sm font-normal text-[#6b7280]">
            共 {total} 条
          </span>
        </h2>
        <button
          onClick={onRefresh}
          className="inline-flex items-center px-3 py-1.5 text-sm text-[#4b5563] bg-[#f3f4f6] border border-[#d1d5db] rounded-md hover:bg-[#e5e7eb] transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#e5e7eb]">
          <thead className="bg-[#f9fafb]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider w-12"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                外部编码
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                收货信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                SKU数量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#6b7280]">
                  加载中...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#6b7280]">
                  暂无数据
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <React.Fragment key={order.id}>
                  <tr className="hover:bg-[#f9fafb] transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                        className="text-[#9ca3af] hover:text-[#374151] transition-colors"
                      >
                        {expandedOrder === order.id ? '▼' : '▶'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-[#1f2937]">
                      {order.externalCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#1f2937]">
                      {order.storeName ? (
                        <div>
                          <div className="font-medium">{order.storeName}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{order.receiverName || '-'}</div>
                          <div className="text-[#6b7280]">{order.receiverPhone || ''}</div>
                          <div className="text-[#6b7280] truncate max-w-xs" title={order.receiverAddress || ''}>
                            {order.receiverAddress || ''}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6b7280]">
                      {order.items.length} 个SKU
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border-0 cursor-pointer ${getStatusInfo(order.status).class}`}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6b7280]">
                      {new Date(order.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 justify-end"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                      </button>
                    </td>
                  </tr>
                  {expandedOrder === order.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-0">
                        <div className="border-t border-[#e5e7eb] bg-[#f9fafb] py-4">
                          <h4 className="text-sm font-medium text-[#1f2937] mb-3">SKU明细</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-white">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                                    SKU编码
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                                    SKU名称
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                                    规格
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                                    数量
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                                    备注
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#e5e7eb]">
                                {order.items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-4 py-2 text-[#1f2937]">{item.skuCode}</td>
                                    <td className="px-4 py-2 text-[#1f2937]">{item.skuName}</td>
                                    <td className="px-4 py-2 text-[#6b7280]">{item.specification || '-'}</td>
                                    <td className="px-4 py-2 text-[#1f2937] font-medium">{item.quantity}</td>
                                    <td className="px-4 py-2 text-[#6b7280]">{item.remark || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && orders.length > 0 && (
        <div className="px-6 py-3 border-t border-[#e5e7eb] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6b7280]">每页显示:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
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
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-4 py-2 text-sm border border-[#d1d5db] rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f4f6] transition-colors"
            >
              上一页
            </button>
            <span className="text-sm text-[#4b5563]">
              第 {page} / {totalPages || 1} 页
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm border border-[#d1d5db] rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f4f6] transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
