// Import school calendar: pick an .ics or .csv file, preview what's new, add it to the binder.

import React, { useRef, useState } from 'react';
import { CalendarDays, Download, X } from 'lucide-react';
import type { AcademicYearBinder } from '../types/planner';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  buildPreview,
  CSV_TEMPLATE,
  parseCalendarFile,
  toException,
  type ImportedKind,
  type PreviewRow,
} from '../services/calendarImport';
import { parseISO } from '../engine/dateUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  binder: AcademicYearBinder;
}

const fmt = (iso: string, withYear: boolean) =>
  parseISO(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
const fmtRange = (r: PreviewRow) =>
  r.start === r.end ? fmt(r.start, true) : `${fmt(r.start, false)} – ${fmt(r.end, true)}`;

const KIND_STYLE: Record<ImportedKind, string> = {
  'no-school': 'bg-red-100 text-red-800 border-red-200',
  event: 'bg-blue-100 text-blue-800 border-blue-200',
};

export const CalendarImportModal: React.FC<Props> = ({ open, onClose, binder }) => {
  const updateActiveBinder = usePlannerStore((s) => s.updateActiveBinder);
  const showToast = usePlannerStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<(PreviewRow & { on: boolean })[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setFileName(null);
    setRows([]);
    setError(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const load = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const preview = buildPreview(binder, parseCalendarFile(file.name, await file.text()));
      setRows(preview.map((r) => ({ ...r, on: r.status === 'new' })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  };

  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
    a.download = 'mvplanner-calendar-template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const visible = rows.filter((r) => r.status !== 'outside');
  const outside = rows.length - visible.length;
  const chosen = visible.filter((r) => r.on);

  const apply = () => {
    const additions = chosen.map((r, i) => toException(r, i));
    updateActiveBinder((b) => ({ ...b, exceptions: [...b.exceptions, ...additions] }));
    showToast(`Added ${additions.length} date${additions.length === 1 ? '' : 's'} to ${binder.title}.`);
    close();
  };

  const patchRow = (row: PreviewRow, p: Partial<PreviewRow & { on: boolean }>) =>
    setRows((rs) => rs.map((r) => (r === row ? { ...r, ...p } : r)));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-import-title"
        className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-200">
          <div>
            <h2 id="cal-import-title" className="text-base font-bold text-slate-900">
              Import school calendar
            </h2>
            <p className="text-slate-500 mt-0.5">
              Adds holidays, no-school days and events to &ldquo;{binder.title}&rdquo;. Your lesson notes are not
              touched.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="font-bold text-[13px] text-slate-900">Calendar file (.ics)</div>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Export it from Google, Apple or Outlook Calendar, or download it from the school website.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[13px] text-slate-900">Spreadsheet (.csv)</span>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline cursor-pointer"
                >
                  <Download className="w-3 h-3" /> Template
                </button>
              </div>
              <p className="text-slate-600 mt-1">One row per date. Dates like 2026-12-21 or 21/12/2026.</p>
              <pre className="mt-2 bg-slate-900 text-slate-100 rounded-md px-2.5 py-2 text-[10.5px] leading-relaxed overflow-x-auto">
                {CSV_TEMPLATE.trim()}
              </pre>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".ics,.csv,.txt,text/calendar,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void load(f);
              e.target.value = '';
            }}
          />
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-400 bg-slate-50 px-3.5 py-2.5">
            <CalendarDays className="w-4.5 h-4.5 text-blue-800 shrink-0" />
            <div className="flex-1 min-w-0 font-semibold text-slate-900 truncate">
              {fileName ?? 'Choose an .ics or .csv file'}
              {rows.length > 0 && (
                <span className="font-medium text-slate-500">
                  {' '}
                  · {rows.length} date{rows.length === 1 ? '' : 's'} found
                  {outside > 0 ? ` · ${outside} outside this school year (skipped)` : ''}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {fileName ? 'Choose another file' : 'Choose file'}
            </button>
          </div>

          {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-800">{error}</div>}

          {visible.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[28px_190px_minmax(0,1fr)_116px_78px] gap-2 px-3 py-1.5 bg-slate-100 text-[10px] font-bold tracking-wider text-slate-500">
                <span />
                <span>DATES</span>
                <span>LABEL</span>
                <span>TYPE</span>
                <span>STATUS</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {visible.map((r, i) => (
                  <div
                    key={`${r.start}-${r.label}-${i}`}
                    className="grid grid-cols-[28px_190px_minmax(0,1fr)_116px_78px] gap-2 items-center px-3 py-1.5 border-t border-slate-100"
                  >
                    <input
                      type="checkbox"
                      checked={r.on}
                      onChange={(e) => patchRow(r, { on: e.target.checked })}
                      aria-label={`Include ${r.label}`}
                      className="w-3.5 h-3.5 accent-blue-800"
                    />
                    <span className="text-slate-700">{fmtRange(r)}</span>
                    <span className="font-semibold text-slate-900 truncate" title={r.label}>
                      {r.label}
                    </span>
                    <select
                      value={r.kind}
                      onChange={(e) => patchRow(r, { kind: e.target.value as ImportedKind })}
                      aria-label={`Type for ${r.label}`}
                      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold cursor-pointer ${KIND_STYLE[r.kind]}`}
                    >
                      <option value="no-school">No school</option>
                      <option value="event">Event</option>
                    </select>
                    <span
                      className={`text-[11px] font-semibold ${r.status === 'new' ? 'text-emerald-700' : 'text-slate-400'}`}
                    >
                      {r.status === 'new' ? 'New' : 'Already in'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 px-5 py-3 border-t border-slate-200">
          <div className="flex-1 text-slate-600">
            <strong className="text-slate-900">No school</strong> pauses the{' '}
            {binder.cycleLetters[0]}–{binder.cycleLetters[binder.cycleLetters.length - 1]} cycle ·{' '}
            <strong className="text-slate-900">Event</strong> shows a banner and keeps the cycle going
          </div>
          <button
            type="button"
            onClick={close}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={chosen.length === 0 || binder.archived}
            onClick={apply}
            className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            Import {chosen.length} date{chosen.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
};
