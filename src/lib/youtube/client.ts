import { parseIsoDuration } from './duration';
import { sourceToken } from './parse-input';
import { MAX_ITEMS, type ErrorCode, type ListData, type ListMeta, type Source, type Video } from './types';

const API = 'https://www.googleapis.com/youtube/v3';
const PAGE = 50;

export class YouTubeError extends Error {
  constructor(public code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'YouTubeError';
  }
}

export interface FetchOptions {
  apiKey: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  onMeta?: (meta: ListMeta) => void;
  onProgress?: (loaded: number, total: number) => void;
  /** How many videos.list requests may run at once. */
  concurrency?: number;
  /** Called once the list's size is known; return false to stop before reading its videos (rate limit). */
  allowItems?: (meta: ListMeta) => boolean;
}

/** Only the fields Playpace uses, so 5,000-video lists don't download every description. */
const FIELDS = {
  playlists: 'items(id,snippet(title,channelTitle,thumbnails(default/url,medium/url,high/url)),contentDetails/itemCount)',
  channels: 'items(id,snippet(title,thumbnails(default/url,medium/url,high/url)),contentDetails/relatedPlaylists/uploads)',
  playlistItems: 'nextPageToken,items/snippet(title,videoOwnerChannelTitle,resourceId/videoId)',
  videos: 'items(id,snippet(title,channelTitle,liveBroadcastContent,thumbnails(default/url,medium/url,high/url)),contentDetails/duration)',
} as const;

/** Reasons that mean the API key itself is wrong, blocked or restricted. */
const KEY_PROBLEMS = new Set([
  'keyInvalid',
  'keyExpired',
  'accessNotConfigured',
  'ipRefererBlocked',
  'API_KEY_INVALID',
  'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_IP_ADDRESS_BLOCKED',
  'API_KEY_SERVICE_BLOCKED',
  'SERVICE_DISABLED',
]);

/** Estimated quota units for reading a list of this size: one playlistItems and one videos call per 50. */
export function estimateUnits(itemCount: number): number {
  return 2 + Math.ceil(Math.min(Math.max(itemCount, 1), MAX_ITEMS) / PAGE) * 2;
}

interface Thumbs {
  default?: { url: string };
  medium?: { url: string };
  high?: { url: string };
}

interface PlaylistResource {
  id: string;
  snippet?: { title?: string; channelTitle?: string; thumbnails?: Thumbs };
  contentDetails?: { itemCount?: number };
}

interface ChannelResource {
  id: string;
  snippet?: { title?: string; thumbnails?: Thumbs };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  statistics?: { videoCount?: string };
}

interface PlaylistItemResource {
  snippet?: {
    title?: string;
    videoOwnerChannelTitle?: string;
    resourceId?: { videoId?: string };
  };
}

interface VideoResource {
  id: string;
  snippet?: { title?: string; channelTitle?: string; thumbnails?: Thumbs; liveBroadcastContent?: string };
  contentDetails?: { duration?: string };
}

interface ListResponse<T> {
  items?: T[];
  nextPageToken?: string;
  pageInfo?: { totalResults?: number };
}

function pickThumb(t?: Thumbs): string | undefined {
  return t?.medium?.url ?? t?.high?.url ?? t?.default?.url;
}

async function call<T>(path: keyof typeof FIELDS, params: Record<string, string>, opts: FetchOptions, attempt = 0): Promise<T> {
  const doFetch = opts.fetch ?? fetch;
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('fields', FIELDS[path]);
  url.searchParams.set('key', opts.apiKey);

  let res: Response;
  try {
    res = await doFetch(url, { signal: opts.signal, headers: { accept: 'application/json' }, cache: 'no-store' });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    if (attempt === 0) return call<T>(path, params, opts, 1);
    throw new YouTubeError('upstream', 'network error');
  }
  if (res.ok) return (await res.json()) as T;

  let reason = '';
  let detail = '';
  try {
    const body = (await res.json()) as {
      error?: { errors?: { reason?: string }[]; details?: { reason?: string }[] };
    };
    reason = body.error?.errors?.[0]?.reason ?? '';
    detail = body.error?.details?.find((d) => d.reason)?.reason ?? '';
  } catch {
    // ignore unreadable bodies
  }
  if (KEY_PROBLEMS.has(reason) || KEY_PROBLEMS.has(detail)) {
    throw new YouTubeError('config', `${path}: ${reason} ${detail}`.trim());
  }
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded') {
    throw new YouTubeError('quota', reason);
  }
  if (res.status === 404 || reason === 'playlistNotFound' || reason === 'channelNotFound' || reason === 'videoNotFound') {
    throw new YouTubeError('not_found', reason);
  }
  // A private playlist's items answer 403 forbidden; elsewhere a 403 means the key isn't allowed.
  if (reason === 'playlistItemsNotAccessible' || (reason === 'forbidden' && path === 'playlistItems')) {
    throw new YouTubeError('not_found', reason);
  }
  if (res.status === 403 || (res.status === 400 && reason === 'badRequest')) {
    throw new YouTubeError('config', `${path}: HTTP ${res.status} ${reason} ${detail}`.trim());
  }
  if (res.status >= 500 && attempt === 0) return call<T>(path, params, opts, 1);
  throw new YouTubeError('upstream', `${path}: HTTP ${res.status} ${reason}`);
}

