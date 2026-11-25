// Native SheetJS (.xlsx / .csv) importer for NIST-style Grid + FINAL workbooks.
// Also exports a shared 2D-array parser reused by Google Sheets Sync (Milestone 2).

import * as XLSX from 'xlsx';
import type {
  AcademicYearBinder,
  CalendarException,
  CourseDefinition,
  PeriodRow,
} from '../types/planner';
import { NIST_COURSES, NIST_PERIODS, createNist2026Binder } from '../presets/nist2026_2027';
import { isISODate, monthIndex, serialToISO } from '../engine/dateUtils';

const FALLBACK_COLORS = [
  '#d9d1e9',
  '#a4c1f4',
  '#f4cccc',
  '#d3ebf1',
  '#fce4cd',
  '#d9ead3',
  '#fff1cc',
  '#e0e7ff',
  '#fae8ff',
];

function guessCourseDef(code: string, idx: number): CourseDefinition {
  const trimmed = code.trim();
  if (NIST_COURSES[trimmed]) return structuredClone(NIST_COURSES[trimmed]);
  const upper = trimmed.toUpperCase();
  if (upper.startsWith('DUTY')) {
    return { id: trimmed, code: trimmed, category: 'duty', color: '#ffff00', textColor: '#1e2022' };
  }
  if (upper.startsWith('CMT') || upper.includes('MTG') || upper.includes('MEETING')) {
    return { id: trimmed, code: trimmed, category: 'meeting', color: '#fff1cc', textColor: '#9a3412' };
  }
  if (upper.includes('ADV') || upper.includes('HOMEROOM')) {
    return { id: trimmed, code: trimmed, category: 'advisory', color: '#d9ead3' };
  }
  const yrMatch = trimmed.match(/^(\d{1,2})/);
  return {
    id: trimmed,
    code: trimmed,
    yearGroup: yrMatch ? `Y${yrMatch[1]}` : undefined,
    category: 'class',
    color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
  };
}

