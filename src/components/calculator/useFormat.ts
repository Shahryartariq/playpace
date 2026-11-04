'use client';

import { useMemo } from 'react';
import type { Plural } from '@/i18n/types';
import { formatClock, formatDuration, formatInteger, formatSpeed, plural } from '@/lib/format';
import type { Ui } from './types';

export interface Fmt {
  tag: string;
  dur: (seconds: number, withSeconds?: boolean) => string;
  clock: (seconds: number) => string;
  speed: (x: number) => string;
  int: (n: number) => string;
  count: (forms: Plural, n: number) => string;
  date: (d: Date) => string;
  dateLong: (d: Date) => string;
}

/** Number, duration and date formatting in the page's language. */
export function useFormat(ui: Ui, tag: string): Fmt {
  return useMemo(() => {
    const short = new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'short' });
    const long = new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return {
      tag,
      dur: (seconds, withSeconds = true) => formatDuration(seconds, ui.units, tag, withSeconds),
      clock: (seconds) => formatClock(seconds, tag),
      speed: (x) => formatSpeed(x, tag),
      int: (n) => formatInteger(n, tag),
      count: (forms, n) => plural(forms, n, tag),
      date: (d) => short.format(d),
      dateLong: (d) => long.format(d),
    };
  }, [ui.units, tag]);
}
