export const locales = ['en', 'es', 'pt', 'fr', 'de', 'ru', 'tr', 'id', 'hi', 'ur', 'ar', 'ja'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

interface LocaleInfo {
  /** Name of the language in that language, for the switcher. */
  name: string;
  /** English name, for screen readers and the switcher's title. */
  englishName: string;
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag for Intl formatting and <html lang>. */
  tag: string;
  /** Open Graph locale. */
  og: string;
  /** Whether the Open Graph image font can draw this script (Latin and Cyrillic only). */
  ogScript: boolean;
}

export const localeInfo: Record<Locale, LocaleInfo> = {
  en: { name: 'English', englishName: 'English', dir: 'ltr', tag: 'en', og: 'en_US', ogScript: true },
  es: { name: 'Español', englishName: 'Spanish', dir: 'ltr', tag: 'es', og: 'es_ES', ogScript: true },
  pt: { name: 'Português', englishName: 'Portuguese', dir: 'ltr', tag: 'pt-BR', og: 'pt_BR', ogScript: true },
  fr: { name: 'Français', englishName: 'French', dir: 'ltr', tag: 'fr', og: 'fr_FR', ogScript: true },
  de: { name: 'Deutsch', englishName: 'German', dir: 'ltr', tag: 'de', og: 'de_DE', ogScript: true },
  ru: { name: 'Русский', englishName: 'Russian', dir: 'ltr', tag: 'ru', og: 'ru_RU', ogScript: true },
  tr: { name: 'Türkçe', englishName: 'Turkish', dir: 'ltr', tag: 'tr', og: 'tr_TR', ogScript: true },
  id: { name: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr', tag: 'id', og: 'id_ID', ogScript: true },
  hi: { name: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', tag: 'hi', og: 'hi_IN', ogScript: false },
  ur: { name: 'اردو', englishName: 'Urdu', dir: 'rtl', tag: 'ur', og: 'ur_PK', ogScript: false },
  ar: { name: 'العربية', englishName: 'Arabic', dir: 'rtl', tag: 'ar', og: 'ar_AR', ogScript: false },
  ja: { name: '日本語', englishName: 'Japanese', dir: 'ltr', tag: 'ja', og: 'ja_JP', ogScript: false },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Public path for a page in a locale. English lives at the root, others under /<locale>. */
export function localePath(locale: Locale, path = '/'): string {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return clean || '/';
  return `/${locale}${clean}`;
}

/** Splits a public pathname into its locale and the rest of the path. */
export function splitLocale(pathname: string): { locale: Locale; rest: string; explicit: boolean } {
  const [, first, ...others] = pathname.split('/');
  if (isLocale(first)) {
    const rest = `/${others.join('/')}`;
    return { locale: first, rest: rest === '/' ? '/' : rest.replace(/\/$/, ''), explicit: true };
  }
  return { locale: defaultLocale, rest: pathname || '/', explicit: false };
}
