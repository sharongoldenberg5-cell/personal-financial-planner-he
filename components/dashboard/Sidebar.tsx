'use client';

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

  return (
    <aside className="w-64 bg-surface border-e border-border min-h-screen flex flex-col shadow-sm">
      <div className="p-4 border-b border-border flex flex-col items-center gap-2">
        <img src="/captain.png" alt="Logo" className="max-w-[140px]" />
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
    </aside>
  );
}
