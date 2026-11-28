// 1/3-style sequences and unit planning ("U2 L1…L8") across a class's next lessons.
// Both live inside each lesson's CellPlan, so Bump moves them along with the text.

import { cellKey, type AcademicYearBinder, type CellPlan, type UnitPlan } from '../types/planner';
import { resolveSchedule, type ResolvedSchedule } from './cycleEngine';
import { listValidCourseSlots, type CourseSlotRef } from './smartBumpEngine';

/** The class's lessons after `fromKey` (not including it), up to `count`. */
export function nextLessons(
  binder: AcademicYearBinder,
  courseId: string,
  fromKey: string,
  count: number,
  schedule?: ResolvedSchedule,
): CourseSlotRef[] {
  const slots = listValidCourseSlots(binder, courseId, schedule);
  const i = slots.findIndex((s) => s.key === fromKey);
  const start = i === -1 ? slots.findIndex((s) => s.key > fromKey) : i + 1;
  return start < 0 ? [] : slots.slice(start, start + count);
}

const seqLine = (k: number, total: number, rest: string) => `${k}/${total} ${rest}`;
const seqLineRe = (total: number) => new RegExp(`^\\s*\\d{1,2}\\s*/\\s*${total}\\s+`);

/** Add "2/3 …", "3/3 …" as the first line of the class's next lessons. */
export function fillSequence(
  binder: AcademicYearBinder,
  courseId: string,
  fromKey: string,
  total: number,
  rest: string,
): Record<string, CellPlan> {
  const plans = { ...binder.cellPlans };
  nextLessons(binder, courseId, fromKey, total - 1).forEach((slot, i) => {
    const line = seqLine(i + 2, total, rest);
    const existing = plans[slot.key];
    const text = existing?.text.trim() ? `${line}\n${existing.text.trim()}` : line;
    plans[slot.key] = { ...(existing ?? { ink: binder.cellPlans[fromKey]?.ink ?? 'pencil' }), text, seqFrom: fromKey };
  });
  return plans;
}

/** Has this 1/N already been carried forward? */
export function sequenceAlreadyFilled(binder: AcademicYearBinder, fromKey: string): boolean {
  return Object.values(binder.cellPlans).some((p) => p.seqFrom === fromKey);
}

function stripSeqLine(plan: CellPlan, total?: number): CellPlan | null {
  const lines = plan.text.split('\n');
  const re = total ? seqLineRe(total) : /^\s*\d{1,2}\s*\/\s*\d{1,2}\s+/;
  const idx = lines.findIndex((l) => re.test(l));
  if (idx !== -1) lines.splice(idx, 1);
  const text = lines.join('\n').trim();
  const { seqFrom: _drop, ...rest } = plan;
  void _drop;
  return text || rest.unit ? { ...rest, text } : null;
}

/** Remove one added sequence line (the ✕ on a lesson). */
export function removeSequenceLine(binder: AcademicYearBinder, key: string): Record<string, CellPlan> {
  const plans = { ...binder.cellPlans };
  const p = plans[key];
  if (!p?.seqFrom) return plans;
  const next = stripSeqLine(p);
  if (next) plans[key] = next;
  else delete plans[key];
  return plans;
}

/** Remove every line a 1/N started (keeps the 1/N itself). */
export function removeWholeSequence(binder: AcademicYearBinder, fromKey: string): Record<string, CellPlan> {
  let plans = { ...binder.cellPlans };
  for (const [k, p] of Object.entries(binder.cellPlans)) {
    if (p.seqFrom === fromKey) plans = removeSequenceLine({ ...binder, cellPlans: plans }, k);
  }
  return plans;
}

// ---------- Units ----------

export function nextUnitNumber(binder: AcademicYearBinder, courseId: string): string {
  const nums = Object.values(binder.units ?? {})
    .filter((u) => u.courseId === courseId)
    .map((u) => Number(u.number))
    .filter((n) => !Number.isNaN(n));
  return String(nums.length ? Math.max(...nums) + 1 : 1);
}

export interface UnitPreviewRow {
  kind: 'lesson' | 'skipped';
  key?: string;
  date: string;
  periodId?: string;
  lesson?: number;
  label?: string; // why it was skipped
}

/** Where each lesson of a new unit would land, with no-school days in between shown as skipped. */
export function previewUnit(
  binder: AcademicYearBinder,
  courseId: string,
  startKey: string,
  count: number,
  schedule?: ResolvedSchedule,
): UnitPreviewRow[] {
  const sched = schedule ?? resolveSchedule(binder);
  const slots = listValidCourseSlots(binder, courseId, sched);
  let i = slots.findIndex((s) => s.key === startKey);
  if (i === -1) i = slots.findIndex((s) => s.key > startKey);
  if (i === -1) return [];
  const chosen = slots.slice(i, i + count);
  if (chosen.length === 0) return [];
  const first = chosen[0].date;
  const last = chosen[chosen.length - 1].date;
  const skipped: UnitPreviewRow[] = [];
  const seen = new Set<string>();
  for (const w of sched.weeks) {
    for (const d of w.days) {
      const pause = d.classification.pause;
      if (d.iso > first && d.iso < last && pause && !seen.has(pause.id)) {
        seen.add(pause.id);
        skipped.push({ kind: 'skipped', date: d.iso, label: pause.title });
      }
    }
  }
  const rows: UnitPreviewRow[] = chosen.map((s, n) => ({
    kind: 'lesson',
    key: s.key,
    date: s.date,
    periodId: s.periodId,
    lesson: n + 1,
  }));
  return [...rows, ...skipped].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'skipped' ? -1 : 1));
}

/** Tag the lessons (and optionally add each title as the note's first line). */
export function applyUnit(
  binder: AcademicYearBinder,
  unit: UnitPlan,
  rows: UnitPreviewRow[],
  titles: Record<number, string>,
  addTitles: boolean,
): AcademicYearBinder {
  const plans = { ...binder.cellPlans };
  for (const r of rows) {
    if (r.kind !== 'lesson' || !r.key || !r.lesson) continue;
    const existing = plans[r.key];
    const title = titles[r.lesson]?.trim();
    let text = existing?.text ?? '';
    if (addTitles && title && !text.split('\n').some((l) => l.trim() === title)) {
      text = text.trim() ? `${title}\n${text.trim()}` : title;
    }
    plans[r.key] = { ...(existing ?? { ink: 'pencil' }), text, unit: { id: unit.id, lesson: r.lesson } };
  }
  return { ...binder, cellPlans: plans, units: { ...(binder.units ?? {}), [unit.id]: unit } };
}

/** Take a unit's tags off its lessons (their notes stay). */
export function removeUnit(binder: AcademicYearBinder, unitId: string): AcademicYearBinder {
  const plans: Record<string, CellPlan> = {};
  for (const [k, p] of Object.entries(binder.cellPlans)) {
    if (p.unit?.id !== unitId) {
      plans[k] = p;
      continue;
    }
    const { unit: _u, ...rest } = p;
    void _u;
    if (rest.text.trim()) plans[k] = rest;
  }
  const units = { ...(binder.units ?? {}) };
  delete units[unitId];
  return { ...binder, cellPlans: plans, units };
}

export const unitKeyFor = (date: string, periodId: string) => cellKey(date, periodId);
