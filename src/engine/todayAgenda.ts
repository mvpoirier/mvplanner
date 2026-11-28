// Today's lessons, duties and events with clock times: feeds reminders and the Mac menu bar.

import type { AcademicYearBinder, PeriodRow } from '../types/planner';
import { resolveSlot, type ResolvedSchedule } from './cycleEngine';
import type { ReminderKind } from '../store/reminderPrefs';
import { plainText } from './richText';

export interface AgendaItem {
  periodId: string;
  periodLabel: string;
  cellKey: string; // "2026-11-26__P3"
  kind: ReminderKind;
  start: string; // '12:30'
  end: string | null;
  startMin: number; // minutes after midnight
  endMin: number | null;
  title: string; // course code, duty, event text or "Free"
  note: string | null; // first line of the lesson note
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Breaks and lunch have no bell times of their own: borrow the neighbours' end and start. */
function timesFor(periods: PeriodRow[], i: number): { start?: string; end?: string } {
  const p = periods[i];
  if (p.start) return { start: p.start, end: p.end };
  const prev = [...periods.slice(0, i)].reverse().find((x) => x.end);
  const next = periods.slice(i + 1).find((x) => x.start);
  return { start: prev?.end, end: next?.start };
}

export function agendaFor(binder: AcademicYearBinder, schedule: ResolvedSchedule, iso: string): AgendaItem[] {
  const day = schedule.weeks.flatMap((w) => w.days).find((d) => d.iso === iso);
  if (!day || !day.inBinderRange || day.classification.pause) return [];
  const items: AgendaItem[] = [];
  binder.periods.forEach((period, i) => {
    const { start, end } = timesFor(binder.periods, i);
    if (!start) return;
    const slot = resolveSlot(binder, day, period);
    if (slot.exceptionKind === 'full') return;

    let kind: ReminderKind;
    let title: string;
    if (slot.course) {
      title = slot.course.code;
      const cat = slot.course.category;
      kind =
        period.id === 'ECA'
          ? 'eca'
          : cat === 'duty' || /duty/i.test(slot.course.code)
            ? 'duty'
            : cat === 'meeting' || cat === 'advisory'
              ? 'event'
              : 'class';
    } else if (slot.banners.length > 0) {
      title = slot.banners[0];
      kind = period.id === 'ECA' || /\beca\b/i.test(title) ? 'eca' : 'event';
    } else if (period.kind === 'period' && !slot.exceptionKind) {
      title = 'Free';
      kind = 'free';
    } else {
      return;
    }

    const cellKey = `${iso}__${period.id}`;
    items.push({
      periodId: period.id,
      periodLabel: period.label,
      cellKey,
      kind,
      start,
      end: end ?? null,
      startMin: toMin(start),
      endMin: end ? toMin(end) : null,
      title,
      note: plainText(binder.cellPlans[cellKey]?.text ?? '').trim().split('\n')[0] || null,
    });
  });
  return items.sort((a, b) => a.startMin - b.startMin);
}

/** Short menu-bar text (≤ 30 characters) for this minute of the day. */
export function menuBarText(items: AgendaItem[], nowMin: number): string {
  if (items.length === 0) return 'No lessons today';
  const now = items.find((i) => i.endMin !== null && nowMin >= i.startMin && nowMin < i.endMin);
  const next = items.find((i) => i.startMin > nowMin);
  const fit = (s: string) => (s.length > 30 ? `${s.slice(0, 29)}…` : s);
  if (now && next && next.startMin - nowMin <= 10) return fit(`Next ${next.periodLabel} ${next.title} ${next.start}`);
  if (now) return fit(`Now ${now.periodLabel} ${now.title} → ${now.end}`);
  if (next) return fit(`${next.periodLabel} ${next.title} · ${next.start}`);
  return 'Done for today';
}

/** Reminders that are due at this minute (not yet sent), given the settings. */
export function dueReminders(
  items: AgendaItem[],
  nowMin: number,
  opts: { leadMin: number; kinds: Record<ReminderKind, boolean>; skips: string[] },
  alreadySent: Set<string>,
): AgendaItem[] {
  return items.filter((i) => {
    if (!opts.kinds[i.kind] || opts.skips.includes(i.cellKey) || alreadySent.has(i.cellKey)) return false;
    const due = i.startMin - opts.leadMin;
    // From the reminder time until the item starts ("at start": its first minute)
    return nowMin >= due && nowMin < Math.max(i.startMin, due + 1);
  });
}

export function reminderText(i: AgendaItem, nowMin: number, includeNote: boolean): string {
  const mins = i.startMin - nowMin;
  const when = mins <= 0 ? 'Now' : `In ${mins} min`;
  const what = i.kind === 'free' ? `${i.periodLabel} free period` : `${i.periodLabel} ${i.title}`;
  const note = includeNote && i.note ? ` — ${i.note}` : '';
  return `${when} · ${what} at ${i.start}${note}`.slice(0, 300);
}
