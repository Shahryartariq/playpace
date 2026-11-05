'use client';

import { useMemo, useState } from 'react';
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
 *
 * Hovering shows one label above the strip instead of an SVG <title> per block: hundreds of <title>
 * elements appearing at once make Malwarebytes Browser Guard block the page as a scam.
 * This part of the page only renders in the browser, so the inline styles go through the CSSOM
 * and are allowed by the nonce-based CSP.
 */
export function Timeline({ ui, f, items, total, speed }: Props) {
  const [hover, setHover] = useState<Block | null>(null);

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
  const scale = Math.min(1, 1 / speed);
  const savedWidth = WIDTH * (1 - scale);

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    let fraction = (event.clientX - box.left) / box.width;
    if (getComputedStyle(event.currentTarget).direction === 'rtl') fraction = 1 - fraction;
    const x = (fraction / scale) * WIDTH;
    if (x < 0 || x > WIDTH) {
      setHover(null);
      return;
    }
    // Blocks are sorted by x, so a binary search finds the one under the pointer.
    let lo = 0;
    let hi = blocks.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (blocks[mid]!.x <= x) lo = mid;
      else hi = mid - 1;
    }
    const block = blocks[lo]!;
    setHover((prev) => (prev === block ? prev : block));
  };

  const label = hover
    ? hover.first.n === hover.last.n
      ? `${f.int(hover.first.n)}. ${hover.first.t} (${f.clock(atSpeed(hover.seconds, speed))})`
      : `${f.int(hover.first.n)}–${f.int(hover.last.n)} (${f.clock(atSpeed(hover.seconds, speed))})`
    : '';

  return (
    <figure className="timeline">
      <p className="timeline__hover" aria-hidden="true" dir="auto">
        {label}
      </p>
      <svg
        viewBox={`0 0 ${WIDTH} 36`}
        preserveAspectRatio="none"
        className="timeline__svg"
        role="img"
        aria-label={`${f.dur(atSpeed(total, speed))}, ${f.count(ui.plurals.videos, items.length)}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
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
        <g className="timeline__strip" style={{ transform: `scaleX(${scale})` }}>
          {blocks.map((b, i) => (
            <rect
              key={b.first.n}
              className={[
                'timeline__block',
                i % 2 ? 'timeline__block--b' : '',
                hover === b ? 'is-hover' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              x={b.x}
              y={2}
              width={Math.max(0.6, b.w - (b.w > 3 ? 1 : 0))}
              height={32}
            />
          ))}
        </g>
      </svg>
      <div className="timeline__axis" aria-hidden="true">
        <span>0</span>
        <span className="timeline__end" style={{ insetInlineStart: `${scale * 100}%` }}>
          {f.dur(atSpeed(total, speed), false)}
        </span>
        {speed > 1 ? (
          <span className="timeline__saved-label">
            {fill(ui.results.saves, { time: f.dur(total - atSpeed(total, speed), false) })}
          </span>
        ) : null}
      </div>
      <figcaption className="timeline__caption">{ui.results.timelineLabel}</figcaption>
    </figure>
  );
}
