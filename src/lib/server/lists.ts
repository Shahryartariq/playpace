import 'server-only';
import { fetchSource, YouTubeError } from '../youtube/client';
import { sourceToken } from '../youtube/parse-input';
import { fetchSample } from '../youtube/sample';
import type { ListData, ListMeta, Source } from '../youtube/types';
import { sampleDataEnabled } from '../site';
import { readList, writeList } from './cache';

export interface LoadCallbacks {
  onMeta?: (meta: ListMeta, cached: boolean) => void;
  onProgress?: (loaded: number, total: number) => void;
  /** Called before a fresh (uncached) fetch; return false to refuse it. */
  beforeFetch?: () => boolean;
  signal?: AbortSignal;
}

/** In-flight fetches, so two people asking for the same playlist at once share one set of API calls. */
const inflight = new Map<string, Promise<ListData>>();

/** Returns a list from the cache or YouTube, reporting progress along the way. */
export async function loadList(source: Source, cb: LoadCallbacks = {}): Promise<ListData> {
  const token = sourceToken(source);
  const cached = await readList(token);
  if (cached) {
    cb.onMeta?.(cached.meta, true);
    cb.onProgress?.(cached.videos.length, cached.videos.length);
    return cached;
  }

  const shared = inflight.get(token);
  if (shared) {
    const data = await shared;
    cb.onMeta?.(data.meta, true);
    cb.onProgress?.(data.videos.length, data.videos.length);
    return data;
  }

  if (cb.beforeFetch && !cb.beforeFetch()) throw new YouTubeError('rate_limited');

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const opts = {
    onMeta: (meta: ListMeta) => cb.onMeta?.(meta, false),
    onProgress: cb.onProgress,
    signal: cb.signal,
  };

  let job: Promise<ListData>;
  if (sampleDataEnabled()) job = fetchSample(source, opts);
  else if (!apiKey) throw new YouTubeError('config', 'YOUTUBE_API_KEY is not set');
  else job = fetchSource(source, { ...opts, apiKey });

  inflight.set(token, job);
  try {
    const data = await job;
    await writeList(token, data);
    return data;
  } finally {
    inflight.delete(token);
  }
}
