// Excel (.xlsx) & CSV exporter matching the NIST Grid + FINAL (with notes) workbook layout.

import * as XLSX from 'xlsx';
import { cellKey, type AcademicYearBinder } from '../../types/planner';
import { resolveSchedule, resolveSlot } from '../../engine/cycleEngine';

export function buildGridSheetRows(binder: AcademicYearBinder): string[][] {
  const rows: string[][] = [[binder.schoolLabel, '', ...binder.cycleLetters]];
  for (const period of binder.periods) {
    if (period.kind === 'banner') continue;
    const timeStr = period.start ? `${period.start}-${period.endAlt ?? period.end ?? ''}` : '';
    const row = [
      period.label,
      timeStr,
      ...binder.cycleLetters.map((l) => binder.cycleGrid[l]?.[period.id] ?? ''),
    ];
    rows.push(row);
  }
  return rows;
}

export function buildFinalSheetRows(
  binder: AcademicYearBinder,
  fromWeekIdx: number,
  toWeekIdx: number,
): string[][] {
  const schedule = resolveSchedule(binder);
  const slice = schedule.weeks.slice(
    Math.max(0, fromWeekIdx),
    Math.min(schedule.weeks.length, toWeekIdx + 1),
  );

  const occRow: string[] = ['', ''];
  const dowRow: string[] = [binder.title, ''];
  const dateRow: string[] = ['DATE', ''];
  const dayRow: string[] = ['DAY', ''];

  const periodRows: string[][] = binder.periods.map((p) => [
    p.label,
    p.start ? `${p.start}–${p.end ?? ''}${p.endAlt ? ` (${p.endAlt})` : ''}` : '',
  ]);

  for (const week of slice) {
    for (const day of week.days) {
      occRow.push(day.occurrenceTag ?? (day.classification.pause ? day.classification.pause.title : ''));
      dowRow.push(day.dow);
      dateRow.push(day.shortDate);
      dayRow.push(day.cycleLetter ?? (day.classification.pause ? day.classification.pause.title : ''));

      binder.periods.forEach((period, pIdx) => {
        const slot = resolveSlot(binder, day, period);
        const plan = binder.cellPlans[cellKey(day.iso, period.id)];
        if (slot.exceptionKind === 'full') {
          periodRows[pIdx].push(period.id === 'AM' ? slot.exceptionLabel ?? '' : '');
        } else if (slot.exceptionKind === 'cohort' || slot.exceptionKind === 'blocked') {
          periodRows[pIdx].push(`[${slot.exceptionLabel}]`);
        } else {
          const parts: string[] = [];
          if (slot.course) parts.push(slot.course.code);
          if (slot.banners.length > 0) parts.push(slot.banners.join(' · '));
          if (plan?.text.trim()) parts.push(plan.text.trim());
          periodRows[pIdx].push(parts.join('\n'));
        }
      });
    }

    // 6th column per week block = NOTES
    occRow.push('');
    dowRow.push('NOTES');
    dateRow.push(week.teachingWeekNumber ? `Wk ${week.teachingWeekNumber}` : 'Break');
    dayRow.push('');
    const weekNotes = (binder.weeklyNotes[week.mondayIso] ?? []).map((n) => `• ${n.text}`).join('\n');
    binder.periods.forEach((_, pIdx) => {
      periodRows[pIdx].push(pIdx === 0 ? weekNotes : '');
    });
  }

  return [occRow, dowRow, dateRow, dayRow, ...periodRows];
}

export function downloadXlsxWorkbook(
  binder: AcademicYearBinder,
  fromWeekIdx: number,
  toWeekIdx: number,
): void {
  const wb = XLSX.utils.book_new();
  const gridWs = XLSX.utils.aoa_to_sheet(buildGridSheetRows(binder));
  const finalWs = XLSX.utils.aoa_to_sheet(buildFinalSheetRows(binder, fromWeekIdx, toWeekIdx));

  XLSX.utils.book_append_sheet(wb, gridWs, 'Grid');
  XLSX.utils.book_append_sheet(wb, finalWs, 'FINAL (with notes)');

  const safeName = binder.title.replace(/[^a-zA-Z0-9_-]+/g, '_');
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}

export function generateFinalCsv(
  binder: AcademicYearBinder,
  fromWeekIdx: number,
  toWeekIdx: number,
): string {
  const rows = buildFinalSheetRows(binder, fromWeekIdx, toWeekIdx);
  return rows
    .map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
