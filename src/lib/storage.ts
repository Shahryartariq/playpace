'use client';

/**
 * A tiny localStorage-backed store for useSyncExternalStore. Falls back to memory when storage is
 * blocked (private windows, strict settings) so the page keeps working for the current visit.
 */
export interface LocalStore<T> {
  read: () => T;
  write: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
  server: () => T;
}

export function createLocalStore<T>(key: string, fallback: T, parse: (value: unknown) => T | null): LocalStore<T> {
  let memory: string | null = null;
  let cache: { raw: string | null; value: T } | null = null;
  const listeners = new Set<() => void>();

  const getRaw = (): string | null => {
    try {
      return window.localStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  };

  const read = (): T => {
    const raw = getRaw();
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    if (raw) {
      try {
        value = parse(JSON.parse(raw)) ?? fallback;
      } catch {
        value = fallback;
      }
    }
    cache = { raw, value };
    return value;
  };

  const write = (value: T) => {
    const raw = JSON.stringify(value);
    memory = raw;
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      // storage full or blocked: memory copy keeps this visit working
    }
    cache = null;
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) {
        cache = null;
        listener();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  };

  return { read, write, subscribe, server: () => fallback };
}

const EMPTY: string[] = [];

/** Video ids marked as watched, shared across every list (a video watched once is watched everywhere). */
export const watchedStore = createLocalStore<string[]>('playpace:watched', EMPTY, (v) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-50_000) : null,
);

export interface HistoryEntry {
  q: string;
  title: string;
  seconds: number;
  count: number;
  at: number;
}

const NO_HISTORY: HistoryEntry[] = [];

export const historyStore = createLocalStore<HistoryEntry[]>('playpace:history', NO_HISTORY, (v) =>
  Array.isArray(v)
    ? v
        .filter(
          (e): e is HistoryEntry =>
            !!e && typeof e.q === 'string' && typeof e.title === 'string' && typeof e.seconds === 'number',
        )
        .slice(0, 8)
    : null,
);

export type ThemeChoice = 'system' | 'light' | 'dark';

export const themeStore = createLocalStore<ThemeChoice>('playpace:theme', 'system', (v) =>
  v === 'light' || v === 'dark' || v === 'system' ? v : null,
);
