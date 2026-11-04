import type { ListData, Video } from './youtube/types';

/** A video with its position in the combined list (1-based) and which list it came from. */
export interface Item extends Video {
  n: number;
  src: number;
}

export type Mode = 'all' | 'range' | 'from';

export interface Selection {
  mode: Mode;
  /** First video (1-based) for range and from modes. */
  from: number;
  /** Last video (1-based) for range mode. */
  to: number;
}

export const SPEED_PRESETS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 16;

export function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(value * 100) / 100));
}

/** Joins several lists into one numbered list, in the order they were pasted. */
export function combine(lists: ListData[]): Item[] {
  const items: Item[] = [];
  lists.forEach((list, src) => {
    for (const v of list.videos) items.push({ ...v, n: items.length + 1, src });
  });
  return items;
}

/** Normalises a selection against a list of `count` videos so from/to are always valid. */
export function normalizeSelection(sel: Selection, count: number): Selection {
  const max = Math.max(1, count);
  const clamp = (n: number) => Math.min(max, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));
  let from = clamp(sel.from);
  let to = clamp(sel.to || max);
  if (sel.mode === 'range' && from > to) [from, to] = [to, from];
  return { mode: sel.mode, from, to: sel.mode === 'range' ? to : max };
}

export function inSelection(n: number, sel: Selection): boolean {
  if (sel.mode === 'all') return true;
  if (sel.mode === 'from') return n >= sel.from;
  return n >= sel.from && n <= sel.to;
}

export const isCountable = (v: Video) => !v.s && v.d > 0;

export interface Totals {
  /** Videos inside the selection. */
  inRange: number;
  /** Videos counted toward the total (playable, not marked watched). */
  counted: number;
  /** Seconds at 1x of the counted videos. */
  seconds: number;
  /** Seconds at 1x already marked watched inside the selection. */
  watchedSeconds: number;
  watchedCount: number;
  /** Private, deleted or blocked videos inside the selection. */
  unavailable: number;
  /** Live streams and premieres inside the selection (no fixed length). */
  live: number;
  average: number;
  longest: Item | null;
  shortest: Item | null;
}

export function computeTotals(items: Item[], sel: Selection, watched: ReadonlySet<string> = new Set()): Totals {
  const t: Totals = {
    inRange: 0,
    counted: 0,
    seconds: 0,
    watchedSeconds: 0,
    watchedCount: 0,
    unavailable: 0,
    live: 0,
    average: 0,
    longest: null,
    shortest: null,
  };
  for (const item of items) {
    if (!inSelection(item.n, sel)) continue;
    t.inRange += 1;
    if (item.s === 'live') {
      t.live += 1;
      continue;
    }
    if (!isCountable(item)) {
      t.unavailable += 1;
      continue;
    }
    if (watched.has(item.id)) {
      t.watchedCount += 1;
      t.watchedSeconds += item.d;
      continue;
    }
    t.counted += 1;
    t.seconds += item.d;
    if (!t.longest || item.d > t.longest.d) t.longest = item;
    if (!t.shortest || item.d < t.shortest.d) t.shortest = item;
  }
  t.average = t.counted ? t.seconds / t.counted : 0;
  return t;
}

export function atSpeed(seconds: number, speed: number): number {
  return seconds / clampSpeed(speed);
}

/** A piece of one video watched on a given day, in seconds of the video itself (1x). */
export interface Segment {
  n: number;
  start: number;
  end: number;
  /** Full length of the video. */
  length: number;
}

export interface PlanDay {
  index: number;
  date: Date;
  segments: Segment[];
  /** Watching time that day at the chosen speed. */
  seconds: number;
}

export interface PlanOptions {
  /** Watching time per day, in real minutes (at the chosen speed). */
  minutesPerDay: number;
  speed: number;
  start: Date;
  weekdaysOnly?: boolean;
}

export const MAX_PLAN_DAYS = 3650;

function nextStudyDay(date: Date, weekdaysOnly: boolean): Date {
  const d = new Date(date);
  while (weekdaysOnly && (d.getDay() === 0 || d.getDay() === 6)) d.setDate(d.getDate() + 1);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Splits the videos into days. Whole videos stay together when they fit; a video longer than a whole
 * day's budget is split across days. Times are measured at the chosen speed.
 */
export function planDays(items: Item[], opts: PlanOptions): PlanDay[] {
  const speed = clampSpeed(opts.speed);
  const budget = Math.max(1, opts.minutesPerDay) * 60 * speed; // seconds of video per day
  const weekdaysOnly = !!opts.weekdaysOnly;
  const days: PlanDay[] = [];
  let date = nextStudyDay(opts.start, weekdaysOnly);
  let current: Segment[] = [];
  let used = 0;

  const close = () => {
    if (!current.length) return;
    days.push({ index: days.length + 1, date, segments: current, seconds: used / speed });
    date = nextStudyDay(addDays(date, 1), weekdaysOnly);
    current = [];
    used = 0;
  };

  for (const item of items) {
    if (days.length >= MAX_PLAN_DAYS) break;
    const length = item.d;
    if (length <= 0) continue;
    if (used > 0 && used + length > budget) close();
    if (length <= budget - used) {
      current.push({ n: item.n, start: 0, end: length, length });
      used += length;
      continue;
    }
    // Longer than what's left of an empty day: split it.
    let start = 0;
    while (start < length && days.length < MAX_PLAN_DAYS) {
      const take = Math.min(budget - used, length - start);
      current.push({ n: item.n, start, end: start + take, length });
      used += take;
      start += take;
      if (used >= budget) close();
    }
  }
  close();
  return days;
}

/** Minutes a day needed to finish `seconds` of video at `speed` in `days` days. */
export function minutesPerDayFor(seconds: number, speed: number, days: number): number {
  if (days <= 0) return 0;
  return atSpeed(seconds, speed) / 60 / days;
}

/** Study days between two dates, inclusive of both, optionally weekdays only. */
export function countStudyDays(from: Date, to: Date, weekdaysOnly: boolean): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (b < a) return 0;
  let count = 0;
  for (let d = a; d <= b && count < MAX_PLAN_DAYS; d = addDays(d, 1)) {
    if (!weekdaysOnly || (d.getDay() !== 0 && d.getDay() !== 6)) count += 1;
  }
  return count;
}

/** Where each video starts and ends inside the selection, at a given speed (for the "ends at" column). */
export function cumulativeEnds(items: Item[], sel: Selection, watched: ReadonlySet<string>, speed: number): Map<number, number> {
  const ends = new Map<number, number>();
  let running = 0;
  for (const item of items) {
    if (!inSelection(item.n, sel) || !isCountable(item) || watched.has(item.id)) continue;
    running += item.d;
    ends.set(item.n, running / clampSpeed(speed));
  }
  return ends;
}
