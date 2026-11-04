import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { defaultLocale, isLocale, localeInfo, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import type { Dictionary } from '@/i18n/types';
import { atSpeed, combine, computeTotals, normalizeSelection } from '@/lib/calc';
import { fill, formatDuration, formatSpeed, plural } from '@/lib/format';
import { loadList } from '@/lib/server/lists';
import { chargeUnits, clientIp } from '@/lib/server/rate-limit';
import { readShareQuery } from '@/lib/share';

export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };
const INK = '#12142B';
const PAPER = '#F4F5FA';
const ACCENT = '#3442F5';
const ACCENT_2 = '#8B93FF';
const MINT = '#7CF2BC';

type FontWeight = 500 | 800;

let fontsPromise: Promise<{ name: string; data: Buffer; weight: FontWeight; style: 'normal' }[]> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all(
    (['latin', 'latin-ext', 'cyrillic'] as const).flatMap((subset) =>
      ([500, 800] as const).map(async (weight) => ({
        name: 'Onest',
        data: await readFile(join(process.cwd(), 'assets/fonts', `onest-${subset}-${weight}-normal.woff`)),
        weight,
        style: 'normal' as const,
      })),
    ),
  );
  return fontsPromise;
}

/** The bundled font only covers Latin and Cyrillic; other scripts fall back to English text. */
const DRAWABLE = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]*$/u;
const drawable = (text: string) => DRAWABLE.test(text);

function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : text;
}

/** Decorative strip: blocks of a made-up playlist, and the same blocks squeezed to 2×. */
function Strip({ widths, scale, color, muted }: { widths: number[]; scale: number; color: string; muted: string }) {
  return (
    <div style={{ display: 'flex', width: 1040 * scale, height: 36, gap: 4 }}>
      {widths.map((w, i) => (
        <div key={i} style={{ display: 'flex', flexGrow: w, height: 36, borderRadius: 6, background: i % 2 ? muted : color }} />
      ))}
    </div>
  );
}

const BLOCKS = [8, 5, 11, 4, 7, 9, 3, 6, 10, 5, 7, 4];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 80px 64px',
        background: INK,
        color: PAPER,
        fontFamily: 'Onest',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 13, borderRadius: 16, background: ACCENT }}>
          <div style={{ width: 30, height: 8, borderRadius: 4, background: '#fff' }} />
          <div style={{ width: 21, height: 8, borderRadius: 4, background: '#fff' }} />
          <div style={{ width: 11, height: 8, borderRadius: 4, background: MINT }} />
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>Playpace</div>
      </div>
      {children}
    </div>
  );
}

function textFor(locale: Locale): { dict: Dictionary; locale: Locale } {
  return localeInfo[locale].ogScript ? { dict: getDictionary(locale), locale } : { dict: getDictionary(defaultLocale), locale: defaultLocale };
}

async function sharedCard(params: URLSearchParams, locale: Locale, ip: string) {
  const shared = readShareQuery(params);
  if (!shared) return null;
  // At most three lists on a preview image; lookups are charged to the requester like on the page.
  const lists = await Promise.all(
    shared.sources.slice(0, 3).map(async (source) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 8000);
      });
      try {
        return await Promise.race([loadList(source, { charge: (units) => chargeUnits(ip, units) }), timeout]);
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  const loaded = lists.filter((l): l is NonNullable<typeof l> => !!l);
  if (!loaded.length) return null;

  const { dict, locale: textLocale } = textFor(locale);
  const tag = localeInfo[textLocale].tag;
  const items = combine(loaded);
  const totals = computeTotals(items, normalizeSelection(shared.selection, items.length));
  const speed = shared.speed === 1 ? 2 : shared.speed;
  const rawTitle = loaded.map((l) => l.meta.title).join(' + ');
  const title = drawable(rawTitle) ? clip(rawTitle, 70) : 'YouTube';
  const dur = (s: number) => formatDuration(s, dict.units, tag, false);

  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 38, fontWeight: 500, color: '#C9CCF0', lineHeight: 1.25 }}>{title}</div>
        <div style={{ fontSize: 136, fontWeight: 800, letterSpacing: -5, lineHeight: 1 }}>{dur(totals.seconds)}</div>
        <div style={{ display: 'flex', gap: 28, fontSize: 40, fontWeight: 500 }}>
          <span style={{ color: MINT }}>{`${fill(dict.results.atSpeed, { speed: formatSpeed(speed, tag) })}: ${dur(atSpeed(totals.seconds, speed))}`}</span>
          <span style={{ color: '#9EA3D1' }}>{plural(dict.plurals.videos, totals.counted, tag)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Strip widths={BLOCKS} scale={1} color={ACCENT} muted={ACCENT_2} />
        <Strip widths={BLOCKS} scale={1 / speed} color={MINT} muted="#3FD196" />
      </div>
    </Frame>
  );
}

function defaultCard(locale: Locale, page: string | null) {
  const { dict } = textFor(locale);
  const headline = page === 'speed' ? dict.speedPage.h1 : dict.hero.h1;
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1.04, maxWidth: 1000 }}>{headline}</div>
        <div style={{ fontSize: 36, fontWeight: 500, color: '#C9CCF0', maxWidth: 980 }}>{dict.meta.ogTagline}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Strip widths={BLOCKS} scale={1} color={ACCENT} muted={ACCENT_2} />
        <Strip widths={BLOCKS} scale={0.5} color={MINT} muted="#3FD196" />
      </div>
    </Frame>
  );
}

/** GET /api/og?l=es — the page's share image; with ?q=… it shows that result's numbers. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const l = params.get('l');
  const locale: Locale = isLocale(l) ? l : defaultLocale;
  const fonts = await loadFonts();

  let element = null;
  let maxAge = 86_400;
  if (params.get('q')) {
    element = await sharedCard(params, locale, clientIp(request.headers)).catch(() => null);
    maxAge = element ? 3_600 : 300;
  }
  element ??= defaultCard(locale, params.get('p'));

  return new ImageResponse(element, {
    ...SIZE,
    fonts,
    headers: { 'cache-control': `public, max-age=${Math.min(maxAge, 3600)}, s-maxage=${maxAge}, stale-while-revalidate=86400` },
  });
}
