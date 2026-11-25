// Duplex Binder Print / PDF exporter (A4 Portrait default or US Letter Portrait).
// Strictly enforces §4.1 (NO rowspan for NOTES; CSS Grid 73% 27%; pixel-locked row heights)
// and §4.2 (mirrored 18mm 2-ring punch margins for duplex long-edge printing; filled + blank modes).

import {
  cellKey,
  type AcademicYearBinder,
  type NoteFontMode,
  type PaperSize,
} from '../../types/planner';
import {
  formatWeekHeading,
  resolveSchedule,
  resolveSlot,
  type ResolvedDay,
  type ResolvedWeek,
} from '../../engine/cycleEngine';

function esc(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getRowHeightMm(kind: string): number {
  if (kind === 'banner') return 18;
  if (kind === 'divider') return 7.5;
  return 38; // P1–P4 generous writing height on A4/Letter portrait
}

function getSlotBg(
  binder: AcademicYearBinder,
  day: ResolvedDay,
  periodId: string,
): { bg: string; text?: string; striped?: boolean } {
  const period = binder.periods.find((p) => p.id === periodId)!;
  const slot = resolveSlot(binder, day, period);
  if (slot.exceptionKind === 'full') {
    return periodId === 'AM' ? { bg: '#f6df00' } : { bg: '#e5e7eb' };
  }
  if (slot.exceptionKind === 'cohort' || slot.exceptionKind === 'blocked') {
    return { bg: '#f8ecd0', striped: true };
  }
  if (period.kind === 'banner') {
    if (periodId === 'AM') return { bg: slot.banners.length > 0 ? '#fabe8f' : '#d1d5db' };
    return { bg: slot.banners.length > 0 ? '#dbeafe' : '#e2e8f0' };
  }
  if (slot.course) {
    return { bg: slot.course.color, text: slot.course.textColor };
  }
  return { bg: '#e2e4e8' };
}

function renderPrintTable(
  binder: AcademicYearBinder,
  week: ResolvedWeek,
  dayIndices: number[],
  blankMode: boolean,
): string {
  const dayPct = Math.floor(81 / dayIndices.length);
  const cols = `<colgroup><col style="width:8%"/><col style="width:11%"/>${dayIndices
    .map(() => `<col style="width:${dayPct}%"/>`)
    .join('')}</colgroup>`;

  const hdrTop = `<tr style="height:8.5mm"><th colspan="2" class="hdr-top">${esc(binder.schoolLabel)}</th>${dayIndices
    .map((di) => {
      const d = week.days[di];
      const bell = d.classification.bellLabel ? ' ⏱' : '';
      return `<th class="hdr-top">${esc(d.dow)}${bell}</th>`;
    })
    .join('')}</tr>`;

  const hdrDate = `<tr style="height:7mm"><th colspan="2" class="hdr-date">DATE</th>${dayIndices
    .map((di) => `<th class="hdr-date">${esc(week.days[di].shortDate)}</th>`)
    .join('')}</tr>`;

  const hdrDay = `<tr style="height:7mm"><th colspan="2" class="hdr-day">DAY</th>${dayIndices
    .map((di) => {
      const d = week.days[di];
      const lbl = d.cycleLetter
        ? `${esc(d.cycleLetter)} <span style="font-weight:400;font-size:8pt;opacity:0.75">(${esc(d.occurrenceTag ?? '')})</span>`
        : '—';
      return `<th class="hdr-day">${lbl}</th>`;
    })
    .join('')}</tr>`;

  const bodyRows = binder.periods
    .map((period) => {
      const h = getRowHeightMm(period.kind);
      if (period.kind === 'divider') {
        const cells = dayIndices
          .map((di) => {
            const d = week.days[di];
            const slot = resolveSlot(binder, d, period);
            if (!slot.course) return `<td class="div-cell"></td>`;
            return `<td class="div-cell" style="background:${slot.course.color};color:${slot.course.textColor ?? '#1e2022'};font-weight:800">${esc(slot.course.code)}</td>`;
          })
          .join('');
        return `<tr style="height:${h}mm"><td colspan="2" class="div-cell">${esc(period.label)}</td>${cells}</tr>`;
      }

      const timeSub = `<div class="time-sub"><span>${esc(period.start ?? '')}</span><span>${esc(period.end ?? '')}${period.endAlt ? `<br/>(${esc(period.endAlt)})` : ''}</span></div>`;

      const cells = dayIndices
        .map((di) => {
          const d = week.days[di];
          const slot = resolveSlot(binder, d, period);
          const style = getSlotBg(binder, d, period.id);
          const bgStyle = style.striped
            ? 'background:repeating-linear-gradient(-45deg,#f8ecd0,#f8ecd0 5px,#f1deaf 5px,#f1deaf 10px);'
            : `background:${style.bg};`;

          let inner = '';
          if (slot.exceptionKind === 'full' && period.id === 'AM') {
            inner = `<div class="slot-center">${esc(slot.exceptionLabel ?? '')}</div>`;
          } else if (slot.exceptionKind === 'full') {
            inner = '';
          } else if (slot.exceptionKind === 'cohort' || slot.exceptionKind === 'blocked') {
            inner = `<div class="slot-inner">
              ${slot.course ? `<div class="course-tag" style="opacity:0.55;text-decoration:line-through">${esc(slot.course.code)}</div>` : ''}
              <div style="font-size:8.5pt;font-weight:700;color:#78350f;margin-top:2px">${esc(slot.exceptionLabel ?? '')}</div>
            </div>`;
          } else {
            const plan = blankMode ? undefined : binder.cellPlans[cellKey(d.iso, period.id)];
            const inkCls = plan?.ink === 'red' ? 'ink-red' : plan?.ink === 'blue' ? 'ink-blue' : 'ink-pencil';
            const lines = (plan?.text ?? '').split('\n').filter(Boolean);
            const notesHtml = lines
              .map((line, i) => {
                const cls = [
                  'note-line',
                  inkCls,
                  plan?.circled && i === 0 ? 'circled' : '',
                  plan?.strike ? 'strike' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const star = plan?.star && i === 0 ? '★ ' : '';
                return `<div><span class="${cls}">${star}${esc(line)}</span></div>`;
              })
              .join('');

            const headerHtml = slot.course
              ? `<div class="course-tag" style="${style.text ? `color:${style.text}` : ''}"><span>${esc(slot.course.code)}</span><span>${plan?.seq ? `<span class="seq">${esc(plan.seq)}</span>` : ''}${plan?.pinNote ? ' →' : ''}</span></div>`
              : slot.banners.length > 0
                ? `<div style="font-size:8pt;font-weight:800;margin-bottom:2px">${esc(slot.banners.join(' · '))}</div>`
                : '';

            inner = `<div class="slot-inner">${headerHtml}<div>${notesHtml}</div></div>`;
          }

          return `<td class="slot-td" style="${bgStyle}">${inner}</td>`;
        })
        .join('');

      return `<tr style="height:${h}mm"><td class="time-col">${esc(period.label)}</td><td style="padding:0;vertical-align:stretch">${timeSub}</td>${cells}</tr>`;
    })
    .join('');

  return `<table class="tt-table">${cols}<tbody>${hdrTop}${hdrDate}${hdrDay}${bodyRows}</tbody></table>`;
}

export function buildPrintSpreadHTML(
  binder: AcademicYearBinder,
  fromWeekIdx: number,
  toWeekIdx: number,
  options: {
    paperSize: PaperSize;
    noteFont: NoteFontMode;
    blankMode: boolean;
  },
): string {
  const schedule = resolveSchedule(binder);
  const slice = schedule.weeks.slice(
    Math.max(0, fromWeekIdx),
    Math.min(schedule.weeks.length, toWeekIdx + 1),
  );
  const pageSizeCss = options.paperSize === 'LETTER' ? 'letter portrait' : 'A4 portrait';
  const pageWidth = options.paperSize === 'LETTER' ? '8.5in' : '210mm';
  const pageHeight = options.paperSize === 'LETTER' ? '11in' : '297mm';

  const pagesHtml = slice
    .map((week) => {
      const heading = formatWeekHeading(week);
      const notes = options.blankMode ? [] : binder.weeklyNotes[week.mondayIso] ?? [];
      const notesHtml = notes
        .map((n) => {
          const ink = n.ink === 'red' ? 'ink-red' : n.ink === 'blue' ? 'ink-blue' : 'ink-pencil';
          return `<div class="callout ${ink}">${esc(n.text)}</div>`;
        })
        .join('');

      return `
        <section class="print-page verso">
          <div class="meta-bar">
            <span class="meta-week">${esc(heading)}</span>
            <span class="meta-sub">${esc(binder.title)} · Mon–Wed</span>
          </div>
          ${renderPrintTable(binder, week, [0, 1, 2], options.blankMode)}
        </section>
        <section class="print-page recto">
          <div class="meta-bar">
            <span class="meta-sub">${esc(week.dateRange)}</span>
            <span class="meta-sub">${schedule.summary.totalTeachingWeeks} Teaching Weeks Total</span>
          </div>
          <div class="right-grid">
            <div>${renderPrintTable(binder, week, [3, 4], options.blankMode)}</div>
            <div class="notes-panel">
              <div class="notes-hdr">NOTES</div>
              <div class="notes-body">${notesHtml}</div>
            </div>
          </div>
        </section>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(binder.title)} — ${options.blankMode ? 'Blank Binder Sheets' : 'Binder Print'}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { size: ${pageSizeCss}; margin: 0; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; color: #181a1f; background: #e2e8f0; }
  .print-page {
    width: ${pageWidth};
    height: ${pageHeight};
    background: #fff;
    margin: 12px auto;
    page-break-after: always;
    break-after: page;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Mirrored 18mm 2-ring punch margins for duplex long-edge printing */
  .verso { padding: 10mm 18mm 10mm 10mm; }
  .recto { padding: 10mm 10mm 10mm 18mm; }
  .meta-bar { height: 7mm; margin-bottom: 2mm; display: flex; align-items: center; justify-content: space-between; font-size: 9pt; color: #334155; flex-shrink: 0; }
  .meta-week { font-weight: 800; color: #0f172a; font-size: 10pt; }
  .right-grid { display: grid; grid-template-columns: 73% 27%; align-items: stretch; }
  .tt-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; border: 1.5px solid #2b2f36; }
  .tt-table th, .tt-table td { border: 0.8px solid #484e57; padding: 0; vertical-align: top; overflow: hidden; }
  .hdr-top { background: #e8eaed; font-weight: 700; text-align: center; vertical-align: middle !important; white-space: nowrap; }
  .hdr-date { background: #c9d5c5; font-weight: 600; text-align: center; vertical-align: middle !important; white-space: nowrap; }
  .hdr-day { background: #e6d8b9; font-weight: 700; text-align: center; vertical-align: middle !important; white-space: nowrap; }
  .time-col { background: #eceef0; font-weight: 700; text-align: center; vertical-align: middle !important; font-size: 8.5pt; }
  .time-sub { background: #f4f5f6; font-size: 7pt; text-align: right; padding: 2px 3px; display: flex; flex-direction: column; justify-content: space-between; height: 100%; color: #334155; }
  .div-cell { background: #c8ccd1; font-size: 7.5pt; font-weight: 700; text-align: center; vertical-align: middle !important; white-space: nowrap; }
  .slot-inner { padding: 3px 4px; height: 100%; display: flex; flex-direction: column; }
  .slot-center { height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 800; font-size: 8pt; padding: 2px; }
  .course-tag { font-weight: 800; font-size: 8.5pt; display: flex; justify-content: space-between; margin-bottom: 2px; }
  .seq { font-family: monospace; font-size: 7pt; padding: 0 3px; border-radius: 3px; background: rgba(255,255,255,0.75); border: 1px solid rgba(0,0,0,0.2); }
  .note-line { font-size: 8pt; line-height: 1.25; ${options.noteFont === 'handwritten' ? 'font-family: "Comic Sans MS", "Bradley Hand", cursive, sans-serif;' : ''} }
  .ink-pencil { color: #3a3f47; }
  .ink-blue { color: #1648a8; }
  .ink-red { color: #c02323; font-weight: 600; }
  .circled { border: 1.2px solid currentColor; border-radius: 50%; padding: 0 4px; display: inline-block; }
  .strike { text-decoration: line-through; opacity: 0.68; }
  .notes-panel { display: flex; flex-direction: column; border-top: 1.5px solid #2b2f36; border-right: 1.5px solid #2b2f36; border-bottom: 1.5px solid #2b2f36; background: #f8f8f6; }
  .notes-hdr { height: 8.5mm; background: #e8eaed; border-bottom: 0.8px solid #484e57; font-size: 8.5pt; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .notes-body { flex: 1; padding: 5px; }
  .callout { font-size: 8pt; border-left: 2px solid #c02323; background: rgba(192,35,35,0.05); padding: 3px 5px; margin-bottom: 5px; ${options.noteFont === 'handwritten' ? 'font-family: "Comic Sans MS", "Bradley Hand", cursive, sans-serif;' : ''} }
  @media print {
    body { background: #fff; }
    .print-page { margin: 0; box-shadow: none; }
  }
</style>
</head>
<body>
${pagesHtml}
<script>window.onload = () => setTimeout(() => window.print(), 250);</script>
</body>
</html>`;
}

export function openPrintSpread(
  binder: AcademicYearBinder,
  fromWeekIdx: number,
  toWeekIdx: number,
  options: { paperSize: PaperSize; noteFont: NoteFontMode; blankMode: boolean },
): void {
  const html = buildPrintSpreadHTML(binder, fromWeekIdx, toWeekIdx, options);
  const w = window.open('', '_blank');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}
