// Rotating cycle engine (A–J or custom length), occurrence numbering (A1..H18),
// teaching-week numbering, and remaining teaching weeks calculation.

import type {
  AcademicYearBinder,
  CalendarException,
  CourseDefinition,
  PeriodRow,
} from '../types/planner';
import {
  addDays,
  dowLabel,
  isWeekend,
  mondayOf,
  rangeLabel,
  shortDate,
} from './dateUtils';
import { classifyDate, exceptionsOn, type DateClassification } from './exceptionResolver';
import { recurringTextsFor } from './recurringEngine';

export interface ResolvedDay {
  iso: string;
  dow: string;
  shortDate: string;
  inBinderRange: boolean;
  isInstructional: boolean;
  cycleLetter: string | null;
  occurrence: number | null;
  occurrenceTag: string | null; // e.g. 'A1', 'J8', 'H18'
  classification: DateClassification;
  exceptions: CalendarException[];
}

export interface ResolvedWeek {
  index: number; // 0-based calendar week index
  mondayIso: string;
  fridayIso: string;
  dateRange: string;
  isTeachingWeek: boolean;
  teachingWeekNumber: number | null; // 1..totalTeachingWeeks
  teachingWeeksRemaining: number; // teaching weeks remaining AFTER this week
  nonTeachingLabel: string | null;
  days: ResolvedDay[]; // always 5 items: Mon..Fri
}

export interface ScheduleSummary {
  totalCalendarWeeks: number;
  totalTeachingWeeks: number;
  totalInstructionalDays: number;
  letterCounts: Record<string, number>;
  firstInstructionalDay: ResolvedDay | null;
  lastInstructionalDay: ResolvedDay | null;
}

export interface ResolvedSchedule {
  weeks: ResolvedWeek[];
  daysByIso: Record<string, ResolvedDay>;
  summary: ScheduleSummary;
}

export interface SlotResolution {
  courseId: string | null;
  course: CourseDefinition | null;
  exceptionKind: 'full' | 'blocked' | 'cohort' | null;
  exceptionLabel: string | null;
  banners: string[]; // event banners + recurring rules for this slot
}

export function resolveSchedule(binder: AcademicYearBinder): ResolvedSchedule {
  const letters = binder.cycleLetters.length > 0 ? binder.cycleLetters : ['A'];
  const letterCounts: Record<string, number> = {};
  for (const l of letters) letterCounts[l] = 0;

  const startMon = mondayOf(binder.startDate);
  const endMon = mondayOf(binder.endDate);

  const daysByIso: Record<string, ResolvedDay> = {};
  const rawWeeks: {
    mondayIso: string;
    fridayIso: string;
    days: ResolvedDay[];
    isTeachingWeek: boolean;
  }[] = [];

  let cycleCursor = 0;
  let firstInstructionalDay: ResolvedDay | null = null;
  let lastInstructionalDay: ResolvedDay | null = null;
  let totalInstructionalDays = 0;

  let curMon = startMon;
  while (curMon <= endMon) {
    const days: ResolvedDay[] = [];
    let hasInstructional = false;

    for (let offset = 0; offset < 5; offset++) {
      const iso = addDays(curMon, offset);
      const inBinderRange = iso >= binder.startDate && iso <= binder.endDate;
      const exs = inBinderRange ? exceptionsOn(binder, iso) : [];
      const classification = classifyDate(exs);

      let isInstructional = false;
      let cycleLetter: string | null = null;
      let occurrence: number | null = null;
      let occurrenceTag: string | null = null;

      if (
        inBinderRange &&
        !isWeekend(iso) &&
        iso >= binder.firstCycleDate &&
        !classification.pause
      ) {
        if (classification.skipLetters > 0) {
          cycleCursor += classification.skipLetters;
        }
        cycleLetter = letters[cycleCursor % letters.length];
        cycleCursor += 1;
        letterCounts[cycleLetter] = (letterCounts[cycleLetter] ?? 0) + 1;
        occurrence = letterCounts[cycleLetter];
        occurrenceTag = `${cycleLetter}${occurrence}`;
        isInstructional = true;
        hasInstructional = true;
        totalInstructionalDays += 1;
      }

      const day: ResolvedDay = {
        iso,
        dow: dowLabel(iso),
        shortDate: shortDate(iso),
        inBinderRange,
        isInstructional,
        cycleLetter,
        occurrence,
        occurrenceTag,
        classification,
        exceptions: exs,
      };

      if (isInstructional) {
        if (!firstInstructionalDay) firstInstructionalDay = day;
        lastInstructionalDay = day;
      }

      days.push(day);
      daysByIso[iso] = day;
    }

    rawWeeks.push({
      mondayIso: curMon,
      fridayIso: addDays(curMon, 4),
      days,
      isTeachingWeek: hasInstructional,
    });

    curMon = addDays(curMon, 7);
  }

  const totalTeachingWeeks = rawWeeks.filter((w) => w.isTeachingWeek).length;
  let twCounter = 0;
  const weeks: ResolvedWeek[] = rawWeeks.map((rw, index) => {
    let teachingWeekNumber: number | null = null;
    if (rw.isTeachingWeek) {
      twCounter += 1;
      teachingWeekNumber = twCounter;
    }
    const teachingWeeksRemaining = totalTeachingWeeks - twCounter;

    let nonTeachingLabel: string | null = null;
    if (!rw.isTeachingWeek) {
      const pauseTitles = new Set<string>();
      for (const d of rw.days) {
        if (d.classification.pause?.title) pauseTitles.add(d.classification.pause.title);
      }
      if (pauseTitles.size > 0) {
        nonTeachingLabel = Array.from(pauseTitles).slice(0, 2).join(' · ');
      } else if (rw.fridayIso < binder.firstCycleDate) {
        nonTeachingLabel = 'Pre-Semester Orientation';
      } else {
        nonTeachingLabel = 'Non-Teaching Week';
      }
    }

    return {
      index,
      mondayIso: rw.mondayIso,
      fridayIso: rw.fridayIso,
      dateRange: rangeLabel(rw.mondayIso, rw.fridayIso),
      isTeachingWeek: rw.isTeachingWeek,
      teachingWeekNumber,
      teachingWeeksRemaining,
      nonTeachingLabel,
      days: rw.days,
    };
  });

  return {
    weeks,
    daysByIso,
    summary: {
      totalCalendarWeeks: weeks.length,
      totalTeachingWeeks,
      totalInstructionalDays,
      letterCounts,
      firstInstructionalDay,
      lastInstructionalDay,
    },
  };
}

