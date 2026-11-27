import { describe, expect, it } from 'vitest';
import { createNist2026Binder } from '../../presets/nist2026_2027';
import { cellKey } from '../../types/planner';
import { formatWeekHeading, resolveSchedule, resolveSlot } from '../cycleEngine';
import { smartBumpForward } from '../smartBumpEngine';

describe('NIST 2026–2027 Schedule Verification', () => {
  const binder = createNist2026Binder();
  const schedule = resolveSchedule(binder);

  it('produces exact 46 calendar weeks, 38 teaching weeks, and 178 instructional days', () => {
    expect(schedule.summary.totalCalendarWeeks).toBe(46);
    expect(schedule.summary.totalTeachingWeeks).toBe(38);
    expect(schedule.summary.totalInstructionalDays).toBe(178);
    expect(schedule.weeks.filter((w) => !w.isTeachingWeek)).toHaveLength(8);
  });

  it('produces exact per-letter occurrence counts (A–H = 18, I–J = 17)', () => {
    for (const l of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      expect(schedule.summary.letterCounts[l]).toBe(18);
    }
    expect(schedule.summary.letterCounts['I']).toBe(17);
    expect(schedule.summary.letterCounts['J']).toBe(17);
  });

  it('verifies key cycle anchor dates (A1, J8, H18) and teaching week headings', () => {
    const a1 = schedule.daysByIso['2026-08-19'];
    expect(a1.occurrenceTag).toBe('A1');
    const wk1 = schedule.weeks.find((w) => w.mondayIso === '2026-08-17')!;
    expect(formatWeekHeading(wk1)).toBe('Week 1 of 38');

    const wk9 = schedule.weeks.find((w) => w.mondayIso === '2026-10-19')!;
    expect(formatWeekHeading(wk9)).toBe('Week 9 of 38');
    expect(schedule.daysByIso['2026-10-23'].isInstructional).toBe(false);
    expect(schedule.daysByIso['2026-10-23'].classification.pause?.title).toContain('RAMA V');

    const wk17 = schedule.weeks.find((w) => w.mondayIso === '2026-12-14')!;
    expect(formatWeekHeading(wk17)).toBe('Week 17 of 38');
    expect(schedule.daysByIso['2026-12-18'].occurrenceTag).toBe('I8');
    expect(schedule.daysByIso['2026-12-18'].classification.bellLabel).toBe('Early Dismissal 11:30');

    const j8 = schedule.daysByIso['2027-01-11'];
    expect(j8.occurrenceTag).toBe('J8');
    const wk18 = schedule.weeks.find((w) => w.mondayIso === '2027-01-11')!;
    expect(formatWeekHeading(wk18)).toBe('Week 18 of 38');

    const h18 = schedule.daysByIso['2027-06-18'];
    expect(h18.occurrenceTag).toBe('H18');
    const wk38 = schedule.weeks.find((w) => w.mondayIso === '2027-06-14')!;
    expect(formatWeekHeading(wk38)).toBe('Week 38 of 38');
  });

  it('applies recurring AM/ECA rules and skips holidays', () => {
    const amPeriod = binder.periods.find((p) => p.id === 'AM')!;
    const ecaPeriod = binder.periods.find((p) => p.id === 'ECA')!;

    const tueActive = resolveSlot(binder, schedule.daysByIso['2026-10-20'], amPeriod);
    expect(tueActive.banners).toContain('8:05 - Morning Meeting');

    const wedActive = resolveSlot(binder, schedule.daysByIso['2026-10-21'], ecaPeriod);
    expect(wedActive.banners).toContain('ECA - Science Support');

    const tueWinterBreak = resolveSlot(binder, schedule.daysByIso['2026-12-22'], amPeriod);
    expect(tueWinterBreak.banners).not.toContain('8:05 - Morning Meeting');
  });
});

