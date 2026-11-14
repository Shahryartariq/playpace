/** What a pasted link points to. The token form (`p:ID`, `v:ID`, `c:ID`, `h:handle`, `u:name`) travels in URLs. */
export type Source =
  | { kind: 'playlist'; id: string }
  | { kind: 'video'; id: string }
  | { kind: 'channel'; id: string }
  | { kind: 'handle'; handle: string }
  | { kind: 'username'; name: string };

export type UnsupportedReason = 'mix' | 'private_list' | 'custom_url' | 'unknown';

export interface ParsedInput {
  sources: Source[];
  /** Pieces we couldn't use, with why. */
  rejected: { text: string; reason: UnsupportedReason }[];
  /** `index=` from a watch link that's inside a playlist (1-based), when there is exactly one source. */
  startIndex?: number;
  /** How many valid links were left out because only MAX_SOURCES are counted. */
  dropped?: number;
}

export type VideoStatus = 'live' | 'private' | 'deleted' | 'unavailable';

/** One video in a list. Short keys keep the cached payload small for 5,000-video playlists. */
export interface Video {
  /** YouTube video id. */
  id: string;
  /** Title. */
  t: string;
  /** Channel that uploaded it. */
  c?: string;
  /** Duration in seconds (0 when it can't be counted). */
  d: number;
  /** Set when the video can't be counted. */
  s?: VideoStatus;
}

export interface ListMeta {
  token: string;
  kind: 'playlist' | 'channel' | 'video';
  id: string;
  title: string;
  channel: string;
  thumb?: string;
  /** Items YouTube says the list has (can include private and deleted videos). */
  itemCount: number;
  url: string;
}

export interface ListData {
  meta: ListMeta;
  videos: Video[];
  /** True when the list had more than MAX_ITEMS videos and we stopped there. */
  truncated: boolean;
  fetchedAt: number;
}

export type ErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'mix'
  | 'private_list'
  | 'custom_url'
  | 'quota'
  | 'rate_limited'
  | 'upstream'
  | 'config';

export type StreamEvent =
  | { type: 'meta'; meta: ListMeta; cached: boolean }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'done'; data: ListData }
  | { type: 'error'; code: ErrorCode };

export const MAX_ITEMS = 5000;
