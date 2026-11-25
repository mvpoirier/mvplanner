// Guided 5-Step Bespoke Yearly Timetable Setup Wizard (spec §6):
// Step 1: Starting Point (Clone / NIST Preset / Blank Custom Cycle / Import .xlsx)
// Step 2: Year Dates & Interactive Bell Row Builder
// Step 3: Courses, Duties & Pastel Palette
// Step 4: Visual Cycle Grid Painter with live Load Counters
// Step 5: Holidays (.ics / CSV / quick-add), Disruptions & Recurring Rules
// + Live Calendar Verification Bar (Teaching Weeks · Instructional Days · Last Day Letter)

import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  AcademicYearBinder,
  CalendarException,
  CourseCategory,
  CourseDefinition,
  PeriodRow,
} from '../types/planner';
import { createNist2026Binder, NIST_PERIODS } from '../presets/nist2026_2027';
import { resolveSchedule } from '../engine/cycleEngine';
import { BEHAVIOR_LABELS } from '../engine/exceptionResolver';
import { usePlannerStore } from '../store/usePlannerStore';
import { importWorkbookFile } from '../services/xlsxImporter';
import {
  candidatesToExceptions,
  parseCsvOrTextExceptions,
  parseIcsExceptions,
  type ParsedExceptionCandidate,
} from '../services/calendarExceptionImporter';

const PASTEL_SWATCHES = [
  '#d9d1e9',
  '#a4c1f4',
  '#f4cccc',
  '#d3ebf1',
  '#fce4cd',
  '#d9ead3',
  '#fff1cc',
  '#ffff00',
  '#e0e7ff',
  '#fae8ff',
];

const CYCLE_PRESETS: { label: string; letters: string[] }[] = [
  { label: '10-Day (A–J · NIST)', letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] },
  { label: '8-Day (A–H)', letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
  { label: '6-Day (Day 1–6)', letters: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] },
  { label: '5-Day (Mon–Fri)', letters: ['M', 'T', 'W', 'Th', 'F'] },
];

interface SetupWizardModalProps {
  open: boolean;
  onClose: () => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({ open, onClose }) => {
  const workspace = usePlannerStore((s) => s.workspace);
  const addBinder = usePlannerStore((s) => s.addBinder);
  const showToast = usePlannerStore((s) => s.showToast);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [draft, setDraft] = useState<AcademicYearBinder>(() =>
    createNist2026Binder({
      id: `binder-${Date.now()}`,
      title: 'NIST 2026–2027',
      schoolLabel: 'NIST 26/27',
    }),
  );

  // Step 3 new course form
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newYearGroup, setNewYearGroup] = useState('Y10');
  const [newCategory, setNewCategory] = useState<CourseCategory>('class');
  const [newColor, setNewColor] = useState('#d9d1e9');

  // Step 4 active paintbrush
  const [paintCourseId, setPaintCourseId] = useState<string>('');

