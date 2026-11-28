import { describe, expect, it } from 'vitest';
import { cellKey } from '../../types/planner';
import { createNist2026Binder } from '../../presets/nist2026_2027';
import { listValidCourseSlots, smartBumpForward } from '../smartBumpEngine';
import {
  applyUnit,
  fillSequence,
  nextLessons,
  nextUnitNumber,
  previewUnit,
  removeSequenceLine,
  removeUnit,
  removeWholeSequence,
} from '../unitsAndSequences';

describe('Sequences', () => {
  const binder = createNist2026Binder();
  const slots = listValidCourseSlots(binder, '13 PHY');
  const from = slots[10].key;
  binder.cellPlans = { [from]: { text: '1/3 Titration practical', ink: 'blue' }, [slots[12].key]: { text: 'Quiz', ink: 'pencil' } };

  it('fills 2/3 and 3/3 into the next two lessons of the class', () => {
    expect(nextLessons(binder, '13 PHY', from, 2).map((s) => s.key)).toEqual([slots[11].key, slots[12].key]);
    const plans = fillSequence(binder, '13 PHY', from, 3, 'Titration practical');
    expect(plans[slots[11].key]).toMatchObject({ text: '2/3 Titration practical', seqFrom: from, ink: 'blue' });
    expect(plans[slots[12].key].text).toBe('3/3 Titration practical\nQuiz');
  });

  it('removes one added line, or the whole sequence', () => {
    const b = { ...binder, cellPlans: fillSequence(binder, '13 PHY', from, 3, 'Titration practical') };
    const one = removeSequenceLine(b, slots[12].key);
    expect(one[slots[12].key].text).toBe('Quiz');
    expect(one[slots[11].key]).toBeDefined();
    const all = removeWholeSequence(b, from);
    expect(all[slots[11].key]).toBeUndefined();
    expect(all[slots[12].key].text).toBe('Quiz');
    expect(all[from].text).toBe('1/3 Titration practical');
  });
});

describe('Units', () => {
  const binder = createNist2026Binder();
  const course = '13 PHY';
  const slots = listValidCourseSlots(binder, course);
  // Start the week before Rama IX Birthday (Mon 7 Dec 2026) so it shows as skipped
  const start = slots.find((s) => s.date >= '2026-12-01')!;

  it('previews lessons across the next dates and lists no-school days between', () => {
    const rows = previewUnit(binder, course, start.key, 6);
    const lessons = rows.filter((r) => r.kind === 'lesson');
    expect(lessons.map((r) => r.lesson)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.some((r) => r.kind === 'skipped' && r.date === '2026-12-07')).toBe(true);
  });

  it('tags lessons, adds titles, and the tags move with Bump', () => {
    const rows = previewUnit(binder, course, start.key, 4);
    const unit = { id: 'u2', courseId: course, number: '2', name: 'Fields', total: 4, createdAt: '' };
    const b = applyUnit(binder, unit, rows, { 1: 'Intro', 3: 'Lab' }, true);
    const keys = rows.filter((r) => r.kind === 'lesson').map((r) => r.key!);
    expect(b.cellPlans[keys[0]]).toMatchObject({ text: 'Intro', unit: { id: 'u2', lesson: 1 } });
    expect(b.cellPlans[keys[1]]).toMatchObject({ text: '', unit: { id: 'u2', lesson: 2 } });
    expect(nextUnitNumber(b, course)).toBe('3');

    // Lose a lesson: move everything from L1 along one slot; L4's tag lands one lesson later
    const bumped = smartBumpForward(b, course, start.date, cellKey(start.date, start.periodId).split('__')[1], 'term');
    expect(bumped.nextCellPlans[keys[1]].unit).toEqual({ id: 'u2', lesson: 1 });
    const after = slots[slots.findIndex((s) => s.key === keys[3]) + 1].key;
    expect(bumped.nextCellPlans[after].unit).toEqual({ id: 'u2', lesson: 4 });
  });

  it('removes a unit but keeps the notes', () => {
    const rows = previewUnit(binder, course, start.key, 2);
    const unit = { id: 'u9', courseId: course, number: '9', name: '', total: 2, createdAt: '' };
    const b = removeUnit(applyUnit(binder, unit, rows, { 1: 'Keep me' }, true), 'u9');
    const keys = rows.filter((r) => r.kind === 'lesson').map((r) => r.key!);
    expect(b.cellPlans[keys[0]]).toEqual({ ink: 'pencil', text: 'Keep me' });
    expect(b.cellPlans[keys[1]]).toBeUndefined();
    expect(b.units?.u9).toBeUndefined();
  });
});
