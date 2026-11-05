import Link from 'next/link';
import { headers } from 'next/headers';
import { isLocale, localePath, defaultLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n';

export default async function NotFound() {
  const raw = (await headers()).get('x-playpace-locale');
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  return (
    <main id="main" className="container not-found">
      <title>{`${dict.meta.notFoundTitle} | Playpace`}</title>
      <p className="not-found__code" aria-hidden="true">
        404
      </p>
      <h1 className="hero__title">{dict.notFound.h1}</h1>
      <p className="hero__lead">{dict.notFound.text}</p>
      <p>
        <Link className="button button--primary" href={localePath(locale)}>
          {dict.notFound.home}
        </Link>
      </p>
    </main>
  );
}