  // Step 5 quick-add exception + bulk import + recurring rule
  const [exTitle, setExTitle] = useState('');
  const [exStart, setExStart] = useState('2026-10-12');
  const [exEnd, setExEnd] = useState('2026-10-16');
  const [exBehavior, setExBehavior] = useState<CalendarException['behavior']>('pause_cycle');
  const [bulkText, setBulkText] = useState('');
  const [candidates, setCandidates] = useState<ParsedExceptionCandidate[]>([]);
  const [recWeekday, setRecWeekday] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [recPeriodId, setRecPeriodId] = useState('AM');
  const [recText, setRecText] = useState('');

  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);

  const liveSchedule = useMemo(() => resolveSchedule(draft), [draft]);

  // Live course load counts for Step 4
  const loadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of draft.cycleLetters) {
      const col = draft.cycleGrid[l] ?? {};
      for (const cid of Object.values(col)) {
        if (cid) counts[cid] = (counts[cid] ?? 0) + 1;
      }
    }
    return counts;
  }, [draft.cycleLetters, draft.cycleGrid]);

  if (!open) return null;

  const existingBinders = Object.values(workspace.binders);

  const startFromNist = () => {
    setDraft(
      createNist2026Binder({
        id: `binder-${Date.now()}`,
        title: 'NIST 2026–2027',
        schoolLabel: 'NIST 26/27',
      }),
    );
    setStep(2);
  };

  const startFromClone = (sourceId: string) => {
    const src = workspace.binders[sourceId];
    if (!src) return;
    const bump = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
    const nextTitle = src.title.replace(/(\d{4})/g, (y) => String(Number(y) + 1));
    setDraft({
      ...structuredClone(src),
      id: `binder-${Date.now()}`,
      title: nextTitle === src.title ? `${src.title} (New Year)` : nextTitle,
      archived: false,
      startDate: bump(src.startDate),
      endDate: bump(src.endDate),
      firstCycleDate: bump(src.firstCycleDate),
      exceptions: [],
      recurringRules: [],
      cellPlans: {},
      weeklyNotes: {},
      createdAt: new Date().toISOString(),
    });
    setStep(2);
  };

  const startFromBlank = () => {
    setDraft({
      id: `binder-${Date.now()}`,
      title: '2026–2027 Timetable',
      schoolLabel: '26/27',
      archived: false,
      startDate: '2026-08-17',
      endDate: '2027-06-18',
      firstCycleDate: '2026-08-17',
      cycleLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
      periods: structuredClone(NIST_PERIODS),
      courses: {},
      cycleGrid: {},
      exceptions: [],
      recurringRules: [],
      cellPlans: {},
      weeklyNotes: {},
      createdAt: new Date().toISOString(),
    });
    setStep(2);
  };

  const handleImportXlsx = async (file: File) => {
    try {
      const res = await importWorkbookFile(file);
      setDraft({ ...res.binder, id: `binder-${Date.now()}` });
      showToast(`Imported ${res.importedCourses} courses & ${res.importedExceptions} calendar dates from ${file.name}.`);
      setStep(2);
    } catch {
      showToast('Failed to parse Excel/CSV workbook.');
    }
  };

  const movePeriod = (idx: number, delta: -1 | 1) => {
    const next = [...draft.periods];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft({ ...draft, periods: next });
  };

  const addPeriodRow = (kind: PeriodRow['kind']) => {
    const num = draft.periods.filter((p) => p.kind === kind).length + 1;
    const id = kind === 'divider' ? `DIV${num}` : kind === 'banner' ? `SLOT${num}` : `P${num}`;
    const row: PeriodRow = {
      id,
      label: kind === 'divider' ? `BREAK ${num}` : id,
      kind,
      start: kind === 'divider' ? undefined : '15:00',
      end: kind === 'divider' ? undefined : '16:00',
      acceptsCourses: kind === 'period',
      height: kind === 'divider' ? 20 : kind === 'banner' ? 48 : 82,
    };
    setDraft({ ...draft, periods: [...draft.periods, row] });
  };

  const handleAddCourse = () => {
    const code = newCode.trim();
    if (!code) return;
    const def: CourseDefinition = {
      id: code,
      code,
      name: newName.trim() || undefined,
      yearGroup: newYearGroup.trim() || undefined,
      category: newCategory,
      color: newColor,
      textColor: newCategory === 'meeting' ? '#9a3412' : newCategory === 'duty' ? '#1e2022' : undefined,
    };
    setDraft({ ...draft, courses: { ...draft.courses, [code]: def } });
    setPaintCourseId(code);
    setNewCode('');
    setNewName('');
  };

  const paintCell = (letter: string, periodId: string) => {
    const col = { ...(draft.cycleGrid[letter] ?? {}) };
    if (!paintCourseId || col[periodId] === paintCourseId) {
      delete col[periodId];
    } else {
      col[periodId] = paintCourseId;
    }
    setDraft({ ...draft, cycleGrid: { ...draft.cycleGrid, [letter]: col } });
  };

  const handleAddException = () => {
    if (!exTitle.trim() || !exStart) return;
    const ex: CalendarException = {
      id: `ex-${Date.now()}`,
      title: exTitle.trim(),
      start: exStart,
      end: exEnd >= exStart ? exEnd : exStart,
      behavior: exBehavior,
      bellLabel: exBehavior === 'custom_bell' ? exTitle.trim() : undefined,
      periodIds: exBehavior === 'event' ? ['AM'] : undefined,
    };
    setDraft({ ...draft, exceptions: [...draft.exceptions, ex] });
    setExTitle('');
  };

  const handleIcsUpload = async (file: File) => {
    const text = await file.text();
    const parsed = parseIcsExceptions(text, draft.startDate, draft.endDate);
    setCandidates(parsed);
    showToast(`Found ${parsed.length} calendar events in ${file.name}.`);
  };

  const handleParseBulkText = () => {
    const parsed = parseCsvOrTextExceptions(bulkText);
    setCandidates(parsed);
    showToast(`Parsed ${parsed.length} date entries.`);
  };

  const handleApplyCandidates = () => {
    const toAdd = candidatesToExceptions(candidates);
    setDraft({ ...draft, exceptions: [...draft.exceptions, ...toAdd] });
    setCandidates([]);
    setBulkText('');
    showToast(`Added ${toAdd.length} holidays/disruptions.`);
  };

  const handleCreate = () => {
    addBinder({ ...draft, createdAt: new Date().toISOString() }, true);
    showToast(`Created binder "${draft.title}" (${liveSchedule.summary.totalTeachingWeeks} teaching weeks).`);
    onClose();
  };

  const STEPS = [
    [1, '1. Start'],
    [2, '2. Dates & Bells'],
    [3, '3. Courses'],
    [4, '4. Cycle Grid'],
    [5, '5. Holidays & Rules'],
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3 md:p-5">
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Bespoke Academic Year Setup Wizard
            </h2>
            <p className="text-xs text-slate-500">
              Configure your school cycle, bell rows, courses, and August–June holidays
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-200/70 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-200 bg-white overflow-x-auto text-xs">
          {STEPS.map(([num, lbl]) => (
            <button
              key={num}
              type="button"
              onClick={() => setStep(num)}
              className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap cursor-pointer transition ${
                step === num
                  ? 'bg-blue-700 text-white'
                  : num < step
                    ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={startFromNist}
                className="text-left p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 hover:border-blue-500 cursor-pointer transition"
              >
                <div className="font-bold text-sm text-blue-900">
                  NIST 10-Day A–J Preset (2026–2027)
                </div>
                <p className="text-slate-600 mt-1">
                  Pre-loaded with NIST bell times, A–J cycle, 14 Thailand/NIST holidays, and clean course palette (zero PII). Tweak any detail in Steps 2–5.
                </p>
              </button>

              <button
                type="button"
                onClick={startFromBlank}
                className="text-left p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-slate-50 cursor-pointer transition"
              >
                <div className="font-bold text-sm text-slate-900">
                  Blank Custom Cycle (5 / 6 / 8 / 10-Day)
                </div>
                <p className="text-slate-600 mt-1">
                  Start fresh with your own cycle labels (A–J, Day 1–6, Week A/B), custom period rows, and courses.
                </p>
              </button>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-sm text-slate-900">Clone &amp; Tweak a Previous Year</div>
                <p className="text-slate-600">
                  Copies courses, colors, duties, and bell rows forward while clearing lesson notes.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {existingBinders.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => startFromClone(b.id)}
                      className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800 cursor-pointer"
                    >
                      Clone "{b.title}"
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  Import Excel (.xlsx) / CSV Workbook
                </div>
                <p className="text-slate-600">
                  Auto-populates Steps 2–5 from a NIST-style `Grid` + `FINAL` spreadsheet.
                </p>
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportXlsx(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => xlsxInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Choose .xlsx / .csv…
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="font-semibold text-slate-700">Binder Title</span>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-700">Corner Label</span>
                  <input
                    type="text"
                    value={draft.schoolLabel}
                    onChange={(e) => setDraft({ ...draft, schoolLabel: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-700">Cycle Preset</span>
                  <select
                    onChange={(e) => {
                      const found = CYCLE_PRESETS[Number(e.target.value)];
                      if (found) setDraft({ ...draft, cycleLetters: [...found.letters] });
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 bg-white"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Current: {draft.cycleLetters.length}-Day ({draft.cycleLetters.join(',')})
                    </option>
                    {CYCLE_PRESETS.map((cp, i) => (
                      <option key={cp.label} value={i}>
                        {cp.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-700">Calendar Start (Aug)</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-700">First Cycle Day ({draft.cycleLetters[0]}1)</span>
                  <input
                    type="date"
                    value={draft.firstCycleDate}
                    onChange={(e) => setDraft({ ...draft, firstCycleDate: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-700">Calendar End (Jun)</span>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-700">Cycle Labels (comma-sep)</span>
                  <input
                    type="text"
                    value={draft.cycleLetters.join(',')}
                    onChange={(e) => {
                      const arr = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      if (arr.length > 0) setDraft({ ...draft, cycleLetters: arr });
                    }}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </label>
              </div>

              {/* Interactive Bell Row Builder */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800">
                    Bell Schedule Rows ({draft.periods.length})
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => addPeriodRow('period')}
                      className="px-2 py-1 rounded bg-blue-50 text-blue-800 font-semibold hover:bg-blue-100 cursor-pointer"
                    >
                      + Period
                    </button>
                    <button
                      type="button"
                      onClick={() => addPeriodRow('divider')}
                      className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
                    >
                      + Break/Lunch Band
                    </button>
                    <button
                      type="button"
                      onClick={() => addPeriodRow('banner')}
                      className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-semibold hover:bg-amber-100 cursor-pointer"
                    >
                      + AM/ECA Strip
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {draft.periods.map((p, idx) => (
                    <div
                      key={p.id + idx}
                      className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/70"
                    >
                      <input
                        type="text"
                        value={p.label}
                        onChange={(e) => {
                          const next = [...draft.periods];
                          next[idx] = { ...p, label: e.target.value };
                          setDraft({ ...draft, periods: next });
                        }}
                        className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-bold"
                      />
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                        {p.kind}
                      </span>
                      {p.kind !== 'divider' && (
                        <>
                          <input
                            type="text"
                            value={p.start ?? ''}
                            onChange={(e) => {
                              const next = [...draft.periods];
                              next[idx] = { ...p, start: e.target.value };
                              setDraft({ ...draft, periods: next });
                            }}
                            placeholder="8:50"
                            className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1 font-mono"
                          />
                          <span>–</span>
                          <input
                            type="text"
                            value={p.end ?? ''}
                            onChange={(e) => {
                              const next = [...draft.periods];
                              next[idx] = { ...p, end: e.target.value };
                              setDraft({ ...draft, periods: next });
                            }}
                            placeholder="10:05"
                            className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1 font-mono"
                          />
                          <input
                            type="text"
                            value={p.endAlt ?? ''}
                            onChange={(e) => {
                              const next = [...draft.periods];
                              next[idx] = { ...p, endAlt: e.target.value || undefined };
                              setDraft({ ...draft, periods: next });
                            }}
                            placeholder="(alt)"
                            className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1 font-mono"
                            title="Optional staggered end time shown in parentheses"
                          />
                        </>
                      )}
                      <label className="inline-flex items-center gap-1 ml-auto text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={p.acceptsCourses}
                          onChange={(e) => {
                            const next = [...draft.periods];
                            next[idx] = { ...p, acceptsCourses: e.target.checked };
                            setDraft({ ...draft, periods: next });
                          }}
                        />
                        Paintable
                      </label>
                      <button
                        type="button"
                        onClick={() => movePeriod(idx, -1)}
                        className="p-1 rounded hover:bg-slate-200 cursor-pointer"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePeriod(idx, 1)}
                        className="p-1 rounded hover:bg-slate-200 cursor-pointer"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            periods: draft.periods.filter((_, i) => i !== idx),
                          })
                        }
                        className="p-1 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="font-bold text-slate-800">Add Course, Advisory, Meeting or Duty</div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Code (e.g. 13 PHY)"
                    className="w-32 rounded border border-slate-300 bg-white px-2 py-1.5 font-bold"
                  />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full name (optional)"
                    className="flex-1 min-w-[140px] rounded border border-slate-300 bg-white px-2 py-1.5"
                  />
                  <input
                    type="text"
                    value={newYearGroup}
                    onChange={(e) => setNewYearGroup(e.target.value)}
                    placeholder="Y13"
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1.5"
                    title="Year group for cohort overrides"
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CourseCategory)}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5"
                  >
                    <option value="class">Class</option>
                    <option value="advisory">Advisory</option>
                    <option value="meeting">Meeting (CMT)</option>
                    <option value="duty">Duty</option>
                  </select>
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleAddCourse}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500">Pastel Swatches:</span>
                  {PASTEL_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setNewColor(hex)}
                      className={`w-5 h-5 rounded-full border border-slate-300 cursor-pointer ${
                        newColor === hex ? 'ring-2 ring-blue-600' : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.values(draft.courses).map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-slate-300 p-2.5 flex items-center justify-between gap-2"
                    style={{ backgroundColor: c.color, color: c.textColor ?? '#0f172a' }}
                  >
                    <div>
                      <div className="font-extrabold">{c.code}</div>
                      <div className="text-[10.5px] opacity-80">
                        {c.category} {c.yearGroup ? `· ${c.yearGroup}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...draft.courses };
                        delete next[c.id];
                        setDraft({ ...draft, courses: next });
                      }}
                      className="p-1 rounded bg-white/60 hover:bg-white text-slate-600 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Visual Cycle Grid Painter */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="font-bold text-slate-700 mr-1">Paintbrush:</span>
                <button
                  type="button"
                  onClick={() => setPaintCourseId('')}
                  className={`px-2.5 py-1 rounded-md border font-semibold cursor-pointer ${
                    paintCourseId === ''
                      ? 'border-blue-600 bg-blue-100 text-blue-900'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  Eraser (Free)
                </button>
                {Object.values(draft.courses).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPaintCourseId(c.id)}
                    className={`px-2.5 py-1 rounded-md border font-bold cursor-pointer transition ${
                      paintCourseId === c.id ? 'ring-2 ring-blue-600 scale-105' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: c.color, color: c.textColor ?? '#0f172a' }}
                  >
                    {c.code}{' '}
                    <span className="font-mono text-[10px] opacity-75">
                      ({loadCounts[c.id] ?? 0}/{draft.cycleLetters.length})
                    </span>
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-center text-[11px] border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 p-1.5 w-20">Period</th>
                      {draft.cycleLetters.map((l) => (
                        <th key={l} className="border border-slate-300 p-1.5 font-extrabold">
                          {l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.periods
                      .filter((p) => p.acceptsCourses)
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="border border-slate-300 p-1.5 font-bold bg-slate-50">
                            {p.label}
                          </td>
                          {draft.cycleLetters.map((l) => {
                            const cid = draft.cycleGrid[l]?.[p.id] ?? '';
                            const course = cid ? draft.courses[cid] : null;
                            return (
                              <td
                                key={l}
                                onClick={() => paintCell(l, p.id)}
                                className="border border-slate-300 p-2 cursor-pointer hover:opacity-85 select-none font-bold"
                                style={{
                                  backgroundColor: course?.color ?? '#f8fafc',
                                  color: course?.textColor ?? '#0f172a',
                                }}
                              >
                                {course?.code ?? '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 5: Holidays, Disruptions & Recurring Rules */}
          {step === 5 && (
            <div className="space-y-4">
              {/* Quick-Add Single/Range Exception */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-700" />
                  Quick-Add Holiday, PL Day or Disruption
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={exTitle}
                    onChange={(e) => setExTitle(e.target.value)}
                    placeholder="Title (e.g. October Break, PL Day)"
                    className="flex-1 min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1.5"
                  />
                  <input
                    type="date"
                    value={exStart}
                    onChange={(e) => {
                      setExStart(e.target.value);
                      if (e.target.value > exEnd) setExEnd(e.target.value);
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5"
                  />
                  <span>→</span>
                  <input
                    type="date"
                    value={exEnd}
                    onChange={(e) => setExEnd(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5"
                  />
                  <select
                    value={exBehavior}
                    onChange={(e) => setExBehavior(e.target.value as CalendarException['behavior'])}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5"
                  >
                    {Object.entries(BEHAVIOR_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddException}
                    className="px-3 py-1.5 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Bulk Import (.ics or CSV/text paste) */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800">
                    Bulk Import School Calendar (.ics or CSV / Text List)
                  </span>
                  <input
                    ref={icsInputRef}
                    type="file"
                    accept=".ics"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleIcsUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => icsInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload .ics…
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Paste lines like: 2026-10-12..2026-10-16 October Break  OR  2026-09-18, 2026-09-18, PL DAY, pause_cycle"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-[11px]"
                />
                {bulkText.trim() && (
                  <button
                    type="button"
                    onClick={handleParseBulkText}
                    className="px-3 py-1 rounded bg-slate-800 text-white font-semibold cursor-pointer"
                  >
                    Preview Parsed Dates
                  </button>
                )}

                {candidates.length > 0 && (
                  <div className="border-t border-slate-200 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">
                        Select events to import ({candidates.filter((c) => c.selected).length}/
                        {candidates.length}):
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyCandidates}
                        className="px-2.5 py-1 rounded bg-emerald-700 text-white font-semibold cursor-pointer"
                      >
                        Import Selected
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {candidates.map((c, idx) => (
                        <label key={c.id} className="flex items-center gap-2 text-[11px]">
                          <input
                            type="checkbox"
                            checked={c.selected}
                            onChange={(e) => {
                              const next = [...candidates];
                              next[idx] = { ...c, selected: e.target.checked };
                              setCandidates(next);
                            }}
                          />
                          <span className="font-mono text-slate-500">
                            {c.start}
                            {c.end !== c.start ? `..${c.end}` : ''}
                          </span>
                          <span className="font-semibold text-slate-800">{c.title}</span>
                          <span className="text-[10px] px-1.5 rounded bg-slate-100 text-slate-600">
                            {c.behavior}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Exceptions List */}
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="font-bold text-slate-800 mb-2">
                  Configured Calendar Dates ({draft.exceptions.length})
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
                  {draft.exceptions.map((ex) => (
                    <div key={ex.id} className="py-1 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-slate-500 mr-2">
                          {ex.start}
                          {ex.end !== ex.start ? ` → ${ex.end}` : ''}
                        </span>
                        <span className="font-semibold text-slate-800">{ex.title}</span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {ex.behavior}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            exceptions: draft.exceptions.filter((e) => e.id !== ex.id),
                          })
                        }
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recurring Weekday Rules */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="font-bold text-slate-800">
                  Recurring Weekday Rules ({draft.recurringRules.length})
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={recWeekday}
                    onChange={(e) => setRecWeekday(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    <option value={1}>Every Mon</option>
                    <option value={2}>Every Tue</option>
                    <option value={3}>Every Wed</option>
                    <option value={4}>Every Thu</option>
                    <option value={5}>Every Fri</option>
                  </select>
                  <select
                    value={recPeriodId}
                    onChange={(e) => setRecPeriodId(e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    {draft.periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={recText}
                    onChange={(e) => setRecText(e.target.value)}
                    placeholder="e.g. 8:05 - Morning Meeting"
                    className="flex-1 min-w-[160px] rounded border border-slate-300 px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!recText.trim()) return;
                      setDraft({
                        ...draft,
                        recurringRules: [
                          ...draft.recurringRules,
                          {
                            id: `rec-${Date.now()}`,
                            weekday: recWeekday,
                            periodId: recPeriodId,
                            text: recText.trim(),
                            start: draft.startDate,
                            end: draft.endDate,
                            skipHolidays: true,
                          },
                        ],
                      });
                      setRecText('');
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 text-white font-semibold cursor-pointer"
                  >
                    + Rule
                  </button>
                </div>
                {draft.recurringRules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[11px] text-slate-700">
                    <span>
                      {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][r.weekday]} {r.periodId}:{' '}
                      <strong>{r.text}</strong> ({r.start} → {r.end})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          recurringRules: draft.recurringRules.filter((x) => x.id !== r.id),
                        })
                      }
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Persistent Live Calendar Verification Bar + Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-700">
            <span className="font-bold text-slate-900">
              {liveSchedule.summary.totalTeachingWeeks} Teaching Weeks ·{' '}
              {liveSchedule.summary.totalInstructionalDays} Instructional Days
            </span>
            {liveSchedule.summary.lastInstructionalDay && (
              <span className="ml-2 text-slate-600">
                Last Day: <strong>{liveSchedule.summary.lastInstructionalDay.iso}</strong> (
                {liveSchedule.summary.lastInstructionalDay.occurrenceTag})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                ← Back
              </button>
            )}
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5)}
                className="px-4 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 cursor-pointer"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Create Binder
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
