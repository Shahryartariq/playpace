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
  const verification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
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
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    ...(verification ? { verification: { google: verification } } : {}),
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
