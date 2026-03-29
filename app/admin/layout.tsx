'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UserCog, Settings, Shield } from 'lucide-react';

const adminNav = [
  { key: 'dashboard', href: '/admin', icon: LayoutDashboard, label: 'דשבורד' },
  { key: 'leads', href: '/admin/leads', icon: Users, label: 'לידים' },
  { key: 'advisors', href: '/admin/advisors', icon: UserCog, label: 'יועצים' },
  { key: 'settings', href: '/admin/settings', icon: Settings, label: 'הגדרות' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Admin Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Shield size={22} className="text-yellow-400" />
            <span className="font-bold text-lg">קפטן פיננסי</span>
            <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded">ADMIN</span>
          </div>
          <nav className="flex gap-1">
            {adminNav.map(item => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">חזרה לאתר ←</Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
