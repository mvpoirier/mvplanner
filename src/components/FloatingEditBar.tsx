// Compact Floating Mini-Toolbar anchored above/below the cell currently being inline-edited.

import React, { useState } from 'react';
import { SkipForward, Undo2 } from 'lucide-react';
import { cellKey, type AcademicYearBinder, type InkTone } from '../types/planner';
import { resolveSlot, type ResolvedSchedule, type ResolvedWeek } from '../engine/cycleEngine';
import { usePlannerStore } from '../store/usePlannerStore';
import type { BumpScope } from '../engine/smartBumpEngine';

export interface ActiveEditTarget {
  date: string;
  periodId: string;
  rect: { top: number; bottom: number; left: number; width: number };
}

interface FloatingEditBarProps {
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  week: ResolvedWeek;
  target: ActiveEditTarget;
  onDone: () => void;
}

export const FloatingEditBar: React.FC<FloatingEditBarProps> = ({
  binder,
  schedule,
  week,
  target,
  onDone,
}) => {
  const updateCellPlan = usePlannerStore((s) => s.updateCellPlan);
  const bumpCourseForward = usePlannerStore((s) => s.bumpCourseForward);
  const pinCellToWeeklyNotes = usePlannerStore((s) => s.pinCellToWeeklyNotes);
  const undo = usePlannerStore((s) => s.undo);
  const canUndo = usePlannerStore((s) => s.past.length > 0);
  const [bumpScope, setBumpScope] = useState<BumpScope>('blank');

  const day = schedule.daysByIso[target.date];
  const period = binder.periods.find((p) => p.id === target.periodId);
  if (!day || !period) return null;

  const slot = resolveSlot(binder, day, period);
  const plan = binder.cellPlans[cellKey(target.date, target.periodId)];
  const activeInk: InkTone = plan?.ink ?? 'pencil';
  const canBump =
    !binder.archived &&
    Boolean(slot.courseId) &&
    slot.course?.category !== 'duty' &&
    period.kind === 'period';

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const top = target.rect.top > 56 ? target.rect.top - 44 : target.rect.bottom + 6;
  const left = Math.min(Math.max(12, target.rect.left - 20), Math.max(12, vw - 520));

  return (
    <div
      className="floating-toolbar"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={(e) => {
        // Keep focus inside the inline textarea unless clicking an input/select
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'SELECT') e.preventDefault();
      }}
    >
      {/* Ink tones */}
      {(
        [
          ['pencil', 'Pencil', 'text-slate-700'],
          ['blue', 'Blue', 'text-blue-700'],
          ['red', 'Red', 'text-red-700'],
        ] as [InkTone, string, string][]
      ).map(([tone, label, colorCls]) => (
        <button
          key={tone}
          type="button"
          onClick={() => updateCellPlan(target.date, target.periodId, { ink: tone })}
          className={`px-1.5 py-0.5 rounded border font-semibold cursor-pointer ${colorCls} ${
            activeInk === tone ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-100'
          }`}
        >
          {label}
        </button>
      ))}

      <span className="w-px h-4 bg-slate-200" />

      {/* Markers */}
      <button
        type="button"
        onClick={() => updateCellPlan(target.date, target.periodId, { circled: !plan?.circled })}
        className={`px-1.5 py-0.5 rounded border font-semibold cursor-pointer ${
          plan?.circled ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 hover:bg-slate-100'
        }`}
        title="Circle first line"
      >
        ◯
      </button>
      <button
        type="button"
        onClick={() => updateCellPlan(target.date, target.periodId, { star: !plan?.star })}
        className={`px-1.5 py-0.5 rounded border font-semibold cursor-pointer ${
          plan?.star ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 hover:bg-slate-100'
        }`}
        title="Star highlight"
      >
        ★
      </button>
      <button
        type="button"
        onClick={() => updateCellPlan(target.date, target.periodId, { strike: !plan?.strike })}
        className={`px-1.5 py-0.5 rounded border font-semibold cursor-pointer ${
          plan?.strike ? 'border-slate-600 bg-slate-200' : 'border-slate-200 hover:bg-slate-100'
        }`}
        title="Strikethrough"
      >
        S̶
      </button>
      <button
        type="button"
        disabled={!plan?.text.trim()}
        onClick={() =>
          pinCellToWeeklyNotes(
            week.mondayIso,
            target.date,
            target.periodId,
            `${day.dow} ${period.label} ${slot.course?.code ?? ''}`.trim(),
          )
        }
        className={`px-1.5 py-0.5 rounded border font-semibold cursor-pointer disabled:opacity-40 ${
          plan?.pinNote ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 hover:bg-slate-100'
        }`}
        title="Pin to right-page NOTES"
      >
        → NOTES
      </button>

      {/* Sequence tag */}
      <input
        type="text"
        value={plan?.seq ?? ''}
        onChange={(e) => updateCellPlan(target.date, target.periodId, { seq: e.target.value })}
        placeholder="1/3"
        className="w-11 rounded border border-slate-200 px-1 py-0.5 font-mono text-[10.5px] focus:outline-none focus:ring-1 focus:ring-blue-500"
        title="Lesson sequence tag (e.g. 1/3)"
      />

      {canBump && (
        <>
          <span className="w-px h-4 bg-slate-200" />
          <select
            value={bumpScope}
            onChange={(e) => setBumpScope(e.target.value as BumpScope)}
            className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10.5px] cursor-pointer"
            title="Smart Bump scope"
          >
            <option value="blank">To blank</option>
            <option value="term">Full term</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (slot.courseId) {
                bumpCourseForward(slot.courseId, target.date, target.periodId, bumpScope);
                onDone();
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer"
            title="Smart Bump this course forward"
          >
            <SkipForward className="w-3 h-3" /> Bump
          </button>
        </>
      )}

      {canUndo && (
        <button
          type="button"
          onClick={undo}
          className="p-1 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"
          title="Undo (Ctrl/Cmd+Z)"
        >
          <Undo2 className="w-3 h-3" />
        </button>
      )}

      <button
        type="button"
        onClick={onDone}
        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
      >
        Done
      </button>
    </div>
  );
};
