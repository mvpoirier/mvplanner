import { describe, expect, it } from 'vitest';
import { createNist2026Binder } from '../../presets/nist2026_2027';
import { locateToday, resolveSchedule } from '../cycleEngine';

describe('Open on Today', () => {
  const schedule = resolveSchedule(createNist2026Binder());
  const { weeks } = schedule;
  const weekOf = (iso: string) => weeks[locateToday(schedule, iso).weekIndex];

  it('opens on the week and weekday containing a school day', () => {
    const pos = locateToday(schedule, '2026-11-26'); // Thursday
    expect(weeks[pos.weekIndex].mondayIso).toBe('2026-11-23');
    expect(pos.dayIndex).toBe(3);
  });

  it('opens on the coming week at the weekend', () => {
    expect(weekOf('2026-11-28').mondayIso).toBe('2026-11-30'); // Saturday
    expect(weekOf('2026-11-29').mondayIso).toBe('2026-11-30'); // Sunday
    expect(locateToday(schedule, '2026-11-29').dayIndex).toBe(0);
  });

  it('opens on the first teaching week before the binder starts', () => {
    const pos = locateToday(schedule, '2026-06-01');
    expect(weeks[pos.weekIndex].isTeachingWeek).toBe(true);
    expect(pos.weekIndex).toBe(weeks.findIndex((w) => w.isTeachingWeek));
  });

  it('opens on the final week after the binder ends', () => {
    const pos = locateToday(schedule, '2027-08-15');
    expect(pos.weekIndex).toBe(weeks.length - 1);
    expect(pos.dayIndex).toBe(4);
  });

  it('shows a holiday week if today falls in one', () => {
    const holiday = weeks.find((w) => !w.isTeachingWeek && w.index > 2)!;
    expect(weekOf(holiday.days[2].iso).mondayIso).toBe(holiday.mondayIso);
  });
});
