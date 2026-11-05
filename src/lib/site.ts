export const SITE_NAME = 'Playpace';
export const PRODUCTION_URL = 'https://getplaypace.vercel.app';
export const REPO_URL = 'https://github.com/Shahryartariq/playpace';
export const AUTHOR = { name: 'Muhammad Shehryar', url: 'https://github.com/Shahryartariq' };

/** Absolute site address without a trailing slash. SITE_URL overrides the production default. */
export function siteUrl(): string {
  const fromEnv = process.env.SITE_URL?.trim();
  return (fromEnv || PRODUCTION_URL).replace(/\/+$/, '');
}

export function absoluteUrl(path = '/'): string {
  const base = siteUrl();
  // The home page is written without a trailing slash, the way Next.js prints canonical links.
  if (path === '/' || path === '') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** GA4 IDs look like G-XXXXXXX. Anything else is ignored so a typo can't break the CSP. */
export function gaMeasurementId(): string | null {
  const id = process.env.GA_MEASUREMENT_ID?.trim();
  return id && /^G-[A-Z0-9]{4,16}$/.test(id) ? id : null;
}

export function sampleDataEnabled(): boolean {
  return process.env.PLAYPACE_SAMPLE_DATA === '1';
}
