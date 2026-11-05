export interface DurationUnits {
  /** Short labels, e.g. { h: 'h', m: 'm', s: 's' } or { h: 'ч', m: 'мин', s: 'с' }. */
  h: string;
  m: string;
  s: string;
  /** Text between a number and its unit: '' in English ("12h"), ' ' in Russian ("12 ч"). */
  unitGap: string;
  /** Text between parts: ' ' in most languages, '' in Japanese ("12時間4分"). */
  partGap: string;
}

export interface DurationPart {
  value: number;
  unit: 'h' | 'm' | 's';
}

/** Hours (uncapped), minutes and seconds of a duration, dropping leading zero units. */
export function durationParts(totalSeconds: number, withSeconds = true): DurationPart[] {
  const total = Math.max(0, Math.round(totalSeconds));
  if (!withSeconds) {
    // Round to whole minutes; anything above zero shows at least one minute.
    const minutes = total > 0 ? Math.max(1, Math.round(total / 60)) : 0;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return [{ value: m, unit: 'm' }];
    return m ? [{ value: h, unit: 'h' }, { value: m, unit: 'm' }] : [{ value: h, unit: 'h' }];
  }
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: DurationPart[] = [];
  if (h) parts.push({ value: h, unit: 'h' });
  if (h || m) parts.push({ value: m, unit: 'm' });
  parts.push({ value: s, unit: 's' });
  return parts;
}

export function numberFormatter(tag: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return new Intl.NumberFormat(tag, options);
}

/** "12h 4m 31s" in the page's language. Minutes and seconds are padded once hours are shown. */
export function formatDuration(totalSeconds: number, units: DurationUnits, tag: string, withSeconds = true): string {
  const nf = numberFormatter(tag, { useGrouping: true });
  const pad = numberFormatter(tag, { minimumIntegerDigits: 2, useGrouping: false });
  const parts = durationParts(totalSeconds, withSeconds);
  return parts
    .map((p, i) => `${i === 0 ? nf.format(p.value) : pad.format(p.value)}${units.unitGap}${units[p.unit]}`)
    .join(units.partGap);
}

/** "1:02:03" or "4:05", for video lengths in lists. */
export function formatClock(totalSeconds: number, tag = 'en'): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const n = numberFormatter(tag, { useGrouping: false });
  const p = numberFormatter(tag, { minimumIntegerDigits: 2, useGrouping: false });
  return h ? `${n.format(h)}:${p.format(m)}:${p.format(s)}` : `${n.format(m)}:${p.format(s)}`;
}

const RTL = /^(ar|ur|fa|he)(-|$)/;

/** "1.5×" with the locale's decimal mark, kept left-to-right inside Arabic and Urdu text. */
export function formatSpeed(speed: number, tag: string): string {
  const text = `${numberFormatter(tag, { maximumFractionDigits: 2 }).format(speed)}×`;
  return RTL.test(tag) ? `\u2066${text}\u2069` : text;
}

export function formatInteger(value: number, tag: string): string {
  return numberFormatter(tag).format(value);
}

/** Replaces {name} placeholders in a translated string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Picks "one" or "other" form with Intl.PluralRules; templates use {n}. */
export function plural(
  forms: { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string },
  n: number,
  tag: string,
): string {
  const rule = new Intl.PluralRules(tag).select(n) as keyof typeof forms;
  const template = forms[rule] ?? forms.other;
  return fill(template, { n: formatInteger(n, tag) });
}
