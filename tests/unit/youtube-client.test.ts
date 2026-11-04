import { describe, expect, it, vi } from 'vitest';
import { estimateSeconds, fetchSource, YouTubeError } from '@/lib/youtube/client';
import { MAX_ITEMS } from '@/lib/youtube/types';

type Handler = (url: URL) => { status?: number; body: unknown };

function mockFetch(handler: Handler) {
  const calls: URL[] = [];
  const fn = vi.fn(async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    calls.push(url);
    const { status = 200, body } = handler(url);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const vid = (i: number) => `vid${String(i).padStart(8, '0')}`;

/** A fake YouTube with one playlist of `count` items; item 2 is private, item 3 deleted, item 4 a live stream. */
function fakeYouTube(count: number) {
  return (url: URL) => {
    const path = url.pathname.split('/').pop();
    if (path === 'playlists') {
      return {
        body: {
          items: [
            {
              id: url.searchParams.get('id'),
              snippet: { title: 'My course', channelTitle: 'Teacher', thumbnails: { medium: { url: 'https://i.ytimg.com/m.jpg' } } },
              contentDetails: { itemCount: count },
            },
          ],
        },
      };
    }
    if (path === 'playlistItems') {
      const page = Number(url.searchParams.get('pageToken') ?? '0');
      const start = page * 50;
      const items = Array.from({ length: Math.min(50, count - start) }, (_, k) => {
        const i = start + k;
        const title = i === 2 ? 'Private video' : i === 3 ? 'Deleted video' : `Video ${i}`;
        return { snippet: { title, videoOwnerChannelTitle: 'Teacher', resourceId: { videoId: vid(i) } } };
      });
      return { body: { items, nextPageToken: start + 50 < count ? String(page + 1) : undefined } };
    }
    if (path === 'videos') {
      const ids = (url.searchParams.get('id') ?? '').split(',');
      return {
        body: {
          items: ids
            .filter((id) => id !== vid(2) && id !== vid(3))
            .map((id) => ({
              id,
              snippet: { title: `T ${id}`, channelTitle: 'Teacher', liveBroadcastContent: id === vid(4) ? 'live' : 'none' },
              contentDetails: { duration: id === vid(4) ? 'P0D' : 'PT10M5S' },
            })),
        },
      };
    }
    if (path === 'channels') {
      return {
        body: {
          items: [
            {
              id: 'UC0123456789012345678901',
              snippet: { title: 'Some Channel' },
              contentDetails: { relatedPlaylists: { uploads: 'UU0123456789012345678901' } },
            },
          ],
        },
      };
    }
    return { status: 404, body: {} };
  };
}

describe('fetchSource', () => {
  it('reads a playlist across pages in order, with statuses for unplayable videos', async () => {
    const { fetch, calls } = mockFetch(fakeYouTube(120));
    const progress: number[] = [];
    let meta: unknown;
    const data = await fetchSource(
      { kind: 'playlist', id: 'PLtest0000000000' },
      { apiKey: 'k', fetch, onMeta: (m) => (meta = m), onProgress: (loaded) => progress.push(loaded) },
    );
    expect(meta).toMatchObject({ title: 'My course', channel: 'Teacher', itemCount: 120, kind: 'playlist' });
    expect(data.videos).toHaveLength(120);
    expect(data.videos.map((v) => v.id)).toEqual(Array.from({ length: 120 }, (_, i) => vid(i)));
    expect(data.videos[0]).toEqual({ id: vid(0), t: `T ${vid(0)}`, c: 'Teacher', d: 605 });
    expect(data.videos[2]).toMatchObject({ s: 'private', d: 0 });
    expect(data.videos[3]).toMatchObject({ s: 'deleted', d: 0 });
    expect(data.videos[4]).toMatchObject({ s: 'live', d: 0 });
    expect(progress.at(-1)).toBe(120);
    // 1 playlists + 3 playlistItems pages + 3 videos batches; every call carries the key.
    expect(calls).toHaveLength(7);
    expect(calls.every((u) => u.searchParams.get('key') === 'k')).toBe(true);
    expect(calls.filter((u) => u.pathname.endsWith('/videos')).every((u) => u.searchParams.get('id')!.split(',').length <= 50)).toBe(true);
  });

  it('stops at the 5,000 video limit', async () => {
    const { fetch } = mockFetch(fakeYouTube(5060));
    const data = await fetchSource({ kind: 'playlist', id: 'PLtest0000000000' }, { apiKey: 'k', fetch });
    expect(data.videos).toHaveLength(MAX_ITEMS);
    expect(data.truncated).toBe(true);
  });

  it('reads a channel through its uploads playlist', async () => {
    const { fetch, calls } = mockFetch(fakeYouTube(10));
    const data = await fetchSource({ kind: 'handle', handle: 'somechannel' }, { apiKey: 'k', fetch });
    expect(calls[0]?.searchParams.get('forHandle')).toBe('@somechannel');
    expect(data.meta).toMatchObject({ kind: 'channel', title: 'Some Channel', id: 'UU0123456789012345678901' });
    expect(data.videos).toHaveLength(10);
  });

  it('reads a single video', async () => {
    const { fetch } = mockFetch(fakeYouTube(10));
    const data = await fetchSource({ kind: 'video', id: vid(7) }, { apiKey: 'k', fetch });
    expect(data.meta.kind).toBe('video');
    expect(data.videos).toEqual([{ id: vid(7), t: `T ${vid(7)}`, c: 'Teacher', d: 605 }]);
  });

  it.each([
    [404, 'playlistNotFound', 'not_found'],
    [403, 'quotaExceeded', 'quota'],
    [400, 'keyInvalid', 'config'],
    [403, 'playlistItemsNotAccessible', 'not_found'],
    [500, 'backendError', 'upstream'],
  ])('maps HTTP %i %s to %s', async (status, reason, code) => {
    const { fetch } = mockFetch(() => ({ status, body: { error: { errors: [{ reason }] } } }));
    await expect(fetchSource({ kind: 'playlist', id: 'PLtest0000000000' }, { apiKey: 'k', fetch })).rejects.toMatchObject({
      code,
    });
  });

  it('reports an empty answer as not found', async () => {
    const { fetch } = mockFetch(() => ({ body: { items: [] } }));
    const err = await fetchSource({ kind: 'playlist', id: 'PLtest0000000000' }, { apiKey: 'k', fetch }).catch((e) => e);
    expect(err).toBeInstanceOf(YouTubeError);
    expect(err.code).toBe('not_found');
  });

  it('estimates fetch time from the item count', () => {
    expect(estimateSeconds(10)).toBe(1);
    expect(estimateSeconds(5000)).toBeGreaterThan(15);
  });
});
