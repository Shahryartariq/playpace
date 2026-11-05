import { afterEach, describe, expect, it, vi } from 'vitest';
import { chargeUnits, clientIp, resetRateLimits } from '@/lib/server/rate-limit';
import { loadList } from '@/lib/server/lists';

afterEach(() => {
  resetRateLimits();
  vi.unstubAllEnvs();
});

describe('rate limit by quota units', () => {
  it('allows about three huge lists per address per 10 minutes', () => {
    expect(chargeUnits('1.1.1.1', 202, 0)).toBe(true);
    expect(chargeUnits('1.1.1.1', 202, 1)).toBe(true);
    expect(chargeUnits('1.1.1.1', 202, 2)).toBe(false);
    expect(chargeUnits('2.2.2.2', 202, 3)).toBe(true);
    expect(chargeUnits('1.1.1.1', 202, 10 * 60 * 1000 + 1)).toBe(true);
  });

  it('caps the whole instance per day', () => {
    let ok = 0;
    for (let i = 0; i < 100; i++) if (chargeUnits(`10.0.0.${i}`, 500, i)) ok += 1;
    expect(ok).toBe(18);
  });

  it('groups IPv6 addresses by network', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '2001:db8:1:2:aaaa:bbbb:cccc:dddd' }))).toBe('2001:db8:1:2');
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
  });
});

describe('loadList', () => {
  it('lets a second viewer join a lookup in progress and see its progress', async () => {
    vi.stubEnv('PLAYPACE_SAMPLE_DATA', '1');
    const source = { kind: 'playlist', id: 'PLplaypaceSampleLong0001' } as const;
    const first: number[] = [];
    const second: number[] = [];
    const a = loadList(source, { onProgress: (n) => first.push(n) });
    await new Promise((r) => setTimeout(r, 5));
    const b = loadList(source, { onProgress: (n) => second.push(n) });
    const [da, db] = await Promise.all([a, b]);
    expect(db).toBe(da);
    expect(second.length).toBeGreaterThan(1);
    expect(second.at(-1)).toBe(1200);
  });

  it('refuses a fresh lookup when the budget is spent, but serves cached lists', async () => {
    vi.stubEnv('PLAYPACE_SAMPLE_DATA', '1');
    const cachedSource = { kind: 'playlist', id: 'PLplaypaceSampleMusic001' } as const;
    await loadList(cachedSource);
    await expect(loadList({ kind: 'playlist', id: 'PLbrandNewList0000001' }, { charge: () => false })).rejects.toMatchObject({
      code: 'rate_limited',
    });
    await expect(loadList(cachedSource, { charge: () => false })).resolves.toMatchObject({ meta: { id: 'PLplaypaceSampleMusic001' } });
  });

  it('needs an API key outside sample mode', async () => {
    vi.stubEnv('PLAYPACE_SAMPLE_DATA', '');
    vi.stubEnv('YOUTUBE_API_KEY', '');
    await expect(loadList({ kind: 'playlist', id: 'PLnoKeyList0000000001' })).rejects.toMatchObject({ code: 'config' });
  });
});
