'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  clampSpeed,
  combine,
  computeTotals,
  normalizeSelection,
  SPEED_PRESETS,
  type Mode,
  type Selection,
} from '@/lib/calc';
import type { Example } from '@/lib/examples';
import { fill } from '@/lib/format';
import { readShareQuery, shareQuery, sourceToLink, type ShareState } from '@/lib/share';
import { historyStore, watchedStore, type HistoryEntry } from '@/lib/storage';
import { estimateSeconds } from '@/lib/youtube/client';
import { parseInput, sourceToken } from '@/lib/youtube/parse-input';
import type { ErrorCode, ListData, Source, StreamEvent } from '@/lib/youtube/types';
import { Results } from './Results';
import type { Ui } from './types';
import { useFormat } from './useFormat';

interface Props {
  ui: Ui;
  tag: string;
  examples: Example[];
  /** Calculation encoded in the page address (?q=…), read on the server so the first render matches. */
  initial: ShareState | null;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

interface Progress {
  list: number;
  lists: number;
  title: string;
  loaded: number;
  total: number;
  estimate: number;
}

class CalcError extends Error {
  constructor(public code: ErrorCode | 'network') {
    super(code);
  }
}

/** Reads one list from /api/playlist, reporting progress as the stream arrives. */
async function streamList(
  source: Source,
  signal: AbortSignal,
  onEvent: (event: StreamEvent) => void,
): Promise<ListData> {
  let res: Response;
  try {
    res = await fetch(`/api/playlist?src=${encodeURIComponent(sourceToken(source))}`, { signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new CalcError('network');
  }
  if (!res.body) throw new CalcError('network');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        const event = JSON.parse(line) as StreamEvent;
        if (event.type === 'error') throw new CalcError(event.code);
        if (event.type === 'done') return event.data;
        onEvent(event);
      }
      if (done) break;
    }
  } catch (err) {
    if (err instanceof CalcError || (err as Error).name === 'AbortError') throw err;
    throw new CalcError('network');
  }
  throw new CalcError('network');
}

const DEFAULT_SPEED = 1;

