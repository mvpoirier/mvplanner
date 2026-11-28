import { describe, expect, it } from 'vitest';
import { agendaFor, dueReminders, menuBarText, reminderText, type AgendaItem } from '../todayAgenda';
import { resolveSchedule } from '../cycleEngine';
import { createNist2026Binder } from '../../presets/nist2026_2027';
import { DEFAULT_REMINDER_PREFS } from '../../store/reminderPrefs';

const item = (p: Partial<AgendaItem>): AgendaItem => ({
  periodId: 'P1', periodLabel: 'P1', cellKey: '2026-11-26__P1', kind: 'class',
  start: '8:50', end: '10:05', startMin: 530, endMin: 605, title: '12 PHY', note: null, ...p,
});

describe('Agenda, menu bar and reminders', () => {
  const binder = createNist2026Binder();
  const schedule = resolveSchedule(binder);
  const week = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];

  it("lists a day's timed items in order, with a kind for each", () => {
    const items = agendaFor(binder, schedule, '2026-11-26');
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.startMin)).toEqual([...items.map((i) => i.startMin)].sort((a, b) => a - b));
    expect(items.every((i) => ['class', 'duty', 'event', 'eca', 'free'].includes(i.kind))).toBe(true);
  });

  it('gives lunch and break items the times either side of them', () => {
    const lunch = week.flatMap((d) => agendaFor(binder, schedule, d)).filter((i) => i.periodId === 'LUNCH');
    expect(lunch.length).toBeGreaterThan(0);
    expect(lunch.every((i) => i.start === '11:40' && i.end === '12:30')).toBe(true);
  });

  it('is empty on a no-school day and at the weekend', () => {
    expect(agendaFor(binder, schedule, '2026-12-07')).toEqual([]); // Rama IX birthday
    expect(agendaFor(binder, schedule, '2026-11-28')).toEqual([]); // Saturday
  });

  it('says what is on now, next, or done', () => {
    const items = [item({}), item({ periodId: 'P2', periodLabel: 'P2', start: '10:25', end: '11:40', startMin: 625, endMin: 700, title: '9.7 SCI' })];
    expect(menuBarText(items, 480)).toBe('P1 12 PHY · 8:50');
    expect(menuBarText(items, 560)).toBe('Now P1 12 PHY → 10:05');
    expect(menuBarText(items, 616)).toBe('P2 9.7 SCI · 10:25');
    expect(menuBarText(items, 720)).toBe('Done for today');
    expect(menuBarText([], 600)).toBe('No lessons today');
  });

  it('reminds 10 minutes before by default, once, and only for the chosen kinds', () => {
    const p3 = item({ periodId: 'P3', periodLabel: 'P3', cellKey: 'k-p3', start: '12:30', startMin: 750, title: '9.7 SCI', note: 'Lab report' });
    const free = item({ periodId: 'P4', periodLabel: 'P4', cellKey: 'k-p4', kind: 'free', startMin: 845, title: 'Free' });
    const sent = new Set<string>();
    expect(dueReminders([p3, free], 739, DEFAULT_REMINDER_PREFS, sent)).toEqual([]);
    expect(dueReminders([p3, free], 740, DEFAULT_REMINDER_PREFS, sent)).toEqual([p3]);
    sent.add('k-p3');
    expect(dueReminders([p3], 741, DEFAULT_REMINDER_PREFS, sent)).toEqual([]);
    expect(dueReminders([free], 835, DEFAULT_REMINDER_PREFS, new Set())).toEqual([]); // free periods off by default
    expect(dueReminders([p3], 740, { ...DEFAULT_REMINDER_PREFS, skips: ['k-p3'] }, new Set())).toEqual([]);
    expect(dueReminders([p3], 750, { ...DEFAULT_REMINDER_PREFS, leadMin: 0 }, new Set())).toEqual([p3]);
    expect(reminderText(p3, 740, true)).toBe('In 10 min · P3 9.7 SCI at 12:30 — Lab report');
  });
});
