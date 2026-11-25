// RFC 5545 .ics calendar feed exporter for a selected week range.

import { cellKey, type AcademicYearBinder } from '../../types/planner';
import { resolveSchedule, resolveSlot } from '../../engine/cycleEngine';

function icsEscape(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toIcsDateTime(iso: string, hhmm: string): string {
  const d = iso.replace(/-/g, '');
  const [h, m] = hhmm.split(':').map((n) => n.padStart(2, '0'));
  return `${d}T${h}${m}00`;
}

export function generateIcsContent(
  binder: AcademicYearBinder,
  fromWeekIdx: number,
  toWeekIdx: number,
): string {
  const schedule = resolveSchedule(binder);
  const slice = schedule.weeks.slice(
    Math.max(0, fromWeekIdx),
    Math.min(schedule.weeks.length, toWeekIdx + 1),
  );
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MVPlanner//Teacher Timetable//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(binder.title)}`,
  ];

  for (const week of slice) {
    for (const day of week.days) {
      if (!day.inBinderRange) continue;

      if (day.classification.pause) {
        const dStart = day.iso.replace(/-/g, '');
        lines.push(
          'BEGIN:VEVENT',
          `UID:pause-${day.iso}@mvplanner`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${dStart}`,
          `SUMMARY:${icsEscape(day.classification.pause.title)}`,
          'END:VEVENT',
        );
        continue;
      }

      if (!day.isInstructional) continue;

      for (const period of binder.periods) {
        if (period.kind === 'divider') {
          const slot = resolveSlot(binder, day, period);
          if (slot.course) {
            lines.push(
              'BEGIN:VEVENT',
              `UID:${day.iso}-${period.id}@mvplanner`,
              `DTSTAMP:${stamp}`,
              `DTSTART:${toIcsDateTime(day.iso, '11:45')}`,
              `DTEND:${toIcsDateTime(day.iso, '12:30')}`,
              `SUMMARY:${icsEscape(`${slot.course.code} (${day.occurrenceTag ?? day.cycleLetter})`)}`,
              'END:VEVENT',
            );
          }
          continue;
        }

        const slot = resolveSlot(binder, day, period);
        const plan = binder.cellPlans[cellKey(day.iso, period.id)];
        const titleParts: string[] = [];
        if (slot.course) titleParts.push(slot.course.code);
        else if (slot.banners.length > 0) titleParts.push(slot.banners[0]);
        else if (plan?.text.trim()) titleParts.push(period.label);
        else continue;

        if (day.occurrenceTag) titleParts.push(`(${day.occurrenceTag})`);

        const startT = period.start ?? '08:00';
        const endT = period.end ?? '09:00';
        const descParts: string[] = [];
        if (slot.banners.length > 0) descParts.push(slot.banners.join(' · '));
        if (slot.exceptionLabel) descParts.push(`Exception: ${slot.exceptionLabel}`);
        if (plan?.text.trim()) descParts.push(plan.text.trim());

        lines.push(
          'BEGIN:VEVENT',
          `UID:${day.iso}-${period.id}@mvplanner`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${toIcsDateTime(day.iso, startT)}`,
          `DTEND:${toIcsDateTime(day.iso, endT)}`,
          `SUMMARY:${icsEscape(titleParts.join(' '))}`,
          ...(descParts.length > 0 ? [`DESCRIPTION:${icsEscape(descParts.join('\n'))}`] : []),
          ...(slot.course?.room ? [`LOCATION:${icsEscape(slot.course.room)}`] : []),
          'END:VEVENT',
        );
      }
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
