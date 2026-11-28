// Reminders: on by default, 10 minutes before whatever is next (classes, duties, meetings, ECAs).

import React from 'react';
import { Bell, X } from 'lucide-react';
import type { AcademicYearBinder } from '../types/planner';
import type { ResolvedSchedule } from '../engine/cycleEngine';
import { agendaFor } from '../engine/todayAgenda';
import { todayISO } from '../engine/dateUtils';
import { updateReminderPrefs, useReminderPrefs, type ReminderKind } from '../store/reminderPrefs';
import type { DesktopAppControls } from '../hooks/useDesktopApp';

interface Props {
  open: boolean;
  onClose: () => void;
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  desktopApp: DesktopAppControls;
}

const KINDS: { kind: ReminderKind; label: string; hint: string; chip: string; sample: string }[] = [
  { kind: 'class', label: 'Classes', hint: 'Lessons', chip: '#d3eaf1', sample: 'CLASS' },
  { kind: 'duty', label: 'Duties', hint: 'Oval, canteen…', chip: '#ffff00', sample: 'DUTY' },
  { kind: 'event', label: 'Meetings & events', hint: 'AM, lunch, advisory', chip: '#fff2cc', sample: 'MEET' },
  { kind: 'eca', label: 'ECAs', hint: 'After school', chip: '#dbe8fd', sample: 'ECA' },
  { kind: 'free', label: 'Free periods', hint: 'Off by default', chip: '#e3e5ea', sample: 'FREE' },
];
const LEADS = [
  { min: 5, label: '5 min' },
  { min: 10, label: '10 min' },
  { min: 15, label: '15 min' },
  { min: 0, label: 'At start' },
];

export const RemindersDrawer: React.FC<Props> = ({ open, onClose, binder, schedule, desktopApp }) => {
  const prefs = useReminderPrefs();
  if (!open) return null;

  const today = todayISO();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const pausedToday = prefs.pausedOn === today;
  const next = agendaFor(binder, schedule, today).find(
    (i) => prefs.kinds[i.kind] && !prefs.skips.includes(i.cellKey) && i.startMin - prefs.leadMin > nowMin,
  );
  const fmtMin = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const { notifyAccess } = desktopApp;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onMouseDown={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col text-xs"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminders-title"
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-800" />
            <div>
              <h2 id="reminders-title" className="text-sm font-bold text-slate-900">
                Reminders
              </h2>
              <p className="text-[11px] text-slate-500">On by default · before whatever is next</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-slate-700">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 cursor-pointer">
            <span>
              <span className="block font-bold text-[13px] text-slate-900">Remind me before what&apos;s next</span>
              <span className="block text-slate-600 mt-0.5">Classes, duties, meetings and ECAs</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={prefs.enabled}
              onChange={(e) => updateReminderPrefs({ enabled: e.target.checked })}
              className="w-9 h-5 accent-blue-800 cursor-pointer"
            />
          </label>

          {prefs.enabled && notifyAccess !== 'granted' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2 text-amber-900">
              {notifyAccess === 'unsupported' ? (
                <p>This browser can&apos;t show notifications. Install the Mac app, or use Chrome, Edge or Safari.</p>
              ) : notifyAccess === 'denied' ? (
                <p>Notifications are blocked for MVPlanner. Allow them in your browser&apos;s site settings, or in the Mac app&apos;s Permissions.</p>
              ) : (
                <>
                  <p>
                    {desktopApp.isApp
                      ? 'Allow MVPlanner to show notifications and use the menu bar.'
                      : 'Allow notifications so reminders can pop up. On the website they only arrive while a MVPlanner tab is open; the Mac app reminds you even in the background.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void desktopApp.allowNotifications()}
                    className="px-3 py-1.5 rounded-lg bg-blue-800 text-white font-semibold hover:bg-blue-900 cursor-pointer"
                  >
                    Allow notifications
                  </button>
                </>
              )}
            </div>
          )}

          <fieldset disabled={!prefs.enabled} className="space-y-4 disabled:opacity-50">
            <div>
              <div className="text-[10px] font-bold tracking-wider text-slate-500 mb-1.5">HOW EARLY</div>
              <div role="radiogroup" aria-label="Minutes before" className="grid grid-cols-4 gap-1.5">
                {LEADS.map((l) => (
                  <button
                    key={l.min}
                    type="button"
                    role="radio"
                    aria-checked={prefs.leadMin === l.min}
                    onClick={() => updateReminderPrefs({ leadMin: l.min })}
                    className={`h-8 rounded-lg font-semibold cursor-pointer ${
                      prefs.leadMin === l.min
                        ? 'border-2 border-blue-800 bg-blue-50 text-blue-900'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-wider text-slate-500 mb-1">REMIND ME ABOUT</div>
              {KINDS.map((k) => (
                <label key={k.kind} className="flex items-center gap-2.5 py-2 border-b border-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.kinds[k.kind]}
                    onChange={(e) => updateReminderPrefs({ kinds: { ...prefs.kinds, [k.kind]: e.target.checked } })}
                    className="w-3.5 h-3.5 accent-blue-800"
                  />
                  <span
                    className="w-14 h-5 rounded text-[9.5px] font-bold flex items-center justify-center text-slate-800"
                    style={{ backgroundColor: k.chip }}
                  >
                    {k.sample}
                  </span>
                  <span className="flex-1 font-semibold text-slate-900">{k.label}</span>
                  <span className="text-[11px] text-slate-400">{k.hint}</span>
                </label>
              ))}
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-wider text-slate-500 mb-1">ALSO</div>
              {desktopApp.isApp && (
                <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.menuBar}
                    onChange={(e) => updateReminderPrefs({ menuBar: e.target.checked })}
                    className="w-3.5 h-3.5 accent-blue-800"
                  />
                  <span className="font-semibold text-slate-900">Show the next one in the menu bar</span>
                </label>
              )}
              <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.includeNote}
                  onChange={(e) => updateReminderPrefs({ includeNote: e.target.checked })}
                  className="w-3.5 h-3.5 accent-blue-800"
                />
                <span className="font-semibold text-slate-900">Include the first line of my lesson note</span>
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                Never on holidays or no-school days. Right-click any lesson → <strong>No reminder</strong> to skip just
                that one.
              </p>
            </div>
          </fieldset>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="text-[10px] font-bold tracking-wider text-slate-500">NEXT REMINDER</div>
            {!prefs.enabled ? (
              <div className="font-semibold text-slate-600 mt-0.5">Reminders are off</div>
            ) : pausedToday ? (
              <div className="font-semibold text-slate-600 mt-0.5">Paused for today</div>
            ) : next ? (
              <>
                <div className="font-bold text-[13px] text-slate-900 mt-0.5">
                  {fmtMin(next.startMin - prefs.leadMin)} · {next.periodLabel} {next.title} at {next.start}
                </div>
                {prefs.includeNote && next.note && <div className="text-slate-600">{next.note}</div>}
              </>
            ) : (
              <div className="font-semibold text-slate-600 mt-0.5">Nothing else today</div>
            )}
          </div>

          {desktopApp.problem && <p className="text-[11px] text-amber-800">{desktopApp.problem}</p>}
        </div>

        <div className="flex justify-between gap-2 px-4 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => void desktopApp.sendTestReminder()}
            disabled={notifyAccess !== 'granted'}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
          >
            Send a test reminder
          </button>
          <button
            type="button"
            onClick={() => updateReminderPrefs({ pausedOn: pausedToday ? null : today })}
            disabled={!prefs.enabled}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
          >
            {pausedToday ? 'Resume today' : 'Pause for today'}
          </button>
        </div>
      </div>
    </div>
  );
};
