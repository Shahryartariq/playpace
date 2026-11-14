import type { ParsedInput, Source, UnsupportedReason } from './types';

const VIDEO_ID = /^[\w-]{11}$/;
const CHANNEL_ID = /^UC[\w-]{22}$/;
const PLAYLIST_ID = /^[\w-]{2,64}$/;
const HANDLE = /^[\p{L}\p{N}._-]{3,30}$/u;
/** Prefixes YouTube uses for playlists the API can read. */
const READABLE_PLAYLIST = /^(PL|UU|UUSH|UULF|UULV|UUMO|UUPS|UUPV|FL|OLAK5uy_|OL|EL|CL|SP|PU|LP|UL)[\w-]{8,}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
  'youtube-nocookie.com',
]);

export function sourceToken(source: Source): string {
  switch (source.kind) {
    case 'playlist':
      return `p:${source.id}`;
    case 'video':
      return `v:${source.id}`;
    case 'channel':
      return `c:${source.id}`;
    case 'handle':
      return `h:${source.handle}`;
    case 'username':
      return `u:${source.name}`;
  }
}

export function parseToken(token: string): Source | null {
  const match = /^([pvchu]):(.+)$/u.exec(token);
  if (!match) return null;
  const [, kind, value = ''] = match;
  switch (kind) {
    case 'p':
      return PLAYLIST_ID.test(value) && classifyPlaylist(value) === 'ok' ? { kind: 'playlist', id: value } : null;
    case 'v':
      return VIDEO_ID.test(value) ? { kind: 'video', id: value } : null;
    case 'c':
      return CHANNEL_ID.test(value) ? { kind: 'channel', id: value } : null;
    case 'h':
      return HANDLE.test(value) ? { kind: 'handle', handle: value } : null;
    case 'u':
      return /^[\w.-]{2,40}$/.test(value) ? { kind: 'username', name: value } : null;
    default:
      return null;
  }
}

function classifyPlaylist(id: string): 'ok' | UnsupportedReason {
  if (id.startsWith('RD')) return 'mix';
  if (id === 'WL' || id === 'LL' || id === 'LM') return 'private_list';
  return 'ok';
}

type PieceResult =
  | { ok: true; source: Source; index?: number }
  | { ok: false; reason: UnsupportedReason };

function fromPlaylistId(id: string, index?: number): PieceResult {
  const kind = classifyPlaylist(id);
  if (kind !== 'ok') return { ok: false, reason: kind };
  if (!PLAYLIST_ID.test(id)) return { ok: false, reason: 'unknown' };
  return { ok: true, source: { kind: 'playlist', id }, index };
}

function toUrl(text: string): URL | null {
  let candidate = text.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    if (!/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function parseIndex(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 && n <= 100_000 ? n : undefined;
}

function parseUrl(url: URL): PieceResult {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const list = url.searchParams.get('list');
  const index = parseIndex(url.searchParams.get('index'));

  if (host === 'youtu.be') {
    if (list) return fromPlaylistId(list, index);
    const id = segments[0];
    return id && VIDEO_ID.test(id) ? { ok: true, source: { kind: 'video', id } } : { ok: false, reason: 'unknown' };
  }
  if (!YOUTUBE_HOSTS.has(host)) return { ok: false, reason: 'unknown' };

  // Any page inside a playlist: /playlist, /watch, /embed/videoseries, music links.
  if (list) return fromPlaylistId(list, index);

  const [first = '', second = ''] = segments;
  if (first === 'watch') {
    const v = url.searchParams.get('v');
    return v && VIDEO_ID.test(v) ? { ok: true, source: { kind: 'video', id: v } } : { ok: false, reason: 'unknown' };
  }
  if ((first === 'shorts' || first === 'live' || first === 'embed' || first === 'v') && VIDEO_ID.test(second)) {
    return { ok: true, source: { kind: 'video', id: second } };
  }
  if (first.startsWith('@')) {
    const handle = first.slice(1);
    return HANDLE.test(handle) ? { ok: true, source: { kind: 'handle', handle } } : { ok: false, reason: 'unknown' };
  }
  if (first === 'channel' && CHANNEL_ID.test(second)) return { ok: true, source: { kind: 'channel', id: second } };
  if (first === 'user' && /^[\w.-]{2,40}$/.test(second)) return { ok: true, source: { kind: 'username', name: second } };
  if (first === 'c') return { ok: false, reason: 'custom_url' };
  return { ok: false, reason: 'unknown' };
}

function parsePiece(text: string): PieceResult {
  const url = toUrl(text);
  if (url) return parseUrl(url);

  const raw = text.trim();
  if (raw.startsWith('@')) {
    const handle = raw.slice(1);
    return HANDLE.test(handle) ? { ok: true, source: { kind: 'handle', handle } } : { ok: false, reason: 'unknown' };
  }
  if (CHANNEL_ID.test(raw)) return { ok: true, source: { kind: 'channel', id: raw } };
  if (raw.startsWith('RD') && raw.length > 11) return { ok: false, reason: 'mix' };
  if (raw === 'WL' || raw === 'LL' || raw === 'LM') return { ok: false, reason: 'private_list' };
  if (READABLE_PLAYLIST.test(raw)) return { ok: true, source: { kind: 'playlist', id: raw } };
  if (VIDEO_ID.test(raw)) return { ok: true, source: { kind: 'video', id: raw } };
  return { ok: false, reason: 'unknown' };
}

/** Max sources in one calculation. */
export const MAX_SOURCES = 10;

/**
 * Reads everything a person might paste: playlist, video, Shorts, live, channel and handle links,
 * music.youtube.com links, links without https://, bare IDs, several of them separated by spaces,
 * commas or new lines.
 */
export function parseInput(text: string): ParsedInput {
  const pieces = text
    .split(/[\s,;]+/)
    .map((p) => p.trim().replace(/^[<("'[]+|[>)"'\].]+$/g, ''))
    .filter(Boolean);

  const sources: Source[] = [];
  const seen = new Set<string>();
  const rejected: ParsedInput['rejected'] = [];
  const indexes: (number | undefined)[] = [];

  for (const piece of pieces) {
    const result = parsePiece(piece);
    if (!result.ok) {
      rejected.push({ text: piece, reason: result.reason });
      continue;
    }
    const token = sourceToken(result.source);
    if (seen.has(token)) continue;
    seen.add(token);
    sources.push(result.source);
    indexes.push(result.index);
  }

  const parsed: ParsedInput = { sources: sources.slice(0, MAX_SOURCES), rejected };
  if (sources.length > MAX_SOURCES) parsed.dropped = sources.length - MAX_SOURCES;
  if (sources.length === 1 && indexes[0] && indexes[0] > 1) parsed.startIndex = indexes[0];
  return parsed;
}