export function Calculator({ ui, tag, examples, initial }: Props) {
  const f = useFormat(ui, tag);
  const [input, setInput] = useState(() => initial?.sources.map(sourceToLink).join('\n') ?? '');
  const [mode, setMode] = useState<Mode>(initial?.selection.mode ?? 'all');
  const [from, setFrom] = useState(String(initial?.selection.from ?? 1));
  const [to, setTo] = useState(initial?.selection.to ? String(initial.selection.to) : '');
  const [speed, setSpeed] = useState<number>(initial?.speed ?? DEFAULT_SPEED);
  const [customSpeed, setCustomSpeed] = useState(() =>
    initial && !(SPEED_PRESETS as readonly number[]).includes(initial.speed) ? String(initial.speed) : '',
  );
  const [status, setStatus] = useState<Status>(initial ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lists, setLists] = useState<ListData[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLHeadingElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const watchedIds = useSyncExternalStore(watchedStore.subscribe, watchedStore.read, watchedStore.server);
  const watched = useMemo(() => new Set(watchedIds), [watchedIds]);
  const history = useSyncExternalStore(historyStore.subscribe, historyStore.read, historyStore.server);

  const items = useMemo(() => combine(lists), [lists]);
  const selection: Selection = useMemo(
    () =>
      normalizeSelection(
        { mode, from: Number.parseInt(from, 10) || 1, to: Number.parseInt(to, 10) || items.length },
        items.length,
      ),
    [mode, from, to, items.length],
  );

  const errorMessage = useCallback(
    (code: ErrorCode | 'network'): string => (code === 'network' ? ui.errors.network : ui.errors[code]),
    [ui.errors],
  );

  const calculate = useCallback(
    async (text: string, preset?: Partial<ShareState>) => {
      // A new request replaces whatever is running, including when the new input turns out to be invalid.
      abortRef.current?.abort();
      const parsed = parseInput(text);
      const pending: string[] = [];
      if (!text.trim()) {
        setStatus('error');
        setError(ui.errors.empty);
        return;
      }
      if (!parsed.sources.length) {
        const reason = parsed.rejected[0]?.reason;
        setStatus('error');
        setError(reason && reason !== 'unknown' ? ui.errors[reason] : ui.errors.noValid);
        return;
      }
      for (const r of parsed.rejected) {
        pending.push(r.reason === 'unknown' ? fill(ui.errors.unknown, { text: r.text }) : ui.errors[r.reason]);
      }
      if (parsed.startIndex && !preset?.selection) {
        setMode('from');
        setFrom(String(parsed.startIndex));
        pending.push(fill(ui.form.startIndexNote, { n: f.int(parsed.startIndex) }));
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('loading');
      setError(null);
      setNotices([]);
      setProgress({ list: 1, lists: parsed.sources.length, title: '', loaded: 0, total: 0, estimate: 0 });

      const loaded: ListData[] = [];
      const loadedSources: Source[] = [];
      for (const [i, source] of parsed.sources.entries()) {
        try {
          const data = await streamList(source, controller.signal, (event) => {
            if (event.type === 'meta') {
              setProgress({
                list: i + 1,
                lists: parsed.sources.length,
                title: event.meta.title,
                loaded: 0,
                total: event.meta.itemCount,
                estimate: event.cached ? 0 : estimateSeconds(event.meta.itemCount),
              });
            } else if (event.type === 'progress') {
              setProgress((p) => (p ? { ...p, loaded: event.loaded, total: event.total } : p));
            }
          });
          loaded.push(data);
          loadedSources.push(source);
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          const code = err instanceof CalcError ? err.code : 'network';
          if (parsed.sources.length === 1) {
            setStatus('error');
            setError(errorMessage(code));
            setProgress(null);
            return;
          }
          pending.push(`${fill(ui.errors.partial, { title: sourceToLink(source) })} ${errorMessage(code)}`);
        }
      }
      if (controller.signal.aborted) return;
      setProgress(null);
      if (!loaded.length) {
        setStatus('error');
        setError(pending.at(-1) ?? ui.errors.upstream);
        return;
      }

      setLists(loaded);
      setSources(loadedSources);
      setNotices([...new Set(pending)]);
      setStatus('done');

      const seconds = loaded.reduce((sum, l) => sum + l.videos.reduce((s, v) => s + (v.s ? 0 : v.d), 0), 0);
      const entry: HistoryEntry = {
        q: loadedSources.map(sourceToken).join(','),
        title: loaded.map((l) => l.meta.title).join(' + '),
        seconds,
        count: loaded.reduce((sum, l) => sum + l.videos.length, 0),
        at: Date.now(),
      };
      historyStore.write([entry, ...historyStore.read().filter((h) => h.q !== entry.q)].slice(0, 8));

      requestAnimationFrame(() => {
        const heading = resultsRef.current;
        if (!heading) return;
        heading.focus({ preventScroll: true });
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        heading.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    },
    [errorMessage, f, ui],
  );

  // Open a shared link (?q=…): start the calculation the server already prepared the form for.
  // Runs once; in development StrictMode mounts twice, so the cleanup cancels and the second mount starts again.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !initial) return;
    started.current = true;
    void calculate(initial.sources.map(sourceToLink).join('\n'), initial);
    return () => {
      abortRef.current?.abort();
      started.current = false;
    };
  }, [calculate, initial]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Browsers without CSS field-sizing (Firefox, Safari) don't grow the box as links are added; do it here.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content'))) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 3, 260)}px`;
  }, [input]);

  const query = useMemo(
    () => (sources.length ? shareQuery({ sources, selection, speed }) : ''),
    [sources, selection, speed],
  );

  // The address bar is left alone on purpose: rewriting it to ?q=… after results appear makes
  // Malwarebytes Browser Guard block the page. Share and copy links carry the result instead.

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void calculate(input);
  };

  const cancel = () => {
    abortRef.current?.abort();
    setStatus(lists.length ? 'done' : 'idle');
    setProgress(null);
  };

  const pickSpeed = (value: number) => {
    setSpeed(clampSpeed(value));
    setCustomSpeed('');
  };

  const onCustomSpeed = (value: string) => {
    setCustomSpeed(value);
    const n = Number.parseFloat(value.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) setSpeed(clampSpeed(n));
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput((prev) => (prev.trim() ? `${prev.trim()}\n${text.trim()}` : text.trim()));
    } catch {
      // Clipboard permission refused: the person can still paste with the keyboard.
    }
    inputRef.current?.focus();
  };

  const runExample = (link: string) => {
    setInput(link);
    setMode('all');
    void calculate(link, { selection: { mode: 'all', from: 1, to: 0 } });
  };

  const runHistory = (entry: HistoryEntry) => {
    const state = readShareQuery(new URLSearchParams({ q: entry.q }));
    if (!state) return;
    const text = state.sources.map(sourceToLink).join('\n');
    setInput(text);
    void calculate(text);
  };

  const totals = useMemo(() => computeTotals(items, selection, watched), [items, selection, watched]);
  const loading = status === 'loading';
  const isPreset = (SPEED_PRESETS as readonly number[]).includes(speed) && !customSpeed;
  const exampleLabel = { course: ui.form.exampleCourse, music: ui.form.exampleMusic, channel: ui.form.exampleChannel };
  const progressPct = progress && progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;

  return (
    <div className="calculator" id="calculator">
      <form className="panel calc-form" onSubmit={onSubmit} noValidate aria-busy={loading}>
        <div className="field">
          <div className="field__head">
            <label htmlFor="links" className="field__label">
              {ui.form.label}
            </label>
            <div className="field__tools">
              <button type="button" className="text-button" onClick={paste}>
                {ui.form.paste}
              </button>
              {input ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setInput('');
                    inputRef.current?.focus();
                  }}
                >
                  {ui.form.clear}
                </button>
              ) : null}
            </div>
          </div>
          <textarea
            id="links"
            ref={inputRef}
            className="links-input"
            name="links"
            rows={1}
            dir="ltr"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            inputMode="url"
            placeholder={ui.form.placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void calculate(input);
              }
            }}
            aria-describedby="links-help"
            aria-invalid={status === 'error' ? true : undefined}
          />
          <p id="links-help" className="field__help">
            {ui.form.help}
          </p>
          <p className="examples">
            <span>{ui.form.examples}</span>{' '}
            {examples.map((ex) => (
              <button key={ex.key} type="button" className="chip chip--quiet" onClick={() => runExample(ex.link)}>
                {exampleLabel[ex.key]}
              </button>
            ))}
          </p>
        </div>

        <div className="calc-form__options">
          <fieldset className="field">
            <legend className="field__label">{ui.form.mode}</legend>
            <div className="segmented" role="radiogroup" aria-label={ui.form.mode}>
              {(
                [
                  ['all', ui.form.modeAll],
                  ['range', ui.form.modeRange],
                  ['from', ui.form.modeFrom],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="segmented__option">
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {mode !== 'all' ? (
              <div className="range-inputs">
                <label>
                  <span>{mode === 'range' ? ui.form.rangeFrom : ui.form.fromLabel}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="number-input"
                  />
                </label>
                {mode === 'range' ? (
                  <label>
                    <span>{ui.form.rangeTo}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={to}
                      placeholder={items.length ? String(items.length) : ''}
                      onChange={(e) => setTo(e.target.value)}
                      className="number-input"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
          </fieldset>

          <fieldset className="field">
            <legend className="field__label">{ui.form.speed}</legend>
            <div className="speed-chips" role="radiogroup" aria-label={ui.form.speed}>
              {SPEED_PRESETS.map((s) => (
                <label key={s} className="chip-radio">
                  <input type="radio" name="speed" checked={isPreset && speed === s} onChange={() => pickSpeed(s)} />
                  <span>{f.speed(s)}</span>
                </label>
              ))}
              <label className="custom-speed">
                <span className="visually-hidden">{ui.form.customSpeed}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0.25}
                  max={16}
                  step={0.05}
                  placeholder={ui.form.customSpeed}
                  value={customSpeed}
                  onChange={(e) => onCustomSpeed(e.target.value)}
                  className="number-input"
                  aria-label={ui.form.customSpeed}
                />
                <span aria-hidden="true">×</span>
              </label>
            </div>
          </fieldset>
        </div>

        <div className="calc-form__submit">
          <button type="submit" className="button button--primary" disabled={loading}>
            {loading ? ui.form.submitting : ui.form.submit}
          </button>
        </div>

        <p className="visually-hidden" role="status" aria-live="polite">
          {loading && progress?.title ? fill(ui.progress.reading, { title: progress.title }) : ''}
        </p>
        {loading && progress ? (
          <div className="progress">
            <div className="progress__text">
              <span className="progress__title">
                {progress.title ? fill(ui.progress.reading, { title: progress.title }) : ui.form.submitting}
                {progress.lists > 1 ? ` (${fill(ui.progress.listOf, { n: f.int(progress.list), total: f.int(progress.lists) })})` : ''}
              </span>
              {progress.total ? (
                <span className="progress__count">
                  {fill(ui.progress.count, { loaded: f.int(progress.loaded), total: f.int(progress.total) })}
                  {progress.estimate > 2 && progressPct < 100
                    ? `, ${fill(ui.progress.estimate, { seconds: f.int(progress.estimate) })}`
                    : ''}
                </span>
              ) : null}
            </div>
            <progress
              className="progress__bar"
              max={100}
              value={progressPct || undefined}
              aria-label={ui.form.submitting}
            />
            <button type="button" className="text-button" onClick={cancel}>
              {ui.progress.cancel}
            </button>
          </div>
        ) : null}
        <div role="alert" className="calc-form__alert">
          {status === 'error' && error ? <p className="alert alert--error">{error}</p> : null}
        </div>

        {history.length && status !== 'loading' ? (
          <div className="recent">
            <h2 className="recent__title">{ui.form.recent}</h2>
            <ul className="recent__list" role="list">
              {history.map((h) => (
                <li key={h.q}>
                  <button type="button" className="chip chip--quiet recent__item" onClick={() => runHistory(h)}>
                    <span className="recent__name" dir="auto">
                      {h.title}
                    </span>
                    <span className="recent__time">{f.dur(h.seconds, false)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="text-button" onClick={() => historyStore.write([])}>
              {ui.form.clearRecent}
            </button>
          </div>
        ) : null}
      </form>

      {status === 'done' && lists.length ? (
        <Results
          ui={ui}
          f={f}
          lists={lists}
          items={items}
          selection={selection}
          totals={totals}
          watched={watched}
          speed={speed}
          notices={notices}
          query={query}
          headingRef={resultsRef}
          onSpeed={pickSpeed}
          onStartHere={(n) => {
            setMode('from');
            setFrom(String(n));
          }}
        />
      ) : null}
    </div>
  );
}
