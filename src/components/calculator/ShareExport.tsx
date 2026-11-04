'use client';

import { useState } from 'react';
import { atSpeed, type Item, type Totals } from '@/lib/calc';
import { buildCsv, downloadText, fileSlug } from '@/lib/exporters';
import { fill } from '@/lib/format';
import { NETWORKS, networkUrl, type Network } from '@/lib/share';
import type { Ui } from './types';
import type { Fmt } from './useFormat';

interface Props {
  ui: Ui;
  f: Fmt;
  title: string;
  items: Item[];
  totals: Totals;
  speed: number;
  watched: ReadonlySet<string>;
  /** Query string that reopens this result (?q=…). */
  query: string;
}

const NETWORK_NAMES: Record<Exclude<Network, 'email'>, string> = {
  x: 'X',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
};

const ICONS: Record<Network, string> = {
  x: 'M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z',
  facebook:
    'M14 8.5V6.8c0-.8.5-1 .9-1H17V2.1L14 2c-3.3 0-4 2.5-4 4.1v2.4H8V12h2v10h4V12h2.8l.4-3.5H14Z',
  whatsapp:
    'M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.5-.3Z',
  telegram: 'M21.5 3.3 2.9 10.5c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.8.8.4 0 .6-.2.8-.4l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.2-1.6ZM9.4 13.6l9-5.7c.4-.3.8-.1.5.2l-7.4 6.7-.3 3.4-1.8-4.6Z',
  reddit:
    'M22 12.1a2.2 2.2 0 0 0-3.7-1.6 10.7 10.7 0 0 0-5.7-1.8l1-4.6 3.2.7a1.6 1.6 0 1 0 .2-1l-3.6-.8a.5.5 0 0 0-.6.4l-1.1 5.3a10.8 10.8 0 0 0-5.8 1.8 2.2 2.2 0 1 0-2.4 3.6 4.3 4.3 0 0 0 0 .7c0 3.5 4 6.3 9 6.3s9-2.8 9-6.3a4.3 4.3 0 0 0 0-.7 2.2 2.2 0 0 0 1.4-2ZM7.5 13.6a1.6 1.6 0 1 1 1.6 1.6 1.6 1.6 0 0 1-1.6-1.6Zm9 4.2a5.8 5.8 0 0 1-4.5 1.4 5.8 5.8 0 0 1-4.5-1.4.4.4 0 0 1 .5-.6 5 5 0 0 0 4 1.1 5 5 0 0 0 4-1.1.4.4 0 1 1 .5.6Zm-.4-2.6a1.6 1.6 0 1 1 1.6-1.6 1.6 1.6 0 0 1-1.6 1.6Z',
  linkedin:
    'M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1a3.8 3.8 0 0 1 3.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.3ZM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1ZM7.1 20.5H3.5V9h3.6v11.5Z',
  email: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm.9 2 8.1 6 8.1-6M3 17.5l6.4-5M21 17.5l-6.4-5',
};

export function ShareExport({ ui, f, title, items, totals, speed, watched, query }: Props) {
  const [copied, setCopied] = useState<'link' | 'summary' | null>(null);
  const fastSpeed = speed === 1 ? 2 : speed;
  const fast = f.dur(atSpeed(totals.seconds, fastSpeed), false);
  const total = f.dur(totals.seconds, false);
  const text = fill(ui.actions.shareText, { title, total, fast, speed: f.speed(fastSpeed) });

  const url = () => `${window.location.origin}${window.location.pathname}?${query}`;

  const copy = async (what: 'link' | 'summary') => {
    const value =
      what === 'link'
        ? url()
        : fill(ui.actions.summary, {
            title,
            count: f.count(ui.plurals.videos, totals.counted),
            total: f.dur(totals.seconds),
            speed: f.speed(fastSpeed),
            fast: f.dur(atSpeed(totals.seconds, fastSpeed)),
            link: url(),
          });
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt(ui.actions.copyLink, value);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text, url: url() });
    } catch {
      // dismissed
    }
  };

  const csv = () => {
    const content = buildCsv(items, speed, watched, {
      number: ui.list.number,
      title: ui.list.title,
      channel: ui.csv.channel,
      duration: ui.list.duration,
      seconds: ui.csv.seconds,
      atSpeed: ui.csv.atSpeed,
      status: ui.csv.status,
      watched: ui.csv.watched,
      link: ui.csv.link,
      yes: ui.csv.yes,
      statusNames: {
        ok: ui.csv.ok,
        live: ui.list.statusLive,
        private: ui.list.statusPrivate,
        deleted: ui.list.statusDeleted,
        unavailable: ui.list.statusUnavailable,
      },
    });
    downloadText(`${fileSlug(title)}.csv`, content, 'text/csv;charset=utf-8');
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <section className="panel share" aria-labelledby="share-heading">
      <h3 id="share-heading" className="panel__title">
        {ui.actions.heading}
      </h3>
      <div className="share__actions">
        {canShare ? (
          <button type="button" className="button button--primary" onClick={nativeShare}>
            {ui.actions.share}
          </button>
        ) : null}
        <button type="button" className="button button--secondary" onClick={() => copy('link')}>
          {copied === 'link' ? ui.actions.copied : ui.actions.copyLink}
        </button>
        <button type="button" className="button button--secondary" onClick={() => copy('summary')}>
          {copied === 'summary' ? ui.actions.copied : ui.actions.copySummary}
        </button>
        <button type="button" className="button button--secondary" onClick={csv}>
          {ui.actions.downloadCsv}
        </button>
      </div>
      <ul className="share__networks" role="list">
        {NETWORKS.map((n) => {
          const name = n === 'email' ? ui.actions.email : NETWORK_NAMES[n];
          return (
            <li key={n}>
              <a
                className={`network network--${n}`}
                href={networkUrl(n, typeof window === 'undefined' ? '' : url(), text)}
                target={n === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                aria-label={`${ui.actions.share}: ${name}`}
                title={name}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {n === 'email' ? (
                    <path d={ICONS[n]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
                  ) : (
                    <path d={ICONS[n]} fill="currentColor" />
                  )}
                </svg>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="visually-hidden" aria-live="polite">
        {copied ? ui.actions.copied : ''}
      </p>
    </section>
  );
}
