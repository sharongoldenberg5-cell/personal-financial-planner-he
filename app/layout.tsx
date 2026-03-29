'use client';

import { useState, useMemo, useEffect } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import type { Locale } from '@/lib/types';
import { getDirection } from '@/lib/i18n';
import { getTranslations, LocaleContext } from '@/lib/translations';
import { Sidebar } from '@/components/dashboard/Sidebar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>('he');
  const direction = getDirection(locale);
  const t = useMemo(() => getTranslations(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    document.title = t('app.title');
  }, [locale, direction, t]);

  const contextValue = useMemo(() => ({
    locale,
    setLocale,
    t,
  }), [locale, t]);

  return (
    <html
      lang="he"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex bg-background">
        <LocaleContext.Provider value={contextValue}>
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-auto">
            <header className="py-3 border-b border-border bg-surface/50 flex justify-center">
              <div className="flex items-center gap-5 justify-center">
                <img src="/captain.png" alt="Logo" className="h-28" />
                <div>
                  <h1 className="text-3xl font-bold text-primary">{t('app.title')}</h1>
                  <p className="text-sm text-text-light">{t('app.subtitle')}</p>
                </div>
              </div>
            </header>
            <main className="flex-1 p-6">
              {children}
            </main>
            <footer className="p-4 border-t border-border bg-surface/50">
              <div className="max-w-4xl mx-auto">
                <p className="text-xs font-semibold text-text-light mb-1">{t('app.disclaimer')}</p>
                <p className="text-[11px] text-text-light leading-relaxed">
                  {t('app.disclaimerFull')}
                </p>
              </div>
            </footer>
          </div>
        </LocaleContext.Provider>
      </body>
    </html>
  );
}
