import { describe, expect, it } from 'vitest';
import { agendaFor, menuBarText } from '../todayAgenda';
import { resolveSchedule } from '../cycleEngine';
import { createNist2026Binder } from '../../presets/nist2026_2027';

describe('Mac app menu bar agenda', () => {
  const binder = createNist2026Binder();
  const schedule = resolveSchedule(binder);

  it("lists a teaching day's timed lessons in order", () => {
    const items = agendaFor(binder, schedule, '2026-11-26');
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.startMin)).toEqual([...items.map((i) => i.startMin)].sort((a, b) => a - b));
    expect(items.every((i) => /^\d{1,2}:\d{2}$/.test(i.start))).toBe(true);
  });

  it('is empty on a no-school day and at the weekend', () => {
    expect(agendaFor(binder, schedule, '2026-12-07')).toEqual([]); // Rama IX birthday
    expect(agendaFor(binder, schedule, '2026-11-28')).toEqual([]); // Saturday
  });

  it('says what is on now, next, or done', () => {
    const items = [
      { periodLabel: 'P1', start: '8:50', end: '10:05', startMin: 530, endMin: 605, title: '12 PHY', note: null },
      { periodLabel: 'P2', start: '10:25', end: '11:40', startMin: 625, endMin: 700, title: '9.7 SCI', note: null },
    ];
    expect(menuBarText(items, 480)).toBe('P1 12 PHY · 8:50');
    expect(menuBarText(items, 560)).toBe('Now P1 12 PHY → 10:05');
    expect(menuBarText(items, 600)).toBe('Now P1 12 PHY → 10:05');
    expect(menuBarText(items, 616)).toBe('P2 9.7 SCI · 10:25'); // in the break
    const tight = [items[0], { ...items[1], start: '10:10', startMin: 610 }];
    expect(menuBarText(tight, 602)).toBe('Next P2 9.7 SCI 10:10'); // last minutes of P1
    expect(menuBarText(items, 720)).toBe('Done for today');
    expect(menuBarText([], 600)).toBe('No lessons today');
  });
});