async function fetchDurations(ids: string[], opts: FetchOptions): Promise<Map<string, VideoResource>> {
  const out = new Map<string, VideoResource>();
  if (!ids.length) return out;
  const res = await call<ListResponse<VideoResource>>(
    'videos',
    { part: 'contentDetails,snippet', id: ids.join(','), maxResults: String(PAGE) },
    opts,
  );
  for (const item of res.items ?? []) out.set(item.id, item);
  return out;
}

function toVideo(id: string, fallbackTitle: string, owner: string | undefined, found: VideoResource | undefined): Video {
  if (!found) {
    const s = fallbackTitle === 'Private video' ? 'private' : fallbackTitle === 'Deleted video' ? 'deleted' : 'unavailable';
    return { id, t: fallbackTitle || id, d: 0, s };
  }
  const title = found.snippet?.title ?? fallbackTitle;
  const channel = found.snippet?.channelTitle ?? owner;
  const d = parseIsoDuration(found.contentDetails?.duration);
  const live = found.snippet?.liveBroadcastContent;
  const video: Video = { id, t: title, d };
  if (channel) video.c = channel;
  if (live === 'live' || live === 'upcoming' || d === 0) {
    video.d = 0;
    video.s = 'live';
  }
  return video;
}

async function resolveChannel(
  source: Extract<Source, { kind: 'channel' | 'handle' | 'username' }>,
  opts: FetchOptions,
): Promise<{ uploads: string; title: string; thumb?: string; url: string }> {
  const params: Record<string, string> = { part: 'snippet,contentDetails' };
  if (source.kind === 'channel') params.id = source.id;
  else if (source.kind === 'handle') params.forHandle = `@${source.handle}`;
  else params.forUsername = source.name;

  const res = await call<ListResponse<ChannelResource>>('channels', params, opts);
  const channel = res.items?.[0];
  const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channel || !uploads) throw new YouTubeError('not_found', 'channel');
  return {
    uploads,
    title: channel.snippet?.title ?? '',
    thumb: pickThumb(channel.snippet?.thumbnails),
    url: `https://www.youtube.com/channel/${channel.id}`,
  };
}

