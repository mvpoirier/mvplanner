// Full-width Mon–Fri + NOTES flat bulk-edit grid view.

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
  onSelectCell: (date: string, periodId: string) => void;
}

export const FlatGridView: React.FC<FlatGridViewProps> = ({
  binder,
  schedule,
  week,
  selectedCell,
  onSelectCell,
}) => {
  return (
    <section className="paper-sheet rounded-xl shadow-md border border-slate-200">
      <div className="page-meta-bar">
        <span className="font-bold text-slate-800">
          {formatWeekHeading(week)} · {week.dateRange}
        </span>
        <span className="text-[10.5px] text-slate-500">
          Flat Bulk-Edit View · {schedule.summary.totalTeachingWeeks} Teaching Weeks Total
        </span>
      </div>
      <div className="flat-page-grid">
        <div>
          <TimetableTable
            binder={binder}
            week={week}
            dayIndices={[0, 1, 2, 3, 4]}
            selectedCell={selectedCell}
            onSelectCell={onSelectCell}
          />
        </div>
        <WeeklyNotesPanel binder={binder} week={week} />
      </div>
    </section>
  );
};
