// Year-agnostic starting points for the Setup Wizard: NIST structure for any school year
// (with the official holiday calendar where we have one), or a blank custom cycle.

import type { AcademicYearBinder } from '../types/planner';
import { addDays, parseISO, todayISO, weekdayOf } from '../engine/dateUtils';
import { createNist2026Binder, NIST_PERIODS } from './nist2026_2027';

/** School years that ship with NIST's published holiday calendar. */
const NIST_CALENDARS: Record<number, () => AcademicYearBinder> = {
  2026: () => createNist2026Binder(),
};
const NIST_BASE_YEAR = 2026;

/** A school year starts in August: Jul–Dec belong to `year`, Jan–Jun to `year - 1`. */
export function currentSchoolYearStart(today: string = todayISO()): number {
  const d = parseISO(today);
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

export const schoolYearLabel = (startYear: number) => `${startYear}–${startYear + 1}`;
const shortLabel = (startYear: number) =>
  `${String(startYear).slice(2)}/${String(startYear + 1).slice(2)}`;

export interface NistYearOption {
  startYear: number;
  label: string;
  hasCalendar: boolean;
}

/** This school year and next, so the list never goes stale. */
export function nistYearOptions(today: string = todayISO()): NistYearOption[] {
  const first = currentSchoolYearStart(today);
  return [first, first + 1].map((y) => ({
    startYear: y,
    label: schoolYearLabel(y),
    hasCalendar: y in NIST_CALENDARS,
  }));
}

export function hasNistCalendar(startYear: number): boolean {
  return startYear in NIST_CALENDARS;
}

/** First Monday on or after the given date. */
function mondayOnOrAfter(iso: string): string {
  const wd = weekdayOf(iso); // 0 = Sun … 6 = Sat
  return addDays(iso, (8 - wd) % 7);
}
/** Last Friday on or before the given date. */
function fridayOnOrBefore(iso: string): string {
  const wd = weekdayOf(iso);
  return addDays(iso, -((wd - 5 + 7) % 7));
}

/** Typical Aug–Jun dates for a school year when no calendar is known. */
export function defaultYearDates(startYear: number): {
  startDate: string;
  endDate: string;
  firstCycleDate: string;
} {
  const startDate = mondayOnOrAfter(`${startYear}-08-15`);
  return {
    startDate,
    firstCycleDate: startDate,
    endDate: fridayOnOrBefore(`${startYear + 1}-06-20`),
  };
}

const newId = () => `binder-${Date.now()}`;

/**
 * NIST bell times, A–J cycle and course palette for any school year.
 * Years with a known calendar include its holidays; other years start with none
 * (dates are moved forward a whole number of weeks so weekdays still line up).
 */
export function createNistBinderForYear(
  startYear: number,
  customDates?: { startDate: string; endDate: string; firstCycleDate: string },
): AcademicYearBinder {
  const known = NIST_CALENDARS[startYear];
  const base = known ? known() : createNist2026Binder();
  const binder: AcademicYearBinder = {
    ...base,
    id: newId(),
    title: `NIST ${schoolYearLabel(startYear)}`,
    schoolLabel: `NIST ${shortLabel(startYear)}`,
    createdAt: new Date().toISOString(),
  };
  if (!known) {
    const shift = (startYear - NIST_BASE_YEAR) * 364;
    binder.startDate = addDays(base.startDate, shift);
    binder.endDate = addDays(base.endDate, shift);
    binder.firstCycleDate = addDays(base.firstCycleDate, shift);
    binder.exceptions = [];
    binder.recurringRules = base.recurringRules.map((r) => ({
      ...r,
      start: addDays(r.start, shift),
      end: addDays(r.end, shift),
    }));
  }
  if (customDates) {
    Object.assign(binder, customDates);
    // Holidays outside the custom range would never show; keep only those inside it.
    binder.exceptions = binder.exceptions.filter(
      (e) => e.end >= customDates.startDate && e.start <= customDates.endDate,
    );
  }
  return binder;
}

/** Blank timetable for another school: chosen cycle, standard period rows, no courses yet. */
export function createBlankBinderForYear(startYear: number, cycleLetters: string[]): AcademicYearBinder {
  return {
    id: newId(),
    title: `${schoolYearLabel(startYear)} Timetable`,
    schoolLabel: shortLabel(startYear),
    archived: false,
    ...defaultYearDates(startYear),
    cycleLetters: [...cycleLetters],
    periods: structuredClone(NIST_PERIODS),
    courses: {},
    cycleGrid: {},
    exceptions: [],
    recurringRules: [],
    cellPlans: {},
    weeklyNotes: {},
    createdAt: new Date().toISOString(),
  };
}
