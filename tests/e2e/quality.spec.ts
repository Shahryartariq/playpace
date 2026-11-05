import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { calculate, COURSE } from './helpers';

const BASE = 'https://getplaypace.vercel.app';

test.describe('accessibility (WCAG 2.1 AA)', () => {
  const pages = ['/', '/speed-calculator', '/privacy', '/ur', '/ja', '/nope'];
  for (const path of pages) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${path} in ${scheme} mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
      });
    }
  }

  test('results in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await calculate(page, COURSE);
    await page.locator('.video-row').first().getByRole('checkbox').check();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });
});

test.describe('SEO', () => {
  test('home page metadata, hreflang and structured data', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('YouTube Playlist Length Calculator: Total Time at Any Speed');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /how long any YouTube playlist/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', BASE);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(13);
    await expect(page.locator('link[rel="alternate"][hreflang="ur"]')).toHaveAttribute('href', `${BASE}/ur`);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', BASE);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${BASE}/api/og?l=en`);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    const types = ld['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toEqual(['WebSite', 'Person', 'WebApplication', 'FAQPage']);
    expect(ld['@graph'][3].mainEntity).toHaveLength(11);
    expect(ld['@graph'][2].author).toEqual({ '@id': `${BASE}#author` });
  });

  test('a shared result keeps the canonical page but gets its own preview image', async ({ page }) => {
    await page.goto('/?q=p%3APLplaypaceSampleCourse01&s=2');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', BASE);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /api\/og\?l=en&q=p%3APLplaypaceSampleCourse01&s=2/);
  });

  test('each language has its own title, canonical and lang', async ({ page }) => {
    await page.goto('/es/speed-calculator');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${BASE}/es/speed-calculator`);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'es_ES');
    expect(await page.title()).not.toContain('Video Speed Calculator');
  });

  test('sitemap, robots and manifest', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap.match(/<url>/g)).toHaveLength(36);
    expect(sitemap).toContain(`<loc>${BASE}/ur/speed-calculator</loc>`);
    expect(sitemap).toContain('hreflang="x-default"');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain(`Sitemap: ${BASE}/sitemap.xml`);
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.short_name).toBe('Playpace');
  });

  test('share images render', async ({ request }) => {
    for (const url of ['/api/og?l=en', '/api/og?l=ur', '/api/og?l=de&p=speed', '/api/og?l=en&q=p%3APLplaypaceSampleCourse01&s=2']) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type']).toBe('image/png');
      expect((await res.body()).length).toBeGreaterThan(10_000);
    }
  });

  test('one address per page and real 404s', async ({ request }) => {
    const en = await request.get('/en/privacy', { maxRedirects: 0 });
    expect(en.status()).toBe(308);
    expect(en.headers().location).toBe('/privacy');
    expect((await request.get('/no-such-page')).status()).toBe(404);
    expect((await request.get('/fr/no-such-page')).status()).toBe(404);
    expect((await request.get('/wp-login.php')).status()).toBe(404);
  });
});

test.describe('security', () => {
  test('pages send a nonce-based CSP and hardening headers', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-[\w+/=]+' 'strict-dynamic'/);
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['strict-transport-security']).toContain('max-age=63072000');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-powered-by']).toBeUndefined();
    const nonce = /'nonce-([^']+)'/.exec(h['content-security-policy']!)![1];
    const html = await res.text();
    expect(html).toContain(`nonce="${nonce}"`);
    expect(html).not.toContain('YOUTUBE_API_KEY');
  });

  test('the API rejects bad input and is never cached', async ({ request }) => {
    for (const src of ['', 'x', 'p:<script>', 'v:short', 'h:a b']) {
      const res = await request.get(`/api/playlist?src=${encodeURIComponent(src)}`);
      expect(res.status()).toBe(400);
      expect(await res.text()).toBe('{"type":"error","code":"invalid_input"}\n');
    }
    const ok = await request.get('/api/playlist?src=p%3APLplaypaceSampleMusic001');
    expect(ok.headers()['cache-control']).toBe('no-store');
    const lines = (await ok.text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines[0].type).toBe('meta');
    expect(lines.at(-1).type).toBe('done');
    expect(lines.at(-1).data.videos).toHaveLength(18);
  });

  test('no CSP violations while calculating', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/.test(m.text())) violations.push(m.text());
    });
    await page.goto('/');
    await calculate(page, COURSE);
    await page.locator('.speed-chips').first().getByText('2×', { exact: true }).click();
    expect(violations).toEqual([]);
  });
});
