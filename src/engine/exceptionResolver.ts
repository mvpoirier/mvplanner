// Exception resolver: turns the list of CalendarExceptions into a per-date classification
import type { AcademicYearBinder, CalendarException } from '../types/planner';

export interface DateClassification {
  pause: CalendarException | null;
  skipLetters: number;
  blocked: Record<string, string>; // periodId -> label
  bellLabel: string | null;
  cohorts: { yearGroups: string[]; label: string }[];
  events: { title: string; periodIds: string[] }[];
}

export function exceptionsOn(binder: Pick<AcademicYearBinder, 'exceptions'>, iso: string): CalendarException[] {
  return binder.exceptions.filter((e) => iso >= e.start && iso <= (e.end || e.start));
}

export function classifyDate(exs: CalendarException[]): DateClassification {
  const out: DateClassification = {
    pause: null,
    skipLetters: 0,
    blocked: {},
    bellLabel: null,
    cohorts: [],
    events: [],
  };
  for (const e of exs) {
    switch (e.behavior) {
      case 'pause_cycle':
        if (!out.pause) out.pause = e;
        break;
      case 'skip_letter':
        out.skipLetters += 1;
        out.events.push({ title: e.title, periodIds: e.periodIds?.length ? e.periodIds : ['AM'] });
        break;
      case 'partial_block':
        for (const p of e.periodIds ?? []) out.blocked[p] = e.title;
        break;
      case 'custom_bell':
        out.bellLabel = e.bellLabel || e.title;
        for (const p of e.periodIds ?? []) out.blocked[p] = e.bellLabel || e.title;
        out.events.push({ title: e.title, periodIds: ['AM'] });
        break;
      case 'cohort_override':
        out.cohorts.push({ yearGroups: e.yearGroups ?? [], label: e.title });
        break;
      case 'event':
        out.events.push({ title: e.title, periodIds: e.periodIds?.length ? e.periodIds : ['AM'] });
        break;
    }
  }
  return out;
}

export const BEHAVIOR_LABELS: Record<CalendarException['behavior'], string> = {
  pause_cycle: 'Pause Cycle (no school)',
  skip_letter: 'Skip Letter',
  partial_block: 'Partial-Day Block',
  custom_bell: 'Alternate Bell',
  cohort_override: 'Year-Group Cohort Override',
  event: 'Event Banner (info only)',
};

export function normalizeBehavior(raw: string | undefined): CalendarException['behavior'] {
  const s = (raw || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return 'pause_cycle';
  if (s.includes('skip')) return 'skip_letter';
  if (s.includes('partial') || s.includes('block')) return 'partial_block';
  if (s.includes('bell') || s.includes('early') || s.includes('custom')) return 'custom_bell';
  if (s.includes('cohort') || s.includes('year')) return 'cohort_override';
  if (s.includes('event') || s.includes('info') || s.includes('banner')) return 'event';
  return 'pause_cycle';
}
