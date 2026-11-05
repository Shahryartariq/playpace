import 'server-only';

/**
 * Protects the shared YouTube quota (10,000 units a day by default). Lookups are charged by their
 * estimated cost in API units, not per request, so one address can't drain the day with a few huge
 * playlists. Cached answers are free. Limits are per server instance and roll over time:
 * - each address: 600 units per 10 minutes (about three 5,000-video playlists, or 150 typical ones)
 * - the whole instance: 9,000 units per 24 hours
 */
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_UNITS = 600;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_UNITS = 9000;
const MAX_TRACKED = 5000;

type Charge = { t: number; units: number };

const byIp = new Map<string, Charge[]>();
let global: Charge[] = [];

const sum = (charges: Charge[]) => charges.reduce((s, c) => s + c.units, 0);

/** Records `units` against `ip` if both its own and the instance's budget allow it. */
export function chargeUnits(ip: string, units: number, now = Date.now()): boolean {
  const mine = (byIp.get(ip) ?? []).filter((c) => now - c.t < IP_WINDOW_MS);
  global = global.filter((c) => now - c.t < DAY_MS);
  if (sum(mine) + units > IP_UNITS || sum(global) + units > DAILY_UNITS) {
    byIp.set(ip, mine);
    return false;
  }
  mine.push({ t: now, units });
  global.push({ t: now, units });
  byIp.delete(ip);
  byIp.set(ip, mine);
  if (byIp.size > MAX_TRACKED) {
    const oldest = byIp.keys().next().value;
    if (oldest !== undefined) byIp.delete(oldest);
  }
  return true;
}

/** For tests. */
export function resetRateLimits(): void {
  byIp.clear();
  global = [];
}

export function clientIp(headers: Headers): string {
  const ip = headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  // IPv6 users can rotate through a whole /64; count the network, not the address.
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
}
