// Pixel-locked Full-Screen 3D 2-Ring Binder Spread with outer-edge / corner-curl page turning,
// 3D page-flip animation, double-click inline editing, and right-edge monthly tabs.

import React from 'react';
import type { AcademicYearBinder, BinderCoverTheme } from '../types/planner';
import { formatWeekHeading, type ResolvedSchedule, type ResolvedWeek } from '../engine/cycleEngine';
import type { SelectedCell } from '../store/usePlannerStore';
import { TimetableTable, WeeklyNotesPanel } from './TimetableTable';
import { monthLabel } from '../engine/dateUtils';

const TAB_COLORS = [
  { bg: '#dbeafe', text: '#1e3a8a' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#e0f2fe', text: '#075985' },
  { bg: '#ffedd5', text: '#9a3412' },
  { bg: '#f1f5f9', text: '#334155' },
];

interface BinderSpreadProps {
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  week: ResolvedWeek;
  coverTheme: BinderCoverTheme;
  flipDir: 'next' | 'prev' | null;
  flipKey: number;
  canPrev: boolean;
  canNext: boolean;
  selectedCell: SelectedCell | null;
  editingCell: SelectedCell | null;
  onSelectCell: (date: string, periodId: string) => void;
  onStartEdit: (
    date: string,
    periodId: string,
    rect: { top: number; bottom: number; left: number; width: number },
  ) => void;
  onStopEdit: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onJumpWeek: (weekIdx: number) => void;
  onJumpToday: () => void;
  todayIso: string;
  searchSlot?: React.ReactNode;
  statusSlot?: React.ReactNode;
}

export const BinderSpread: React.FC<BinderSpreadProps> = ({
  binder,
  schedule,
  week,
  coverTheme,
  flipDir,
  flipKey,
  canPrev,
  canNext,
  selectedCell,
  editingCell,
  onSelectCell,
  onStartEdit,
  onStopEdit,
  onPrevWeek,
  onNextWeek,
  onJumpWeek,
  onJumpToday,
  todayIso,
  searchSlot,
  statusSlot,
}) => {
  const todayOnSpread = week.days.some((d) => d.iso === todayIso);
  const totalTeaching = schedule.summary.totalTeachingWeeks;
  const progressPct =
    week.isTeachingWeek && week.teachingWeekNumber && totalTeaching
      ? Math.round((week.teachingWeekNumber / totalTeaching) * 100)
      : null;

  const monthTabs: { label: string; weekIndex: number; color: { bg: string; text: string } }[] = [];
  const seenMonths = new Set<string>();
  schedule.weeks.forEach((w, idx) => {
    const m = monthLabel(w.mondayIso);
    if (!seenMonths.has(m)) {
      seenMonths.add(m);
      monthTabs.push({
        label: m,
        weekIndex: idx,
        color: TAB_COLORS[monthTabs.length % TAB_COLORS.length],
      });
    }
  });

  const activeMonth = monthLabel(week.mondayIso);

  return (
    <div className={`binder-shell cover-${coverTheme}`}>
      {/* Right-edge monthly binder divider tabs */}
      <div className="binder-tabs hidden lg:flex">
        {monthTabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => onJumpWeek(tab.weekIndex)}
            className={`binder-tab ${activeMonth === tab.label ? 'active' : ''}`}
            style={{ backgroundColor: tab.color.bg, color: tab.color.text }}
            title={`Jump to ${tab.label}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="spread-wrapper">
        <div className="spine-crease" />

        {/* 2 Metallic Binder Rings */}
        <div className="binder-ring-assembly" style={{ top: '34%' }}>
          <div className="punch-hole" />
          <div className="metal-ring" />
          <div className="punch-hole" />
        </div>
        <div className="binder-ring-assembly" style={{ top: '66%' }}>
          <div className="punch-hole" />
          <div className="metal-ring" />
          <div className="punch-hole" />
        </div>

        {/* 3D Page Flip Leaf */}
        {flipDir && (
          <div
            key={flipKey}
            className={`flip-leaf ${flipDir === 'next' ? 'flip-next' : 'flip-prev'}`}
          />
        )}

        {/* Left Page (Verso): Mon–Wed */}
        <section className="paper-sheet paper-left">
          <div
            className={`edge-turn-zone edge-turn-prev ${!canPrev ? 'disabled' : ''}`}
            onClick={() => canPrev && onPrevWeek()}
            title={canPrev ? 'Click edge to flip to previous week' : undefined}
          />
          <div
            className={`corner-curl corner-curl-prev ${!canPrev ? 'disabled' : ''}`}
            onClick={() => canPrev && onPrevWeek()}
            title="Previous week"
          />
          {canPrev && <div className="corner-hint corner-hint-prev">‹ Prev Week</div>}

          <div className="page-meta-bar">
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="font-bold text-slate-800 tracking-tight whitespace-nowrap">
                {formatWeekHeading(week)}
              </span>
              {progressPct !== null && (
                <span
                  className="week-progress"
                  role="progressbar"
                  aria-label="Teaching weeks completed"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${progressPct}%` }} />
                </span>
              )}
              {binder.archived && <span className="text-[10px] text-slate-500">Archived · Read-Only</span>}
            </span>
            {searchSlot}
          </div>
          <div className="table-fit">
            <TimetableTable
              binder={binder}
              week={week}
              dayIndices={[0, 1, 2]}
              selectedCell={selectedCell}
              editingCell={editingCell}
              onSelectCell={onSelectCell}
              onStartEdit={onStartEdit}
              onStopEdit={onStopEdit}
            />
          </div>
        </section>

        {/* Right Page (Recto): Thu–Fri + side-by-side NOTES panel */}
        <section className="paper-sheet paper-right">
          <div
            className={`edge-turn-zone edge-turn-next ${!canNext ? 'disabled' : ''}`}
            onClick={() => canNext && onNextWeek()}
            title={canNext ? 'Click edge to flip to next week' : undefined}
          />
          <div
            className={`corner-curl corner-curl-next ${!canNext ? 'disabled' : ''}`}
            onClick={() => canNext && onNextWeek()}
            title="Next week"
          />
          {canNext && <div className="corner-hint corner-hint-next">Next Week ›</div>}

          {!todayOnSpread && (
            <button
              type="button"
              className="today-ribbon-peek"
              onClick={onJumpToday}
              title="Go to today's week (T)"
            >
              Today
            </button>
          )}

          <div className="page-meta-bar">
            <span className="text-[10.5px] font-semibold text-slate-600">{week.dateRange}</span>
            {statusSlot}
          </div>
          <div className="right-page-grid">
            <div className="table-fit">
              <TimetableTable
                binder={binder}
                week={week}
                dayIndices={[3, 4]}
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
      </div>
    </div>
  );
};
