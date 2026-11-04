import { atSpeed, type Item, type PlanDay } from './calc';
import { formatClock } from './format';

function escapeCsv(value: string): string {
  // Titles come from strangers: stop spreadsheets from running "=…", "+…", "-…", "@…" as formulas.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export interface CsvLabels {
  number: string;
  title: string;
  channel: string;
  duration: string;
  seconds: string;
  atSpeed: string;
  status: string;
  watched: string;
  link: string;
  yes: string;
  statusNames: Record<'ok' | 'live' | 'private' | 'deleted' | 'unavailable', string>;
}

/** CSV with a UTF-8 BOM so Excel opens titles in any script correctly. */
export function buildCsv(items: Item[], speed: number, watched: ReadonlySet<string>, labels: CsvLabels): string {
  const header = [
    labels.number,
    labels.title,
    labels.channel,
    labels.duration,
    labels.seconds,
    `${labels.atSpeed} ${speed}x`,
    labels.status,
    labels.watched,
    labels.link,
  ];
  const rows = items.map((item) =>
    [
      String(item.n),
      item.t,
      item.c ?? '',
      formatClock(item.d),
      String(item.d),
      formatClock(atSpeed(item.d, speed)),
      labels.statusNames[item.s ?? 'ok'],
      watched.has(item.id) ? labels.yes : '',
      `https://www.youtube.com/watch?v=${item.id}`,
    ]
      .map(escapeCsv)
      .join(','),
  );
  return `\uFEFF${[header.map(escapeCsv).join(','), ...rows].join('\r\n')}\r\n`;
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds lines longer than 75 bytes as RFC 5545 requires, without splitting a multi-byte character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export interface IcsDay {
  day: PlanDay;
  summary: string;
  description: string;
}

/** One all-day calendar event per study day. */
export function buildIcs(days: IcsDay[], calendarName: string, url: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // Stable ids, so importing the same plan again updates its events instead of duplicating them.
  const seed = Math.abs([...`${calendarName}|${url}`].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7)).toString(36);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Playpace//Watch plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];
  for (const { day, summary, description } of days) {
    const end = new Date(day.date);
    end.setDate(end.getDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:playpace-${seed}-${ymd(day.date)}-${day.index}@playpace.vercel.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(day.date)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      `URL:${url}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Saves text as a file in the browser. */
export function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** A safe file name from a playlist title. */
export function fileSlug(title: string, fallback = 'playlist'): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  return slug || fallback;
}
