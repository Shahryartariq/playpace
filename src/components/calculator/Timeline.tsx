'use client';

import { useMemo } from 'react';
import { atSpeed, type Item } from '@/lib/calc';
import { fill } from '@/lib/format';
import type { Ui } from './types';
import type { Fmt } from './useFormat';

interface Props {
  ui: Ui;
  f: Fmt;
  /** Videos being counted, in order. */
  items: Item[];
  /** Their total length at 1x. */
  total: number;
  speed: number;
}

const WIDTH = 1000;
const MAX_BLOCKS = 1200;

interface Block {
  x: number;
  w: number;
  first: Item;
  last: Item;
  seconds: number;
}

/**
 * The playlist as a strip of blocks, one per video, sized by length. At higher speeds the strip
 * shrinks to show how much of the original running time is left; the dashed part is time saved.
 * This part of the page only renders in the browser, so the inline styles go through the CSSOM
 * and are allowed by the nonce-based CSP.
 */
export function Timeline({ ui, f, items, total, speed }: Props) {
  const blocks = useMemo(() => {
    if (!total) return [] as Block[];
    const per = Math.max(1, Math.ceil(items.length / MAX_BLOCKS));
    const out: Block[] = [];
    let x = 0;
    for (let i = 0; i < items.length; i += per) {
      const group = items.slice(i, i + per);
      const seconds = group.reduce((s, v) => s + v.d, 0);
      const w = (seconds / total) * WIDTH;
      out.push({ x, w, first: group[0]!, last: group.at(-1)!, seconds });
      x += w;
    }
    return out;
  }, [items, total]);

  if (!blocks.length) return null;
  const scale = 1 / speed;
  const savedWidth = WIDTH * (1 - Math.min(1, scale));

  return (
    <figure className="timeline">
      <svg
        viewBox={`0 0 ${WIDTH} 36`}
        preserveAspectRatio="none"
        className="timeline__svg"
        role="img"
        aria-label={`${f.dur(atSpeed(total, speed))}, ${f.count(ui.plurals.videos, items.length)}`}
      >
        {speed > 1 ? (
          <rect
            className="timeline__saved"
            x={WIDTH - savedWidth + 2}
            y={2}
            width={Math.max(0, savedWidth - 4)}
            height={32}
            rx={6}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <g className="timeline__strip" style={{ transform: `scaleX(${Math.min(1, scale)})` }}>
          {blocks.map((b, i) => (
            <rect
              key={b.first.n}
              className={i % 2 ? 'timeline__block timeline__block--b' : 'timeline__block'}
              x={b.x}
              y={2}
              width={Math.max(0.6, b.w - (b.w > 3 ? 1 : 0))}
              height={32}
            >
              <title>
                {b.first.n === b.last.n
                  ? `${f.int(b.first.n)}. ${b.first.t} (${f.clock(b.seconds)})`
                  : `${f.int(b.first.n)}–${f.int(b.last.n)} (${f.clock(b.seconds)})`}
              </title>
            </rect>
          ))}
        </g>
      </svg>
      <div className="timeline__axis" aria-hidden="true">
        <span>0</span>
        <span className="timeline__end" style={{ insetInlineStart: `${Math.min(1, scale) * 100}%` }}>
          {f.dur(atSpeed(total, speed), false)}
        </span>
        {speed > 1 ? <span className="timeline__saved-label">{fill(ui.results.saves, { time: f.dur(total - atSpeed(total, speed), false) })}</span> : null}
      </div>
      <figcaption className="timeline__caption">{ui.results.timelineLabel}</figcaption>
    </figure>
  );
}
