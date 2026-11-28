// Shared pure timetable table (ZERO rowspan!) & sibling Weekly NOTES panel.
// Strictly enforces §4.1 pixel-lock across Left & Right pages while fitting 100% of the viewport height.
// Supports double-click inline cell editing & double-click inline weekly note editing.

import React, { useEffect, useRef, useState } from 'react';
import {
  cellKey,
  type AcademicYearBinder,
  type InkTone,
  type PeriodRow,
} from '../types/planner';
import { resolveSlot, type ResolvedWeek } from '../engine/cycleEngine';
import { todayISO } from '../engine/dateUtils';
import { toggleReminderSkip, useReminderPrefs } from '../store/reminderPrefs';
import { continueList, toggleWrap } from '../engine/richText';
import { editActiveTextarea } from './FloatingEditBar';
import { RichLine } from './RichText';
import { UnitTag } from './UnitTag';
import { usePlannerStore, type SelectedCell } from '../store/usePlannerStore';

function getRowWeight(period: PeriodRow): number {
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
  editingCell: SelectedCell | null;
  onSelectCell: (date: string, periodId: string) => void;
  onStartEdit: (
    date: string,
    periodId: string,
    rect: { top: number; bottom: number; left: number; width: number },
  ) => void;
  onStopEdit: () => void;
  /** Tab / Shift+Tab while editing: save and open the next / previous lesson. */
  onTabEdit?: (dir: 1 | -1) => void;
}

