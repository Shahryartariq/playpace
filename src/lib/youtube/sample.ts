import { YouTubeError, type FetchOptions } from './client';
import { sourceToken } from './parse-input';
import type { ListData, ListMeta, Source, Video } from './types';

/**
 * Built-in sample lists for development, tests and screenshots (PLAYPACE_SAMPLE_DATA=1).
 * Any id works: unknown ones get a playlist generated from the id, so pasted links still show something.
 * Ids containing "NotFound" fail with not_found and "Quota" with quota, to exercise error states.
 */
export const SAMPLE_IDS = {
  course: 'PLplaypaceSampleCourse01',
  long: 'PLplaypaceSampleLong0001',
  music: 'PLplaypaceSampleMusic001',
  missing: 'PLplaypaceNotFound00001',
  quota: 'PLplaypaceQuota00000001',
  handle: 'playpace',
  video: 'PPsample001',
} as const;

const TOPICS = [
  'Setting up your tools',
  'Variables and types',
  'Functions in depth',
  'Working with arrays',
  'Objects and classes',
  'Async code and promises',
  'Fetching data from an API',
  'Building the first page',
  'Forms and validation',
  'State and effects',
  'Routing between pages',
  'Styling with CSS',
  'Testing your code',
  'Debugging like a pro',
  'Databases explained',
  'Writing a REST API',
  'Authentication basics',
  'Deploying to production',
  'Performance tuning',
  'Project walkthrough',
];

const SONGS = ['Morning drive', 'City lights', 'Slow river', 'Paper planes', 'Northern sky', 'Late train'];

/** Small deterministic PRNG so fixtures never change between runs. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function videoId(seed: string, i: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const r = rng(`${seed}:${i}`);
  let id = '';
  for (let k = 0; k < 11; k++) id += chars[Math.floor(r() * chars.length)];
  return id;
}

function buildList(seed: string, count: number, kind: 'course' | 'music'): Video[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const id = videoId(seed, i);
    if (kind === 'music') {
      const song = SONGS[i % SONGS.length]!;
      return { id, t: `${song} (Part ${Math.floor(i / SONGS.length) + 1})`, c: 'Playpace Samples', d: 150 + Math.floor(r() * 150) };
    }
    const topic = TOPICS[i % TOPICS.length]!;
    return { id, t: `Lesson ${i + 1}: ${topic}`, c: 'Playpace Samples', d: 240 + Math.floor(r() * 2700) };
  });
}

function sampleData(source: Source): ListData {
  const token = sourceToken(source);
  const thumb = undefined;

  if (source.kind === 'video') {
    const video: Video = { id: source.id, t: 'How playback speed changes what you remember', c: 'Playpace Samples', d: 1234 };
    const meta: ListMeta = {
      token,
      kind: 'video',
      id: source.id,
      title: video.t,
      channel: 'Playpace Samples',
      itemCount: 1,
      url: `https://www.youtube.com/watch?v=${source.id}`,
    };
    return { meta, videos: [video], truncated: false, fetchedAt: Date.now() };
  }

  if (source.kind !== 'playlist') {
    const name = source.kind === 'handle' ? source.handle : source.kind === 'username' ? source.name : source.id;
    const videos = buildList(`channel:${name}`, 60, 'course');
    const meta: ListMeta = {
      token,
      kind: 'channel',
      id: `UUsample${name}`,
      title: name === SAMPLE_IDS.handle ? 'Playpace' : name,
      channel: name === SAMPLE_IDS.handle ? 'Playpace' : name,
      thumb,
      itemCount: videos.length,
      url: `https://www.youtube.com/@${name}`,
    };
    return { meta, videos, truncated: false, fetchedAt: Date.now() };
  }

  const id = source.id;
  let title = 'Sample playlist';
  let videos: Video[];
  if (id === SAMPLE_IDS.course) {
    title = 'Full-stack web development, complete course';
    videos = buildList(id, 36, 'course');
    videos[7] = { id: videoId(id, 7), t: 'Private video', d: 0, s: 'private' };
    videos[19] = { id: videoId(id, 19), t: 'Deleted video', d: 0, s: 'deleted' };
    videos[35] = { id: videoId(id, 35), t: 'Live Q&A (upcoming)', c: 'Playpace Samples', d: 0, s: 'live' };
  } else if (id === SAMPLE_IDS.long) {
    title = 'Every lecture, 1,200 videos';
    videos = buildList(id, 1200, 'course');
  } else if (id === SAMPLE_IDS.music) {
    title = 'Focus music mix';
    videos = buildList(id, 18, 'music');
  } else {
    const r = rng(id);
    videos = buildList(id, 10 + Math.floor(r() * 50), 'course');
  }

  const meta: ListMeta = {
    token,
    kind: 'playlist',
    id,
    title,
    channel: 'Playpace Samples',
    thumb,
    itemCount: videos.length,
    url: `https://www.youtube.com/playlist?list=${id}`,
  };
  return { meta, videos, truncated: false, fetchedAt: Date.now() };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Same contract as fetchSource, served from fixtures with a small delay so progress is visible. */
export async function fetchSample(source: Source, opts: Pick<FetchOptions, 'onMeta' | 'onProgress' | 'signal'>): Promise<ListData> {
  const id = source.kind === 'playlist' ? source.id : '';
  if (id.includes('NotFound')) throw new YouTubeError('not_found');
  if (id.includes('Quota')) throw new YouTubeError('quota');

  const data = sampleData(source);
  opts.onMeta?.(data.meta);
  const total = data.videos.length;
  for (let loaded = 50; loaded < total; loaded += 50) {
    await sleep(total > 500 ? 40 : 15);
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    opts.onProgress?.(loaded, total);
  }
  opts.onProgress?.(total, total);
  return data;
}
