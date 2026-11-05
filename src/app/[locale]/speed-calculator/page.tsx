import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isLocale, localeInfo, localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { JsonLd } from '@/components/JsonLd';
import { SpeedConverter } from '@/components/SpeedConverter';
import { pageMetadata, personLd, websiteLd } from '@/lib/seo';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]/speed-calculator'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/speed-calculator',
    title: dict.meta.speedTitle,
    description: dict.meta.speedDescription,
    ogImage: `/api/og?l=${locale}&p=speed`,
    ogAlt: dict.meta.ogAlt,
    absoluteTitle: true,
  });
}

export default async function SpeedPage({ params }: PageProps<'/[locale]/speed-calculator'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const tag = localeInfo[locale].tag;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = absoluteUrl(localePath(locale, '/speed-calculator'));

  return (
    <main id="main">
      <JsonLd
        nonce={nonce}
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            websiteLd(tag),
            personLd(),
            {
              '@type': 'WebApplication',
              name: dict.speedPage.h1,
              author: { '@id': `${absoluteUrl('/')}#author` },
              isPartOf: { '@id': `${absoluteUrl('/')}#website` },
              image: absoluteUrl(`/api/og?l=${locale}&p=speed`),
              url,
              description: dict.meta.speedDescription,
              applicationCategory: 'UtilitiesApplication',
              operatingSystem: 'Any',
              inLanguage: tag,
              isAccessibleForFree: true,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: SITE_NAME, item: absoluteUrl(localePath(locale)) },
                { '@type': 'ListItem', position: 2, name: dict.speedPage.h1, item: url },
              ],
            },
            {
              '@type': 'FAQPage',
              inLanguage: tag,
              mainEntity: dict.speedPage.faq.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ],
        }}
      />
      <div className="container hero">
        <h1 className="hero__title">{dict.speedPage.h1}</h1>
        <p className="hero__lead">{dict.speedPage.lead}</p>
        <SpeedConverter
          t={dict.speedPage}
          results={{ speedCol: dict.results.speedCol, timeCol: dict.results.timeCol, savedCol: dict.results.savedCol }}
          units={dict.units}
          tag={tag}
        />
        <p className="cross-link">
          {dict.speedPage.toPlaylist} <Link href={localePath(locale)}>{dict.speedPage.toPlaylistLink}</Link>
        </p>
      </div>
      <section className="container section" aria-labelledby="speed-faq">
        <h2 id="speed-faq" className="section__title">
          {dict.content.faqHeading}
        </h2>
        <div className="faq">
          {dict.speedPage.faq.map((item) => (
            <details key={item.q} className="faq__item">
              <summary>
                <h3 className="faq__q">{item.q}</h3>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
