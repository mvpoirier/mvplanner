// Bottom Annotation Dock: inline lesson editor, Pencil/Blue/Red ink tones,
// Circle/Star/Strike/Pin-to-NOTES markers, sequence tag, Smart Bump Forward, and Undo/Redo.

import React, { useEffect, useRef, useState } from 'react';
import { Redo2, SkipForward, Undo2 } from 'lucide-react';
import { cellKey, type AcademicYearBinder, type InkTone } from '../types/planner';
import { resolveSlot, type ResolvedSchedule, type ResolvedWeek } from '../engine/cycleEngine';
import { usePlannerStore, type SelectedCell } from '../store/usePlannerStore';
import type { BumpScope } from '../engine/smartBumpEngine';

interface AnnotationDockProps {
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  week: ResolvedWeek;
  selectedCell: SelectedCell | null;
}

export const AnnotationDock: React.FC<AnnotationDockProps> = ({
  binder,
  schedule,
  week,
  selectedCell,
}) => {
  const updateCellPlan = usePlannerStore((s) => s.updateCellPlan);
  const bumpCourseForward = usePlannerStore((s) => s.bumpCourseForward);
  const pinCellToWeeklyNotes = usePlannerStore((s) => s.pinCellToWeeklyNotes);
  const undo = usePlannerStore((s) => s.undo);
  const redo = usePlannerStore((s) => s.redo);
  const canUndo = usePlannerStore((s) => s.past.length > 0);
  const canRedo = usePlannerStore((s) => s.future.length > 0);

  const [bumpScope, setBumpScope] = useState<BumpScope>('blank');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const day = selectedCell ? schedule.daysByIso[selectedCell.date] : null;
  const period = selectedCell
    ? binder.periods.find((p) => p.id === selectedCell.periodId) ?? null
    : null;
  const slot = day && period ? resolveSlot(binder, day, period) : null;
  const plan =
    selectedCell ? binder.cellPlans[cellKey(selectedCell.date, selectedCell.periodId)] : undefined;

  const isDisabled = !selectedCell || !day || !period || binder.archived || Boolean(slot?.exceptionKind);
  const canBump =
    !isDisabled &&
    Boolean(slot?.courseId) &&
    slot?.course?.category !== 'duty' &&
    period?.kind === 'period';

  useEffect(() => {
    if (selectedCell && !isDisabled) {
      textareaRef.current?.focus();
    }
  }, [selectedCell?.date, selectedCell?.periodId, isDisabled]);

  const titleText = (() => {
    if (!selectedCell || !day || !period) return 'Select any cell on the page to edit';
    const label =
      slot?.course?.code ??
      (period.id === 'AM' ? 'AM Slot' : period.id === 'ECA' ? 'ECA Slot' : 'Free / Prep');
    return `${label} · ${day.dow} ${day.shortDate} (${day.occurrenceTag ?? '—'}) · ${period.label}`;
  })();

  const activeInk: InkTone = plan?.ink ?? 'pencil';

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[260px]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
                {titleText}
              </span>
              {binder.archived && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                  Read-Only Archive
                </span>
              )}
              {slot?.exceptionLabel && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                  {slot.exceptionLabel}
                </span>
              )}
            </div>
            {!isDisabled && (
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                <span>Seq:</span>
                <input
                  type="text"
                  value={plan?.seq ?? ''}
                  onChange={(e) =>
                    selectedCell &&
                    updateCellPlan(selectedCell.date, selectedCell.periodId, {
                      seq: e.target.value,
                    })
                  }
                  placeholder="1/3"
                  className="w-14 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            )}
          </div>

          <textarea
            ref={textareaRef}
            rows={2}
            disabled={isDisabled}
            value={plan?.text ?? ''}
            onChange={(e) =>
              selectedCell &&
              updateCellPlan(selectedCell.date, selectedCell.periodId, { text: e.target.value })
            }
            placeholder="Click any timetable cell (e.g., 13 PHY, 12 PHY, 11A SCI, 9.7 SCI, 9.6 SCI, 13B ADV) to type lesson notes…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-55"
          />
        </div>

        <div className="flex flex-col gap-2 min-w-[330px]">
          {/* Ink tones & markers */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-0.5">Ink:</span>
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
                disabled={isDisabled}
                onClick={() =>
                  selectedCell &&
                  updateCellPlan(selectedCell.date, selectedCell.periodId, { ink: tone })
                }
                className={`px-2 py-1 rounded-md border text-xs font-semibold cursor-pointer disabled:opacity-40 ${colorCls} ${
                  !isDisabled && activeInk === tone
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}

            <span className="text-[11px] text-slate-500 ml-2 mr-0.5">Markers:</span>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() =>
                selectedCell &&
                updateCellPlan(selectedCell.date, selectedCell.periodId, {
                  circled: !plan?.circled,
                })
              }
              className={`px-2 py-1 rounded-md border text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                plan?.circled
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-200 hover:bg-slate-100'
              }`}
              title="Circle first line"
            >
              ◯
            </button>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() =>
                selectedCell &&
                updateCellPlan(selectedCell.date, selectedCell.periodId, { star: !plan?.star })
              }
              className={`px-2 py-1 rounded-md border text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                plan?.star
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : 'border-slate-200 hover:bg-slate-100'
              }`}
              title="Star highlight"
            >
              ★
            </button>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() =>
                selectedCell &&
                updateCellPlan(selectedCell.date, selectedCell.periodId, { strike: !plan?.strike })
              }
              className={`px-2 py-1 rounded-md border text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                plan?.strike
                  ? 'border-slate-600 bg-slate-200 text-slate-900'
                  : 'border-slate-200 hover:bg-slate-100'
              }`}
              title="Strikethrough completed/cancelled"
            >
              S̶
            </button>
            <button
              type="button"
              disabled={isDisabled || !plan?.text.trim()}
              onClick={() =>
                selectedCell &&
                day &&
                period &&
                pinCellToWeeklyNotes(
                  week.mondayIso,
                  selectedCell.date,
                  selectedCell.periodId,
                  `${day.dow} ${period.label} ${slot?.course?.code ?? ''}`.trim(),
                )
              }
              className={`px-2 py-1 rounded-md border text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                plan?.pinNote
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-200 hover:bg-slate-100'
              }`}
              title="Pin callout to right-page NOTES column"
            >
              → NOTES
            </button>
          </div>

          {/* Smart Bump & Undo/Redo */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
            <select
              value={bumpScope}
              onChange={(e) => setBumpScope(e.target.value as BumpScope)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs cursor-pointer"
              aria-label="Bump forward scope"
            >
              <option value="blank">Stop at next blank/buffer</option>
              <option value="term">Ripple full term</option>
            </select>
            <button
              type="button"
              disabled={!canBump}
              onClick={() =>
                selectedCell &&
                slot?.courseId &&
                bumpCourseForward(slot.courseId, selectedCell.date, selectedCell.periodId, bumpScope)
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-700 text-white text-xs font-semibold cursor-pointer hover:bg-blue-800 disabled:opacity-40"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Bump Forward
            </button>
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
              title="Undo (Ctrl/Cmd+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={redo}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
