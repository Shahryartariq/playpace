'use client';

import { useId, useState } from 'react';
import { speedToFit, YOUTUBE_PREMIUM_MAX } from '@/lib/calc';
import type { Dictionary } from '@/i18n/types';
import { fill, formatDuration, formatSpeed } from '@/lib/format';

interface Props {
  t: Dictionary['fit'];
  units: Dictionary['units'];
  tag: string;
  /** Length to fit, in seconds at 1×. */
  seconds: number;
  /** The speed currently in use, so "Use 1.45×" hides once it's applied. */
  speed?: number;
  onApply?: (speed: number) => void;
}

const amount = (v: string) => {
  const n = Number.parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** "How much time do you have?" → the slowest speed YouTube can play at that still finishes in time. */
export function TimeFit({ t, units, tag, seconds, speed, onApply }: Props) {
  const id = useId();
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const available = Math.round(amount(hours) * 3600 + amount(minutes) * 60);
  const fit = speedToFit(seconds, available);
  const dur = (x: number, withSeconds = true) => formatDuration(x, units, tag, withSeconds);
  const sp = (x: number) => formatSpeed(x, tag);

  return (
    <section className="panel time-fit" aria-labelledby={`${id}-h`}>
      <div className="time-fit__ask">
        <h2 id={`${id}-h`} className="panel__title">
          {t.heading}
        </h2>
        <p className="time-fit__lead">{t.lead}</p>
        <div className="hms" role="group" aria-labelledby={`${id}-h`}>
          {(
            [
              [t.hours, hours, setHours, 'hours'],
              [t.minutes, minutes, setMinutes, 'minutes'],
            ] as const
          ).map(([label, value, set, name]) => (
            <label key={name} className="hms__field">
              <span>{label}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                name={`fit-${name}`}
                className="number-input"
                value={value}
                onChange={(e) => set(e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="time-fit__answer" aria-live="polite">
        {fit?.kind === 'impossible' ? (
          <p className="time-fit__text time-fit__text--warn">
            {fill(t.impossible, { time: dur(seconds / YOUTUBE_PREMIUM_MAX) })}
          </p>
        ) : fit ? (
          <>
            <p className="time-fit__result">
              <span className="time-fit__label">{t.speedLabel}</span>
              <span className="time-fit__speed">{sp(fit.speed)}</span>
            </p>
            <p className="time-fit__text">
              {fit.kind === 'normal' ? fill(t.normal, { time: dur(seconds) }) : fill(t.finish, { time: dur(fit.watch) })}
              {fit.spare >= 60 ? ` ${fill(t.spare, { spare: dur(fit.spare, false) })}` : null}
            </p>
            {fit.kind === 'premium' ? <p className="note note--warn">{t.premium}</p> : null}
            {fit.kind !== 'normal' ? (
              <p className="time-fit__how">{fill(t.howTo, { speed: sp(fit.speed) })}</p>
            ) : null}
            {onApply && fit.speed !== speed ? (
              <button type="button" className="button button--secondary" onClick={() => onApply(fit.speed)}>
                {fill(t.apply, { speed: sp(fit.speed) })}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
