'use client';

import { useMemo, useState } from 'react';
import { atSpeed, clampSpeed, SPEED_PRESETS } from '@/lib/calc';
import type { Dictionary } from '@/i18n/types';
import { fill, formatDuration, formatSpeed } from '@/lib/format';
import { TimeFit } from './TimeFit';

interface Props {
  t: Dictionary['speedPage'];
  fit: Dictionary['fit'];
  results: Pick<Dictionary['results'], 'speedCol' | 'timeCol' | 'savedCol'>;
  units: Dictionary['units'];
  tag: string;
}

const int = (v: string) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Length × speed for a single video, plus the speed needed to fit it into the time you have. */
export function SpeedConverter({ t, fit, results, units, tag }: Props) {
  const [h, setH] = useState('1');
  const [m, setM] = useState('0');
  const [s, setS] = useState('0');
  const [speed, setSpeed] = useState('1.5');

  const seconds = int(h) * 3600 + int(m) * 60 + int(s);
  const speedValue = clampSpeed(Number.parseFloat(speed.replace(',', '.')) || 1);
  const dur = (x: number) => formatDuration(x, units, tag);
  const speeds = useMemo(() => [...new Set<number>([...SPEED_PRESETS, 4, speedValue])].sort((a, b) => a - b), [speedValue]);

  return (
    <div className="panel converter">
      <form className="converter__form" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="field">
          <legend className="field__label">{t.lengthLegend}</legend>
          <div className="hms">
            {(
              [
                [t.hours, h, setH, 999],
                [t.minutes, m, setM, 59],
                [t.seconds, s, setS, 59],
              ] as const
            ).map(([label, value, set, max]) => (
              <label key={label} className="hms__field">
                <span>{label}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={max}
                  className="number-input"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span className="field__label">{t.speed}</span>
          <span className="custom-speed">
            <input
              type="number"
              inputMode="decimal"
              min={0.25}
              max={16}
              step={0.05}
              className="number-input"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
            />
            <span className="custom-speed__unit" aria-hidden="true">×</span>
          </span>
        </label>
      </form>

      <p className="converter__result" aria-live="polite">
        <span className="summary__label">{fill(t.resultAt, { speed: formatSpeed(speedValue, tag) })}</span>
        <span className="converter__time">{dur(atSpeed(seconds, speedValue))}</span>
      </p>

      <h2 className="panel__title">{t.tableHeading}</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{results.speedCol}</th>
            <th scope="col">{results.timeCol}</th>
            <th scope="col">{results.savedCol}</th>
          </tr>
        </thead>
        <tbody>
          {speeds.map((x) => (
            <tr key={x} className={x === speedValue ? 'is-current' : undefined}>
              <th scope="row">{formatSpeed(x, tag)}</th>
              <td>{dur(atSpeed(seconds, x))}</td>
              <td className={x > 1 ? 'saved' : undefined}>{x > 1 ? dur(seconds - atSpeed(seconds, x)) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TimeFit
        t={fit}
        units={units}
        tag={tag}
        seconds={seconds}
        speed={speedValue}
        onApply={(x) => setSpeed(String(x))}
      />
    </div>
  );
}
