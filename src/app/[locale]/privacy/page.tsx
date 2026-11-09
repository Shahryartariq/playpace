import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isLocale, localeInfo } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { JsonLd } from '@/components/JsonLd';
import { pageMetadata, personLd, webPageLd, websiteLd } from '@/lib/seo';
import { REPO_URL } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/privacy',
    title: `${dict.meta.privacyTitle} | Playpace`,
    description: dict.meta.privacyDescription,
    ogImage: `/api/og?l=${locale}`,
    ogAlt: dict.meta.ogAlt,
    absoluteTitle: true,
  });
}

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const sections = dict.privacy.sections;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <main id="main" className="container prose">
      <JsonLd
        nonce={nonce}
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            websiteLd(localeInfo[locale].tag),
            personLd(),
            ...webPageLd({
              locale,
              path: '/privacy',
              name: `${dict.meta.privacyTitle} | Playpace`,
              description: dict.meta.privacyDescription,
              image: `/api/og?l=${locale}`,
              trail: [[dict.meta.privacyTitle, '/privacy']],
            }),
          ],
        }}
      />
      <h1 className="hero__title">{dict.privacy.h1}</h1>
      <p className="prose__updated">{dict.privacy.updated}</p>
      <p className="hero__lead">{dict.privacy.intro}</p>
      {sections.map((section, i) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {i === 1 ? (
            <p>
              <a href="https://www.youtube.com/t/terms">{dict.footer.ytTerms}</a>
              {', '}
              <a href="https://policies.google.com/privacy">{dict.footer.googlePrivacy}</a>
            </p>
          ) : null}
          {i === sections.length - 1 ? (
            <p>
              <a href={`${REPO_URL}/issues`}>{`${REPO_URL.replace('https://', '')}/issues`}</a>
            </p>
          ) : null}
        </section>
      ))}
    </main>
  );
}
