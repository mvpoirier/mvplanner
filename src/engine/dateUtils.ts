// Timezone-safe ISO date helpers (all arithmetic in UTC so DST never shifts a school day)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(iso: string): number {
  return parseISO(iso).getUTCDay();
}

export function isWeekend(iso: string): boolean {
  const w = weekdayOf(iso);
  return w === 0 || w === 6;
}

export function mondayOf(iso: string): string {
  const w = weekdayOf(iso);
  const delta = w === 0 ? -6 : 1 - w;
  return addDays(iso, delta);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

export function dowLabel(iso: string): string {
  return DOW[weekdayOf(iso)];
}

/** '19-Aug' (matches the printed binder / Google Sheet DATE row) */
export function shortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`;
}

export function monthLabel(iso: string): string {
  return MONTHS[parseISO(iso).getUTCMonth()];
}

export function monthIndex(name: string): number {
  return MONTHS.findIndex((m) => m.toLowerCase() === name.slice(0, 3).toLowerCase());
}

/** 'Oct 19–23, 2026' or 'Dec 28, 2026 – Jan 1, 2027' */
export function rangeLabel(startIso: string, endIso: string): string {
  const s = parseISO(startIso);
  const e = parseISO(endIso);
  const sm = MONTHS[s.getUTCMonth()];
  const em = MONTHS[e.getUTCMonth()];
  if (s.getUTCFullYear() !== e.getUTCFullYear()) {
    return `${sm} ${s.getUTCDate()}, ${s.getUTCFullYear()} – ${em} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  }
  if (sm !== em) return `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  return `${sm} ${s.getUTCDate()}–${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

export function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Excel / Google Sheets serial date (1900 system) -> ISO */
export function serialToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000);
  return toISO(new Date(ms));
}

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
