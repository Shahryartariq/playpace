import 'server-only';

/**
 * A small per-instance limiter that protects the shared YouTube quota from scripts hammering the API.
 * Cached answers don't count. Real people never come near it: 40 fresh lists per 10 minutes per address.
 */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 40;
const MAX_TRACKED = 5000;

const hits = new Map<string, number[]>();

export function takeToken(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  return true;
}

export function clientIp(headers: Headers): string {
  return headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
