'use client';

import { useMemo, type RefObject } from 'react';
import { atSpeed, cumulativeEnds, inSelection, isCountable, type Item, type Selection, type Totals } from '@/lib/calc';
import { fill } from '@/lib/format';
import { TimeFit } from '@/components/TimeFit';
import type { ListData } from '@/lib/youtube/types';
import { Planner } from './Planner';
import { ShareExport } from './ShareExport';
import { SpeedTable } from './SpeedTable';
import { Timeline } from './Timeline';
import type { Ui } from './types';
import type { Fmt } from './useFormat';
import { VideoList } from './VideoList';

interface Props {
  ui: Ui;
  f: Fmt;
  lists: ListData[];
  items: Item[];
  selection: Selection;
  totals: Totals;
  watched: ReadonlySet<string>;
  speed: number;
  notices: string[];
  query: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSpeed: (speed: number) => void;
  onStartHere: (n: number) => void;
}

function BigTime({ seconds, f }: { seconds: number; f: Fmt }) {
  // Render "12h 04m 31s" with smaller unit letters, keeping the language's own order and spacing.
  const text = f.dur(seconds);
  const parts = text.split(/(\d[\d.,\s  ]*)/u).filter(Boolean);
  return (
    <span className="big-time" dir="auto">
      {parts.map((part, i) =>
        /^\d/.test(part) ? (
          <span key={i} className="big-time__num">
            {part}
          </span>
        ) : (
          <span key={i} className="big-time__unit">
            {part}
          </span>
        ),
      )}
    </span>
  );
}

export function Results(props: Props) {
  const { ui, f, lists, items, selection, totals, watched, speed, notices, query, headingRef, onSpeed, onStartHere } = props;
  const fast = atSpeed(totals.seconds, speed);
  const counted = useMemo(
    () => items.filter((i) => inSelection(i.n, selection) && isCountable(i) && !watched.has(i.id)),
    [items, selection, watched],
  );
  const ends = useMemo(() => cumulativeEnds(items, selection, watched, speed), [items, selection, watched, speed]);
  const title = lists.length === 1 ? lists[0]!.meta.title : lists.map((l) => l.meta.title).join(' + ');

  const scope =
    selection.mode === 'range'
      ? fill(ui.results.rangeNote, { from: f.int(selection.from), to: f.int(selection.to) })
      : selection.mode === 'from'
        ? fill(ui.results.fromNote, { from: f.int(selection.from) })
        : ui.results.allNote;

  return (
    <section className="results" aria-labelledby="results-heading">
      <h2 id="results-heading" className="visually-hidden" ref={headingRef} tabIndex={-1}>
        {ui.results.heading}: {title}
      </h2>

      <div className="results__lists">
        {lists.length > 1 ? <p className="results__combined">{fill(ui.results.combined, { n: f.int(lists.length) })}</p> : null}
        <ul role="list" className="list-cards">
          {lists.map((l) => (
            <li key={l.meta.token} className="list-card">
              {l.meta.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails, already sized by YouTube.
                <img src={l.meta.thumb} alt="" width={120} height={68} loading="lazy" decoding="async" className="list-card__thumb" />
              ) : (
                <span className="list-card__thumb list-card__thumb--empty" aria-hidden="true" />
              )}
              <div className="list-card__body">
                <a href={l.meta.url} className="list-card__title" target="_blank" rel="noopener noreferrer" dir="auto">
                  {l.meta.title || l.meta.id}
                </a>
                <p className="list-card__meta">
                  {l.meta.kind === 'channel' ? ui.results.channelUploads : l.meta.channel ? fill(ui.results.by, { channel: l.meta.channel }) : null}
                  {l.meta.kind !== 'video' ? <span>{f.count(ui.plurals.videos, l.videos.length)}</span> : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="summary panel">
        <div className="summary__main">
          <p className="summary__label">{speed === 1 ? ui.results.total : fill(ui.results.atSpeed, { speed: f.speed(speed) })}</p>
          <p className="summary__time">
            <BigTime seconds={fast} f={f} />
          </p>
          {speed !== 1 ? (
            <p className="summary__sub">
              <span>
                {ui.results.total}: <strong>{f.dur(totals.seconds)}</strong>
              </span>
              <span className="saved">{fill(ui.results.saves, { time: f.dur(totals.seconds - fast) })}</span>
            </p>
          ) : null}
          <p className="summary__scope">
            {scope}, {f.count(ui.plurals.videos, totals.counted)}
          </p>
        </div>
        <dl className="summary__stats">
          <div>
            <dt>{ui.results.average}</dt>
            <dd>{f.dur(atSpeed(totals.average, speed))}</dd>
          </div>
          <div>
            <dt>{ui.results.longest}</dt>
            <dd>{totals.longest ? f.dur(atSpeed(totals.longest.d, speed)) : '–'}</dd>
          </div>
          <div>
            <dt>{ui.results.shortest}</dt>
            <dd>{totals.shortest ? f.dur(atSpeed(totals.shortest.d, speed)) : '–'}</dd>
          </div>
        </dl>
        {totals.unavailable || totals.live || totals.watchedCount || lists.some((l) => l.truncated) || notices.length ? (
          <ul className="summary__notes" role="list">
            {totals.watchedCount ? (
              <li className="note note--done">{fill(ui.results.watchedNote, { time: f.dur(atSpeed(totals.watchedSeconds, speed)) })}</li>
            ) : null}
            {totals.unavailable ? <li className="note">{f.count(ui.results.unavailable, totals.unavailable)}</li> : null}
            {totals.live ? <li className="note">{f.count(ui.results.live, totals.live)}</li> : null}
            {lists.some((l) => l.truncated) ? <li className="note">{ui.results.truncated}</li> : null}
            {notices.map((n) => (
              <li key={n} className="note note--warn">
                {n}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Timeline ui={ui} f={f} items={counted} total={totals.seconds} speed={speed} />

      <div className="results__grid">
        <div className="results__col">
          <TimeFit t={ui.fit} units={ui.units} tag={f.tag} seconds={totals.seconds} speed={speed} onApply={onSpeed} />
          <SpeedTable ui={ui} f={f} seconds={totals.seconds} speed={speed} onSpeed={onSpeed} />
        </div>
        <Planner ui={ui} f={f} items={counted} speed={speed} title={title} />
      </div>

      <ShareExport ui={ui} f={f} title={title} items={items} totals={totals} speed={speed} watched={watched} query={query} />

      <VideoList
        ui={ui}
        f={f}
        items={items}
        selection={selection}
        watched={watched}
        ends={ends}
        speed={speed}
        onStartHere={onStartHere}
      />
    </section>
  );
}