async function fetchItems(playlistId: string, meta: ListMeta, opts: FetchOptions): Promise<{ videos: Video[]; truncated: boolean }> {
  // Stop everything on the first failure (or when the caller aborts) instead of reading on and spending quota.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);
  const inner: FetchOptions = { ...opts, signal: controller.signal };

  const videos: Video[] = [];
  const pending: Promise<void>[] = [];
  const limit = Math.max(1, opts.concurrency ?? 4);
  let running = 0;
  const waiters: (() => void)[] = [];
  // 0 when YouTube doesn't say how big the list is: the page then shows only how many have loaded.
  const total = Math.min(meta.itemCount, MAX_ITEMS);
  let loaded = 0;
  let pageToken: string | undefined;
  let truncated = false;
  let failure: unknown = null;

  const fail = (err: unknown) => {
    failure ??= err;
    controller.abort();
  };
  const acquire = async () => {
    if (running < limit) {
      running += 1;
      return;
    }
    await new Promise<void>((resolve) => waiters.push(resolve));
    running += 1;
  };
  const release = () => {
    running -= 1;
    waiters.shift()?.();
  };

  try {
    do {
      if (failure) break;
      const page = await call<ListResponse<PlaylistItemResource>>(
        'playlistItems',
        { part: 'snippet', playlistId, maxResults: String(PAGE), ...(pageToken ? { pageToken } : {}) },
        inner,
      );
      const items = (page.items ?? [])
        .map((item) => ({
          id: item.snippet?.resourceId?.videoId ?? '',
          title: item.snippet?.title ?? '',
          owner: item.snippet?.videoOwnerChannelTitle,
        }))
        .filter((item) => item.id);

      const start = videos.length;
      const room = MAX_ITEMS - start;
      const slice = items.slice(0, room);
      if (items.length > room) truncated = true;
      // Reserve positions so the order matches the playlist even though duration lookups finish out of order.
      videos.push(...slice.map((item) => ({ id: item.id, t: item.title, d: 0 }) as Video));

      await acquire();
      if (failure) {
        release();
        break;
      }
      pending.push(
        fetchDurations(
          slice.map((item) => item.id),
          inner,
        )
          .then((found) => {
            slice.forEach((item, i) => {
              videos[start + i] = toVideo(item.id, item.title, item.owner, found.get(item.id));
            });
            loaded += slice.length;
            opts.onProgress?.(loaded, total ? Math.max(total, loaded) : 0);
          })
          .catch(fail)
          .finally(release),
      );

      pageToken = page.nextPageToken;
      if (videos.length >= MAX_ITEMS) {
        if (pageToken) truncated = true;
        break;
      }
    } while (pageToken);
  } catch (err) {
    fail(err);
  } finally {
    await Promise.all(pending);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  if (failure) {
    // The caller's own abort wins over the AbortErrors it caused in sibling requests.
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw failure;
  }
  return { videos, truncated };
}

/** Reads a playlist, channel uploads or single video with the YouTube Data API v3. */
export async function fetchSource(source: Source, opts: FetchOptions): Promise<ListData> {
  const token = sourceToken(source);

  if (source.kind === 'video') {
    const found = await fetchDurations([source.id], opts);
    const item = found.get(source.id);
    if (!item) throw new YouTubeError('not_found', 'video');
    const video = toVideo(source.id, '', undefined, item);
    const meta: ListMeta = {
      token,
      kind: 'video',
      id: source.id,
      title: video.t,
      channel: item.snippet?.channelTitle ?? '',
      thumb: pickThumb(item.snippet?.thumbnails),
      itemCount: 1,
      url: `https://www.youtube.com/watch?v=${source.id}`,
    };
    opts.onMeta?.(meta);
    opts.onProgress?.(1, 1);
    return { meta, videos: [video], truncated: false, fetchedAt: Date.now() };
  }

  let playlistId: string;
  let meta: ListMeta;

  if (source.kind === 'playlist') {
    playlistId = source.id;
    const res = await call<ListResponse<PlaylistResource>>(
      'playlists',
      { part: 'snippet,contentDetails', id: source.id, maxResults: '1' },
      opts,
    );
    const pl = res.items?.[0];
    if (!pl) throw new YouTubeError('not_found', 'playlist');
    meta = {
      token,
      kind: 'playlist',
      id: source.id,
      title: pl.snippet?.title ?? '',
      channel: pl.snippet?.channelTitle ?? '',
      thumb: pickThumb(pl.snippet?.thumbnails),
      itemCount: pl.contentDetails?.itemCount ?? 0,
      url: `https://www.youtube.com/playlist?list=${source.id}`,
    };
  } else {
    const ch = await resolveChannel(source, opts);
    playlistId = ch.uploads;
    // The uploads playlist's item count is the channel's public video count.
    const res = await call<ListResponse<PlaylistResource>>(
      'playlists',
      { part: 'contentDetails', id: ch.uploads, maxResults: '1' },
      opts,
    ).catch(() => ({ items: [] }) as ListResponse<PlaylistResource>);
    meta = {
      token,
      kind: 'channel',
      id: ch.uploads,
      title: ch.title,
      channel: ch.title,
      thumb: ch.thumb,
      itemCount: res.items?.[0]?.contentDetails?.itemCount ?? 0,
      url: ch.url,
    };
  }

  if (opts.allowItems && !opts.allowItems(meta)) throw new YouTubeError('rate_limited', 'list too large for remaining budget');
  opts.onMeta?.(meta);
  const { videos, truncated } = await fetchItems(playlistId, meta, opts);
  return { meta, videos, truncated, fetchedAt: Date.now() };
}

/** Rough seconds the first (uncached) fetch takes, for the "about N seconds" hint. */
export function estimateSeconds(itemCount: number): number {
  const pages = Math.max(1, Math.ceil(Math.min(itemCount, MAX_ITEMS) / PAGE));
  return Math.max(1, Math.round(0.6 + pages * 0.22));
}
