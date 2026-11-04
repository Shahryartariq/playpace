'use client';

import { atSpeed, SPEED_PRESETS } from '@/lib/calc';
import type { Ui } from './types';
import type { Fmt } from './useFormat';

interface Props {
  ui: Ui;
  f: Fmt;
  seconds: number;
  speed: number;
  onSpeed: (speed: number) => void;
}

const EXTRA = [4] as const;

export function SpeedTable({ ui, f, seconds, speed, onSpeed }: Props) {
  const speeds = [...new Set<number>([...SPEED_PRESETS, ...EXTRA, speed])].sort((a, b) => a - b);
  return (
    <section className="panel speed-table" aria-labelledby="speeds-heading">
      <h3 id="speeds-heading" className="panel__title">
        {ui.results.speedsHeading}
      </h3>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{ui.results.speedCol}</th>
            <th scope="col">{ui.results.timeCol}</th>
            <th scope="col">{ui.results.savedCol}</th>
          </tr>
        </thead>
        <tbody>
          {speeds.map((s) => {
            const t = atSpeed(seconds, s);
            const current = s === speed;
            return (
              <tr key={s} className={current ? 'is-current' : undefined} aria-current={current ? 'true' : undefined}>
                <th scope="row">
                  <button type="button" className="speed-pick" onClick={() => onSpeed(s)} aria-pressed={current}>
                    {f.speed(s)}
                  </button>
                </th>
                <td>{f.dur(t)}</td>
                <td className={s > 1 ? 'saved' : undefined}>{s > 1 ? f.dur(seconds - t) : s < 1 ? `+${f.dur(t - seconds)}` : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
