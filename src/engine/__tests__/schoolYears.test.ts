import { describe, expect, it } from 'vitest';
import { resolveSchedule } from '../cycleEngine';
import { weekdayOf } from '../dateUtils';
import {
  createBlankBinderForYear,
  createNistBinderForYear,
  currentSchoolYearStart,
  defaultYearDates,
  nistYearOptions,
} from '../../presets/schoolYears';

describe('Setup Wizard school years', () => {
  it('works out the school year from today', () => {
    expect(currentSchoolYearStart('2026-11-26')).toBe(2026);
    expect(currentSchoolYearStart('2027-03-01')).toBe(2026);
    expect(currentSchoolYearStart('2027-08-01')).toBe(2027);
  });

  it('offers this school year and next, flagging which have a NIST calendar', () => {
    expect(nistYearOptions('2026-11-26')).toEqual([
      { startYear: 2026, label: '2026–2027', hasCalendar: true },
      { startYear: 2027, label: '2027–2028', hasCalendar: false },
    ]);
  });

  it('2026–2027 keeps the full NIST calendar (178 days)', () => {
    const b = createNistBinderForYear(2026);
    expect(b.title).toBe('NIST 2026–2027');
    expect(resolveSchedule(b).summary.totalInstructionalDays).toBe(178);
  });

  it('2027–2028 keeps NIST structure, moves dates, and starts with no holidays', () => {
    const b = createNistBinderForYear(2027);
    expect(b.title).toBe('NIST 2027–2028');
    expect(b.schoolLabel).toBe('NIST 27/28');
    expect(b.cycleLetters).toHaveLength(10);
    expect(Object.keys(b.courses).length).toBeGreaterThan(0);
    expect(b.exceptions).toEqual([]);
    expect(b.startDate.startsWith('2027-08')).toBe(true);
    expect(b.endDate.startsWith('2028-06')).toBe(true);
    expect(weekdayOf(b.firstCycleDate)).toBe(weekdayOf(createNistBinderForYear(2026).firstCycleDate));
  });

  it('custom dates override and drop holidays outside the range', () => {
    const b = createNistBinderForYear(2026, {
      startDate: '2026-08-24',
      endDate: '2026-12-18',
      firstCycleDate: '2026-08-24',
    });
    expect(b.startDate).toBe('2026-08-24');
    expect(b.exceptions.every((e) => e.start <= '2026-12-18')).toBe(true);
  });

  it('blank custom binder uses the chosen cycle and Monday–Friday dates', () => {
    const b = createBlankBinderForYear(2027, ['M', 'T', 'W', 'Th', 'F']);
    expect(b.cycleLetters).toEqual(['M', 'T', 'W', 'Th', 'F']);
    expect(b.courses).toEqual({});
    const d = defaultYearDates(2027);
    expect(weekdayOf(d.startDate)).toBe(1);
    expect(weekdayOf(d.endDate)).toBe(5);
    expect(b.startDate).toBe(d.startDate);
  });
});
