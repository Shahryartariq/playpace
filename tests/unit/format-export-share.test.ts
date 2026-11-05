import { describe, expect, it } from 'vitest';
import { combine, planDays } from '@/lib/calc';
import { buildCsv, buildIcs, fileSlug, type CsvLabels } from '@/lib/exporters';
import { fill, formatClock, formatDuration, formatSpeed, plural } from '@/lib/format';
import { networkUrl, readShareQuery, shareQuery, sourceToLink } from '@/lib/share';

const en = { h: 'h', m: 'm', s: 's', unitGap: '', partGap: ' ' };
const ja = { h: '時間', m: '分', s: '秒', unitGap: '', partGap: '' };

describe('format', () => {
  it('formats durations in the page language', () => {
    expect(formatDuration(43471, en, 'en')).toBe('12h 04m 31s');
    expect(formatDuration(43471, en, 'en', false)).toBe('12h 05m');
    expect(formatDuration(125, en, 'en')).toBe('2m 05s');
    expect(formatDuration(9, en, 'en')).toBe('9s');
    expect(formatDuration(20, en, 'en', false)).toBe('1m');
    expect(formatDuration(0, en, 'en', false)).toBe('0m');
    expect(formatDuration(3600, en, 'en', false)).toBe('1h');
    expect(formatDuration(3660, en, 'en', false)).toBe('1h 01m');
    expect(formatDuration(360000, en, 'en', false)).toBe('100h');
    expect(formatDuration(43471, ja, 'ja')).toBe('12時間04分31秒');
    expect(formatDuration(43471, { h: 'س', m: 'د', s: 'ث', unitGap: ' ', partGap: ' ' }, 'ar')).toBe('12 س 04 د 31 ث');
  });

  it('formats clock times and speeds', () => {
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(65)).toBe('1:05');
    expect(formatSpeed(1.5, 'en')).toBe('1.5×');
    expect(formatSpeed(1.25, 'de')).toBe('1,25×');
    expect(formatSpeed(1.5, 'ur')).toBe('\u20661.5×\u2069');
  });

  it('fills placeholders and picks plural forms', () => {
    expect(fill('{a} of {b}', { a: 1, b: 2 })).toBe('1 of 2');
    expect(fill('{missing}', {})).toBe('{missing}');
    const forms = { one: '{n} video', other: '{n} videos' };
    expect(plural(forms, 1, 'en')).toBe('1 video');
    expect(plural(forms, 1200, 'en')).toBe('1,200 videos');
    const ru = { one: '{n} видео', few: '{n} видео', many: '{n} видео', other: '{n} видео' };
    expect(plural(ru, 3, 'ru')).toBe('3 видео');
  });
});

const labels: CsvLabels = {
  number: '#',
  title: 'Title',
  channel: 'Channel',
  duration: 'Duration',
  seconds: 'Seconds',
  atSpeed: 'At',
  status: 'Status',
  watched: 'Watched',
  link: 'Link',
  yes: 'yes',
  statusNames: { ok: 'OK', live: 'Live', private: 'Private', deleted: 'Deleted', unavailable: 'Unavailable' },
};

