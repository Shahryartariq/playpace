import Link from 'next/link';
import { localePath, type Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { LocaleList, NavLink } from './LocaleLinks';
import { LogoMark } from './Logo';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  locale: Locale;
  dict: Dictionary;
  path: string;
}

export function SiteHeader({ locale, dict, path }: Props) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href={localePath(locale)} className="brand" aria-label={`Playpace, ${dict.nav.home}`}>
          <LogoMark />
          <span className="brand__name">Playpace</span>
        </Link>
        <nav className="site-nav" aria-label="Playpace">
          <NavLink locale={locale} path="/speed-calculator" className="site-nav__link">
            {dict.nav.speedCalculator}
          </NavLink>
          <details className="lang-menu">
            <summary className="icon-button" aria-label={`${dict.nav.language} ${locale.toUpperCase()}`} title={dict.nav.language}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-8.5 9h17M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"
                />
              </svg>
              <span className="lang-menu__code">{locale.toUpperCase()}</span>
            </summary>
            <ul className="lang-menu__list" role="list">
              <LocaleList current={locale} fallbackPath={path} itemClassName="lang-menu__item" />
            </ul>
          </details>
          <ThemeToggle
            labels={{
              theme: dict.nav.theme,
              light: dict.nav.themeLight,
              dark: dict.nav.themeDark,
              system: dict.nav.themeSystem,
            }}
          />
        </nav>
      </div>
    </header>
  );
}