export const TimetableTable: React.FC<TimetableTableProps> = ({
  binder,
  week,
  dayIndices,
  selectedCell,
  editingCell,
  onSelectCell,
  onStartEdit,
  onStopEdit,
  onTabEdit,
}) => {
  const updateCellPlan = usePlannerStore((s) => s.updateCellPlan);
  const inlineRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingCell && inlineRef.current) {
      const el = inlineRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editingCell?.date, editingCell?.periodId]);

  const today = todayISO();
  const lastPeriodId = binder.periods[binder.periods.length - 1]?.id;
  const reminderSkips = useReminderPrefs().skips;
  const showToast = usePlannerStore((st) => st.showToast);
  /** Outline today's whole column (screen only). */
  const todayCol = (iso: string, periodId?: string) =>
    iso === today ? ` today-col${periodId === lastPeriodId ? ' today-col-last' : ''}` : '';
  const dayPct = Math.floor(81 / dayIndices.length);
  const totalWeight = binder.periods.reduce((acc, p) => acc + getRowWeight(p), 0) || 1;
  // Reserve ~11.5% for the 3 header rows; distribute remaining ~88.5% proportionally across periods
  const bodyBudgetPct = 88.5;

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
              <th key={d.iso} className={`tt-hdr-top${d.iso === today ? ' is-today today-col today-col-first' : ''}`}>
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
            <th
              key={week.days[di].iso}
              className={`tt-hdr-date${week.days[di].iso === today ? ' is-today today-col' : ''}`}
            >
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
              <th key={d.iso} className={`tt-hdr-day${d.iso === today ? ' is-today today-col' : ''}`}>
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
          const pct = ((getRowWeight(period) / totalWeight) * bodyBudgetPct).toFixed(3);

          if (period.kind === 'divider') {
            return (
              <tr key={period.id} className="tt-divider-row" style={{ height: `${pct}%` }}>
                <td colSpan={2}>{period.label}</td>
                {dayIndices.map((di) => {
                  const d = week.days[di];
                  const slot = resolveSlot(binder, d, period);
                  if (!slot.course) return <td key={d.iso} className={todayCol(d.iso, period.id)} />;
                  return (
                    <td
                      key={d.iso}
                      className={todayCol(d.iso, period.id)}
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
            <tr key={period.id} style={{ height: `${pct}%` }}>
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
                const isEditing =
                  editingCell?.date === day.iso && editingCell?.periodId === period.id;
                const canEdit = !binder.archived && !slot.exceptionKind;

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
                    className={`tt-slot ${extraClass} ${isSelected ? 'selected' : ''} ${
                      isEditing ? 'editing' : ''
                    }${todayCol(day.iso, period.id)}${reminderSkips.includes(cellKey(day.iso, period.id)) ? ' no-reminder' : ''}`}
                    style={bgStyle}
                    data-cell={cellKey(day.iso, period.id)}
                    onClick={() => onSelectCell(day.iso, period.id)}
                    onContextMenu={(e) => {
                      if (slot.exceptionKind === 'full' || (!slot.course && period.kind !== 'period' && slot.banners.length === 0)) return;
                      e.preventDefault();
                      const nowSkipped = toggleReminderSkip(cellKey(day.iso, period.id));
                      showToast(
                        nowSkipped
                          ? `No reminder for ${period.label} on ${day.dow} ${day.shortDate}.`
                          : `Reminder back on for ${period.label} on ${day.dow} ${day.shortDate}.`,
                      );
                    }}
                    onDoubleClick={(e) => {
                      if (!canEdit) return;
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      onStartEdit(day.iso, period.id, {
                        top: r.top,
                        bottom: r.bottom,
                        left: r.left,
                        width: r.width,
                      });
                    }}
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
                            style={
                              slot.course.textColor ? { color: slot.course.textColor } : undefined
                            }
                          >
                            <span>{slot.course.code}</span>
                            <span className="flex items-center gap-1">
                              {plan?.unit && binder.units?.[plan.unit.id] && (
                                <UnitTag binder={binder} unit={plan.unit} />
                              )}
                            </span>
                          </div>
                        ) : slot.banners.length > 0 ? (
                          <div className="text-[9.5px] font-extrabold text-[#1f2937] leading-tight mb-0.5">
                            {slot.banners.join(' · ')}
                          </div>
                        ) : null}

                        {isEditing ? (
                          <textarea
                            ref={inlineRef}
                            value={plan?.text ?? ''}
                            onChange={(e) =>
                              updateCellPlan(day.iso, period.id, { text: e.target.value })
                            }
                            onKeyDown={(e) => {
                              const mod = e.metaKey || e.ctrlKey;
                              const save = (t: string) => updateCellPlan(day.iso, period.id, { text: t });
                              if (e.key === 'Escape' || (mod && e.key === 'Enter')) {
                                e.preventDefault();
                                onStopEdit();
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                onTabEdit?.(e.shiftKey ? -1 : 1);
                              } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'b') {
                                e.preventDefault();
                                editActiveTextarea((v, a, b) => toggleWrap(v, a, b, 'bold'), save);
                              } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'i') {
                                e.preventDefault();
                                editActiveTextarea((v, a, b) => toggleWrap(v, a, b, 'italic'), save);
                              } else if (mod && e.shiftKey && e.key.toLowerCase() === 'x') {
                                e.preventDefault();
                                editActiveTextarea((v, a, b) => toggleWrap(v, a, b, 'strike'), save);
                              } else if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
                                e.preventDefault();
                                editActiveTextarea((v, a, b) => toggleWrap(v, a, b, 'mark'), save);
                              } else if (e.key === 'Enter' && !e.shiftKey && !mod) {
                                const ta = e.currentTarget;
                                if (ta.selectionStart !== ta.selectionEnd) return;
                                const res = continueList(ta.value, ta.selectionStart);
                                if (res) {
                                  e.preventDefault();
                                  editActiveTextarea(() => res, save);
                                }
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Type lesson note…"
                            className={`inline-cell-editor ${inkClass}`}
                          />
                        ) : (
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
                                    <RichLine line={line} prefix={plan?.star && i === 0 ? '★ ' : undefined} />
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
  const updateWeeklyNote = usePlannerStore((s) => s.updateWeeklyNote);
  const deleteWeeklyNote = usePlannerStore((s) => s.deleteWeeklyNote);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [ink, setInk] = useState<InkTone>('blue');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const notes = binder.weeklyNotes[week.mondayIso] ?? [];

  const handleSave = () => {
    if (draft.trim()) {
      addWeeklyNote(week.mondayIso, draft.trim(), ink);
      setDraft('');
      setAdding(false);
    }
  };

  const STICKY = ['sticky-yellow', 'sticky-pink', 'sticky-green', 'sticky-blue'];
  const TILT = ['-1.6deg', '1.2deg', '-0.8deg', '1.6deg'];
  const inkClass = (t: InkTone) => (t === 'red' ? 'ink-red' : t === 'blue' ? 'ink-blue' : 'ink-pencil');

  const inkPicker = (value: InkTone, onChange: (t: InkTone) => void) => (
    <div className="flex items-center gap-1">
      {(['pencil', 'blue', 'red'] as InkTone[]).map((tone) => (
        <button
          key={tone}
          type="button"
          onClick={() => onChange(tone)}
          className={`w-3.5 h-3.5 rounded-full border cursor-pointer ${
            tone === 'pencil' ? 'bg-[#3a3f47]' : tone === 'blue' ? 'bg-[#1648a8]' : 'bg-[#c02323]'
          } ${value === tone ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
          aria-label={`${tone} ink`}
        />
      ))}
    </div>
  );

  return (
    <div className="notes-panel">
      <div className="notes-panel-hdr">Notes</div>
      <div className="notes-panel-body">
        {notes.map((n, i) => {
          const look = { transform: `rotate(${TILT[i % TILT.length]})` };
          if (editingId === n.id) {
            return (
              <div key={n.id} className={`sticky-note ${STICKY[i % STICKY.length]}`} style={look}>
                <textarea
                  rows={3}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className={`sticky-textarea ${inkClass(n.ink)}`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingId(null);
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      if (editDraft.trim()) updateWeeklyNote(week.mondayIso, n.id, editDraft.trim());
                      setEditingId(null);
                    }
                  }}
                />
                <div className="flex justify-end gap-1 mt-1">
                  <button type="button" onClick={() => setEditingId(null)} className="sticky-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (editDraft.trim()) updateWeeklyNote(week.mondayIso, n.id, editDraft.trim());
                      setEditingId(null);
                    }}
                    className="sticky-btn sticky-btn-primary"
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div
              key={n.id}
              className={`sticky-note group ${STICKY[i % STICKY.length]} ${inkClass(n.ink)}`}
              style={look}
              onDoubleClick={() => {
                if (binder.archived) return;
                setEditingId(n.id);
                setEditDraft(n.text);
              }}
              title="Double-click to edit"
            >
              <span className="whitespace-pre-wrap break-words">{n.text}</span>
              {!binder.archived && (
                <button
                  type="button"
                  onClick={() => deleteWeeklyNote(week.mondayIso, n.id)}
                  className="sticky-remove"
                  aria-label="Remove note"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {!binder.archived &&
          (adding ? (
            <div className={`sticky-note ${STICKY[notes.length % STICKY.length]}`}>
              <textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Reminder for this week…"
                className={`sticky-textarea ${inkClass(ink)}`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
                  if (e.key === 'Escape') setAdding(false);
                }}
              />
              <div className="flex items-center justify-between gap-1 mt-1">
                {inkPicker(ink, setInk)}
                <div className="flex gap-1">
                  <button type="button" onClick={() => setAdding(false)} className="sticky-btn">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSave} className="sticky-btn sticky-btn-primary">
                    Stick
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="sticky-add">
              + stick a note
            </button>
          ))}
      </div>
    </div>
  );
};
