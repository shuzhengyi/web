'use client';

import { useState, useEffect, useCallback } from 'react';
import { OutboundOrder, OutboundItem, ParseRule } from '@/generated/prisma/client';
import RuleManager from '@/components/RuleManager';
import FileImporter from '@/components/FileImporter';
import OutboundTable from '@/components/OutboundTable';

export default function OutboundPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'list' | 'rules'>('import');
  const [orders, setOrders] = useState<(OutboundOrder & { items: OutboundItem[] })[]>([]);
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  
  // 查询条件
  const [externalCode, setExternalCode] = useState('');
  const [receiverInfo, setReceiverInfo] = useState('');
  const [status, setStatus] = useState('');
  const [createdAtStart, setCreatedAtStart] = useState('');
  const [createdAtEnd, setCreatedAtEnd] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(externalCode && { externalCode }),
        ...(receiverInfo && { receiverInfo }),
        ...(status && { status }),
        ...(createdAtStart && { createdAtStart }),
        ...(createdAtEnd && { createdAtEnd }),
      });
      const res = await fetch(`/api/outbound-orders?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('获取出库单失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, externalCode, receiverInfo, status, createdAtStart, createdAtEnd]);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/parse-rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.rules);
      }
    } catch (error) {
      console.error('获取规则失败:', error);
    }
  }, []);

  useEffect(() => {
    // 始终获取规则列表（用于导入功能）
    fetchRules();
    
    if (activeTab === 'list') {
      fetchOrders();
    }
  }, [activeTab, fetchOrders, fetchRules]);

  const handleImportComplete = useCallback(() => {
    setActiveTab('list');
    fetchOrders();
  }, [fetchOrders]);

  const handleSearch = () => {
    setPage(1);
    fetchOrders();
  };

  const handleReset = () => {
    setExternalCode('');
    setReceiverInfo('');
    setStatus('');
    setCreatedAtStart('');
    setCreatedAtEnd('');
    setPage(1);
    setTimeout(() => fetchOrders(), 0);
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <header className="bg-white border-b border-[#e5e7eb] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-bold text-[#1f2937]">出库单管理</h1>
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
            出库单列表
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-md ${
              activeTab === 'rules'
                ? 'border-[#0fc6c2] text-[#0fc6c2] bg-white'
                : 'border-transparent text-[#6b7280] hover:text-[#374151] hover:bg-[#f3f4f6]'
            }`}
          >
            解析规则
          </button>
        </div>

        {activeTab === 'import' && (
          <FileImporter 
            rules={rules} 
            onImportComplete={handleImportComplete}
            onRefreshRules={fetchRules}
          />
        )}

        {activeTab === 'list' && (
          <div className="space-y-4">
            {/* 查询条件 */}
            <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db] p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6b7280] mb-1">外部单号</label>
                  <input
                    type="text"
                    value={externalCode}
                    onChange={(e) => setExternalCode(e.target.value)}
                    placeholder="请输入外部单号"
                    className="w-full px-3 py-2 text-sm border border-[#d1d5db] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b7280] mb-1">收货信息</label>
                  <input
                    type="text"
                    value={receiverInfo}
                    onChange={(e) => setReceiverInfo(e.target.value)}
                    placeholder="门店/收货人/电话"
                    className="w-full px-3 py-2 text-sm border border-[#d1d5db] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b7280] mb-1">状态</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#d1d5db] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2] bg-white"
                  >
                    <option value="">全部</option>
                    <option value="pending">待处理</option>
                    <option value="processing">处理中</option>
                    <option value="completed">已完成</option>
                    <option value="cancelled">已取消</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b7280] mb-1">创建时间（起）</label>
                  <input
                    type="date"
                    value={createdAtStart}
                    onChange={(e) => setCreatedAtStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#d1d5db] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b7280] mb-1">创建时间（止）</label>
                  <input
                    type="date"
                    value={createdAtEnd}
                    onChange={(e) => setCreatedAtEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#d1d5db] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0fc6c2] focus:border-[#0fc6c2]"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSearch}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  查询
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#6b7280] bg-white border border-[#d1d5db] rounded-md hover:bg-[#f9fafb] transition-colors"
                >
                  重置
                </button>
              </div>
            </div>
            <OutboundTable
              orders={orders}
              total={total}
              page={page}
              pageSize={pageSize}
              loading={loading}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onRefresh={fetchOrders}
            />
          </div>
        )}

        {activeTab === 'rules' && (
          <RuleManager
            rules={rules}
            onRefresh={fetchRules}
          />
        )}
      </main>
    </div>
  );
}
