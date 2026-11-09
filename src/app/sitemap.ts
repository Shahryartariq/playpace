import type { MetadataRoute } from 'next';
import { localeInfo, localePath, locales } from '@/i18n/config';
import { PAGE_DATES } from '@/lib/seo';
import { absoluteUrl } from '@/lib/site';

const PAGES = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/speed-calculator', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' as const },
];

/** Every page in every language, each listing its translations. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) => {
    const lastModified = new Date(PAGE_DATES[page.path]?.modified ?? '2026-11-05');
    const languages = Object.fromEntries([
      ...locales.map((l) => [localeInfo[l].tag, absoluteUrl(localePath(l, page.path))]),
      ['x-default', absoluteUrl(localePath('en', page.path))],
    ]);
    return locales.map((locale) => ({
      url: absoluteUrl(localePath(locale, page.path)),
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}
