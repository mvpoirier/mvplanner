// Sticky top toolbar with Binder Shelf selector, week navigation, cover swatches,
// font toggle, view switcher, quick setup, export studio, and Google Sync pill.

import React from 'react';
import {
  BookOpen,
  Calendar,
  Cloud,
  CloudOff,
  Download,
  Lock,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  AcademicYearBinder,
  BinderCoverTheme,
  NoteFontMode,
  ViewMode,
} from '../types/planner';
import { formatWeekShortLabel, type ResolvedSchedule } from '../engine/cycleEngine';
import type { SyncStatus } from '../store/usePlannerStore';

const COVERS: { id: BinderCoverTheme; bg: string; label: string }[] = [
  { id: 'nist-blue', bg: '#1e4b94', label: 'NIST Blue' },
  { id: 'charcoal', bg: '#2c313b', label: 'Charcoal' },
  { id: 'forest', bg: '#1d4f3d', label: 'Forest' },
  { id: 'burgundy', bg: '#6d1f32', label: 'Burgundy' },
  { id: 'linen', bg: '#a89880', label: 'Warm Linen' },
];

interface TopToolbarProps {
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
  weekIndex: number;
  coverTheme: BinderCoverTheme;
  noteFont: NoteFontMode;
  viewMode: ViewMode;
  isLockedEnabled: boolean;
  syncStatus: SyncStatus;
  googleEmail: string | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectWeek: (idx: number) => void;
  onCoverChange: (cover: BinderCoverTheme) => void;
  onToggleFont: () => void;
  onViewChange: (mode: ViewMode) => void;
  onOpenShelf: () => void;
  onOpenWizard: () => void;
  onOpenSetup: () => void;
  onOpenExport: () => void;
  onOpenGoogleSync: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  binder,
  schedule,
  weekIndex,
  coverTheme,
  noteFont,
  viewMode,
  isLockedEnabled,
  syncStatus,
  googleEmail,
  onPrevWeek,
  onNextWeek,
  onSelectWeek,
  onCoverChange,
  onToggleFont,
  onViewChange,
  onOpenShelf,
  onOpenWizard,
  onOpenSetup,
  onOpenExport,
  onOpenGoogleSync,
}) => {
  const syncBadge = (() => {
    if (!googleEmail) return { text: 'Sign in with Google', cls: 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' };
    if (syncStatus === 'syncing') return { text: 'Syncing…', cls: 'bg-blue-50 border-blue-300 text-blue-700' };
    if (syncStatus === 'saved') return { text: 'Saved to Drive', cls: 'bg-emerald-50 border-emerald-300 text-emerald-800' };
    if (syncStatus === 'conflict') return { text: 'Sync Conflict!', cls: 'bg-amber-50 border-amber-400 text-amber-900' };
    if (syncStatus === 'error') return { text: 'Sync Error', cls: 'bg-red-50 border-red-300 text-red-700' };
    return { text: googleEmail.split('@')[0], cls: 'bg-emerald-50 border-emerald-300 text-emerald-800' };
  })();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur px-3 md:px-4 py-2 shadow-xs">
      <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Brand + Active Binder Shelf Pill */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1b4487] text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
            MV
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold tracking-tight text-slate-900">MVPlanner</span>
              <button
                type="button"
                onClick={onOpenShelf}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200 cursor-pointer transition"
                title="Open Multi-Year Binder Shelf & Security Settings"
              >
                <BookOpen className="w-3 h-3 text-blue-700" />
                {binder.title}
                {binder.archived && (
                  <span className="text-[9px] uppercase bg-amber-100 text-amber-800 px-1 rounded">
                    Archived
                  </span>
                )}
                {isLockedEnabled && <Lock className="w-2.5 h-2.5 text-emerald-700" />}
              </button>
              <span className="hidden lg:inline text-[11px] text-slate-500">
                {schedule.summary.totalTeachingWeeks} Teaching Wks · {schedule.summary.totalInstructionalDays} Days
              </span>
            </div>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <button
            type="button"
            onClick={onPrevWeek}
            disabled={weekIndex <= 0}
            className="px-2 py-1 text-xs font-bold rounded-md hover:bg-slate-200/80 disabled:opacity-35 cursor-pointer"
            title="Previous week (←)"
          >
            ←
          </button>
          <div className="flex items-center gap-1 px-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
            <select
              value={weekIndex}
              onChange={(e) => onSelectWeek(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold py-1 focus:outline-none cursor-pointer max-w-[210px] sm:max-w-[260px]"
              aria-label="Select week"
            >
              {schedule.weeks.map((w, i) => (
                <option key={w.mondayIso} value={i}>
                  {formatWeekShortLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onNextWeek}
            disabled={weekIndex >= schedule.weeks.length - 1}
            className="px-2 py-1 text-xs font-bold rounded-md hover:bg-slate-200/80 disabled:opacity-35 cursor-pointer"
            title="Next week (→)"
          >
            →
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Cover Swatches */}
          <div
            className="hidden md:flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"
            title="Binder cover color"
          >
            <span className="text-[10.5px] text-slate-500 mr-0.5">Cover:</span>
            {COVERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCoverChange(c.id)}
                className={`w-3.5 h-3.5 rounded-full cursor-pointer transition ${
                  coverTheme === c.id ? 'ring-2 ring-offset-1 ring-blue-600 scale-110' : ''
                }`}
                style={{ backgroundColor: c.bg }}
                title={c.label}
              />
            ))}
          </div>

          {/* Font Toggle */}
          <button
            type="button"
            onClick={onToggleFont}
            className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            title="Toggle Handwritten vs Clean Sans note font"
          >
            {noteFont === 'handwritten' ? 'Aa: Hand' : 'Aa: Sans'}
          </button>

          {/* View Switcher */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[11px]">
            {(
              [
                ['binder', '3D Binder'],
                ['flat', 'Flat Grid'],
                ['phone', 'Phone'],
              ] as [ViewMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => onViewChange(m)}
                className={`px-2 py-1 rounded-md font-semibold cursor-pointer transition ${
                  viewMode === m
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* New Year Wizard */}
          <button
            type="button"
            onClick={onOpenWizard}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-[11px] font-semibold hover:bg-blue-100 cursor-pointer"
            title="Create a bespoke new academic year binder"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Planner</span>
          </button>

          {/* Mid-year Quick Setup */}
          <button
            type="button"
            onClick={onOpenSetup}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
            title="Edit courses, bell rows, holidays & recurring rules"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Setup</span>
          </button>

          {/* Google Sync Pill */}
          <button
            type="button"
            onClick={onOpenGoogleSync}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${syncBadge.cls}`}
            title="Google Sign-In, Private Drive Sync & Google Sheets Import"
          >
            {syncStatus === 'offline' || syncStatus === 'error' ? (
              <CloudOff className="w-3.5 h-3.5" />
            ) : (
              <Cloud className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{syncBadge.text}</span>
          </button>

          {/* Export / Print Studio */}
          <button
            type="button"
            onClick={onOpenExport}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-700 text-white hover:bg-blue-800 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export / Print
          </button>

          {/* Settings shortcut on small screens */}
          <button
            type="button"
            onClick={onOpenShelf}
            className="sm:hidden p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600"
            aria-label="Binder Shelf"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
