'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MenuItem {
  id: string;
  label: string;
  href: string;
}

const menuItems: MenuItem[] = [
  { id: 'waybill', label: '运单管理', href: '/' },
  { id: 'outbound', label: '出库单管理', href: '/outbound' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const getActiveItem = () => {
    if (pathname === '/') return 'waybill';
    if (pathname?.startsWith('/outbound')) return 'outbound';
    return null;
  };

  const activeItem = getActiveItem();

  return (
    <aside className="w-64 bg-[#0d1117] text-[#c9d1d9] min-h-screen flex flex-col border-r border-[#30363d]">
      <div className="px-6 py-5 border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0fc6c2] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">物流订单系统</h1>
            <p className="text-xs text-[#8b949e]">Logistics Order</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = activeItem === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-[#0fc6c2] text-white shadow-[0 2px 8px rgba(15, 198, 194, 0.3)]'
                    : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
                }`}
              >
                <span className="w-5 h-5 flex items-center justify-center mr-3">
                  {item.id === 'waybill' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                  {item.id === 'outbound' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  )}
                </span>
                {item.label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      
      <div className="px-6 py-4 border-t border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center">
            <svg className="w-5 h-5 text-[#8b949e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">管理员</p>
            <p className="text-xs text-[#8b949e]">admin@system.com</p>
          </div>
          <button className="p-1 hover:bg-[#21262d] rounded-lg transition-colors">
            <svg className="w-5 h-5 text-[#8b949e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
