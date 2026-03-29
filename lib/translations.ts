'use client';

import { createContext, useContext } from 'react';
import type { Locale } from './types';
import heMessages from '@/messages/he.json';
import enMessages from '@/messages/en.json';

const messages: Record<Locale, typeof heMessages> = {
  he: heMessages,
  en: enMessages,
};

export type Messages = typeof heMessages;

// Simple nested key access
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

export function getTranslations(locale: Locale) {
  const msg = messages[locale];
  return function t(key: string): string {
    return getNestedValue(msg as unknown as Record<string, unknown>, key);
  };
}

export const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}>({
  locale: 'he',
  setLocale: () => {},
  t: (key: string) => key,
});

export function useTranslation() {
  return useContext(LocaleContext);
}