describe('exports', () => {
  const items = combine([
    {
      meta: { token: 'p:x', kind: 'playlist', id: 'x', title: 'x', channel: 'c', itemCount: 2, url: '' },
      videos: [
        { id: 'aaaaaaaaaaa', t: 'Intro, "part 1"', c: 'Chan', d: 3723 },
        { id: 'bbbbbbbbbbb', t: 'Private video', d: 0, s: 'private' },
      ],
      truncated: false,
      fetchedAt: 0,
    },
  ]);

  it('builds a CSV Excel can open', () => {
    const csv = buildCsv(items, 2, new Set(['aaaaaaaaaaa']), labels);
    expect(csv.startsWith('﻿#,Title,Channel,Duration,Seconds,At 2x,Status,Watched,Link\r\n')).toBe(true);
    expect(csv).toContain('1,"Intro, ""part 1""",Chan,1:02:03,3723,31:02,OK,yes,https://www.youtube.com/watch?v=aaaaaaaaaaa');
    expect(csv).toContain('2,Private video,,0:00,0,0:00,Private,,');
  });

  it('builds a valid calendar with one event per day', () => {
    const days = planDays(items, { minutesPerDay: 30, speed: 1, start: new Date(2026, 10, 2) });
    const ics = buildIcs(
      days.map((day) => ({ day, summary: `Day ${day.index}; video 1`, description: 'Line one\nLine two, more' })),
      'Playpace plan: a very long playlist title that will need folding across several lines of the file',
      'https://playpace.vercel.app/',
      new Date(Date.UTC(2026, 10, 1, 12)),
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261102');
    expect(ics).toContain('DTEND;VALUE=DATE:20261103');
    expect(ics).toContain('SUMMARY:Day 1\\; video 1');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\\, more');
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('stops spreadsheets from running titles as formulas', () => {
    const evil = combine([
      {
        meta: { token: 'p:y', kind: 'playlist', id: 'y', title: 'y', channel: 'c', itemCount: 1, url: '' },
        videos: [{ id: 'ccccccccccc', t: '=HYPERLINK("http://x","click")', c: '@chan', d: 60 }],
        truncated: false,
        fetchedAt: 0,
      },
    ]);
    const csv = buildCsv(evil, 1, new Set(), labels);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""click"")",'@chan,`);
  });

  it('gives calendar events stable ids', () => {
    const days = planDays(items, { minutesPerDay: 30, speed: 1, start: new Date(2026, 10, 2) });
    const entries = days.map((day) => ({ day, summary: 's', description: 'd' }));
    const a = buildIcs(entries, 'Plan', 'https://x/?q=1', new Date(1));
    const b = buildIcs(entries, 'Plan', 'https://x/?q=1', new Date(999999999));
    const uids = (t: string) => t.match(/^UID:.*$/gm);
    expect(uids(a)).toEqual(uids(b));
  });

  it('makes safe file names', () => {
    expect(fileSlug('Full-stack: Web Dev / 2026!')).toBe('full-stack-web-dev-2026');
    expect(fileSlug('دورة البرمجة')).toBe('دورة-البرمجة');
    expect(fileSlug('***')).toBe('playlist');
  });
});

describe('share', () => {
  it('round-trips the calculation state', () => {
    const state = {
      sources: [
        { kind: 'playlist', id: 'PLabcdefghijklmnop' },
        { kind: 'handle', handle: 'mkbhd' },
      ] as const,
      selection: { mode: 'range', from: 3, to: 20 } as const,
      speed: 1.75,
    };
    const query = shareQuery({ ...state, sources: [...state.sources], selection: { ...state.selection } });
    expect(query).toBe('q=p%3APLabcdefghijklmnop%2Ch%3Amkbhd&m=range&a=3&b=20&s=1.75');
    expect(readShareQuery(new URLSearchParams(query))).toEqual({ ...state, sources: [...state.sources] });
  });

  it('ignores bad values', () => {
    expect(readShareQuery(new URLSearchParams('q=nope'))).toBeNull();
    expect(readShareQuery({ q: 'p:PLabcdefghijklmnop', s: '999', m: 'evil' })).toEqual({
      sources: [{ kind: 'playlist', id: 'PLabcdefghijklmnop' }],
      selection: { mode: 'all', from: 1, to: 0 },
      speed: 16,
    });
  });

  it('builds share links', () => {
    expect(networkUrl('whatsapp', 'https://x.y/?q=1', 'Hi there')).toBe('https://wa.me/?text=Hi%20there%20https%3A%2F%2Fx.y%2F%3Fq%3D1');
    expect(networkUrl('x', 'https://x.y', 'Hi')).toBe('https://x.com/intent/post?text=Hi&url=https%3A%2F%2Fx.y');
    expect(sourceToLink({ kind: 'handle', handle: 'mkbhd' })).toBe('https://www.youtube.com/@mkbhd');
  });
});
