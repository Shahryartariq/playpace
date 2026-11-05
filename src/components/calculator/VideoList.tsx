'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { atSpeed, inSelection, type Item, type Selection } from '@/lib/calc';
import { fill } from '@/lib/format';
import { watchedStore } from '@/lib/storage';
import type { Ui } from './types';
import type { Fmt } from './useFormat';

interface Props {
  ui: Ui;
  f: Fmt;
  items: Item[];
  selection: Selection;
  watched: ReadonlySet<string>;
  ends: Map<number, number>;
  speed: number;
  onStartHere: (n: number) => void;
}

const PAGE = 100;

function statusLabel(item: Item, ui: Ui): string | null {
  switch (item.s) {
    case 'live':
      return ui.list.statusLive;
    case 'private':
      return ui.list.statusPrivate;
    case 'deleted':
      return ui.list.statusDeleted;
    case 'unavailable':
      return ui.list.statusUnavailable;
    default:
      return null;
  }
}

function setWatched(ids: string[], on: boolean) {
  const current = new Set(watchedStore.read());
  for (const id of ids) {
    if (on) current.add(id);
    else current.delete(id);
  }
  watchedStore.write([...current]);
}

export function VideoList({ ui, f, items, selection, watched, ends, speed, onStartHere }: Props) {
  const [query, setQuery] = useState('');
  const [hideWatched, setHideWatched] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLocaleLowerCase(f.tag);
    return items.filter(
      (i) => (!hideWatched || !watched.has(i.id)) && (!q || i.t.toLocaleLowerCase(f.tag).includes(q) || String(i.n) === q),
    );
  }, [items, deferredQuery, hideWatched, watched, f.tag]);

  const playable = items.filter((i) => !i.s && i.d > 0);
  const watchedItems = playable.filter((i) => watched.has(i.id));
  const watchedSeconds = watchedItems.reduce((s, i) => s + i.d, 0);
  const totalSeconds = playable.reduce((s, i) => s + i.d, 0);
  const shown = filtered.slice(0, limit);

  return (
    <section className="panel videos" aria-labelledby="videos-heading">
      <div className="videos__head">
        <h3 id="videos-heading" className="panel__title">
          {ui.list.heading} <span className="panel__count">{f.int(items.length)}</span>
        </h3>
        <div className="videos__tools">
          <label className="search">
            <span className="visually-hidden">{ui.list.search}</span>
            <input
              type="search"
              placeholder={ui.list.search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={hideWatched} onChange={(e) => setHideWatched(e.target.checked)} />
            <span>{ui.list.hideWatched}</span>
          </label>
        </div>
      </div>

      {watchedItems.length ? (
        <div className="watched-progress">
          <p>
            {fill(ui.list.watchedProgress, {
              count: f.int(watchedItems.length),
              time: f.dur(watchedSeconds, false),
              total: f.dur(totalSeconds, false),
            })}
          </p>
          <progress max={totalSeconds || 1} value={watchedSeconds} className="watched-progress__bar" aria-hidden="true" />
          <button type="button" className="text-button" onClick={() => setWatched(watchedItems.map((i) => i.id), false)}>
            {ui.list.resetWatched}
          </button>
        </div>
      ) : null}

      {shown.length ? (
        <ol className="video-rows" role="list">
          {shown.map((item) => {
            const status = statusLabel(item, ui);
            const isWatched = watched.has(item.id);
            const inside = inSelection(item.n, selection);
            const end = ends.get(item.n);
            const className = ['video-row', !inside && 'is-outside', isWatched && 'is-watched', status && 'is-unavailable']
              .filter(Boolean)
              .join(' ');
            return (
              <li key={`${item.n}-${item.id}`} className={className}>
                <label className="video-row__check">
                  <input
                    type="checkbox"
                    checked={isWatched}
                    disabled={!!status}
                    onChange={(e) => setWatched([item.id], e.target.checked)}
                    aria-label={fill(ui.list.markWatched, { title: item.t })}
                  />
                </label>
                <span className="video-row__n">{f.int(item.n)}</span>
                {status ? (
                  <span className="video-row__thumb video-row__thumb--empty" aria-hidden="true" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail sizes.
                  <img
                    className="video-row__thumb"
                    src={`https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`}
                    alt=""
                    width={96}
                    height={54}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span className="video-row__main">
                  {status ? (
                    <span className="video-row__title" dir="auto">
                      {item.t}
                    </span>
                  ) : (
                    <a
                      className="video-row__title"
                      dir="auto"
                      href={`https://www.youtube.com/watch?v=${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.t}
                    </a>
                  )}
                  {item.c || status ? (
                    <span className="video-row__meta">
                      {status ? <span className="badge">{status}</span> : item.c}
                    </span>
                  ) : null}
                </span>
                <span className="video-row__len" title={speed !== 1 ? f.dur(item.d) : undefined}>
                  {status ? '–' : f.clock(atSpeed(item.d, speed))}
                </span>
                <span className="video-row__end">
                  {end !== undefined ? (
                    <>
                      <span className="visually-hidden">{ui.list.doneBy} </span>
                      {f.dur(end, false)}
                    </>
                  ) : null}
                </span>
                <span className="video-row__action">
                  {!status && !(selection.mode === 'from' && selection.from === item.n) ? (
                    <button type="button" className="text-button" onClick={() => onStartHere(item.n)}>
                      {ui.list.startHere}
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="empty">{fill(ui.list.none, { q: query })}</p>
      )}
      {filtered.length > limit ? (
        <button type="button" className="button button--secondary videos__more" onClick={() => setLimit((l) => l + PAGE)}>
          {fill(ui.list.more, { n: f.int(Math.min(PAGE, filtered.length - limit)) })}
        </button>
      ) : null}
    </section>
  );
}
