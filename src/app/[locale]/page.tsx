import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isLocale, localeInfo, localePath, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { Calculator } from '@/components/calculator/Calculator';
import { JsonLd } from '@/components/JsonLd';
import { atSpeed } from '@/lib/calc';
import { examples } from '@/lib/examples';
import { formatDuration, formatSpeed } from '@/lib/format';
import { pageMetadata, personLd, webPageLd, websiteLd } from '@/lib/seo';
import { readShareQuery, shareQuery } from '@/lib/share';
import { absoluteUrl, sampleDataEnabled, SITE_NAME } from '@/lib/site';

const REFERENCE_HOURS = [1, 2, 5, 10, 24, 50, 100];
const REFERENCE_SPEEDS = [1.25, 1.5, 1.75, 2, 2.5, 3];

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const shared = readShareQuery(await searchParams);
  // A shared result gets a preview image with its own numbers; the page itself stays canonical.
  const og = shared ? `/api/og?l=${locale}&${shareQuery(shared)}` : `/api/og?l=${locale}`;
  return pageMetadata({
    locale,
    path: '/',
    title: dict.meta.title,
    description: dict.meta.description,
    ogImage: og,
    ogAlt: dict.meta.ogAlt,
    absoluteTitle: true,
  });
}

function structuredData(locale: Locale) {
  const dict = getDictionary(locale);
  const url = absoluteUrl(localePath(locale));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      websiteLd(localeInfo[locale].tag),
      personLd(),
      ...webPageLd({
        locale,
        path: '/',
        name: dict.meta.title,
        description: dict.meta.description,
        image: `/api/og?l=${locale}`,
        mainEntity: `${url}#app`,
      }),
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: SITE_NAME,
        url,
        description: dict.meta.description,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        inLanguage: localeInfo[locale].tag,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@id': `${absoluteUrl('/')}#author` },
        isPartOf: { '@id': `${absoluteUrl('/')}#website` },
        image: absoluteUrl(`/api/og?l=${locale}`),
        screenshot: absoluteUrl(`/api/og?l=${locale}`),
        featureList: dict.content.featureList,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage: localeInfo[locale].tag,
        mainEntity: dict.content.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };
}

export default async function HomePage({ params, searchParams }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const tag = localeInfo[locale].tag;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const initial = readShareQuery(await searchParams);
  const dur = (seconds: number) => formatDuration(seconds, dict.units, tag, false);

  return (
    <main id="main">
      {/* Thumbnails load from YouTube's image server once results appear. */}
      <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous" />
      <JsonLd data={structuredData(locale)} nonce={nonce} />
      <div className="container hero">
        <h1 className="hero__title">{dict.hero.h1}</h1>
        <p className="hero__lead">{dict.hero.lead}</p>
        <noscript>
          <p className="alert">{dict.noscript}</p>
        </noscript>
        <Calculator
          ui={{
            form: dict.form,
            progress: dict.progress,
            errors: dict.errors,
            results: dict.results,
            fit: dict.fit,
            planner: dict.planner,
            list: dict.list,
            actions: dict.actions,
            csv: dict.csv,
            units: dict.units,
            plurals: dict.plurals,
          }}
          tag={tag}
          examples={examples(sampleDataEnabled())}
          initial={initial}
        />
      </div>

      <section className="container section section--deferred" aria-labelledby="reference-heading">
        <h2 id="reference-heading" className="section__title">
          {dict.content.referenceHeading}
        </h2>
        <p className="section__intro">{dict.content.referenceIntro}</p>
        <div className="table-scroll" role="region" aria-labelledby="reference-heading" tabIndex={0}>
          <table className="data-table data-table--reference">
            <thead>
              <tr>
                <th scope="col">{dict.content.referenceLength}</th>
                {REFERENCE_SPEEDS.map((s) => (
                  <th key={s} scope="col">
                    {formatSpeed(s, tag)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REFERENCE_HOURS.map((h) => (
                <tr key={h}>
                  <th scope="row">{dur(h * 3600)}</th>
                  {REFERENCE_SPEEDS.map((s) => (
                    <td key={s}>{dur(atSpeed(h * 3600, s))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cross-link">
          {dict.content.toSpeed} <Link href={localePath(locale, '/speed-calculator')}>{dict.speedPage.h1}</Link>
        </p>
      </section>

      <section className="container section section--deferred" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="section__title">
          {dict.content.faqHeading}
        </h2>
        <div className="faq">
          {dict.content.faq.map((item) => (
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
