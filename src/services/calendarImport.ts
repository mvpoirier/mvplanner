// Import holidays, no-school days and events from a school calendar file.
//  • .ics (iCalendar) from Google / Apple / Outlook Calendar or a school website
//  • .csv with a header row: date, end_date, type, label  (end_date and type optional)

import type { AcademicYearBinder, CalendarException } from '../types/planner';
import { addDays } from '../engine/dateUtils';

export type ImportedKind = 'no-school' | 'event';

export interface ImportedDate {
  start: string; // ISO, inclusive
  end: string; // ISO, inclusive
  label: string;
  kind: ImportedKind;
}

export type PreviewStatus = 'new' | 'duplicate' | 'outside';

export interface PreviewRow extends ImportedDate {
  status: PreviewStatus;
}

const NO_SCHOOL_WORDS =
  /\b(holiday|holidays|break|vacation|no school|no students|closed|closure|day off|songkran|half[- ]term|pl day|pd day|professional (learning|development)|inset|staff day|teacher work ?day)\b/i;

/** Guess whether a calendar entry means "no lessons" or just an event on a school day. */
export function guessKind(label: string, typeHint?: string): ImportedKind {
  const hint = (typeHint ?? '').trim().toLowerCase();
  if (/^(no[- ]?school|holiday|closed|break|pause|off)$/.test(hint)) return 'no-school';
  if (/^(event|banner|special|half[- ]?day|early[- ]?dismissal)$/.test(hint)) return 'event';
  return NO_SCHOOL_WORDS.test(label) ? 'no-school' : 'event';
}

// ---------- iCalendar ----------

function unfoldIcs(text: string): string[] {
  // Lines starting with a space or tab continue the previous line (RFC 5545 §3.1)
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescapeIcs(v: string): string {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

/** DTSTART/DTEND value → { iso date, allDay } (timed UTC values are converted to local dates). */
function icsDate(prop: string, value: string): { iso: string; allDay: boolean } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, z] = m;
  const allDay = /VALUE=DATE(?!-)/i.test(prop) || hh === undefined;
  if (!allDay && z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +ss));
    const pad = (n: number) => String(n).padStart(2, '0');
    return { iso: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, allDay };
  }
  return { iso: `${y}-${mo}-${d}`, allDay };
}

export function parseIcs(text: string): ImportedDate[] {
  const out: ImportedDate[] = [];
  let ev: Record<string, { prop: string; value: string }> | null = null;
  for (const line of unfoldIcs(text)) {
    if (/^BEGIN:VEVENT/i.test(line)) ev = {};
    else if (/^END:VEVENT/i.test(line)) {
      if (ev?.DTSTART) {
        const start = icsDate(ev.DTSTART.prop, ev.DTSTART.value);
        if (start) {
          let end = start.iso;
          if (ev.DTEND) {
            const e = icsDate(ev.DTEND.prop, ev.DTEND.value);
            // All-day DTEND is exclusive; timed events stay on their start date unless they span days
            if (e) end = e.allDay ? addDays(e.iso, -1) : e.iso;
          }
          if (end < start.iso) end = start.iso;
          const label = unescapeIcs(ev.SUMMARY?.value ?? 'Untitled');
          const cat = ev.CATEGORIES ? unescapeIcs(ev.CATEGORIES.value) : undefined;
          out.push({ start: start.iso, end, label, kind: guessKind(label, cat) });
        }
      }
      ev = null;
    } else if (ev) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const prop = line.slice(0, idx);
        const name = prop.split(';')[0].toUpperCase();
        if (!(name in ev)) ev[name] = { prop, value: line.slice(idx + 1).trim() };
      }
    }
  }
  return out;
}

// ---------- CSV ----------

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';' || ch === '\t') {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** Accepts 2026-12-21, 21/12/2026, 21-12-2026 or 21.12.2026 (day first, as in Thailand and the UK). */
export function parseCsvDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export class CalendarFileError extends Error {}

export function parseCalendarCsv(text: string): ImportedDate[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new CalendarFileError('That file is empty.');
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = col('date', 'start', 'startdate', 'from');
  const iEnd = col('enddate', 'end', 'to', 'until');
  const iType = col('type', 'kind', 'category');
  const iLabel = col('label', 'title', 'name', 'event', 'description', 'summary');
  if (iDate === -1 || iLabel === -1) {
    throw new CalendarFileError(
      'The first row of the CSV needs column names, including "date" and "label" (also optional "end_date" and "type").',
    );
  }
  const out: ImportedDate[] = [];
  lines.slice(1).forEach((line, n) => {
    const cells = splitCsvLine(line);
    const start = parseCsvDate(cells[iDate] ?? '');
    if (!start) {
      if ((cells[iDate] ?? '').trim()) {
        throw new CalendarFileError(`Row ${n + 2}: "${cells[iDate]}" isn't a date. Use 2026-12-21 or 21/12/2026.`);
      }
      return;
    }
    const endRaw = iEnd >= 0 ? (cells[iEnd] ?? '') : '';
    const end = (endRaw && parseCsvDate(endRaw)) || start;
    const label = (cells[iLabel] ?? '').trim() || 'Untitled';
    out.push({ start, end: end < start ? start : end, label, kind: guessKind(label, iType >= 0 ? cells[iType] : '') });
  });
  return out;
}

export function parseCalendarFile(fileName: string, text: string): ImportedDate[] {
  const looksIcs = /\.ics$/i.test(fileName) || /BEGIN:VCALENDAR/i.test(text.slice(0, 500));
  const dates = looksIcs ? parseIcs(text) : parseCalendarCsv(text);
  if (dates.length === 0) throw new CalendarFileError('No dates were found in that file.');
  return dates.sort((a, b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label));
}

// ---------- Preview & apply ----------

const normTitle = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

/** Mark each entry as new, already in the binder, or outside the binder's school year. */
export function buildPreview(binder: AcademicYearBinder, dates: ImportedDate[]): PreviewRow[] {
  const seen = new Set<string>();
  return dates
    .filter((d) => {
      const k = `${d.start}|${d.end}|${normTitle(d.label)}`;
      if (seen.has(k)) return false; // repeated inside the file itself
      seen.add(k);
      return true;
    })
    .map((d) => {
      if (d.end < binder.startDate || d.start > binder.endDate) return { ...d, status: 'outside' as const };
      const dup = binder.exceptions.some(
        (e) =>
          (e.start === d.start && e.end === d.end) ||
          (e.start === d.start && normTitle(e.title) === normTitle(d.label)),
      );
      return { ...d, status: dup ? ('duplicate' as const) : ('new' as const) };
    });
}

export function toException(d: ImportedDate, idSeed: number): CalendarException {
  const base = { id: `ex-import-${Date.now().toString(36)}-${idSeed}`, title: d.label, start: d.start, end: d.end };
  return d.kind === 'no-school'
    ? { ...base, behavior: 'pause_cycle' }
    : { ...base, behavior: 'event', periodIds: ['AM'] };
}

export const CSV_TEMPLATE = `date,end_date,type,label
2026-12-21,2027-01-08,no-school,Winter break
2027-03-19,,no-school,PL DAY
2027-03-30,,event,SPT Conference
`;
