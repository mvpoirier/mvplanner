// Single-Course Chronological Pacing Sheet exporter (A1..H18) in Markdown, CSV, or Printable HTML.

import { cellKey, type AcademicYearBinder } from '../../types/planner';
import { resolveSchedule, resolveSlot } from '../../engine/cycleEngine';

export interface PacingRow {
  lessonNumber: number;
  weekLabel: string;
  date: string;
  dow: string;
  occurrenceTag: string;
  periodLabel: string;
  status: 'scheduled' | 'blocked' | 'cohort';
  statusNote: string;
  planText: string;
  seq: string;
}

export function buildCoursePacingRows(
  binder: AcademicYearBinder,
  courseId: string,
  fromWeekIdx: number,
  toWeekIdx: number,
): PacingRow[] {
  const schedule = resolveSchedule(binder);
  const slice = schedule.weeks.slice(
    Math.max(0, fromWeekIdx),
    Math.min(schedule.weeks.length, toWeekIdx + 1),
  );
  const rows: PacingRow[] = [];
  let lessonNum = 0;

  for (const week of slice) {
    for (const day of week.days) {
      if (!day.isInstructional || !day.cycleLetter) continue;
      for (const period of binder.periods) {
        if (!period.acceptsCourses || period.kind === 'divider') continue;
        const slot = resolveSlot(binder, day, period);
        if (slot.courseId !== courseId) continue;

        const isActive = slot.exceptionKind === null;
        if (isActive) lessonNum += 1;
        const plan = binder.cellPlans[cellKey(day.iso, period.id)];

        rows.push({
          lessonNumber: isActive ? lessonNum : 0,
          weekLabel: week.teachingWeekNumber ? `Wk ${week.teachingWeekNumber}` : '—',
          date: day.iso,
          dow: day.dow,
          occurrenceTag: day.occurrenceTag ?? day.cycleLetter,
          periodLabel: period.label,
          status:
            slot.exceptionKind === 'blocked'
              ? 'blocked'
              : slot.exceptionKind === 'cohort'
                ? 'cohort'
                : 'scheduled',
          statusNote: slot.exceptionLabel ?? '',
          planText: plan?.text ?? '',
          seq: plan?.seq ?? '',
        });
      }
    }
  }
  return rows;
}

export function pacingToMarkdown(binder: AcademicYearBinder, courseId: string, rows: PacingRow[]): string {
  const course = binder.courses[courseId];
  const header = `# ${course?.code ?? courseId} — Pacing Sheet (${binder.title})\n\n| # | Week | Date | Day | Cycle | Period | Seq | Lesson Plan / Notes |\n|---:|:---|:---|:---|:---|:---|:---|:---|\n`;
  const body = rows
    .map((r) => {
      const notes =
        r.status !== 'scheduled'
          ? `*[${r.statusNote}]*`
          : r.planText.replace(/\r?\n/g, ' · ').replace(/\|/g, '\\|');
      return `| ${r.lessonNumber || '—'} | ${r.weekLabel} | ${r.date} | ${r.dow} | ${r.occurrenceTag} | ${r.periodLabel} | ${r.seq} | ${notes} |`;
    })
    .join('\n');
  return header + body + '\n';
}

export function pacingToCsv(rows: PacingRow[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = ['Lesson #', 'Week', 'Date', 'DOW', 'Cycle', 'Period', 'Status', 'Seq', 'Plan'].join(',');
  const lines = rows.map((r) =>
    [
      String(r.lessonNumber || ''),
      r.weekLabel,
      r.date,
      r.dow,
      r.occurrenceTag,
      r.periodLabel,
      r.status === 'scheduled' ? 'Active' : r.statusNote,
      r.seq,
      r.planText.replace(/\r?\n/g, ' / '),
    ]
      .map(esc)
      .join(','),
  );
  return [head, ...lines].join('\n');
}

export function openPacingPrintView(binder: AcademicYearBinder, courseId: string, rows: PacingRow[]): void {
  const course = binder.courses[courseId];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(courseId)} Pacing Sheet</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; font-size: 11px; }
  h1 { font-size: 16px; margin: 0 0 4px 0; }
  .meta { color: #475569; margin-bottom: 12px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: ${course?.color ?? '#e2e8f0'}; font-weight: 700; }
  tr.exc td { background: #fef3c7; color: #78350f; font-style: italic; }
</style></head><body>
  <h1>${esc(course?.code ?? courseId)} ${course?.name ? `— ${esc(course.name)}` : ''}</h1>
  <div class="meta">${esc(binder.title)} · ${rows.filter((r) => r.status === 'scheduled').length} instructional lessons</div>
  <table><thead><tr><th>#</th><th>Week</th><th>Date</th><th>Day</th><th>Cycle</th><th>Per</th><th>Seq</th><th>Lesson Plan</th></tr></thead><tbody>
  ${rows
    .map(
      (r) => `<tr class="${r.status !== 'scheduled' ? 'exc' : ''}">
        <td>${r.lessonNumber || '—'}</td><td>${esc(r.weekLabel)}</td><td>${esc(r.date)}</td><td>${esc(r.dow)}</td>
        <td><strong>${esc(r.occurrenceTag)}</strong></td><td>${esc(r.periodLabel)}</td><td>${esc(r.seq)}</td>
        <td>${r.status !== 'scheduled' ? esc(r.statusNote) : esc(r.planText).replace(/\n/g, '<br/>')}</td>
      </tr>`,
    )
    .join('')}
  </tbody></table>
  <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}
