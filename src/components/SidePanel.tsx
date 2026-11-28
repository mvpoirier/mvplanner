// Option 2: Single Auto-Hide Corner Button (☰) + Clean Slide-Out Overlay Side Panel.

import React from 'react';
import {
  BookOpen,
  Download,
  FolderSync,
  Lock,
  Menu,
  Redo2,
  SlidersHorizontal,
  CalendarPlus,
  Laptop,
  Bell,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import type {
  AcademicYearBinder,
  BinderCoverTheme,
  NoteFontMode,
  ViewMode,
} from '../types/planner';
import { formatWeekShortLabel, type ResolvedSchedule } from '../engine/cycleEngine';
import type { FileSyncStatus } from '../hooks/useLocalFileSync';
import type { DesktopAppControls } from '../hooks/useDesktopApp';
import { useReminderPrefs } from '../store/reminderPrefs';

const COVERS: { id: BinderCoverTheme; bg: string; label: string }[] = [
  { id: 'nist-blue', bg: '#1e4b94', label: 'NIST Blue' },
  { id: 'charcoal', bg: '#2c313b', label: 'Charcoal' },
  { id: 'forest', bg: '#1d4f3d', label: 'Forest' },
  { id: 'burgundy', bg: '#6d1f32', label: 'Burgundy' },
  { id: 'linen', bg: '#a89880', label: 'Warm Linen' },
];

interface SidePanelProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  weekIndex: number;
  coverTheme: BinderCoverTheme;
  noteFont: NoteFontMode;
  viewMode: ViewMode;
  isLockedEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectWeek: (idx: number) => void;
  onJumpToday: () => void;
  onCoverChange: (cover: BinderCoverTheme) => void;
  onToggleFont: () => void;
  onViewChange: (mode: ViewMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenShelf: () => void;
  onOpenWizard: () => void;
  isPhone: boolean;
  onOpenSetup: () => void;
  onOpenCalendarImport: () => void;
  onOpenExport: () => void;
  fileSyncStatus: FileSyncStatus;
  fileSyncName: string | null;
  onOpenFileSync: () => void;
  desktopApp: DesktopAppControls;
  onOpenReminders: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  open,
  onToggle,
  onClose,
  binder,
  schedule,
  weekIndex,
  coverTheme,
  noteFont,
  viewMode,
  isLockedEnabled,
  canUndo,
  canRedo,
  onPrevWeek,
  onNextWeek,
  onSelectWeek,
  onJumpToday,
  onCoverChange,
  onToggleFont,
  onViewChange,
  onUndo,
  onRedo,
  onOpenShelf,
  onOpenWizard,
  isPhone,
  onOpenSetup,
  onOpenCalendarImport,
  onOpenExport,
  fileSyncStatus,
  fileSyncName,
  onOpenFileSync,
  desktopApp,
  onOpenReminders,
}) => {
  const reminders = useReminderPrefs();
  const fileLabel: Record<FileSyncStatus, string> = {
    unsupported: 'Backup file',
    unlinked: 'Set up sync file',
    'needs-permission': 'Reconnect sync file',
    idle: 'Synced',
    saving: 'Saving…',
    conflict: 'Conflict',
    error: 'Error',
  };
  // Corner dot on the menu button when the sync file needs attention or is saving
  const syncDot =
    fileSyncStatus === 'saving'
      ? 'bg-blue-500 animate-pulse'
      : fileSyncStatus === 'needs-permission'
        ? 'bg-blue-500'
        : fileSyncStatus === 'conflict'
          ? 'bg-amber-500'
          : fileSyncStatus === 'error'
            ? 'bg-red-500'
            : null;
  const fileLinked = ['idle', 'saving', 'conflict', 'error'].includes(fileSyncStatus);
  const fileTone =
    fileSyncStatus === 'idle' || fileSyncStatus === 'saving'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
      : fileSyncStatus === 'conflict' || fileSyncStatus === 'error'
        ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
        : 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100';

  return (
    <>
      {/* Auto-hide single corner menu button */}
      <button
        type="button"
        onClick={onToggle}
        className={`corner-menu-btn ${open ? 'active' : ''}`}
        title="Open MVPlanner Menu, Settings & Sync"
        aria-label="Toggle MVPlanner Menu"
      >
        {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        {syncDot && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${syncDot}`}
          />
        )}
      </button>

      {/* Backdrop click closes overlay panel */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/15"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out compact overlay side panel */}
      <aside
        className={`fixed left-3 top-14 bottom-3 w-[292px] max-w-[calc(100vw-24px)] z-45 rounded-2xl border border-slate-200 bg-white/98 backdrop-blur shadow-2xl flex flex-col transition-all duration-200 ${
          open
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1b4487] text-white font-bold text-[11px] flex items-center justify-center">
              MV
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-tight">MVPlanner</div>
              <div className="text-[10.5px] text-slate-500 leading-tight">
                {schedule.summary.totalTeachingWeeks} Teaching Wks · {schedule.summary.totalInstructionalDays} Days
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              title="Undo (Ctrl/Cmd+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="p-3.5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Active Binder & Shelf */}
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Active Binder
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenShelf();
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-900 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 truncate">
                <BookOpen className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span className="truncate">{binder.title}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {binder.archived && (
                  <span className="text-[9px] uppercase bg-amber-100 text-amber-800 px-1 rounded">
                    Archived
                  </span>
                )}
                {isLockedEnabled && <Lock className="w-3 h-3 text-emerald-700" />}
              </span>
            </button>
          </div>

          {/* Week Jumper */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                Jump to Week
              </span>
              <button
                type="button"
                onClick={onJumpToday}
                className="px-2 py-0.5 rounded-md border border-blue-200 bg-blue-50 text-blue-800 text-[10.5px] font-bold hover:bg-blue-100 cursor-pointer"
                title="Go to this week (shortcut: T)"
              >
                Today
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrevWeek}
                disabled={weekIndex <= 0}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-35 font-bold cursor-pointer"
              >
                ←
              </button>
              <select
                value={weekIndex}
                onChange={(e) => onSelectWeek(Number(e.target.value))}
                className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold cursor-pointer"
                aria-label="Select week"
              >
                {schedule.weeks.map((w, i) => (
                  <option key={w.mondayIso} value={i}>
                    {formatWeekShortLabel(w)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onNextWeek}
                disabled={weekIndex >= schedule.weeks.length - 1}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-35 font-bold cursor-pointer"
              >
                →
              </button>
            </div>
          </div>

          {/* View Mode */}
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              View Mode
            </div>
            <div
              className={`grid ${isPhone ? 'grid-cols-3' : 'grid-cols-2'} bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[11px]`}
            >
              {(
                [
                  ['binder', '3D Binder'],
                  ['flat', 'Flat Grid'],
                  ...(isPhone ? [['phone', 'Phone']] : []),
                ] as [ViewMode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onViewChange(m)}
                  className={`py-1 rounded-md font-semibold cursor-pointer transition ${
                    viewMode === m
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cover Swatches & Font */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">Binder Cover</span>
              <div className="flex items-center gap-1.5">
                {COVERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onCoverChange(c.id)}
                    className={`w-5 h-5 rounded-full cursor-pointer transition ${
                      coverTheme === c.id ? 'ring-2 ring-offset-1 ring-blue-600 scale-110' : ''
                    }`}
                    style={{ backgroundColor: c.bg }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">Note Font</span>
              <button
                type="button"
                onClick={onToggleFont}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 cursor-pointer"
              >
                {noteFont === 'handwritten' ? 'Aa: Handwritten' : 'Aa: Clean Sans'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFileSync();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border font-semibold cursor-pointer transition ${fileTone}`}
              title="Sync to a file in your OneDrive / Dropbox / iCloud folder — no sign-in needed"
            >
              <span className="flex items-center gap-2 truncate">
                <FolderSync className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {fileLinked && fileSyncName ? fileSyncName : fileLabel[fileSyncStatus]}
                </span>
              </span>
              {fileLinked && <span className="text-[10px] opacity-80">{fileLabel[fileSyncStatus]}</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWizard();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-700" />
              New Year Setup Wizard
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSetup();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
              Holidays &amp; Recurring Rules
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCalendarImport();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800 cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-slate-600" />
              Import School Calendar (.ics / .csv)
            </button>

            {desktopApp.installState === 'available' && (
              <button
                type="button"
                onClick={() => void desktopApp.install()}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-slate-900 text-white hover:bg-slate-800 font-semibold cursor-pointer"
              >
                <Laptop className="w-3.5 h-3.5" />
                Install as Mac app
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenReminders();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-slate-600" />
                Reminders
              </span>
              <span
                className={`text-[10px] ${
                  reminders.enabled && desktopApp.notifyAccess !== 'granted' ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                {!reminders.enabled
                  ? 'Off'
                  : desktopApp.notifyAccess !== 'granted'
                    ? 'Allow notifications'
                    : reminders.leadMin === 0
                      ? 'On · at start'
                      : `On · ${reminders.leadMin} min before`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenExport();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-semibold cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export / Duplex Print Studio
            </button>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 text-[10.5px] text-slate-500 leading-relaxed">
            <strong>Quick Tips:</strong> Double-click any cell or note to edit inline. Click the outer page edges/corners (or press <kbd className="px-1 rounded bg-white border border-slate-300">←</kbd>/<kbd className="px-1 rounded bg-white border border-slate-300">→</kbd>) to turn pages.
          </div>
        </div>
      </aside>
    </>
  );
};
