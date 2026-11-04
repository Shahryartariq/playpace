import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, splitLocale } from './i18n/config';

const GA_ID = /^G-[A-Z0-9]{4,16}$/;

function contentSecurityPolicy(nonce: string, dev: boolean): string {
  const ga = GA_ID.test(process.env.GA_MEASUREMENT_ID?.trim() ?? '');
  const gaScript = ga ? ' https://www.googletagmanager.com' : '';
  const gaConnect = ga
    ? ' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com'
    : '';
  const gaImg = ga ? ' https://*.google-analytics.com https://www.googletagmanager.com' : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${gaScript}${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    `img-src 'self' data: blob: https://i.ytimg.com https://yt3.ggpht.com${gaImg}`,
    "font-src 'self'",
    `connect-src 'self'${gaConnect}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

/**
 * - English pages live at the root (/, /speed-calculator); other languages under /es, /ur, …
 *   Internally every page is rendered from /[locale]/…, so root paths are rewritten to /en/….
 * - /en/… redirects to the root form so each page has one address.
 * - Every page gets a fresh CSP nonce.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale, rest, explicit } = splitLocale(pathname);

  if (explicit && locale === defaultLocale) {
    const url = request.nextUrl.clone();
    url.pathname = rest;
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  headers.set('x-playpace-locale', locale);
  headers.set('x-playpace-path', rest);

  let response: NextResponse;
  if (explicit) {
    response = NextResponse.next({ request: { headers } });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers } });
  }
  response.headers.set('content-security-policy', csp);
  response.headers.set('content-language', locale);
  return response;
}

export const config = {
  matcher: [
    // Pages only: skip the API, Next's own files and anything with a file extension (icons, sitemap, robots…).
    '/((?!api/|_next/|_vercel/|.*\\.[\\w]+$).*)',
  ],
};
