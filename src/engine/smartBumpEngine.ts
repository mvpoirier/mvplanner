// Smart Lesson Bump Forward engine:
// Shifts lessons for a single course forward to subsequent valid teaching slots of that course,
// automatically skipping holidays, cycle pauses, partial blocks, and cohort overrides.

import { cellKey, type AcademicYearBinder, type CellPlan } from '../types/planner';
import { resolveSchedule, resolveSlot, type ResolvedSchedule } from './cycleEngine';

/**
 * - 'next':  move this lesson's text into the class's next lesson (added above anything already there)
 * - 'blank': shift this and the following lessons along until the first blank lesson
 * - 'term':  shift every lesson from here to the end of the year
 */
export type BumpScope = 'next' | 'blank' | 'term';

export interface CourseSlotRef {
  date: string;
  periodId: string;
  key: string;
  occurrenceTag: string | null;
}

export interface BumpResult {
  nextCellPlans: Record<string, CellPlan>;
  movedCount: number;
  droppedPlan?: CellPlan;
  affectedKeys: string[];
  targetSlots: CourseSlotRef[];
}

/** Chronological list of all valid (unblocked, non-cohort-overridden) slots for a course. */
export function listValidCourseSlots(
  binder: AcademicYearBinder,
  courseId: string,
  schedule?: ResolvedSchedule,
): CourseSlotRef[] {
  const sched = schedule ?? resolveSchedule(binder);
  const slots: CourseSlotRef[] = [];

  for (const week of sched.weeks) {
    for (const day of week.days) {
      if (!day.isInstructional || !day.cycleLetter) continue;
      for (const period of binder.periods) {
        if (!period.acceptsCourses || period.kind === 'divider') continue;
        const resolved = resolveSlot(binder, day, period);
        if (resolved.courseId === courseId && resolved.exceptionKind === null) {
          slots.push({
            date: day.iso,
            periodId: period.id,
            key: cellKey(day.iso, period.id),
            occurrenceTag: day.occurrenceTag,
          });
        }
      }
    }
  }
  return slots;
}

function isPlanEmpty(plan: CellPlan | undefined): boolean {
  return !plan || plan.text.trim() === '';
}

/**
 * Shift lessons for `courseId` starting at `(fromDate, fromPeriodId)` forward by 1 valid slot.
 * - `scope === 'blank'`: stops cascading at the first empty/buffer slot after the starting slot.
 * - `scope === 'term'`: ripples all the way through the end of the binder (or current term if provided).
 */
export function smartBumpForward(
  binder: AcademicYearBinder,
  courseId: string,
  fromDate: string,
  fromPeriodId: string,
  scope: BumpScope = 'blank',
  schedule?: ResolvedSchedule,
): BumpResult {
  const allSlots = listValidCourseSlots(binder, courseId, schedule);
  const startKey = cellKey(fromDate, fromPeriodId);
  const startIdx = allSlots.findIndex((s) => s.key === startKey);

  if (startIdx === -1 || startIdx >= allSlots.length - 1) {
    return {
      nextCellPlans: { ...binder.cellPlans },
      movedCount: 0,
      affectedKeys: [],
      targetSlots: [],
    };
  }

  if (scope === 'next') {
    const from = binder.cellPlans[startKey];
    if (isPlanEmpty(from)) {
      return { nextCellPlans: { ...binder.cellPlans }, movedCount: 0, affectedKeys: [], targetSlots: [] };
    }
    const nextKey = allSlots[startIdx + 1].key;
    const there = binder.cellPlans[nextKey];
    const nextCellPlans: Record<string, CellPlan> = { ...binder.cellPlans };
    nextCellPlans[nextKey] = isPlanEmpty(there)
      ? { ...from! }
      : { ...there!, text: `${from!.text.trim()}\n${there!.text.trim()}`, unit: there!.unit ?? from!.unit };
    delete nextCellPlans[startKey];
    return {
      nextCellPlans,
      movedCount: 1,
      affectedKeys: [nextKey, startKey],
      targetSlots: allSlots.slice(startIdx, startIdx + 2),
    };
  }

  // Determine end index for ripple
  let endIdx = allSlots.length - 1;
  if (scope === 'blank') {
    for (let i = startIdx + 1; i < allSlots.length; i++) {
      if (isPlanEmpty(binder.cellPlans[allSlots[i].key])) {
        endIdx = i;
        break;
      }
    }
  }

  const nextCellPlans: Record<string, CellPlan> = { ...binder.cellPlans };
  const affectedKeys: string[] = [];
  let movedCount = 0;
  let droppedPlan: CellPlan | undefined;

  // If the last slot in the ripple range already had content, record it as dropped
  const lastSlotPlan = binder.cellPlans[allSlots[endIdx].key];
  if (!isPlanEmpty(lastSlotPlan)) {
    droppedPlan = { ...lastSlotPlan! };
  }

  // Shift backwards from endIdx down to startIdx + 1
  for (let i = endIdx; i > startIdx; i--) {
    const prevKey = allSlots[i - 1].key;
    const curKey = allSlots[i].key;
    const prevPlan = binder.cellPlans[prevKey];
    if (!isPlanEmpty(prevPlan)) {
      nextCellPlans[curKey] = { ...prevPlan! };
      movedCount += 1;
      affectedKeys.push(curKey);
    } else {
      delete nextCellPlans[curKey];
    }
  }

  // Clear the starting slot (now free/buffer for the rescheduled or catch-up lesson)
  delete nextCellPlans[startKey];
  affectedKeys.push(startKey);

  return {
    nextCellPlans,
    movedCount,
    droppedPlan,
    affectedKeys,
    targetSlots: allSlots.slice(startIdx, endIdx + 1),
  };
}
