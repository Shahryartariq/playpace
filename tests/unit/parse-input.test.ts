import { describe, expect, it } from 'vitest';
import { parseInput, parseToken, sourceToken } from '@/lib/youtube/parse-input';

const PL = 'PLWKjhJtqVAbnRT_hue-3zyiuIYj0OlpyG';

describe('parseInput', () => {
  it.each([
    [`https://www.youtube.com/playlist?list=${PL}`],
    [`youtube.com/playlist?list=${PL}`],
    [`https://m.youtube.com/playlist?list=${PL}`],
    [`https://music.youtube.com/playlist?list=${PL}`],
    [`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${PL}`],
    [`https://youtu.be/dQw4w9WgXcQ?list=${PL}`],
    [`https://www.youtube.com/embed/videoseries?list=${PL}`],
    [`https://www.youtube-nocookie.com/embed/videoseries?list=${PL}`],
    [PL],
    [`<${PL}>`],
  ])('reads a playlist from %s', (text) => {
    expect(parseInput(text).sources).toEqual([{ kind: 'playlist', id: PL }]);
  });

  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ?si=abc'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ'],
  ])('reads a single video from %s', (text) => {
    expect(parseInput(text).sources).toEqual([{ kind: 'video', id: 'dQw4w9WgXcQ' }]);
  });

  it('reads channels, handles and legacy user links', () => {
    expect(parseInput('https://www.youtube.com/@freecodecamp/videos').sources).toEqual([
      { kind: 'handle', handle: 'freecodecamp' },
    ]);
    expect(parseInput('@Fireship').sources).toEqual([{ kind: 'handle', handle: 'Fireship' }]);
    expect(parseInput('https://www.youtube.com/channel/UC8butISFwT-Wl7EV0hUK0BQ').sources).toEqual([
      { kind: 'channel', id: 'UC8butISFwT-Wl7EV0hUK0BQ' },
    ]);
    expect(parseInput('https://www.youtube.com/user/schafer5').sources).toEqual([{ kind: 'username', name: 'schafer5' }]);
  });

  it('accepts handles in any script', () => {
    expect(parseInput('https://www.youtube.com/@%D8%B9%D9%84%D9%8A').sources).toEqual([{ kind: 'handle', handle: 'علي' }]);
  });

  it('reads several links separated by new lines, spaces and commas, without duplicates', () => {
    const text = `https://www.youtube.com/playlist?list=${PL}\nPLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG, ${PL} @mkbhd`;
    expect(parseInput(text).sources.map(sourceToken)).toEqual([`p:${PL}`, 'p:PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG', 'h:mkbhd']);
  });

  it('keeps the index from a link inside a playlist', () => {
    expect(parseInput(`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${PL}&index=12`).startIndex).toBe(12);
    expect(parseInput(`https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${PL}&index=1`).startIndex).toBeUndefined();
  });

  it('explains links it cannot read', () => {
    expect(parseInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ').rejected[0]?.reason).toBe('mix');
    expect(parseInput('https://www.youtube.com/playlist?list=WL').rejected[0]?.reason).toBe('private_list');
    expect(parseInput('https://www.youtube.com/playlist?list=LL').rejected[0]?.reason).toBe('private_list');
    expect(parseInput('https://www.youtube.com/c/SomeName').rejected[0]?.reason).toBe('custom_url');
    expect(parseInput('https://vimeo.com/123').rejected[0]?.reason).toBe('unknown');
    expect(parseInput('hello world').sources).toEqual([]);
  });

  it('limits a calculation to ten links', () => {
    const many = Array.from({ length: 14 }, (_, i) => `PLaaaaaaaaaaaaaaaaaaaaaaaaaaaaa${String(i).padStart(2, '0')}`).join('\n');
    expect(parseInput(many).sources).toHaveLength(10);
  });
});

describe('tokens', () => {
  it('round-trips every source kind', () => {
    for (const token of [`p:${PL}`, 'v:dQw4w9WgXcQ', 'c:UC8butISFwT-Wl7EV0hUK0BQ', 'h:mkbhd', 'u:schafer5']) {
      const source = parseToken(token);
      expect(source).not.toBeNull();
      expect(sourceToken(source!)).toBe(token);
    }
  });

  it('rejects malformed or unsupported tokens', () => {
    for (const token of ['', 'p:', 'x:abc', 'v:short', 'c:notachannel', 'p:RDdQw4w9WgXcQ', 'p:WL', 'p:a b', 'h:<script>']) {
      expect(parseToken(token)).toBeNull();
    }
  });
});
