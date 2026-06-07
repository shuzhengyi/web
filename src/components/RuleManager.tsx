'use client';

import { useState } from 'react';
import { ParseRule } from '@/generated/prisma/client';
import RuleEditor from './RuleEditor';

interface RuleManagerProps {
  rules: ParseRule[];
  onRefresh: () => void;
}

export default function RuleManager({ rules, onRefresh }: RuleManagerProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<ParseRule | null>(null);

  const handleCreate = () => {
    setEditingRule(null);
    setShowEditor(true);
  };

  const handleEdit = (rule: ParseRule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个规则吗？')) return;

    try {
      const res = await fetch(`/api/parse-rules/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
      }
    } catch (error) {
      console.error('删除规则失败:', error);
    }
  };

  const handleCopy = async (rule: ParseRule) => {
    try {
      const res = await fetch('/api/parse-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${rule.name} (副本)`,
          description: rule.description,
          fileType: rule.fileType,
          config: rule.config,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
      }
    } catch (error) {
      console.error('复制规则失败:', error);
    }
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingRule(null);
  };

  const handleSaveComplete = () => {
    handleEditorClose();
    onRefresh();
  };

  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#d1d5db]">
      <div className="px-6 py-4 border-b border-[#e5e7eb] flex justify-between items-center">
        <h2 className="text-lg font-semibold text-[#1f2937]">解析规则</h2>
        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0fc6c2] border border-transparent rounded-md hover:bg-[#0dafab] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0fc6c2] shadow-sm transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建规则
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#e5e7eb]">
          <thead className="bg-[#f9fafb]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                规则名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                文件类型
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
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-[#f9fafb] transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-[#1f2937]">{rule.name}</div>
                  {rule.description && (
                    <div className="text-sm text-[#6b7280]">{rule.description}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-[#6b7280]">
                  {rule.fileType === 'excel' ? 'Excel' : 'PDF'}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(rule.isActive)}`}>
                    {rule.isActive ? '启用' : '禁用'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#6b7280]">
                  {new Date(rule.createdAt).toLocaleString('zh-CN')}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="text-[#0fc6c2] hover:text-[#0dafab] transition-colors"
                    >
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        详情
                      </span>
                    </button>
                    <button
                      onClick={() => handleCopy(rule)}
                      className="text-[#6b7280] hover:text-[#374151] transition-colors"
                    >
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        复制
                      </span>
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-[#6b7280]">
                  暂无规则，请点击"新建规则"创建
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showEditor && (
        <RuleEditor
          rule={editingRule}
          mode={editingRule ? 'edit' : 'create'}
          onClose={handleEditorClose}
          onSaveComplete={handleSaveComplete}
        />
      )}
    </div>
  );
}
