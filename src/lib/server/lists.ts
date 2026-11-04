import 'server-only';
import { estimateUnits, fetchSource, YouTubeError } from '../youtube/client';
import { sourceToken } from '../youtube/parse-input';
import { fetchSample } from '../youtube/sample';
import type { ListData, ListMeta, Source } from '../youtube/types';
import { sampleDataEnabled } from '../site';
import { readList, writeList } from './cache';

export interface LoadCallbacks {
  onMeta?: (meta: ListMeta, cached: boolean) => void;
  onProgress?: (loaded: number, total: number) => void;
  /** Charges estimated YouTube quota units for a fresh lookup; return false to refuse it. */
  charge?: (units: number) => boolean;
}

/** Units for the first calls of a lookup (the list's or channel's details), charged before anything else. */
const BASE_UNITS = 2;

interface Job {
  promise: Promise<ListData>;
  listeners: Set<LoadCallbacks>;
  meta: ListMeta | null;
  progress: [number, number] | null;
}

/**
 * Lookups in progress. A second person asking for the same list joins the first one's job and sees
 * its progress. Jobs don't stop when a viewer leaves: the finished list is cached for the next one.
 */
const jobs = new Map<string, Job>();

function join(job: Job, cb: LoadCallbacks): Promise<ListData> {
  job.listeners.add(cb);
  if (job.meta) cb.onMeta?.(job.meta, false);
  if (job.progress) cb.onProgress?.(...job.progress);
  return job.promise.finally(() => job.listeners.delete(cb));
}

/** Returns a list from the cache or YouTube, reporting progress along the way. */
export async function loadList(source: Source, cb: LoadCallbacks = {}): Promise<ListData> {
  const token = sourceToken(source);
  const cached = await readList(token);
  if (cached) {
    cb.onMeta?.(cached.meta, true);
    cb.onProgress?.(cached.videos.length, cached.videos.length);
    return cached;
  }

  const running = jobs.get(token);
  if (running) return join(running, cb);

  if (cb.charge && !cb.charge(BASE_UNITS)) throw new YouTubeError('rate_limited');

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!sampleDataEnabled() && !apiKey) throw new YouTubeError('config', 'YOUTUBE_API_KEY is not set');

  const job: Job = { promise: Promise.resolve(null as unknown as ListData), listeners: new Set([cb]), meta: null, progress: null };
  const opts = {
    onMeta: (meta: ListMeta) => {
      job.meta = meta;
      for (const l of job.listeners) l.onMeta?.(meta, false);
    },
    onProgress: (loaded: number, total: number) => {
      job.progress = [loaded, total];
      for (const l of job.listeners) l.onProgress?.(loaded, total);
    },
    // The person who started the lookup pays for the list's size once it's known.
    allowItems: (meta: ListMeta) => !cb.charge || cb.charge(estimateUnits(meta.itemCount) - BASE_UNITS),
  };

  job.promise = (async () => {
    try {
      const data = sampleDataEnabled() ? await fetchSample(source, opts) : await fetchSource(source, { ...opts, apiKey: apiKey! });
      await writeList(token, data);
      return data;
    } finally {
      jobs.delete(token);
    }
  })();
  jobs.set(token, job);
  return job.promise.finally(() => job.listeners.delete(cb));
}
