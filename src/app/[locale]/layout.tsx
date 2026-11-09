import '../globals.css';

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { preload } from 'react-dom';
import { isLocale, localeInfo, locales } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { gaMeasurementId, siteUrl } from '@/lib/site';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F5FA' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0F1F' },
  ],
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** Every page uses Onest's Latin file (digits, "YouTube", ×); other files are preloaded only where needed. */
const LATIN_FONT = '/fonts/onest-latin-var.woff2';
const SCRIPT_FONT: Partial<Record<string, string>> = {
  ru: '/fonts/onest-cyrillic-var.woff2',
  ur: '/fonts/noto-nastaliq-urdu-400.woff2',
  ar: '/fonts/noto-sans-arabic-var.woff2',
  hi: '/fonts/noto-sans-devanagari-var.woff2',
};

/** Applies the saved theme before the first paint so dark mode never flashes light. */
const THEME_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem('playpace:theme')||'"system"');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const info = localeInfo[locale];
  const dict = getDictionary(locale);
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const path = (await headers()).get('x-playpace-path') ?? '/';
  const ga = gaMeasurementId();
  const scriptFont = SCRIPT_FONT[locale];
  preload(LATIN_FONT, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  if (scriptFont) preload(scriptFont, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });

  return (
    <html lang={info.tag} dir={info.dir} suppressHydrationWarning>
      <head>
        {/*
          Browser extensions can add their own <script> to <head> before React hydrates, and React may
          then match it to one of these inline scripts. They have already run by then, so it's harmless.
        */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {ga ? (
          <>
            <script nonce={nonce} async src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} />
            <script
              nonce={nonce}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}',{anonymize_ip:true});`,
              }}
            />
          </>
        ) : null}
      </head>
      <body>
        <a className="skip-link" href="#main">
          {dict.nav.skip}
        </a>
        <SiteHeader locale={locale} dict={dict} path={path} />
        {children}
        <SiteFooter locale={locale} dict={dict} path={path} />
      </body>
    </html>
  );
}