export function formatWeekHeading(week: ResolvedWeek): string {
  if (week.isTeachingWeek && week.teachingWeekNumber !== null) {
    return `Week ${week.teachingWeekNumber} / ${week.teachingWeeksRemaining} remaining`;
  }
  return `Non-Teaching Week · ${week.nonTeachingLabel ?? 'Break'}`;
}

export function formatWeekShortLabel(week: ResolvedWeek): string {
  if (week.isTeachingWeek && week.teachingWeekNumber !== null) {
    return `Week ${week.teachingWeekNumber} / ${week.teachingWeeksRemaining} left · ${week.dateRange}`;
  }
  return `Break · ${week.nonTeachingLabel ?? 'Non-Teaching'} · ${week.dateRange}`;
}

export function resolveSlot(
  binder: AcademicYearBinder,
  day: ResolvedDay,
  period: PeriodRow,
): SlotResolution {
  const banners: string[] = [];

  // Event banners targeting this period
  for (const ev of day.classification.events) {
    if (ev.periodIds.includes(period.id)) {
      banners.push(ev.title);
    }
  }
  // Recurring weekday rules targeting this period
  const rec = recurringTextsFor(binder, day.iso, period.id, day.isInstructional);
  banners.push(...rec);

  // Full day pause / holiday / pre-cycle non-instructional day
  if (day.classification.pause) {
    return {
      courseId: null,
      course: null,
      exceptionKind: 'full',
      exceptionLabel: day.classification.pause.title,
      banners,
    };
  }

  if (!day.isInstructional || !day.cycleLetter) {
    return {
      courseId: null,
      course: null,
      exceptionKind: null,
      exceptionLabel: null,
      banners,
    };
  }

  const courseId =
    period.acceptsCourses ? binder.cycleGrid[day.cycleLetter]?.[period.id] || null : null;
  const course = courseId ? binder.courses[courseId] ?? null : null;

  // Partial block / custom bell cancelling this period
  if (day.classification.blocked[period.id]) {
    return {
      courseId,
      course,
      exceptionKind: 'blocked',
      exceptionLabel: day.classification.blocked[period.id],
      banners,
    };
  }

  // Cohort override affecting this course's year group
  if (course?.yearGroup) {
    for (const coh of day.classification.cohorts) {
      if (coh.yearGroups.includes(course.yearGroup)) {
        return {
          courseId,
          course,
          exceptionKind: 'cohort',
          exceptionLabel: coh.label,
          banners,
        };
      }
    }
  }

  return {
    courseId,
    course,
    exceptionKind: null,
    exceptionLabel: null,
    banners,
  };
}

export interface TodayPosition {
  weekIndex: number;
  dayIndex: number; // 0 = Monday … 4 = Friday
}

/**
 * Where should the planner open for a given date?
 *  • a school day or holiday inside the binder → that week & weekday
 *  • a weekend → the coming week (Monday), since weekends are for planning ahead
 *  • before the binder starts → the first teaching week
 *  • after the binder ends → the final week
 */
export function locateToday(schedule: ResolvedSchedule, todayIso: string): TodayPosition {
  const { weeks } = schedule;
  if (weeks.length === 0) return { weekIndex: 0, dayIndex: 0 };
  const firstTeaching = Math.max(0, weeks.findIndex((w) => w.isTeachingWeek));
  if (todayIso < weeks[0].mondayIso) return { weekIndex: firstTeaching, dayIndex: 0 };
  const last = weeks.length - 1;
  if (todayIso > weeks[last].fridayIso) return { weekIndex: last, dayIndex: 4 };

  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    const dayIndex = w.days.findIndex((d) => d.iso === todayIso);
    if (dayIndex !== -1) return { weekIndex: i, dayIndex };
    if (todayIso < w.mondayIso) return { weekIndex: i, dayIndex: 0 }; // weekend before this week
  }
  return { weekIndex: last, dayIndex: 4 };
}
