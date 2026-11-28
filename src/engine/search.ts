// Binder search (⌘K): lesson notes, weekly notes, courses, events and holidays across the whole year.

import type { AcademicYearBinder } from '../types/planner';
import { resolveSlot, type ResolvedSchedule } from './cycleEngine';
import { plainText } from './richText';

export type SearchHitKind = 'lesson' | 'note' | 'event' | 'holiday';

export interface SearchHit {
  kind: SearchHitKind;
  weekIndex: number;
  dayIso: string | null;
  periodId: string | null;
  title: string;
  where: string; // 'Wk 14 · Wed 25 Nov · P3'
  chipLabel: string;
  chipColor: string;
  chipTextColor: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Every word of the query must appear somewhere in the haystack. */
function matches(haystack: string, terms: string[]): boolean {
  const h = norm(haystack);
  return terms.every((t) => h.includes(t));
}

export function searchBinder(
  binder: AcademicYearBinder,
  schedule: ResolvedSchedule,
  query: string,
  limit = 30,
): SearchHit[] {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];
  const seenHoliday = new Set<string>();

  for (const week of schedule.weeks) {
    const wk = week.teachingWeekNumber !== null ? `Wk ${week.teachingWeekNumber}` : 'Break';

    for (const day of week.days) {
      if (!day.inBinderRange) continue;
      const dayLabel = `${day.dow} ${day.shortDate.replace('-', ' ')}`;

      // Holidays / no-school days: one hit per run of the same label
      const pause = day.classification.pause;
      if (pause && !seenHoliday.has(pause.id) && matches(pause.title, terms)) {
        seenHoliday.add(pause.id);
        hits.push({
          kind: 'holiday',
          weekIndex: week.index,
          dayIso: day.iso,
          periodId: null,
          title: pause.title,
          where: `${wk} · ${dayLabel}`,
          chipLabel: 'No school',
          chipColor: '#fee2e2',
          chipTextColor: '#991b1b',
        });
      }

      for (const period of binder.periods) {
        const slot = resolveSlot(binder, day, period);
        const plan = binder.cellPlans[`${day.iso}__${period.id}`];
        const course = slot.course;
        const where = `${wk} · ${dayLabel} · ${period.label}`;

        const lessonText = plainText(plan?.text ?? '').trim();
        const courseText = course ? `${course.code} ${course.name ?? ''} ${course.room ?? ''}` : '';
        if (lessonText && matches(`${lessonText} ${courseText}`, terms)) {
          hits.push({
            kind: 'lesson',
            weekIndex: week.index,
            dayIso: day.iso,
            periodId: period.id,
            title: lessonText.split('\n')[0],
            where,
            chipLabel: course?.code ?? period.label,
            chipColor: course?.color ?? '#e2e8f0',
            chipTextColor: course?.textColor ?? '#1f2937',
          });
          continue;
        }
        // A course name matches but the slot has no lesson note: list the slot itself
        if (!lessonText && course && matches(courseText, terms)) {
          hits.push({
            kind: 'lesson',
            weekIndex: week.index,
            dayIso: day.iso,
            periodId: period.id,
            title: course.name || course.code,
            where,
            chipLabel: course.code,
            chipColor: course.color,
            chipTextColor: course.textColor ?? '#1f2937',
          });
          continue;
        }
        for (const banner of slot.banners) {
          if (matches(banner, terms)) {
            hits.push({
              kind: 'event',
              weekIndex: week.index,
              dayIso: day.iso,
              periodId: period.id,
              title: banner,
              where,
              chipLabel: 'Event',
              chipColor: '#dbeafe',
              chipTextColor: '#1e40af',
            });
            break;
          }
        }
      }
    }

    for (const note of binder.weeklyNotes[week.mondayIso] ?? []) {
      if (matches(plainText(note.text), terms)) {
        hits.push({
          kind: 'note',
          weekIndex: week.index,
          dayIso: null,
          periodId: null,
          title: plainText(note.text),
          where: `${wk} · ${week.dateRange} · note`,
          chipLabel: 'Note',
          chipColor: '#fff59d',
          chipTextColor: '#713f12',
        });
      }
    }
  }

  // Lesson notes and weekly notes first, then events, then plain course slots, holidays last.
  const rank = (h: SearchHit) =>
    h.kind === 'note' ? 0 : h.kind === 'lesson' ? (binder.cellPlans[`${h.dayIso}__${h.periodId}`] ? 0 : 2) : h.kind === 'event' ? 1 : 3;
  return hits
    .map((h, i) => ({ h, i }))
    .sort((a, b) => rank(a.h) - rank(b.h) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.h);
}
