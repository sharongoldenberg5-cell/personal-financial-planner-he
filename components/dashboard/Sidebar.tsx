'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/translations';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  User,
  Wallet,
  CreditCard,
  Building,
  Shield,
  Upload,
  Target,
  Lightbulb,
  Globe,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard },
  { key: 'profile', href: '/profile', icon: User },
  { key: 'assets', href: '/assets', icon: Wallet },
  { key: 'liabilities', href: '/liabilities', icon: CreditCard },
  { key: 'pension', href: '/pension', icon: Shield },
  { key: 'mortgage', href: '/mortgage', icon: Building },
  { key: 'upload', href: '/upload', icon: Upload },
  { key: 'goals', href: '/goals', icon: Target },
  { key: 'recommendations', href: '/recommendations', icon: Lightbulb },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-border flex flex-col items-center gap-2">
        <img src="/captain.png" alt="Logo" className="max-w-[90px]" />
        <div className="text-center">
          <h1 className="text-lg font-bold text-primary leading-tight">{t('app.title')}</h1>
          <p className="text-[10px] text-text-light">{t('app.subtitle')}</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ key, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={key}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-text-light hover:bg-primary/10 hover:text-primary'
              )}
            >
              <Icon size={20} />
              <span>{t(`nav.${key}`)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={() => setLocale(locale === 'he' ? 'en' : 'he')}
          className="flex items-center gap-2 px-4 py-2 w-full rounded-lg text-sm text-text-light hover:bg-primary/10 hover:text-primary transition-colors"
        >
          <Globe size={18} />
          <span>{locale === 'he' ? 'English' : 'עברית'}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 start-3 z-50 p-2 bg-surface rounded-lg shadow-md border border-border"
      >
        <Menu size={24} className="text-primary" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar (slide in) */}
      <aside className={cn(
        'lg:hidden fixed top-0 start-0 h-full w-72 bg-surface border-e border-border shadow-xl z-50 flex flex-col transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
      )}>
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 end-3 p-1 text-text-light hover:text-text"
        >
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar (always visible) */}
      <aside className="hidden lg:flex w-64 bg-surface border-e border-border min-h-screen flex-col shadow-sm">
        {sidebarContent}
      </aside>
    </>
  );
}
