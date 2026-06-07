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

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
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
  }, [page, pageSize]);

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
