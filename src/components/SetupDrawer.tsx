// Quick mid-year SetupDrawer for live edits to exceptions (holidays, PL days, cohort overrides,
// partial blocks, alternate bells), recurring weekday rules, and cycle grid tweaks.

import React, { useState } from 'react';
import { Calendar, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { AcademicYearBinder, CalendarException } from '../types/planner';
import { BEHAVIOR_LABELS } from '../engine/exceptionResolver';
import { usePlannerStore } from '../store/usePlannerStore';

interface SetupDrawerProps {
  open: boolean;
  onClose: () => void;
  binder: AcademicYearBinder;
}

export const SetupDrawer: React.FC<SetupDrawerProps> = ({ open, onClose, binder }) => {
  const updateActiveBinder = usePlannerStore((s) => s.updateActiveBinder);
  const showToast = usePlannerStore((s) => s.showToast);

  const [tab, setTab] = useState<'exceptions' | 'recurring' | 'grid'>('exceptions');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(binder.firstCycleDate);
  const [end, setEnd] = useState(binder.firstCycleDate);
  const [behavior, setBehavior] = useState<CalendarException['behavior']>('pause_cycle');
  const [yearGroup, setYearGroup] = useState('Y13');
  const [periodId, setPeriodId] = useState('P1');

  const [recDay, setRecDay] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [recPer, setRecPer] = useState('AM');
  const [recText, setRecText] = useState('');

  if (!open) return null;

  const handleAddException = () => {
    if (!title.trim() || !start) return;
    const ex: CalendarException = {
      id: `ex-${Date.now()}`,
      title: title.trim(),
      start,
      end: end >= start ? end : start,
      behavior,
      yearGroups: behavior === 'cohort_override' ? [yearGroup] : undefined,
      periodIds:
        behavior === 'partial_block'
          ? [periodId]
          : behavior === 'event'
            ? ['AM']
            : undefined,
      bellLabel: behavior === 'custom_bell' ? title.trim() : undefined,
    };
    updateActiveBinder((b) => {
      b.exceptions.push(ex);
      return b;
    });
    setTitle('');
    showToast(`Added "${ex.title}" — cycle letters & teaching weeks recalculated automatically.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Quick Schedule Setup</h2>
              <p className="text-[11px] text-slate-500">{binder.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 text-xs font-semibold">
          {(
            [
              ['exceptions', 'Holidays & Overrides'],
              ['recurring', 'Recurring Rules'],
              ['grid', 'Cycle Info'],
            ] as const
          ).map(([id, lbl]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 py-2.5 border-b-2 cursor-pointer ${
                tab === id
                  ? 'border-blue-700 text-blue-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto flex-1 text-xs space-y-4">
          {binder.archived && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-amber-900">
              This binder is archived (read-only). Unarchive it from the Binder Shelf to edit.
            </div>
          )}

          {tab === 'exceptions' && (
            <>
              {!binder.archived && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-700" />
                    Add Mid-Year Disruption / Override
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Snow Day, Y13 Mock Exams, Early Dismissal"
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => {
                        setStart(e.target.value);
                        if (e.target.value > end) setEnd(e.target.value);
                      }}
                      className="rounded border border-slate-300 bg-white px-2 py-1"
                    />
                    <input
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1"
                    />
                  </div>
                  <select
                    value={behavior}
                    onChange={(e) => setBehavior(e.target.value as CalendarException['behavior'])}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                  >
                    {Object.entries(BEHAVIOR_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>

                  {behavior === 'cohort_override' && (
                    <input
                      type="text"
                      value={yearGroup}
                      onChange={(e) => setYearGroup(e.target.value)}
                      placeholder="Affected Year Group (e.g. Y13)"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1"
                    />
                  )}
                  {behavior === 'partial_block' && (
                    <select
                      value={periodId}
                      onChange={(e) => setPeriodId(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1"
                    >
                      {binder.periods
                        .filter((p) => p.kind === 'period')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            Block {p.label}
                          </option>
                        ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={handleAddException}
                    className="w-full inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Exception
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="font-bold text-slate-700">
                  Exceptions ({binder.exceptions.length})
                </div>
                {binder.exceptions.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-start justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{ex.title}</div>
                      <div className="text-[10.5px] text-slate-500 font-mono">
                        {ex.start}
                        {ex.end !== ex.start ? ` → ${ex.end}` : ''} · {ex.behavior}
                      </div>
                    </div>
                    {!binder.archived && (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveBinder((b) => {
                            b.exceptions = b.exceptions.filter((x) => x.id !== ex.id);
                            return b;
                          })
                        }
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'recurring' && (
            <>
              {!binder.archived && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="font-bold text-slate-800">Add Recurring Weekday Rule</div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={recDay}
                      onChange={(e) => setRecDay(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                      className="rounded border border-slate-300 bg-white px-2 py-1"
                    >
                      <option value={1}>Mondays</option>
                      <option value={2}>Tuesdays</option>
                      <option value={3}>Wednesdays</option>
                      <option value={4}>Thursdays</option>
                      <option value={5}>Fridays</option>
                    </select>
                    <select
                      value={recPer}
                      onChange={(e) => setRecPer(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1"
                    >
                      {binder.periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={recText}
                    onChange={(e) => setRecText(e.target.value)}
                    placeholder="e.g. 8:05 - Morning Meeting"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!recText.trim()) return;
                      updateActiveBinder((b) => {
                        b.recurringRules.push({
                          id: `rec-${Date.now()}`,
                          weekday: recDay,
                          periodId: recPer,
                          text: recText.trim(),
                          start: b.startDate,
                          end: b.endDate,
                          skipHolidays: true,
                        });
                        return b;
                      });
                      setRecText('');
                    }}
                    className="w-full py-1.5 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer"
                  >
                    + Add Rule
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                {binder.recurringRules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-slate-200"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{r.text}</div>
                      <div className="text-[10.5px] text-slate-500">
                        {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][r.weekday]} · {r.periodId} ·{' '}
                        {r.start} → {r.end}
                      </div>
                    </div>
                    {!binder.archived && (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveBinder((b) => {
                            b.recurringRules = b.recurringRules.filter((x) => x.id !== r.id);
                            return b;
                          })
                        }
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'grid' && (
            <div className="space-y-2">
              <div className="rounded-lg border border-slate-200 p-3 space-y-1">
                <div>
                  <span className="text-slate-500">Span:</span>{' '}
                  <strong>
                    {binder.startDate} → {binder.endDate}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">First Cycle Day:</span>{' '}
                  <strong>{binder.firstCycleDate}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Cycle:</span>{' '}
                  <strong>{binder.cycleLetters.join(' · ')}</strong>
                </div>
              </div>
              <div className="font-bold text-slate-700 pt-1">Courses &amp; Palette</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(binder.courses).map((c) => (
                  <span
                    key={c.id}
                    className="px-2 py-1 rounded font-bold text-[11px] border border-slate-300"
                    style={{ backgroundColor: c.color, color: c.textColor ?? '#0f172a' }}
                  >
                    {c.code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
