import { SAMPLE_IDS } from './youtube/sample';

export interface Example {
  key: 'course' | 'music' | 'channel';
  link: string;
}

/** Real, public lists (checked November 2026). Sample mode swaps in the built-in fixtures. */
const LIVE: Example[] = [
  // CS50x 2024 lectures, Harvard's CS50 channel.
  { key: 'course', link: 'https://www.youtube.com/playlist?list=PLhQjrBD2T381WAHyx1pq-sBfykqMBI7V4' },
  // "Popular Music Videos" from YouTube's own Music channel.
  { key: 'music', link: 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' },
  { key: 'channel', link: 'https://www.youtube.com/@3blue1brown' },
];

const SAMPLE: Example[] = [
  { key: 'course', link: `https://www.youtube.com/playlist?list=${SAMPLE_IDS.course}` },
  { key: 'music', link: `https://www.youtube.com/playlist?list=${SAMPLE_IDS.music}` },
  { key: 'channel', link: `https://www.youtube.com/@${SAMPLE_IDS.handle}` },
];

export function examples(sample: boolean): Example[] {
  return sample ? SAMPLE : LIVE;
}
