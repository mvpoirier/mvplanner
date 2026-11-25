// Shared pure timetable table (ZERO rowspan!) & sibling Weekly NOTES panel.
// Strictly enforces §4.1 so Left (Mon–Wed) and Right (Thu–Fri) rows stay pixel-locked across the spine.

import React, { useState } from 'react';
import {
  cellKey,
  type AcademicYearBinder,
  type InkTone,
  type PeriodRow,
} from '../types/planner';
import { resolveSlot, type ResolvedWeek } from '../engine/cycleEngine';
import { usePlannerStore, type SelectedCell } from '../store/usePlannerStore';

function getRowHeightPx(period: PeriodRow): number {
  if (period.height) return period.height;
  if (period.kind === 'divider') return 20;
  if (period.id === 'AM') return 48;
  if (period.id === 'ECA') return 54;
  return 82;
}

interface TimetableTableProps {
  binder: AcademicYearBinder;
  week: ResolvedWeek;
  dayIndices: number[];
  selectedCell: SelectedCell | null;
  onSelectCell: (date: string, periodId: string) => void;
}

export const TimetableTable: React.FC<TimetableTableProps> = ({
  binder,
  week,
  dayIndices,
  selectedCell,
  onSelectCell,
}) => {
  const dayPct = Math.floor(81 / dayIndices.length);

  return (
    <table className="tt-table">
      <colgroup>
        <col style={{ width: '8%' }} />
        <col style={{ width: '11%' }} />
        {dayIndices.map((di) => (
          <col key={di} style={{ width: `${dayPct}%` }} />
        ))}
      </colgroup>
      <tbody>
        <tr className="row-hdr-top">
          <th colSpan={2} className="tt-hdr-top text-[9px]">
            {binder.schoolLabel}
          </th>
          {dayIndices.map((di) => {
            const d = week.days[di];
            return (
              <th key={d.iso} className="tt-hdr-top">
                {d.dow}
                {d.classification.bellLabel && (
                  <span
                    title={d.classification.bellLabel}
                    className="text-[9px] text-amber-800 ml-0.5"
                  >
                    ⏱
                  </span>
                )}
              </th>
            );
          })}
        </tr>

        <tr className="row-hdr-date">
          <th colSpan={2} className="tt-hdr-date text-[9px]">
            DATE
          </th>
          {dayIndices.map((di) => (
            <th key={week.days[di].iso} className="tt-hdr-date">
              {week.days[di].shortDate}
            </th>
          ))}
        </tr>

        <tr className="row-hdr-day">
          <th colSpan={2} className="tt-hdr-day text-[9px]">
            DAY
          </th>
          {dayIndices.map((di) => {
            const d = week.days[di];
            return (
              <th key={d.iso} className="tt-hdr-day">
                {d.cycleLetter ? (
                  <>
                    {d.cycleLetter}{' '}
                    <span className="text-[8.5px] font-normal opacity-70">
                      ({d.occurrenceTag})
                    </span>
                  </>
                ) : (
                  <span className="text-[9px] text-amber-800">—</span>
                )}
              </th>
            );
          })}
        </tr>

        {binder.periods.map((period) => {
          const h = getRowHeightPx(period);

          if (period.kind === 'divider') {
            return (
              <tr key={period.id} className="tt-divider-row" style={{ height: `${h}px` }}>
                <td colSpan={2}>{period.label}</td>
                {dayIndices.map((di) => {
                  const d = week.days[di];
                  const slot = resolveSlot(binder, d, period);
                  if (!slot.course) return <td key={d.iso} />;
                  return (
                    <td
                      key={d.iso}
                      style={{
                        backgroundColor: slot.course.color,
                        color: slot.course.textColor ?? '#1e2022',
                        fontWeight: 800,
                      }}
                    >
                      {slot.course.code}
                    </td>
                  );
                })}
              </tr>
            );
          }

          return (
            <tr key={period.id} style={{ height: `${h}px` }}>
              <td className="tt-time-col text-[10px]">{period.label}</td>
              <td style={{ padding: 0, verticalAlign: 'stretch' }}>
                <div className="tt-time-sub">
                  <span>{period.start ?? ''}</span>
                  <span>
                    {period.end ?? ''}
                    {period.endAlt && (
                      <>
                        <br />({period.endAlt})
                      </>
                    )}
                  </span>
                </div>
              </td>
              {dayIndices.map((di) => {
                const day = week.days[di];
                const slot = resolveSlot(binder, day, period);
                const plan = binder.cellPlans[cellKey(day.iso, period.id)];
                const isSelected =
                  selectedCell?.date === day.iso && selectedCell?.periodId === period.id;

                let bgStyle: React.CSSProperties = {};
                let extraClass = '';

                if (slot.exceptionKind === 'full') {
                  bgStyle = { backgroundColor: period.id === 'AM' ? '#f6df00' : '#e2e4e8' };
                } else if (slot.exceptionKind === 'cohort' || slot.exceptionKind === 'blocked') {
                  extraClass = 'c-cohort';
                } else if (period.kind === 'banner') {
                  if (period.id === 'AM') {
                    bgStyle = { backgroundColor: slot.banners.length > 0 ? '#fabe8f' : '#d1d5db' };
                  } else {
                    bgStyle = { backgroundColor: slot.banners.length > 0 ? '#dbeafe' : '#e2e8f0' };
                  }
                } else if (slot.course) {
                  bgStyle = { backgroundColor: slot.course.color };
                } else {
                  bgStyle = { backgroundColor: '#e2e4e8' };
                }

                const inkClass =
                  plan?.ink === 'red'
                    ? 'ink-red'
                    : plan?.ink === 'blue'
                      ? 'ink-blue'
                      : 'ink-pencil';
                const lines = (plan?.text ?? '').split('\n').filter(Boolean);

                return (
                  <td
                    key={day.iso}
                    className={`tt-slot ${extraClass} ${isSelected ? 'selected' : ''}`}
                    style={bgStyle}
                    onClick={() => onSelectCell(day.iso, period.id)}
                    data-date={day.iso}
                    data-period={period.id}
                  >
                    {slot.exceptionKind === 'full' && period.id === 'AM' ? (
                      <div className="slot-inner items-center justify-center text-center font-extrabold text-[9.5px] leading-tight text-[#1f2937]">
                        {slot.exceptionLabel}
                      </div>
                    ) : slot.exceptionKind === 'full' ? (
                      <div className="slot-inner opacity-35" />
                    ) : slot.exceptionKind === 'cohort' || slot.exceptionKind === 'blocked' ? (
                      <div className="slot-inner">
                        {slot.course && (
                          <div className="course-tag opacity-60 line-through">
                            <span>{slot.course.code}</span>
                          </div>
                        )}
                        <div className="text-[9.5px] font-bold text-amber-950 mt-0.5 leading-tight">
                          {slot.exceptionLabel}
                        </div>
                      </div>
                    ) : (
                      <div className="slot-inner">
                        {slot.course ? (
                          <div
                            className="course-tag"
                            style={slot.course.textColor ? { color: slot.course.textColor } : undefined}
                          >
                            <span>{slot.course.code}</span>
                            <span className="flex items-center gap-1">
                              {plan?.seq && <span className="seq-pill">{plan.seq}</span>}
                              {plan?.pinNote && (
                                <span
                                  className="text-[9.5px] text-red-700 font-bold"
                                  title="Linked to NOTES"
                                >
                                  →
                                </span>
                              )}
                            </span>
                          </div>
                        ) : slot.banners.length > 0 ? (
                          <div className="text-[9.5px] font-extrabold text-[#1f2937] leading-tight mb-0.5">
                            {slot.banners.join(' · ')}
                          </div>
                        ) : null}

                        <div className="flex-1 overflow-hidden">
                          {lines.map((line, i) => {
                            const cls = [
                              'note-line',
                              inkClass,
                              plan?.circled && i === 0 ? 'marker-circled' : '',
                              plan?.strike ? 'marker-strike' : '',
                            ]
                              .filter(Boolean)
                              .join(' ');
                            return (
                              <div key={i} className="my-0.5">
                                <span className={cls}>
                                  {plan?.star && i === 0 ? '★ ' : ''}
                                  {line}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

interface NotesPanelProps {
  binder: AcademicYearBinder;
  week: ResolvedWeek;
}

export const WeeklyNotesPanel: React.FC<NotesPanelProps> = ({ binder, week }) => {
  const addWeeklyNote = usePlannerStore((s) => s.addWeeklyNote);
  const deleteWeeklyNote = usePlannerStore((s) => s.deleteWeeklyNote);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [ink, setInk] = useState<InkTone>('blue');

  const notes = binder.weeklyNotes[week.mondayIso] ?? [];

  const handleSave = () => {
    if (draft.trim()) {
      addWeeklyNote(week.mondayIso, draft.trim(), ink);
      setDraft('');
      setAdding(false);
    }
  };

  return (
    <div className="notes-panel">
      <div className="notes-panel-hdr">NOTES</div>
      <div className="notes-panel-body space-y-1.5">
        {notes.map((n) => {
          const inkCls =
            n.ink === 'red' ? 'ink-red' : n.ink === 'blue' ? 'ink-blue' : 'ink-pencil';
          return (
            <div key={n.id} className={`callout-chip group relative pr-4 ${inkCls}`}>
              <span>{n.text}</span>
              {!binder.archived && (
                <button
                  onClick={() => deleteWeeklyNote(week.mondayIso, n.id)}
                  className="opacity-0 group-hover:opacity-100 absolute right-1 top-0.5 text-[9px] text-slate-400 hover:text-red-600 cursor-pointer"
                  title="Remove note"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {!binder.archived &&
          (adding ? (
            <div className="p-1.5 rounded border border-slate-300 bg-white space-y-1.5">
              <textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Weekly note or reminder…"
                className="w-full text-[10px] border border-slate-200 rounded p-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
                  if (e.key === 'Escape') setAdding(false);
                }}
              />
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  {(['pencil', 'blue', 'red'] as InkTone[]).map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setInk(tone)}
                      className={`w-3.5 h-3.5 rounded-full border cursor-pointer ${
                        tone === 'pencil'
                          ? 'bg-[#3a3f47]'
                          : tone === 'blue'
                            ? 'bg-[#1648a8]'
                            : 'bg-[#c02323]'
                      } ${ink === tone ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                      title={`${tone} ink`}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="text-[9.5px] px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="text-[9.5px] px-2 py-0.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full mt-1 py-1 px-2 text-[10px] font-semibold rounded border border-dashed border-slate-400 text-slate-600 hover:bg-slate-200/70 cursor-pointer"
            >
              + Add weekly note
            </button>
          ))}
      </div>
    </div>
  );
};
