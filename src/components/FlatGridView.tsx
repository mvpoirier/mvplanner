// Full-width Mon–Fri + NOTES flat bulk-edit grid view with inline double-click editing.

import React from 'react';
import type { AcademicYearBinder } from '../types/planner';
import { formatWeekHeading, type ResolvedSchedule, type ResolvedWeek } from '../engine/cycleEngine';
import type { SelectedCell } from '../store/usePlannerStore';
import { TimetableTable, WeeklyNotesPanel } from './TimetableTable';

interface FlatGridViewProps {
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  week: ResolvedWeek;
  selectedCell: SelectedCell | null;
  editingCell: SelectedCell | null;
  onSelectCell: (date: string, periodId: string) => void;
  onStartEdit: (
    date: string,
    periodId: string,
    rect: { top: number; bottom: number; left: number; width: number },
  ) => void;
  onStopEdit: () => void;
}

export const FlatGridView: React.FC<FlatGridViewProps> = ({
  binder,
  schedule,
  week,
  selectedCell,
  editingCell,
  onSelectCell,
  onStartEdit,
  onStopEdit,
}) => {
  return (
    <section className="paper-sheet rounded-xl shadow-md border border-slate-200 w-full max-w-[1420px] h-[calc(100vh-24px)] max-h-[880px]">
      <div className="page-meta-bar">
        <span className="font-bold text-slate-800">
          {formatWeekHeading(week)} · {week.dateRange}
        </span>
        <span className="text-[10.5px] text-slate-500">
          Flat Bulk-Edit View · Double-click any cell to edit · {schedule.summary.totalTeachingWeeks} Teaching Weeks Total
        </span>
      </div>
      <div className="flat-page-grid">
        <div className="table-fit">
          <TimetableTable
            binder={binder}
            week={week}
            dayIndices={[0, 1, 2, 3, 4]}
            selectedCell={selectedCell}
            editingCell={editingCell}
            onSelectCell={onSelectCell}
            onStartEdit={onStartEdit}
            onStopEdit={onStopEdit}
          />
        </div>
        <WeeklyNotesPanel binder={binder} week={week} />
      </div>
    </section>
  );
};
