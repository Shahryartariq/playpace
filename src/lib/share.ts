import { clampSpeed, type Mode, type Selection } from './calc';
import { MAX_SOURCES, parseToken, sourceToken } from './youtube/parse-input';
import type { Source } from './youtube/types';

export interface ShareState {
  sources: Source[];
  selection: Selection;
  speed: number;
}

/** Query string that reopens a calculation: ?q=p:PLxx,h:name&m=range&a=3&b=20&s=1.5 */
export function shareQuery(state: ShareState): string {
  const params = new URLSearchParams();
  params.set('q', state.sources.map(sourceToken).join(','));
  if (state.selection.mode !== 'all') {
    params.set('m', state.selection.mode);
    params.set('a', String(state.selection.from));
    if (state.selection.mode === 'range') params.set('b', String(state.selection.to));
  }
  if (state.speed !== 1) params.set('s', String(state.speed));
  return params.toString();
}

function readInt(value: string | null | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100_000) : fallback;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function get(params: ParamSource, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key);
  const v = params[key];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export function readShareQuery(params: ParamSource): ShareState | null {
  const q = get(params, 'q');
  if (!q) return null;
  const sources = q
    .split(',')
    .map((t) => parseToken(t.trim()))
    .filter((s): s is Source => !!s)
    .slice(0, MAX_SOURCES);
  if (!sources.length) return null;
  const m = get(params, 'm');
  const mode: Mode = m === 'range' || m === 'from' ? m : 'all';
  const speedRaw = Number.parseFloat(get(params, 's') ?? '1');
  return {
    sources,
    selection: { mode, from: readInt(get(params, 'a'), 1), to: readInt(get(params, 'b'), 0) },
    speed: Number.isFinite(speedRaw) ? clampSpeed(speedRaw) : 1,
  };
}

/** Turns sources back into links a person would recognise, for the input box. */
export function sourceToLink(source: Source): string {
  switch (source.kind) {
    case 'playlist':
      return `https://www.youtube.com/playlist?list=${source.id}`;
    case 'video':
      return `https://www.youtube.com/watch?v=${source.id}`;
    case 'channel':
      return `https://www.youtube.com/channel/${source.id}`;
    case 'handle':
      return `https://www.youtube.com/@${source.handle}`;
    case 'username':
      return `https://www.youtube.com/user/${source.name}`;
  }
}

export type Network = 'x' | 'facebook' | 'whatsapp' | 'telegram' | 'reddit' | 'linkedin' | 'email';

export const NETWORKS: Network[] = ['whatsapp', 'x', 'facebook', 'telegram', 'reddit', 'linkedin', 'email'];

export function networkUrl(network: Network, url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (network) {
    case 'x':
      return `https://x.com/intent/post?text=${t}&url=${u}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case 'reddit':
      return `https://www.reddit.com/submit?url=${u}&title=${t}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case 'email':
      return `mailto:?subject=${t}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
  }
}
