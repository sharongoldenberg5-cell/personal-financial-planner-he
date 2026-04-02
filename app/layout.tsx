'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>('he');
  const direction = getDirection(locale);
  const t = useMemo(() => getTranslations(locale), [locale]);
  const isAuthPage = pathname?.startsWith('/auth') || pathname?.startsWith('/quiz') || pathname?.startsWith('/admin');

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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta property="og:title" content="קפטן פיננסי" />
        <meta property="og:description" content="מנווטים את הדרך הפיננסית שלך" />
        <meta property="og:image" content="https://personal-financial-planner-he.vercel.app/og-image.jpg" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://personal-financial-planner-he.vercel.app/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="קפטן פיננסי" />
        <meta name="twitter:description" content="מנווטים את הדרך הפיננסית שלך" />
        <meta name="twitter:image" content="https://personal-financial-planner-he.vercel.app/og-image.jpg" />
      </head>
      <body className="min-h-screen flex bg-background">
        <LocaleContext.Provider value={contextValue}>
          {isAuthPage ? (
            <div className="flex-1">{children}</div>
          ) : (
            <>
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-auto">
                <main className="flex-1 p-3 pt-14 lg:p-6 lg:pt-6">
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
            </>
          )}
        </LocaleContext.Provider>
      </body>
    </html>
  );
}
