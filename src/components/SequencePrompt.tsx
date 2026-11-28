// "Continue this 3-lesson sequence?" — shown under a lesson whose note starts a line with 1/N.
// Also used from Unit ▾ → "Make this a 1/3 sequence…" to choose how many lessons first.

import React, { useState } from 'react';
import type { AcademicYearBinder } from '../types/planner';
import type { ResolvedSchedule } from '../engine/cycleEngine';
import { nextLessons } from '../engine/unitsAndSequences';
import { parseISO } from '../engine/dateUtils';

interface Props {
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  courseId: string;
  fromKey: string;
  /** Known from the note ("1/3 …"); null = ask how many first. */
  total: number | null;
  anchor: { top: number; left: number };
  onAdd: (total: number) => void;
  onDismiss: () => void;
}

const fmt = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const SequencePrompt: React.FC<Props> = ({ binder, schedule, courseId, fromKey, total, anchor, onAdd, onDismiss }) => {
  const [n, setN] = useState<number>(total ?? 3);
  const targets = nextLessons(binder, courseId, fromKey, n - 1, schedule);
  const code = binder.courses[courseId]?.code ?? courseId;
  const periodLabel = (id: string) => binder.periods.find((p) => p.id === id)?.label ?? id;

  return (
    <div
      className="seq-prompt"
      style={{ top: anchor.top, left: anchor.left }}
      onMouseDown={(e) => e.preventDefault()}
      role="dialog"
      aria-label="Continue sequence"
    >
      <div className="font-bold text-[13px] text-slate-900">
        {total ? `Continue this ${total}-lesson sequence?` : 'Make this a sequence'}
      </div>
      {!total && (
        <div className="flex items-center gap-1.5">
          <span className="text-slate-600">Lessons:</span>
          {[2, 3, 4, 5, 6].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setN(k)}
              className={`w-7 h-7 rounded-md font-bold cursor-pointer ${
                n === k ? 'bg-[#1d3f7a] text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      )}
      <div className="text-slate-600">
        {targets.length === n - 1
          ? `Adds the same line to the next ${n - 1} ${code} lessons:`
          : `Only ${targets.length} more ${code} lesson${targets.length === 1 ? '' : 's'} this year:`}
      </div>
      <div className="space-y-1">
        {targets.map((t, i) => (
          <div key={t.key} className="flex items-center gap-2 text-slate-800">
            <span className="seq-chip">
              {i + 2}/{n}
            </span>
            {fmt(t.date)} · {periodLabel(t.periodId)}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          disabled={targets.length === 0}
          onClick={() => onAdd(n)}
          className="flex-1 h-8 rounded-lg bg-[#1d3f7a] text-white font-bold hover:bg-[#163262] cursor-pointer disabled:opacity-40"
        >
          Add to next {targets.length} lesson{targets.length === 1 ? '' : 's'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-8 px-3 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
        >
          Not now
        </button>
      </div>
    </div>
  );
};
