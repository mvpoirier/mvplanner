// Today's lessons with clock times: feeds the Mac app's menu bar item and lesson reminders.

import type { AcademicYearBinder } from '../types/planner';
import { resolveSlot, type ResolvedSchedule } from './cycleEngine';

export interface AgendaItem {
  periodLabel: string;
  start: string; // '12:30'
  end: string | null;
  startMin: number; // minutes after midnight
  endMin: number | null;
  title: string; // course code, duty or event text
  note: string | null; // first line of the lesson note
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function agendaFor(binder: AcademicYearBinder, schedule: ResolvedSchedule, iso: string): AgendaItem[] {
  const day = schedule.weeks.flatMap((w) => w.days).find((d) => d.iso === iso);
  if (!day || !day.inBinderRange) return [];
  const items: AgendaItem[] = [];
  for (const period of binder.periods) {
    if (!period.start) continue;
    const slot = resolveSlot(binder, day, period);
    if (slot.exceptionKind === 'full') continue;
    const title = slot.course?.code ?? slot.banners[0] ?? null;
    if (!title) continue;
    const plan = binder.cellPlans[`${iso}__${period.id}`];
    items.push({
      periodLabel: period.label,
      start: period.start,
      end: period.end ?? null,
      startMin: toMin(period.start),
      endMin: period.end ? toMin(period.end) : null,
      title,
      note: plan?.text?.trim().split('\n')[0] || null,
    });
  }
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
