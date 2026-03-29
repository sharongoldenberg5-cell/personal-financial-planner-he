import type { Locale } from './types';

export const locales: Locale[] = ['he', 'en'];
export const defaultLocale: Locale = 'he';

export function isRtl(locale: Locale): boolean {
  return locale === 'he';
}

export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}
