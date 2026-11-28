// Plan a unit: tags a class's next N lessons "U2 L1…L8" (skipping holidays), with optional titles.

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { AcademicYearBinder } from '../types/planner';
import type { ResolvedSchedule } from '../engine/cycleEngine';
import { usePlannerStore } from '../store/usePlannerStore';
import { listValidCourseSlots } from '../engine/smartBumpEngine';
import { applyUnit, nextUnitNumber, previewUnit } from '../engine/unitsAndSequences';
import { parseISO } from '../engine/dateUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  courseId: string | null;
  startKey: string | null;
}

const fmt = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const UnitPlannerModal: React.FC<Props> = ({ open, onClose, binder, schedule, courseId, startKey }) => {
  if (!open || !courseId || !startKey) return null;
  return (
    <UnitPlannerInner
      key={`${courseId}-${startKey}`}
      onClose={onClose}
      binder={binder}
      schedule={schedule}
      initialCourse={courseId}
      initialStart={startKey}
    />
  );
};

const UnitPlannerInner: React.FC<{
  onClose: () => void;
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  initialCourse: string;
  initialStart: string;
}> = ({ onClose, binder, schedule, initialCourse, initialStart }) => {
  const updateActiveBinder = usePlannerStore((s) => s.updateActiveBinder);
  const showToast = usePlannerStore((s) => s.showToast);
  const [course, setCourse] = useState(initialCourse);
  const [number, setNumber] = useState(() => nextUnitNumber(binder, initialCourse));
  const [name, setName] = useState('');
  const [count, setCount] = useState(6);
  const [startKey, setStartKey] = useState(initialStart);
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [addTitles, setAddTitles] = useState(true);

  const classCourses = Object.values(binder.courses).filter((c) => c.category === 'class');
  const upcoming = useMemo(() => {
    const slots = listValidCourseSlots(binder, course, schedule);
    const i = Math.max(0, slots.findIndex((s) => s.key >= initialStart));
    return slots.slice(i, i + 40);
  }, [binder, course, schedule, initialStart]);
  const rows = useMemo(() => previewUnit(binder, course, startKey, count, schedule), [binder, course, startKey, count, schedule]);
  const lessons = rows.filter((r) => r.kind === 'lesson');
  const periodLabel = (id?: string) => binder.periods.find((p) => p.id === id)?.label ?? '';
  const overlaps = lessons.filter((r) => r.key && binder.cellPlans[r.key]?.unit).length;

  const apply = () => {
    const unit = {
      id: `unit-${Date.now().toString(36)}`,
      courseId: course,
      number: number.trim() || '1',
      name: name.trim(),
      total: lessons.length,
      createdAt: new Date().toISOString(),
    };
    updateActiveBinder((b) => applyUnit(b, unit, rows, titles, addTitles));
    showToast(`Unit ${unit.number} added to ${lessons.length} ${binder.courses[course]?.code ?? ''} lessons. ⌘Z to undo.`);
    onClose();
  };

  const inp = 'h-8 w-full rounded-lg border border-slate-300 px-2.5 text-[12.5px] text-slate-900 bg-white';
  const lbl = 'flex flex-col gap-1 text-[11px] font-semibold text-slate-500';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-title"
        className="w-full max-w-xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-200">
          <div>
            <h2 id="unit-title" className="text-base font-bold text-slate-900">Plan a unit</h2>
            <p className="text-slate-500 mt-0.5">
              Tags each lesson “U{number || '?'} L1”, “U{number || '?'} L2”… across this class’s next lessons, skipping
              holidays.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-[1.1fr_70px_1.6fr] gap-2.5">
            <label className={lbl}>
              Class
              <select
                className={inp}
                value={course}
                onChange={(e) => {
                  setCourse(e.target.value);
                  setNumber(nextUnitNumber(binder, e.target.value));
                }}
              >
                {classCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Unit
              <input className={inp} value={number} onChange={(e) => setNumber(e.target.value)} />
            </label>
            <label className={lbl}>
              Unit name
              <input className={inp} value={name} placeholder="e.g. Chemical reactions" onChange={(e) => setName(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className={lbl}>
              Number of lessons
              <input
                className={inp}
                type="number"
                min={1}
                max={40}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              />
            </label>
            <label className={lbl}>
              Starts at
              <select className={inp} value={startKey} onChange={(e) => setStartKey(e.target.value)}>
                {upcoming.map((s) => (
                  <option key={s.key} value={s.key}>
                    {fmt(s.date)} · {periodLabel(s.periodId)}
                    {s.key === initialStart ? ' (this lesson)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-[58px_150px_minmax(0,1fr)] gap-2 px-3 py-1.5 bg-slate-100 text-[10px] font-bold tracking-wider text-slate-500">
              <span>LESSON</span>
              <span>WHEN</span>
              <span>TITLE (OPTIONAL)</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {rows.map((r) =>
                r.kind === 'skipped' ? (
                  <div key={`s-${r.date}`} className="grid grid-cols-[58px_150px_minmax(0,1fr)] gap-2 px-3 py-1.5 border-t border-slate-100 bg-red-50 text-red-800">
                    <span>—</span>
                    <span>{fmt(r.date)}</span>
                    <span className="truncate">{r.label} — skipped</span>
                  </div>
                ) : (
                  <div key={r.key} className="grid grid-cols-[58px_150px_minmax(0,1fr)] gap-2 items-center px-3 py-1 border-t border-slate-100">
                    <span className="font-bold text-slate-900">
                      U{number || '?'} L{r.lesson}
                    </span>
                    <span className="text-slate-700">
                      {fmt(r.date)} · {periodLabel(r.periodId)}
                    </span>
                    <input
                      value={titles[r.lesson!] ?? ''}
                      onChange={(e) => setTitles((t) => ({ ...t, [r.lesson!]: e.target.value }))}
                      aria-label={`Title for lesson ${r.lesson}`}
                      className="h-7 rounded-md border border-slate-200 px-2 text-[12px] text-slate-900"
                    />
                  </div>
                ),
              )}
            </div>
          </div>
          {lessons.length < count && (
            <p className="text-amber-700">Only {lessons.length} more lessons of this class this year.</p>
          )}
          {overlaps > 0 && (
            <p className="text-amber-700">
              {overlaps} of these lessons already belong to another unit; they’ll move to this one.
            </p>
          )}

          <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
            <input type="checkbox" checked={addTitles} onChange={(e) => setAddTitles(e.target.checked)} className="accent-[#1d3f7a]" />
            Add each title as the first line of that lesson’s note
          </label>
          <p className="text-slate-500">
            Each lesson shows a “U{number || '?'} L3” tag in its corner; hover it for the unit’s progress. The tags move
            with your notes when you Bump.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            disabled={lessons.length === 0}
            onClick={apply}
            className="px-4 py-2 rounded-lg bg-[#1d3f7a] text-white font-bold hover:bg-[#163262] cursor-pointer disabled:opacity-40"
          >
            Add {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
};