describe('Exception Resolver Behaviors', () => {
  it('supports skip_letter, partial_block, and cohort_override', () => {
    const binder = createNist2026Binder();
    binder.exceptions.push(
      {
        id: 'ex-skip',
        title: 'Skip Letter Test',
        start: '2026-08-20',
        end: '2026-08-20',
        behavior: 'skip_letter',
      },
      {
        id: 'ex-block',
        title: 'Assembly',
        start: '2026-08-19',
        end: '2026-08-19',
        behavior: 'partial_block',
        periodIds: ['P1'],
      },
      {
        id: 'ex-cohort',
        title: 'Y13 Mock Exams',
        start: '2026-08-19',
        end: '2026-08-19',
        behavior: 'cohort_override',
        yearGroups: ['Y13'],
      },
    );

    const sched = resolveSchedule(binder);
    // 2026-08-19 = A1, 2026-08-20 skips B -> C1!
    expect(sched.daysByIso['2026-08-19'].occurrenceTag).toBe('A1');
    expect(sched.daysByIso['2026-08-20'].occurrenceTag).toBe('C1');

    const p1 = binder.periods.find((p) => p.id === 'P1')!;
    const p3 = binder.periods.find((p) => p.id === 'P3')!;
    const p4 = binder.periods.find((p) => p.id === 'P4')!;
    const day = sched.daysByIso['2026-08-19'];

    expect(resolveSlot(binder, day, p1).exceptionKind).toBe('blocked');
    expect(resolveSlot(binder, day, p3).exceptionKind).toBe('cohort'); // 13B ADV is Y13
    expect(resolveSlot(binder, day, p4).exceptionKind).toBeNull(); // 12 PHY is Y12 -> untouched
  });
});

describe('Smart Bump Forward Engine', () => {
  it('stops at the next blank slot in default "blank" mode and skips cohort overrides', () => {
    const binder = createNist2026Binder();
    // 13 PHY occurs on A (P1: 08-19), E (P1: 08-25), F (P1: 08-26), H (P3: 08-28), I (P2: 08-31), J (P3: 09-01)
    // Add a Y13 cohort override on 2026-08-25 (Day E) so Bump must skip 08-25 and land on 08-26 (Day F)!
    binder.exceptions.push({
      id: 'ex-y13-trip',
      title: 'Y13 Field Trip',
      start: '2026-08-25',
      end: '2026-08-25',
      behavior: 'cohort_override',
      yearGroups: ['Y13'],
    });

    const k1 = cellKey('2026-08-19', 'P1'); // A1
    const kSkip = cellKey('2026-08-25', 'P1'); // E1 (overridden)
    const k2 = cellKey('2026-08-26', 'P1'); // F1
    const k3 = cellKey('2026-08-28', 'P3'); // H1 (blank buffer!)
    const k4 = cellKey('2026-08-31', 'P2'); // I1 (occupied after blank -> must NOT move in 'blank' mode)
    const otherCourseKey = cellKey('2026-08-19', 'P4'); // 12 PHY

    binder.cellPlans = {
      [k1]: { text: 'Lesson 1', ink: 'blue' },
      [k2]: { text: 'Lesson 2', ink: 'pencil' },
      [k4]: { text: 'Lesson 4 (keep)', ink: 'red' },
      [otherCourseKey]: { text: '12 PHY untouched', ink: 'pencil' },
    };

    const res = smartBumpForward(binder, '13 PHY', '2026-08-19', 'P1', 'blank');
    expect(res.movedCount).toBe(2);
    expect(res.nextCellPlans[k1]).toBeUndefined();
    expect(res.nextCellPlans[kSkip]).toBeUndefined();
    expect(res.nextCellPlans[k2]?.text).toBe('Lesson 1');
    expect(res.nextCellPlans[k3]?.text).toBe('Lesson 2');
    expect(res.nextCellPlans[k4]?.text).toBe('Lesson 4 (keep)');
    expect(res.nextCellPlans[otherCourseKey]?.text).toBe('12 PHY untouched');
  });

  it('ripples past blank slots in "term" mode', () => {
    const binder = createNist2026Binder();
    const k1 = cellKey('2026-08-19', 'P1'); // A1
    const k2 = cellKey('2026-08-25', 'P1'); // E1 (blank)
    const k3 = cellKey('2026-08-26', 'P1'); // F1
    const k4 = cellKey('2026-08-28', 'P3'); // H1

    binder.cellPlans = {
      [k1]: { text: 'Lesson A', ink: 'blue' },
      [k3]: { text: 'Lesson F', ink: 'blue' },
    };

    const res = smartBumpForward(binder, '13 PHY', '2026-08-19', 'P1', 'term');
    expect(res.nextCellPlans[k1]).toBeUndefined();
    expect(res.nextCellPlans[k2]?.text).toBe('Lesson A');
    expect(res.nextCellPlans[k3]).toBeUndefined();
    expect(res.nextCellPlans[k4]?.text).toBe('Lesson F');
  });
});