function parseSheetDateCell(val: unknown, fallbackYear: number): string | null {
  if (typeof val === 'number' && val > 30000 && val < 80000) {
    return serialToISO(val);
  }
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;
  if (isISODate(s)) return s;

  // e.g. '19-Aug' or '19-Aug-2026'
  const dm = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})(?:[-/\s](\d{2,4}))?$/);
  if (dm) {
    const day = Number(dm[1]);
    const mi = monthIndex(dm[2]);
    if (mi >= 0) {
      let yr = dm[3] ? Number(dm[3]) : fallbackYear;
      if (yr < 100) yr += 2000;
      // Academic year rollover: Jan–Jul belongs to fallbackYear + 1 when no explicit year is given
      if (!dm[3] && mi < 7) yr = fallbackYear + 1;
      return `${yr}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

export interface SheetImportResult {
  binder: AcademicYearBinder;
  importedCourses: number;
  importedExceptions: number;
  detectedStartYear: number;
}

/**
 * Parse 2D arrays from `Grid` and `FINAL` tabs (works identically for SheetJS .xlsx and Google Sheets API).
 * When `existingBinder` is supplied, preserves its `cellPlans` and `weeklyNotes` (non-destructive refresh!).
 */
export function parseGridAndFinalArrays(
  gridRows: unknown[][],
  finalRows: unknown[][],
  title = 'Imported Timetable',
  existingBinder?: AcademicYearBinder,
): SheetImportResult {
  const base = existingBinder
    ? structuredClone(existingBinder)
    : createNist2026Binder({
        id: `import-${Date.now()}`,
        title,
        schoolLabel: title.slice(0, 14),
        exceptions: [],
        recurringRules: [],
        cellPlans: {},
        weeklyNotes: {},
      });

  // 1. Parse Grid tab (row 0 = cycle letters starting at col 2, subsequent rows = period label + courses)
  const courses: Record<string, CourseDefinition> = existingBinder ? { ...existingBinder.courses } : {};
  const cycleGrid: Record<string, Record<string, string>> = {};
  let cycleLetters: string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  if (gridRows.length > 0) {
    const header = gridRows[0] ?? [];
    const letterCols: { col: number; letter: string }[] = [];
    for (let c = 1; c < header.length; c++) {
      const cell = String(header[c] ?? '').trim();
      if (cell && cell.length <= 4 && /^[A-Za-z0-9]+$/.test(cell)) {
        letterCols.push({ col: c, letter: cell.toUpperCase() });
      }
    }
    if (letterCols.length >= 2) {
      cycleLetters = letterCols.map((lc) => lc.letter);
      for (const l of cycleLetters) cycleGrid[l] = {};

      let colorIdx = 0;
      for (let r = 1; r < gridRows.length; r++) {
        const row = gridRows[r] ?? [];
        const rawLabel = String(row[0] ?? '').trim();
        if (!rawLabel) continue;
        const periodId = rawLabel.toUpperCase().replace(/\s+/g, '');
        const mappedId = periodId === 'LUNCH' ? 'LUNCH' : periodId;

        for (const { col, letter } of letterCols) {
          const val = String(row[col] ?? '').trim();
          if (!val) continue;
          if (!courses[val]) {
            courses[val] = guessCourseDef(val, colorIdx++);
          }
          cycleGrid[letter][mappedId] = val;
        }
      }
    }
  }

  // 2. Parse FINAL tab for date span, firstCycleDate, and holiday/pause exceptions
  let detectedStartYear = new Date().getFullYear();
  const titleCell = String(finalRows[1]?.[0] ?? finalRows[0]?.[0] ?? '');
  const yrMatch = titleCell.match(/(20\d{2})/);
  if (yrMatch) detectedStartYear = Number(yrMatch[1]);

  let dateRowIdx = -1;
  let dayRowIdx = -1;
  let amRowIdx = -1;
  for (let r = 0; r < Math.min(finalRows.length, 10); r++) {
    const label = String(finalRows[r]?.[0] ?? '').trim().toUpperCase();
    if (label === 'DATE') dateRowIdx = r;
    if (label === 'DAY') dayRowIdx = r;
    if (label === 'AM') amRowIdx = r;
  }

  const exceptions: CalendarException[] = [];
  let minDate: string | null = null;
  let maxDate: string | null = null;
  let firstCycleDate: string | null = null;

  if (dateRowIdx >= 0 && dayRowIdx >= 0) {
    const dateRow = finalRows[dateRowIdx] ?? [];
    const dayRow = finalRows[dayRowIdx] ?? [];
    const amRow = amRowIdx >= 0 ? finalRows[amRowIdx] ?? [] : [];
    const letterSet = new Set(cycleLetters);

    for (let c = 1; c < dateRow.length; c++) {
      const iso = parseSheetDateCell(dateRow[c], detectedStartYear);
      if (!iso) continue;
      if (!minDate || iso < minDate) minDate = iso;
      if (!maxDate || iso > maxDate) maxDate = iso;

      const dayVal = String(dayRow[c] ?? '').trim();
      const amVal = String(amRow[c] ?? '').trim();
      const upperDay = dayVal.toUpperCase();

      if (letterSet.has(upperDay)) {
        if (!firstCycleDate || iso < firstCycleDate) firstCycleDate = iso;
        if (amVal && /early dismissal/i.test(amVal)) {
          exceptions.push({
            id: `imp-bell-${iso}`,
            title: amVal,
            start: iso,
            end: iso,
            behavior: 'custom_bell',
            bellLabel: amVal,
          });
        } else if (amVal && /sptc|conference|1st day/i.test(amVal)) {
          exceptions.push({
            id: `imp-ev-${iso}`,
            title: amVal,
            start: iso,
            end: iso,
            behavior: 'event',
            periodIds: ['AM'],
          });
        }
      } else if (firstCycleDate && iso >= firstCycleDate) {
        // Non-cycle day after cycle started -> pause_cycle!
        const label =
          (amVal && !/^\.+$/.test(amVal) ? amVal : '') ||
          (dayVal && !/^\.+$/.test(dayVal) ? dayVal : '') ||
          'Holiday / No School';
        exceptions.push({
          id: `imp-pause-${iso}`,
          title: label,
          start: iso,
          end: iso,
          behavior: 'pause_cycle',
        });
      } else if (dayVal && !/^\.+$/.test(dayVal)) {
        exceptions.push({
          id: `imp-pre-${iso}`,
          title: dayVal,
          start: iso,
          end: iso,
          behavior: 'pause_cycle',
        });
      }
    }
  }

  // Merge consecutive pause_cycle exceptions with the same title
  const mergedExceptions: CalendarException[] = [];
  for (const ex of exceptions) {
    const prev = mergedExceptions[mergedExceptions.length - 1];
    if (
      prev &&
      prev.behavior === 'pause_cycle' &&
      ex.behavior === 'pause_cycle' &&
      prev.title.toLowerCase() === ex.title.toLowerCase()
    ) {
      prev.end = ex.end;
    } else {
      mergedExceptions.push(ex);
    }
  }

  const periods: PeriodRow[] = existingBinder?.periods ?? structuredClone(NIST_PERIODS);

  const binder: AcademicYearBinder = {
    ...base,
    title: titleCell.trim() || base.title,
    schoolLabel: (titleCell.trim() || base.schoolLabel).slice(0, 14),
    startDate: minDate ?? base.startDate,
    endDate: maxDate ?? base.endDate,
    firstCycleDate: firstCycleDate ?? minDate ?? base.firstCycleDate,
    cycleLetters,
    periods,
    courses: Object.keys(courses).length > 0 ? courses : base.courses,
    cycleGrid: Object.keys(cycleGrid).length > 0 ? cycleGrid : base.cycleGrid,
    exceptions: mergedExceptions.length > 0 ? mergedExceptions : base.exceptions,
  };

  return {
    binder,
    importedCourses: Object.keys(binder.courses).length,
    importedExceptions: binder.exceptions.length,
    detectedStartYear,
  };
}

export async function importWorkbookFile(
  file: File,
  existingBinder?: AcademicYearBinder,
): Promise<SheetImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  const gridName = wb.SheetNames.find((n) => /^grid$/i.test(n.trim())) ?? wb.SheetNames[0];
  const finalName =
    wb.SheetNames.find((n) => /final/i.test(n)) ??
    wb.SheetNames.find((n) => n !== gridName) ??
    wb.SheetNames[0];

  const gridRows = gridName
    ? (XLSX.utils.sheet_to_json(wb.Sheets[gridName], { header: 1, defval: '' }) as unknown[][])
    : [];
  const finalRows = finalName
    ? (XLSX.utils.sheet_to_json(wb.Sheets[finalName], { header: 1, defval: '' }) as unknown[][])
    : [];

  return parseGridAndFinalArrays(
    gridRows,
    finalRows,
    file.name.replace(/\.(xlsx|xls|csv)$/i, ''),
    existingBinder,
  );
}
