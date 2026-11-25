// Milestone 1 Export & Print Studio Modal:
// Date range picker, A4 / US Letter toggle, and all 6 export formats.

import React, { useMemo, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { AcademicYearBinder, PaperSize } from '../types/planner';
import { formatWeekShortLabel, type ResolvedSchedule } from '../engine/cycleEngine';
import { usePlannerStore } from '../store/usePlannerStore';
import { openPrintSpread } from '../services/exporters/printSpread';
import {
  buildCoursePacingRows,
  openPacingPrintView,
  pacingToCsv,
  pacingToMarkdown,
} from '../services/exporters/pacingSheet';
import { downloadXlsxWorkbook, generateFinalCsv } from '../services/exporters/xlsxExporter';
import { generateIcsContent } from '../services/exporters/icsExporter';
import {
  downloadWorkspaceJson,
  generateMarkdownArchive,
  generateOfflineHtmlArchive,
  triggerFileDownload,
} from '../services/exporters/archiveExporter';

type ExportFormat = 'binder-pdf' | 'blank-pdf' | 'pacing' | 'json' | 'xlsx' | 'ics-archive';

interface ExportStudioModalProps {
  open: boolean;
  onClose: () => void;
  binder: AcademicYearBinder;
  schedule: ResolvedSchedule;
}

export const ExportStudioModal: React.FC<ExportStudioModalProps> = ({
  open,
  onClose,
  binder,
  schedule,
}) => {
  const workspace = usePlannerStore((s) => s.workspace);
  const paperSize = usePlannerStore((s) => s.workspace.uiPreferences.paperSize);
  const noteFont = usePlannerStore((s) => s.workspace.uiPreferences.noteFont);
  const setPaperSize = usePlannerStore((s) => s.setPaperSize);
  const showToast = usePlannerStore((s) => s.showToast);

  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(Math.max(0, schedule.weeks.length - 1));
  const [format, setFormat] = useState<ExportFormat>('binder-pdf');
  const [pacingCourse, setPacingCourse] = useState(() => {
    const first = Object.values(binder.courses).find((c) => c.category === 'class');
    return first?.id ?? Object.keys(binder.courses)[0] ?? '';
  });
  const [pacingSubFmt, setPacingSubFmt] = useState<'print' | 'md' | 'csv'>('print');
  const [jsonPass, setJsonPass] = useState('');
  const [archiveSubFmt, setArchiveSubFmt] = useState<'ics' | 'html' | 'md'>('ics');
  const [xlsxSubFmt, setXlsxSubFmt] = useState<'xlsx' | 'csv'>('xlsx');

  const safeFrom = Math.min(fromIdx, toIdx);
  const safeTo = Math.max(fromIdx, toIdx);
  const selectedWeeks = safeTo - safeFrom + 1;

  const classCourses = useMemo(
    () => Object.values(binder.courses).filter((c) => c.category !== 'duty'),
    [binder.courses],
  );

  if (!open) return null;

  const safeName = binder.title.replace(/[^a-zA-Z0-9_-]+/g, '_');

  const handleExport = async () => {
    if (format === 'binder-pdf' || format === 'blank-pdf') {
      openPrintSpread(binder, safeFrom, safeTo, {
        paperSize,
        noteFont,
        blankMode: format === 'blank-pdf',
      });
      showToast(
        `Opened ${selectedWeeks * 2} ${paperSize} pages for ${format === 'blank-pdf' ? 'blank' : 'filled'} duplex printing.`,
      );
      return;
    }

    if (format === 'pacing') {
      const rows = buildCoursePacingRows(binder, pacingCourse, safeFrom, safeTo);
      if (pacingSubFmt === 'print') {
        openPacingPrintView(binder, pacingCourse, rows);
      } else if (pacingSubFmt === 'md') {
        triggerFileDownload(
          pacingToMarkdown(binder, pacingCourse, rows),
          `${safeName}-${pacingCourse.replace(/\s+/g, '_')}-pacing.md`,
          'text/markdown;charset=utf-8',
        );
      } else {
        triggerFileDownload(
          pacingToCsv(rows),
          `${safeName}-${pacingCourse.replace(/\s+/g, '_')}-pacing.csv`,
          'text/csv;charset=utf-8',
        );
      }
      showToast(`Exported ${pacingCourse} pacing sheet (${rows.length} slots).`);
      return;
    }

    if (format === 'json') {
      await downloadWorkspaceJson(workspace, jsonPass);
      showToast(
        jsonPass.trim()
          ? 'Downloaded AES-GCM encrypted workspace JSON.'
          : 'Downloaded full workspace JSON archive.',
      );
      return;
    }

    if (format === 'xlsx') {
      if (xlsxSubFmt === 'xlsx') {
        downloadXlsxWorkbook(binder, safeFrom, safeTo);
        showToast('Downloaded Grid + FINAL Excel (.xlsx) workbook.');
      } else {
        triggerFileDownload(
          generateFinalCsv(binder, safeFrom, safeTo),
          `${safeName}-FINAL.csv`,
          'text/csv;charset=utf-8',
        );
        showToast('Downloaded FINAL CSV.');
      }
      return;
    }

    if (format === 'ics-archive') {
      if (archiveSubFmt === 'ics') {
        triggerFileDownload(
          generateIcsContent(binder, safeFrom, safeTo),
          `${safeName}.ics`,
          'text/calendar;charset=utf-8',
        );
        showToast('Downloaded RFC 5545 .ics calendar feed.');
      } else if (archiveSubFmt === 'html') {
        triggerFileDownload(
          generateOfflineHtmlArchive(binder, safeFrom, safeTo),
          `${safeName}-archive.html`,
          'text/html;charset=utf-8',
        );
        showToast('Downloaded standalone offline HTML archive.');
      } else {
        triggerFileDownload(
          generateMarkdownArchive(binder, safeFrom, safeTo),
          `${safeName}-archive.md`,
          'text/markdown;charset=utf-8',
        );
        showToast('Downloaded Markdown archive.');
      }
    }
  };

  const FORMATS: { id: ExportFormat; title: string; desc: string }[] = [
    {
      id: 'binder-pdf',
      title: `Binder Duplex PDF / Print (${paperSize})`,
      desc: 'Mon–Wed verso + Thu–Fri+NOTES recto with mirrored 18mm 2-ring punch margins',
    },
    {
      id: 'blank-pdf',
      title: 'Blank Printable Binder Sheets',
      desc: 'Exact course colors, dates, A–J days, duties & AM/ECA — empty cells for pen/pencil',
    },
    {
      id: 'pacing',
      title: 'Single-Course Pacing Sheet',
      desc: 'Chronological A1..H18 log for a single course in Print/PDF, Markdown, or CSV',
    },
    {
      id: 'json',
      title: 'Full Workspace JSON Archive',
      desc: 'Lossless backup of all binders, notes & markers (optional AES-GCM passphrase)',
    },
    {
      id: 'xlsx',
      title: 'Excel (.xlsx) / CSV Workbook',
      desc: 'Exports matching Grid + FINAL (with notes) spreadsheet structure',
    },
    {
      id: 'ics-archive',
      title: 'Calendar (.ics) & Offline HTML / Markdown',
      desc: 'Apple/Google Calendar feed or forever-readable standalone archive',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Export &amp; Print Studio — {binder.title}
            </h2>
            <p className="text-xs text-slate-500">
              Export any custom week range for duplex binder printing or digital archiving
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Range & Paper Size */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-slate-600">From Week</span>
              <select
                value={fromIdx}
                onChange={(e) => setFromIdx(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
              >
                {schedule.weeks.map((w, i) => (
                  <option key={w.mondayIso} value={i}>
                    {formatWeekShortLabel(w)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-semibold text-slate-600">To Week</span>
              <select
                value={toIdx}
                onChange={(e) => setToIdx(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
              >
                {schedule.weeks.map((w, i) => (
                  <option key={w.mondayIso} value={i}>
                    {formatWeekShortLabel(w)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <span className="font-semibold text-slate-600">Paper Size</span>
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(['A4', 'LETTER'] as PaperSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPaperSize(sz)}
                    className={`flex-1 py-1 rounded-md font-semibold cursor-pointer ${
                      paperSize === sz
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sz === 'A4' ? 'A4 Portrait' : 'US Letter'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 6 Export Formats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <label
                key={f.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                  format === f.id
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="expFmt"
                  checked={format === f.id}
                  onChange={() => setFormat(f.id)}
                  className="mt-0.5 accent-blue-700"
                />
                <div>
                  <div className="font-bold text-slate-900">{f.title}</div>
                  <div className="text-slate-500 mt-0.5">{f.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Contextual Sub-options */}
          {format === 'pacing' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Course:</span>
                <select
                  value={pacingCourse}
                  onChange={(e) => setPacingCourse(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-2 py-1"
                >
                  {classCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} {c.name ? `(${c.name})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Format:</span>
                {(['print', 'md', 'csv'] as const).map((sf) => (
                  <button
                    key={sf}
                    type="button"
                    onClick={() => setPacingSubFmt(sf)}
                    className={`px-2 py-1 rounded border font-semibold cursor-pointer ${
                      pacingSubFmt === sf
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    {sf === 'print' ? 'Print / PDF' : sf.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {format === 'json' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">Optional AES-GCM Passphrase:</span>
              <input
                type="password"
                value={jsonPass}
                onChange={(e) => setJsonPass(e.target.value)}
                placeholder="Leave blank for plain JSON…"
                className="flex-1 min-w-[200px] rounded border border-slate-300 bg-white px-2.5 py-1"
              />
            </div>
          )}

          {format === 'xlsx' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center gap-2">
              <span className="font-semibold text-slate-700">Spreadsheet Type:</span>
              {(['xlsx', 'csv'] as const).map((sf) => (
                <button
                  key={sf}
                  type="button"
                  onClick={() => setXlsxSubFmt(sf)}
                  className={`px-2.5 py-1 rounded border font-semibold cursor-pointer ${
                    xlsxSubFmt === sf
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {sf === 'xlsx' ? 'Excel Workbook (.xlsx)' : 'FINAL Sheet (.csv)'}
                </button>
              ))}
            </div>
          )}

          {format === 'ics-archive' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center gap-2">
              <span className="font-semibold text-slate-700">Archive Type:</span>
              {(
                [
                  ['ics', 'Calendar Feed (.ics)'],
                  ['html', 'Offline HTML'],
                  ['md', 'Markdown (.md)'],
                ] as const
              ).map(([sf, lbl]) => (
                <button
                  key={sf}
                  type="button"
                  onClick={() => setArchiveSubFmt(sf)}
                  className={`px-2.5 py-1 rounded border font-semibold cursor-pointer ${
                    archiveSubFmt === sf
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {/* Summary & Action */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900">
                {selectedWeeks} week{selectedWeeks === 1 ? '' : 's'} selected → {selectedWeeks * 2}{' '}
                {paperSize} pages ({selectedWeeks} duplex spreads)
              </div>
              <div className="text-slate-500">
                Aligned row-for-row across left &amp; right pages with mirrored 18mm punch gutters.
              </div>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer shrink-0"
            >
              {format === 'binder-pdf' || format === 'blank-pdf' || (format === 'pacing' && pacingSubFmt === 'print') ? (
                <Printer className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {format === 'binder-pdf' || format === 'blank-pdf' ? 'Open Print Preview' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
