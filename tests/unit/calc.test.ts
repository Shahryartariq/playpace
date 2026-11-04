import { describe, expect, it } from 'vitest';
import {
  atSpeed,
  clampSpeed,
  combine,
  computeTotals,
  countStudyDays,
  cumulativeEnds,
  minutesPerDayFor,
  normalizeSelection,
  planDays,
  type Item,
} from '@/lib/calc';
import { parseIsoDuration } from '@/lib/youtube/duration';
import type { ListData, Video } from '@/lib/youtube/types';

function list(videos: Video[], title = 'List'): ListData {
  return {
    meta: { token: `p:${title}`, kind: 'playlist', id: title, title, channel: 'c', itemCount: videos.length, url: '' },
    videos,
    truncated: false,
    fetchedAt: 0,
  };
}

const v = (id: string, d: number, s?: Video['s']): Video => ({ id, t: id, d, ...(s ? { s } : {}) });

describe('parseIsoDuration', () => {
  it.each([
    ['PT4M13S', 253],
    ['PT1H', 3600],
    ['PT1H2M3S', 3723],
    ['PT45S', 45],
    ['P1DT2H', 93600],
    ['P0D', 0],
    ['PT0S', 0],
    ['', 0],
    ['garbage', 0],
  ])('%s is %i seconds', (iso, seconds) => {
    expect(parseIsoDuration(iso)).toBe(seconds);
  });
});

describe('combine and totals', () => {
  const items = combine([
    list([v('a', 600), v('b', 300), v('c', 0, 'private')], 'one'),
    list([v('d', 1200), v('e', 0, 'live'), v('f', 60)], 'two'),
  ]);

  it('numbers videos across lists in order', () => {
    expect(items.map((i) => [i.n, i.id, i.src])).toEqual([
      [1, 'a', 0],
      [2, 'b', 0],
      [3, 'c', 0],
      [4, 'd', 1],
      [5, 'e', 1],
      [6, 'f', 1],
    ]);
  });

  it('counts the whole list, skipping private and live videos', () => {
    const t = computeTotals(items, { mode: 'all', from: 1, to: 6 });
    expect(t.seconds).toBe(2160);
    expect(t.counted).toBe(4);
    expect(t.unavailable).toBe(1);
    expect(t.live).toBe(1);
    expect(t.average).toBe(540);
    expect(t.longest?.id).toBe('d');
    expect(t.shortest?.id).toBe('f');
  });

  it('counts a range and the rest from a video', () => {
    expect(computeTotals(items, { mode: 'range', from: 2, to: 4 }).seconds).toBe(1500);
    expect(computeTotals(items, { mode: 'from', from: 4, to: 6 }).seconds).toBe(1260);
  });

  it('leaves watched videos out of the time left', () => {
    const t = computeTotals(items, { mode: 'all', from: 1, to: 6 }, new Set(['a', 'd']));
    expect(t.seconds).toBe(360);
    expect(t.watchedSeconds).toBe(1800);
    expect(t.watchedCount).toBe(2);
  });

  it('works out where each video ends at a speed', () => {
    const ends = cumulativeEnds(items, { mode: 'all', from: 1, to: 6 }, new Set(), 2);
    expect(ends.get(1)).toBe(300);
    expect(ends.get(2)).toBe(450);
    expect(ends.has(3)).toBe(false);
    expect(ends.get(6)).toBe(1080);
  });
});

describe('selection and speed', () => {
  it('clamps and orders selections', () => {
    expect(normalizeSelection({ mode: 'range', from: 30, to: 5 }, 20)).toEqual({ mode: 'range', from: 5, to: 20 });
    expect(normalizeSelection({ mode: 'from', from: 0, to: 0 }, 20)).toEqual({ mode: 'from', from: 1, to: 20 });
    expect(normalizeSelection({ mode: 'range', from: 3, to: 0 }, 20)).toEqual({ mode: 'range', from: 3, to: 20 });
  });

  it('keeps speeds in a sane range', () => {
    expect(clampSpeed(0)).toBe(0.25);
    expect(clampSpeed(99)).toBe(16);
    expect(clampSpeed(1.333)).toBe(1.33);
    expect(clampSpeed(Number.NaN)).toBe(1);
    expect(atSpeed(3600, 1.5)).toBe(2400);
    expect(atSpeed(3600, 2)).toBe(1800);
  });
});

describe('planDays', () => {
  const items: Item[] = combine([list([v('a', 1200), v('b', 1200), v('c', 1200), v('d', 7200), v('e', 600)])]);
  const start = new Date(2026, 10, 2); // Monday 2 Nov 2026

  it('keeps whole videos together and splits only videos longer than a day', () => {
    const days = planDays(items, { minutesPerDay: 45, speed: 1, start });
    // a+b (40m), c (20m), d split 45+45+30, e joins the last part of d (30+10).
    expect(days.map((d) => d.segments.map((s) => `${s.n}:${s.start}-${s.end}`))).toEqual([
      ['1:0-1200', '2:0-1200'],
      ['3:0-1200'],
      ['4:0-2700'],
      ['4:2700-5400'],
      ['4:5400-7200', '5:0-600'],
    ]);
    expect(days.at(-1)?.seconds).toBe(2400);
  });

  it('fits more video into a day at higher speed', () => {
    const days = planDays(items, { minutesPerDay: 60, speed: 2, start });
    expect(days.length).toBe(3);
    expect(days.reduce((sum, d) => sum + d.seconds, 0)).toBe(11400 / 2);
  });

  it('skips weekends when asked', () => {
    const saturday = new Date(2026, 10, 7);
    const days = planDays(items, { minutesPerDay: 45, speed: 1, start: saturday, weekdaysOnly: true });
    expect(days[0]?.date.getDay()).toBe(1);
    expect(days.every((d) => d.date.getDay() !== 0 && d.date.getDay() !== 6)).toBe(true);
  });

  it('works out minutes a day for a deadline', () => {
    expect(minutesPerDayFor(36000, 1.5, 10)).toBe(40);
    expect(countStudyDays(new Date(2026, 10, 2), new Date(2026, 10, 15), false)).toBe(14);
    expect(countStudyDays(new Date(2026, 10, 2), new Date(2026, 10, 15), true)).toBe(10);
    expect(countStudyDays(new Date(2026, 10, 15), new Date(2026, 10, 2), true)).toBe(0);
  });
});
