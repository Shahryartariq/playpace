import type { Metadata } from 'next';
import { localeInfo, localePath, locales, type Locale } from '@/i18n/config';
import { absoluteUrl, AUTHOR, siteUrl, SITE_NAME } from './site';

/** hreflang alternates for a page path ("/", "/speed-calculator", …). */
export function alternates(locale: Locale, path: string): Metadata['alternates'] {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeInfo[l].tag] = absoluteUrl(localePath(l, path));
  languages['x-default'] = absoluteUrl(localePath('en', path));
  return { canonical: absoluteUrl(localePath(locale, path)), languages };
}

interface PageMeta {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  ogImage: string;
  ogAlt: string;
  /** Use the title as is, without " | Playpace". */
  absoluteTitle?: boolean;
}

export function pageMetadata({ locale, path, title, description, ogImage, ogAlt, absoluteTitle }: PageMeta): Metadata {
  const url = absoluteUrl(localePath(locale, path));
  const verification = searchVerification();
  return {
    metadataBase: new URL(siteUrl()),
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: alternates(locale, path),
    applicationName: SITE_NAME,
    authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
    creator: AUTHOR.name,
    publisher: SITE_NAME,
    category: 'utilities',
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url,
      title,
      description,
      locale: localeInfo[locale].og,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeInfo[l].og),
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogAlt, type: 'image/png' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: ogImage, alt: ogAlt }] },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
    ...(verification ? { verification } : {}),
  };
}

/** Ownership tags for Google Search Console, Bing Webmaster Tools and Yandex Webmaster, when set. */
function searchVerification(): Metadata['verification'] | null {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  const yandex = process.env.YANDEX_VERIFICATION?.trim();
  if (!google && !bing && !yandex) return null;
  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    ...(bing ? { other: { 'msvalidate.01': bing } } : {}),
  };
}

/** The site's author and publisher, shared by every page's structured data. */
export function personLd() {
  return {
    '@type': 'Person',
    '@id': `${absoluteUrl('/')}#author`,
    name: AUTHOR.name,
    url: AUTHOR.url,
    sameAs: [AUTHOR.url],
  };
}

export function websiteLd(inLanguage: string) {
  return {
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    name: SITE_NAME,
    alternateName: 'Playpace YouTube playlist length calculator',
    url: absoluteUrl('/'),
    inLanguage,
    publisher: { '@id': `${absoluteUrl('/')}#author` },
    image: absoluteUrl('/icon-512.png'),
  };
}

/** When each page's content last changed; shared by the sitemap and structured data. */
export const PAGE_DATES: Record<string, { published: string; modified: string }> = {
  '/': { published: '2026-11-05', modified: '2026-11-09' },
  '/speed-calculator': { published: '2026-11-05', modified: '2026-11-09' },
  '/privacy': { published: '2026-11-05', modified: '2026-11-05' },
};

interface WebPageLd {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  image: string;
  /** Breadcrumb trail after the home page, as [name, path] pairs. */
  trail?: [string, string][];
  /** The page's main thing, such as the calculator. */
  mainEntity?: string;
}

/** WebPage plus its BreadcrumbList, linked to the site, the author and the page's main entity. */
export function webPageLd({ locale, path, name, description, image, trail, mainEntity }: WebPageLd) {
  const url = absoluteUrl(localePath(locale, path));
  const dates = PAGE_DATES[path];
  const nodes: Record<string, unknown>[] = [
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name,
      description,
      inLanguage: localeInfo[locale].tag,
      isPartOf: { '@id': `${absoluteUrl('/')}#website` },
      author: { '@id': `${absoluteUrl('/')}#author` },
      primaryImageOfPage: { '@type': 'ImageObject', url: absoluteUrl(image), width: 1200, height: 630 },
      ...(dates ? { datePublished: dates.published, dateModified: dates.modified } : {}),
      ...(trail ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
      ...(mainEntity ? { mainEntity: { '@id': mainEntity } } : {}),
    },
  ];
  if (trail) {
    const items: [string, string][] = [[SITE_NAME, '/'], ...trail];
    nodes.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: items.map(([itemName, itemPath], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: itemName,
        item: absoluteUrl(localePath(locale, itemPath)),
      })),
    });
  }
  return nodes;
}
