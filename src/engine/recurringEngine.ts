// Recurring day-of-week rules (e.g. Tue AM "8:05 - Morning Meeting", Wed ECA "Science Support")
import type { AcademicYearBinder } from '../types/planner';
import { weekdayOf } from './dateUtils';

export function recurringTextsFor(
  binder: Pick<AcademicYearBinder, 'recurringRules'>,
  iso: string,
  periodId: string,
  isInstructional: boolean,
): string[] {
  const wd = weekdayOf(iso);
  return binder.recurringRules
    .filter(
      (r) =>
        r.periodId === periodId &&
        r.weekday === wd &&
        iso >= r.start &&
        iso <= r.end &&
        (!r.skipHolidays || isInstructional),
    )
    .map((r) => r.text);
}
