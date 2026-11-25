// Bulk importer for school holidays & disruptions from .ics, CSV, or quick text paste.

import type { CalendarException } from '../types/planner';
import { addDays, isISODate } from '../engine/dateUtils';
import { normalizeBehavior } from '../engine/exceptionResolver';

export interface ParsedExceptionCandidate {
  id: string;
  title: string;
  start: string;
  end: string;
  behavior: CalendarException['behavior'];
  selected: boolean;
}

function formatIcsDate(raw: string): string | null {
  const clean = raw.replace(/[^0-9]/g, '');
  if (clean.length < 8) return null;
  const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  return isISODate(iso) ? iso : null;
}

function guessHolidaySelected(title: string): boolean {
  const t = title.toLowerCase();
  return /holiday|break|no school|pl day|pd day|professional|vacation|orientation|memorial|birthday|day off|closed|songkran|chakri|coronation|vishakha|christmas|winter|spring|fall|autumn|october|feb/.test(
    t,
  );
}

/** Parse RFC 5545 .ics text into exception candidates (auto-detecting all-day holiday events). */
export function parseIcsExceptions(
  icsText: string,
  filterStart?: string,
  filterEnd?: string,
): ParsedExceptionCandidate[] {
  // Unfold folded lines (CRLF + space/tab)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1);
  const out: ParsedExceptionCandidate[] = [];

  blocks.forEach((blk, idx) => {
    const endIdx = blk.search(/END:VEVENT/i);
    const body = endIdx >= 0 ? blk.slice(0, endIdx) : blk;
    const lines = body.split(/\r?\n/);

    let summary = '';
    let dtStartRaw = '';
    let dtEndRaw = '';
    let isAllDay = false;

    for (const line of lines) {
      if (/^SUMMARY/i.test(line)) {
        summary = line.replace(/^SUMMARY[^:]*:/i, '').replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
      } else if (/^DTSTART/i.test(line)) {
        if (/VALUE=DATE/i.test(line) || /^DTSTART:\d{8}$/i.test(line)) isAllDay = true;
        dtStartRaw = line.replace(/^DTSTART[^:]*:/i, '').trim();
      } else if (/^DTEND/i.test(line)) {
        dtEndRaw = line.replace(/^DTEND[^:]*:/i, '').trim();
      }
    }

    const start = formatIcsDate(dtStartRaw);
    if (!start || !summary) return;

    let end = formatIcsDate(dtEndRaw) ?? start;
    // In RFC 5545, DTEND for all-day VALUE=DATE events is exclusive
    if (isAllDay && dtEndRaw && end > start) {
      end = addDays(end, -1);
    }
    if (end < start) end = start;

    if (filterStart && end < filterStart) return;
    if (filterEnd && start > filterEnd) return;

    const behavior = /early dismissal|half day|late start/i.test(summary)
      ? 'custom_bell'
      : /conference|sptc|parent/i.test(summary)
        ? 'event'
        : 'pause_cycle';

    out.push({
      id: `ics-${idx}-${start}`,
      title: summary,
      start,
      end,
      behavior,
      selected: isAllDay || guessHolidaySelected(summary),
    });
  });

  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function parseFlexibleDate(token: string): string | null {
  const s = token.trim();
  if (isISODate(s)) return s;
  // Support YYYY/MM/DD
  const slashYMD = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashYMD) {
    return `${slashYMD[1]}-${slashYMD[2].padStart(2, '0')}-${slashYMD[3].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Parse CSV or pasted text lines:
 *   Start Date, End Date, Title, Behavior
 *   or: 2026-10-12..2026-10-16 October Break
 *   or: 2026-09-18, PL DAY
 */
export function parseCsvOrTextExceptions(rawText: string): ParsedExceptionCandidate[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ParsedExceptionCandidate[] = [];

  lines.forEach((line, idx) => {
    // Skip header row
    if (/^start\s*date/i.test(line) || /^date\s*,/i.test(line)) return;

    // Pattern 1: YYYY-MM-DD..YYYY-MM-DD Title
    const rangeMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|to|–|-)\s*(\d{4}-\d{2}-\d{2})[\s,:\t]+(.+)$/i);
    if (rangeMatch) {
      const [, start, end, rest] = rangeMatch;
      const parts = rest.split(',').map((p) => p.trim());
      out.push({
        id: `csv-${idx}-${start}`,
        start,
        end: end >= start ? end : start,
        title: parts[0],
        behavior: normalizeBehavior(parts[1]),
        selected: true,
      });
      return;
    }

    // Pattern 2: CSV / tab-separated
    const cols = line.includes('\t')
      ? line.split('\t').map((c) => c.trim())
      : line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

    if (cols.length >= 2) {
      const d1 = parseFlexibleDate(cols[0]);
      if (d1) {
        const d2 = parseFlexibleDate(cols[1]);
        if (d2) {
          out.push({
            id: `csv-${idx}-${d1}`,
            start: d1,
            end: d2 >= d1 ? d2 : d1,
            title: cols[2] || 'Holiday',
            behavior: normalizeBehavior(cols[3]),
            selected: true,
          });
        } else {
          out.push({
            id: `csv-${idx}-${d1}`,
            start: d1,
            end: d1,
            title: cols[1] || 'Holiday',
            behavior: normalizeBehavior(cols[2]),
            selected: true,
          });
        }
        return;
      }
    }

    // Pattern 3: YYYY-MM-DD Title
    const singleMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (singleMatch) {
      out.push({
        id: `csv-${idx}-${singleMatch[1]}`,
        start: singleMatch[1],
        end: singleMatch[1],
        title: singleMatch[2].trim(),
        behavior: 'pause_cycle',
        selected: true,
      });
    }
  });

  return out;
}

export function candidatesToExceptions(candidates: ParsedExceptionCandidate[]): CalendarException[] {
  return candidates
    .filter((c) => c.selected && c.title.trim())
    .map((c) => ({
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: c.title.trim(),
      start: c.start,
      end: c.end,
      behavior: c.behavior,
      periodIds: c.behavior === 'event' ? ['AM'] : undefined,
      bellLabel: c.behavior === 'custom_bell' ? c.title.trim() : undefined,
    }));
}
