import Link from 'next/link';
import { localePath, type Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { AUTHOR, REPO_URL } from '@/lib/site';
import { LocaleList } from './LocaleLinks';
import { LogoMark } from './Logo';

interface Props {
  locale: Locale;
  dict: Dictionary;
  path: string;
}

export function SiteFooter({ locale, dict, path }: Props) {
  const [before, after = ''] = dict.footer.madeBy.split('{name}');
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__about">
          <p className="brand brand--small">
            <LogoMark size={22} />
            <span className="brand__name">Playpace</span>
          </p>
          <p>{dict.footer.tagline}</p>
          <p>
            {before}
            <a href={AUTHOR.url} rel="author">
              {AUTHOR.name}
            </a>
            {after}
          </p>
        </div>
        <nav aria-label={dict.nav.home} className="site-footer__links">
          <ul role="list">
            <li>
              <Link href={localePath(locale)}>{dict.nav.home}</Link>
            </li>
            <li>
              <Link href={localePath(locale, '/speed-calculator')}>{dict.nav.speedCalculator}</Link>
            </li>
            <li>
              <Link href={localePath(locale, '/privacy')}>{dict.nav.privacy}</Link>
            </li>
            <li>
              <a href={REPO_URL}>{dict.footer.source}</a>
            </li>
          </ul>
        </nav>
        <nav aria-label={dict.footer.languages} className="site-footer__langs">
          <ul role="list">
            <LocaleList current={locale} fallbackPath={path} />
          </ul>
        </nav>
      </div>
      <div className="container site-footer__legal">
        <p>
          {dict.footer.apiNote}{' '}
          <a href="https://www.youtube.com/t/terms">{dict.footer.ytTerms}</a>
          {', '}
          <a href="https://policies.google.com/privacy">{dict.footer.googlePrivacy}</a>
        </p>
      </div>
    </footer>
  );
}
