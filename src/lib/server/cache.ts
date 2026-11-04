import 'server-only';
import { getCache } from '@vercel/functions';
import type { ListData } from '../youtube/types';

/**
 * Finished lists are kept in Vercel's Runtime Cache (in memory when running elsewhere), so the same
 * playlist asked for again costs no YouTube quota and returns instantly. Bump VERSION when ListData changes.
 */
const VERSION = 'v1';
export const LIST_TTL_SECONDS = 2 * 60 * 60;

function key(token: string): string {
  return `playpace:${VERSION}:${token}`;
}

export async function readList(token: string): Promise<ListData | null> {
  try {
    const value = await getCache().get(key(token));
    return value && typeof value === 'object' && 'meta' in value ? (value as ListData) : null;
  } catch (err) {
    console.warn('[cache] read failed', (err as Error).message);
    return null;
  }
}

export async function writeList(token: string, data: ListData): Promise<void> {
  try {
    await getCache().set(key(token), data, { ttl: LIST_TTL_SECONDS, tags: ['playpace-lists'] });
  } catch (err) {
    console.warn('[cache] write failed', (err as Error).message);
  }
}
