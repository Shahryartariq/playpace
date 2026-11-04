'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localeInfo, localePath, locales, splitLocale, type Locale } from '@/i18n/config';

/** Pages that exist in every language; anything else (a 404) links languages to their home page. */
const KNOWN_PATHS = new Set(['/', '/speed-calculator', '/privacy']);

/** The current page without its language prefix, following in-app navigation. */
function useSamePage(fallback: string): string {
  const pathname = usePathname();
  const rest = pathname ? splitLocale(pathname).rest : fallback;
  return KNOWN_PATHS.has(rest) ? rest : '/';
}

interface ListProps {
  current: Locale;
  fallbackPath: string;
  itemClassName?: string;
}

/** Links to this page in every language. Plain <a> so the page reloads with the right <html lang> and direction. */
export function LocaleList({ current, fallbackPath, itemClassName }: ListProps) {
  const page = useSamePage(fallbackPath);
  return (
    <>
      {locales.map((l) => (
        <li key={l}>
          <a
            href={localePath(l, page)}
            hrefLang={localeInfo[l].tag}
            lang={localeInfo[l].tag}
            dir={localeInfo[l].dir}
            aria-current={l === current ? 'true' : undefined}
            className={itemClassName}
          >
            {localeInfo[l].name}
          </a>
        </li>
      ))}
    </>
  );
}

interface NavLinkProps {
  locale: Locale;
  path: string;
  className?: string;
  children: React.ReactNode;
}

/** A link that marks itself as the current page. */
export function NavLink({ locale, path, className, children }: NavLinkProps) {
  const pathname = usePathname();
  const current = pathname ? splitLocale(pathname).rest === path : false;
  return (
    <Link href={localePath(locale, path)} className={className} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}
