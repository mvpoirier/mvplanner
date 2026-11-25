// Standalone Offline HTML Archive, Markdown Archive, and Full Workspace JSON (plain or AES-GCM encrypted).

import { cellKey, type AcademicYearBinder, type PlannerWorkspace } from '../../types/planner';
import { formatWeekHeading, resolveSchedule, resolveSlot } from '../../engine/cycleEngine';
import { encryptJSON } from '../../store/cryptoLock';

export function triggerFileDownload(content: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateMarkdownArchive(
  binder: AcademicYearBinder,
  fromWeekIdx: number,
  toWeekIdx: number,
): string {
  const schedule = resolveSchedule(binder);
  const slice = schedule.weeks.slice(
    Math.max(0, fromWeekIdx),
    Math.min(schedule.weeks.length, toWeekIdx + 1),
  );

  const lines: string[] = [
    `# ${binder.title}`,
    '',
    `> ${schedule.summary.totalTeachingWeeks} Teaching Weeks · ${schedule.summary.totalInstructionalDays} Instructional Days (${binder.startDate} → ${binder.endDate})`,
    '',
  ];

  for (const week of slice) {
    lines.push(`## ${formatWeekHeading(week)} (${week.dateRange})`, '');
    for (const day of week.days) {
      const tag = day.occurrenceTag ? `Day ${day.occurrenceTag}` : day.classification.pause?.title ?? 'Non-instructional';
      lines.push(`### ${day.dow} ${day.shortDate} — ${tag}`);
      if (day.classification.pause) {
        lines.push(`- *${day.classification.pause.title} (Cycle Paused)*`, '');
        continue;
      }
      for (const period of binder.periods) {
        const slot = resolveSlot(binder, day, period);
        const plan = binder.cellPlans[cellKey(day.iso, period.id)];
        if (period.kind === 'divider') {
          if (slot.course) lines.push(`- **${period.label}**: ${slot.course.code}`);
          continue;
        }
        const label = slot.course?.code ?? (slot.banners.length > 0 ? slot.banners.join(' · ') : '');
        const note = plan?.text.trim() ? plan.text.trim().replace(/\n/g, ' / ') : '';
        if (label || note || slot.exceptionLabel) {
          const seq = plan?.seq ? ` \`[${plan.seq}]\`` : '';
          const ex = slot.exceptionLabel ? ` *(Override: ${slot.exceptionLabel})*` : '';
          lines.push(`- **${period.label}**${label ? ` (${label})` : ''}${seq}${ex}${note ? `: ${note}` : ''}`);
        }
      }
      lines.push('');
    }
    const notes = binder.weeklyNotes[week.mondayIso] ?? [];
    if (notes.length > 0) {
      lines.push('**Weekly NOTES:**');
      for (const n of notes) lines.push(`- ${n.text}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function generateOfflineHtmlArchive(
  binder: AcademicYearBinder,
  fromWeekIdx: number,
  toWeekIdx: number,
): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const schedule = resolveSchedule(binder);
  const slice = schedule.weeks.slice(
    Math.max(0, fromWeekIdx),
    Math.min(schedule.weeks.length, toWeekIdx + 1),
  );

  const sections = slice
    .map((week) => {
      const notes = binder.weeklyNotes[week.mondayIso] ?? [];
      const rows = week.days
        .map((day) => {
          const tag = day.occurrenceTag ?? day.classification.pause?.title ?? '—';
          const items = binder.periods
            .map((p) => {
              const slot = resolveSlot(binder, day, p);
              const plan = binder.cellPlans[cellKey(day.iso, p.id)];
              if (!slot.course && !plan?.text.trim() && slot.banners.length === 0 && !slot.exceptionLabel) {
                return '';
              }
              return `<div style="margin:3px 0;padding:4px 6px;border-radius:4px;background:${slot.course?.color ?? '#f1f5f9'}">
                <strong>${esc(p.label)}</strong>${slot.course ? ` · ${esc(slot.course.code)}` : ''}${slot.banners.length ? ` · ${esc(slot.banners.join(' · '))}` : ''}${slot.exceptionLabel ? ` <em>(${esc(slot.exceptionLabel)})</em>` : ''}
                ${plan?.text.trim() ? `<div style="margin-top:2px;white-space:pre-wrap">${esc(plan.text)}</div>` : ''}
              </div>`;
            })
            .filter(Boolean)
            .join('');
          return `<td style="vertical-align:top;border:1px solid #cbd5e1;padding:6px;width:20%">
            <div style="font-weight:700;margin-bottom:4px">${esc(day.dow)} ${esc(day.shortDate)} <span style="color:#475569;font-weight:500">(${esc(tag)})</span></div>
            ${items || '<div style="color:#94a3b8;font-size:11px">—</div>'}
          </td>`;
        })
        .join('');

      return `<section style="margin-bottom:24px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden">
        <div style="background:#1b4487;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;font-weight:700">
          <span>${esc(formatWeekHeading(week))}</span><span>${esc(week.dateRange)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px"><tr>${rows}</tr></table>
        ${notes.length > 0 ? `<div style="background:#f8fafc;padding:8px 12px;border-top:1px solid #cbd5e1;font-size:12px"><strong>NOTES:</strong> ${notes.map((n) => esc(n.text)).join(' · ')}</div>` : ''}
      </section>`;
    })
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${esc(binder.title)} — Offline Archive</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:1200px;margin:24px auto;padding:0 16px;color:#0f172a;}</style>
  </head><body>
    <h1>${esc(binder.title)}</h1>
    <p style="color:#475569">${schedule.summary.totalTeachingWeeks} Teaching Weeks · ${schedule.summary.totalInstructionalDays} Instructional Days · Exported ${new Date().toLocaleDateString()}</p>
    ${sections}
  </body></html>`;
}

export async function downloadWorkspaceJson(
  workspace: PlannerWorkspace,
  passphrase?: string,
): Promise<void> {
  const payload = passphrase?.trim()
    ? await encryptJSON(workspace, passphrase.trim())
    : workspace;
  const suffix = passphrase?.trim() ? '.encrypted.json' : '.json';
  triggerFileDownload(
    JSON.stringify(payload, null, 2),
    `mvplanner-workspace-${new Date().toISOString().slice(0, 10)}${suffix}`,
    'application/json',
  );
}
