'use client';

import { useMemo, useState } from 'react';
import { countStudyDays, minutesPerDayFor, planDays, type Item, type PlanDay } from '@/lib/calc';
import { buildIcs, downloadText, fileSlug } from '@/lib/exporters';
import { fill } from '@/lib/format';
import type { Ui } from './types';
import type { Fmt } from './useFormat';

interface Props {
  ui: Ui;
  f: Fmt;
  items: Item[];
  speed: number;
  title: string;
}

const PRESETS = [15, 30, 60, 120] as const;
const SHOWN = 7;

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "Videos 3–6", "Video 5, 0:00 to 45:00", joined when a day mixes whole and partial videos.
 * `order` maps a video number to its position among counted videos, so a run that skips a private
 * video (19, 21) still reads as one range.
 */
export function describeDay(day: PlanDay, ui: Ui, f: Fmt, order?: Map<number, number>): string {
  const pos = (n: number) => order?.get(n) ?? n;
  const parts: string[] = [];
  let runStart: number | null = null;
  let runEnd: number | null = null;
  const flush = () => {
    if (runStart === null || runEnd === null) return;
    parts.push(
      runStart === runEnd
        ? fill(ui.planner.videoOne, { n: f.int(runStart) })
        : fill(ui.planner.videosRange, { a: f.int(runStart), b: f.int(runEnd) }),
    );
    runStart = runEnd = null;
  };
  for (const s of day.segments) {
    const whole = s.start === 0 && s.end === s.length;
    if (whole) {
      if (runEnd !== null && pos(s.n) === pos(runEnd) + 1) runEnd = s.n;
      else {
        flush();
        runStart = runEnd = s.n;
      }
    } else {
      flush();
      parts.push(fill(ui.planner.videoPart, { n: f.int(s.n), start: f.clock(s.start), end: f.clock(s.end) }));
    }
  }
  flush();
  return parts.join(', ');
}

export function Planner({ ui, f, items, speed, title }: Props) {
  const [minutes, setMinutes] = useState<number>(60);
  const [custom, setCustom] = useState('');
  const [weekdays, setWeekdays] = useState(false);
  const [start, setStart] = useState(() => isoDate(new Date()));
  const [deadline, setDeadline] = useState('');
  const [showAll, setShowAll] = useState(false);

  const startDate = parseDate(start) ?? new Date();
  const days = useMemo(
    () => planDays(items, { minutesPerDay: minutes, speed, start: parseDate(start) ?? new Date(), weekdaysOnly: weekdays }),
    [items, minutes, speed, start, weekdays],
  );
  const totalSeconds = items.reduce((s, v) => s + v.d, 0);
  const order = useMemo(() => new Map(items.map((item, i) => [item.n, i])), [items]);
  const deadlineDate = parseDate(deadline);
  const studyDays = deadlineDate ? countStudyDays(startDate, deadlineDate, weekdays) : 0;

  if (!items.length) return null;
  const last = days.at(-1);
  const shown = showAll ? days : days.slice(0, SHOWN);

  const exportCalendar = () => {
    const ics = buildIcs(
      days.map((day) => {
        const what = describeDay(day, ui, f, order);
        return {
          day,
          summary: `${fill(ui.planner.day, { n: f.int(day.index) })}: ${what}`,
          description: `${title}\n${what}\n${f.dur(day.seconds, false)} (${f.speed(speed)})`,
        };
      }),
      fill(ui.planner.calendarName, { title }),
      window.location.href,
    );
    downloadText(`${fileSlug(title)}-plan.ics`, ics, 'text/calendar;charset=utf-8');
  };

  return (
    <section className="panel planner" aria-labelledby="planner-heading">
      <h3 id="planner-heading" className="panel__title">
        {ui.planner.heading}
      </h3>

      <fieldset className="field">
        <legend className="field__label">{ui.planner.perDay}</legend>
        <div className="speed-chips" role="radiogroup" aria-label={ui.planner.perDay}>
          {PRESETS.map((m) => (
            <label key={m} className="chip-radio">
              <input
                type="radio"
                name="per-day"
                checked={!custom && minutes === m}
                onChange={() => {
                  setMinutes(m);
                  setCustom('');
                }}
              />
              <span>{f.dur(m * 60, false)}</span>
            </label>
          ))}
          <label className="custom-speed">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              className="number-input"
              placeholder={ui.planner.customMinutes}
              aria-label={ui.planner.customMinutes}
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                const n = Number.parseInt(e.target.value, 10);
                if (n > 0) setMinutes(Math.min(1440, n));
              }}
            />
          </label>
        </div>
      </fieldset>

      <div className="planner__row">
        <label className="field field--inline">
          <span className="field__label">{ui.planner.startDate}</span>
          <input type="date" className="date-input" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="field field--inline">
          <span className="field__label">{ui.planner.deadlineLabel}</span>
          <input type="date" className="date-input" value={deadline} min={start} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={weekdays} onChange={(e) => setWeekdays(e.target.checked)} />
          <span>{ui.planner.weekdays}</span>
        </label>
      </div>

      <div className="planner__answers" aria-live="polite">
        {last ? (
          <p className="planner__answer">
            {fill(ui.planner.finish, { days: f.count(ui.plurals.days, days.length), date: f.dateLong(last.date) })}
          </p>
        ) : null}
        {deadlineDate ? (
          <p className="planner__answer planner__answer--deadline">
            {studyDays > 0
              ? fill(ui.planner.deadlineResult, {
                  time: f.dur(minutesPerDayFor(totalSeconds, speed, studyDays) * 60, false),
                  date: f.dateLong(deadlineDate),
                })
              : ui.planner.deadlinePast}
          </p>
        ) : null}
      </div>

      <ol className="plan-days" role="list">
        {shown.map((day) => (
          <li key={day.index} className="plan-day">
            <span className="plan-day__name">
              {fill(ui.planner.day, { n: f.int(day.index) })}
              <span className="plan-day__date">{f.date(day.date)}</span>
            </span>
            <span className="plan-day__what">{describeDay(day, ui, f, order)}</span>
            <span className="plan-day__time">{f.dur(day.seconds, false)}</span>
          </li>
        ))}
      </ol>
      {days.length > SHOWN ? (
        <button type="button" className="text-button planner__more" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? ui.planner.showFewer : fill(ui.planner.showAll, { n: f.int(days.length) })}
        </button>
      ) : null}

      <button type="button" className="button button--secondary" onClick={exportCalendar}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7 7v5m-2.5-2.5h5"
          />
        </svg>
        {ui.planner.addCalendar}
      </button>
    </section>
  );
}
