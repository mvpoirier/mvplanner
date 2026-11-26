// Responsive single-day Mobile Agenda View (auto-activated on small viewports or previewed on desktop).

import React from 'react';
import { cellKey, type AcademicYearBinder } from '../types/planner';
import { formatWeekHeading, resolveSlot, type ResolvedWeek } from '../engine/cycleEngine';
import type { SelectedCell } from '../store/usePlannerStore';
import { todayISO } from '../engine/dateUtils';

interface PhoneAgendaViewProps {
  binder: AcademicYearBinder;
  week: ResolvedWeek;
  dayIndex: number;
  selectedCell: SelectedCell | null;
  onSelectDay: (idx: number) => void;
  onSelectCell: (date: string, periodId: string) => void;
}

export const PhoneAgendaView: React.FC<PhoneAgendaViewProps> = ({
  binder,
  week,
  dayIndex,
  selectedCell,
  onSelectDay,
  onSelectCell,
}) => {
  const safeIdx = Math.min(Math.max(0, dayIndex), week.days.length - 1);
  const day = week.days[safeIdx];
  const notes = binder.weeklyNotes[week.mondayIso] ?? [];

  return (
    <div className="py-2">
      <div className="phone-frame">
        <div className="bg-[#1b4487] text-white px-4 py-3">
          <div className="flex items-center justify-between text-[11px] opacity-90">
            <span className="font-semibold">{binder.schoolLabel} Mobile</span>
            <span>{formatWeekHeading(week)}</span>
          </div>
          <div className="flex items-center justify-between gap-1 mt-2.5">
            {week.days.map((d, di) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => onSelectDay(di)}
                className={`flex-1 py-1.5 rounded-lg text-center text-[11px] font-bold transition cursor-pointer ${
                  di === safeIdx
                    ? 'bg-white text-[#1b4487] shadow-sm'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <div>
                  {d.dow}
                  {d.iso === todayISO() && (
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${
                        di === safeIdx ? 'bg-[#1b4487]' : 'bg-white'
                      }`}
                      aria-label="Today"
                    />
                  )}
                </div>
                <div className="text-[9.5px] opacity-85">{d.cycleLetter ?? '★'}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto bg-[#f8fafc]">
          <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200">
            <span className="font-bold text-slate-800">
              {day.dow}, {day.shortDate}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
              {day.cycleLetter
                ? `Day ${day.cycleLetter} (${day.occurrenceTag})`
                : day.classification.pause?.title ?? 'Non-Instructional'}
            </span>
          </div>

          {day.classification.bellLabel && (
            <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-1.5 text-[11px] font-semibold text-amber-900">
              ⏱ {day.classification.bellLabel}
            </div>
          )}

          {day.classification.pause ? (
            <div className="rounded-xl bg-[#f6df00] p-4 text-center font-extrabold text-sm text-slate-900">
              {day.classification.pause.title}
              <div className="text-xs font-normal mt-1">
                Cycle paused — resumes next instructional day
              </div>
            </div>
          ) : (
            binder.periods.map((p) => {
              const slot = resolveSlot(binder, day, p);
              if (p.kind === 'divider') {
                if (!slot.course) return null;
                return (
                  <div
                    key={p.id}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-extrabold flex justify-between"
                    style={{
                      backgroundColor: slot.course.color,
                      color: slot.course.textColor ?? '#1e2022',
                    }}
                  >
                    <span>{p.label}</span>
                    <span>{slot.course.code}</span>
                  </div>
                );
              }

              const plan = binder.cellPlans[cellKey(day.iso, p.id)];
              const isSelected =
                selectedCell?.date === day.iso && selectedCell?.periodId === p.id;
              const inkClass =
                plan?.ink === 'red'
                  ? 'ink-red'
                  : plan?.ink === 'blue'
                    ? 'ink-blue'
                    : 'ink-pencil';

              const bg =
                slot.exceptionKind === 'cohort' || slot.exceptionKind === 'blocked'
                  ? '#f8ecd0'
                  : slot.course?.color ??
                    (p.id === 'AM' && slot.banners.length > 0
                      ? '#fabe8f'
                      : p.id === 'ECA' && slot.banners.length > 0
                        ? '#dbeafe'
                        : '#e2e8f0');

              return (
                <div
                  key={p.id}
                  onClick={() => onSelectCell(day.iso, p.id)}
                  className={`rounded-xl p-2.5 border cursor-pointer transition ${
                    isSelected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-slate-300/80'
                  }`}
                  style={{ backgroundColor: bg }}
                >
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-900">
                    <span>
                      {p.label}
                      {slot.course
                        ? ` · ${slot.course.code}`
                        : slot.banners.length > 0
                          ? ` · ${slot.banners.join(' · ')}`
                          : ''}
                    </span>
                    <span className="font-mono text-[10px] opacity-75">
                      {p.start && p.end ? `${p.start}–${p.end}` : ''}
                    </span>
                  </div>
                  {slot.exceptionLabel ? (
                    <div className="text-[11px] font-bold text-amber-950 mt-1">
                      {slot.exceptionLabel}
                    </div>
                  ) : plan?.text.trim() ? (
                    <div
                      className={`mt-1 text-xs whitespace-pre-wrap ${inkClass} ${
                        plan.strike ? 'marker-strike' : ''
                      }`}
                    >
                      {plan.star ? '★ ' : ''}
                      {plan.text}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] text-slate-600 italic">
                      Tap to add note…
                    </div>
                  )}
                </div>
              );
            })
          )}

          {notes.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                Weekly Notes
              </div>
              {notes.map((n) => (
                <div key={n.id} className="callout-chip text-[11px]">
                  {n.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
