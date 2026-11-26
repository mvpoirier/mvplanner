import { describe, expect, it } from 'vitest';
import { createDemoBinder } from '../../presets/demoBinder';
import {
  parseCsvOrTextExceptions,
  parseIcsExceptions,
} from '../../services/calendarExceptionImporter';
import { generateIcsContent } from '../../services/exporters/icsExporter';
import { buildCoursePacingRows, pacingToCsv, pacingToMarkdown } from '../../services/exporters/pacingSheet';
import { buildPrintSpreadHTML } from '../../services/exporters/printSpread';
import { generateMarkdownArchive } from '../../services/exporters/archiveExporter';
import { decryptJSON, encryptJSON, isEncryptedEnvelope } from '../../store/cryptoLock';

describe('Calendar Exception Bulk Importer', () => {
  it('parses RFC 5545 .ics all-day holiday events with exclusive DTEND adjustment', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20261012',
      'DTEND;VALUE=DATE:20261017',
      'SUMMARY:October Break',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20261218',
      'DTEND;VALUE=DATE:20261219',
      'SUMMARY:Early Dismissal (11:30)',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const res = parseIcsExceptions(ics, '2026-08-01', '2027-06-30');
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      start: '2026-10-12',
      end: '2026-10-16',
      title: 'October Break',
      behavior: 'pause_cycle',
      selected: true,
    });
    expect(res[1]).toMatchObject({
      start: '2026-12-18',
      end: '2026-12-18',
      behavior: 'custom_bell',
    });
  });

  it('parses CSV and date-range paste lines', () => {
    const raw = `Start Date, End Date, Title, Behavior
2026-09-18, 2026-09-18, PL DAY, pause_cycle
2026-10-12..2026-10-16 October Break
2026-12-07 Rama IX Birthday`;
    const res = parseCsvOrTextExceptions(raw);
    expect(res).toHaveLength(3);
    expect(res[0].title).toBe('PL DAY');
    expect(res[1]).toMatchObject({ start: '2026-10-12', end: '2026-10-16', title: 'October Break' });
    expect(res[2]).toMatchObject({ start: '2026-12-07', end: '2026-12-07', title: 'Rama IX Birthday' });
  });
});

describe('Exporters', () => {
  const binder = createDemoBinder();

  it('generates valid ICS feed, Pacing Sheet, Markdown archive, and A4/Letter duplex print HTML', () => {
    const ics = generateIcsContent(binder, 10, 12);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VCALENDAR');

    const rows = buildCoursePacingRows(binder, '13 PHY', 0, 45);
    expect(rows.length).toBeGreaterThan(100);
    expect(pacingToMarkdown(binder, '13 PHY', rows)).toContain('# 13 PHY — Pacing Sheet');
    expect(pacingToCsv(rows)).toContain('Lesson #');

    const md = generateMarkdownArchive(binder, 10, 11);
    expect(md).toContain('# NIST 2026–2027 (Demo)');

    const htmlA4 = buildPrintSpreadHTML(binder, 11, 11, {
      paperSize: 'A4',
      noteFont: 'handwritten',
      blankMode: false,
    });
    expect(htmlA4).toContain('size: A4 portrait');
    expect(htmlA4).toContain('18mm');
    expect(htmlA4).not.toContain('rowspan');

    const htmlLetterBlank = buildPrintSpreadHTML(binder, 11, 11, {
      paperSize: 'LETTER',
      noteFont: 'sans',
      blankMode: true,
    });
    expect(htmlLetterBlank).toContain('size: letter portrait');
    expect(htmlLetterBlank).not.toContain('A2 Forces &amp; FBDs');
  });

  it('round-trips AES-GCM encrypted JSON envelopes', async () => {
    const sample = { hello: 'mvplanner', weeks: 38 };
    const env = await encryptJSON(sample, 'super-secret-pass');
    expect(isEncryptedEnvelope(env)).toBe(true);
    const decrypted = await decryptJSON<typeof sample>(env, 'super-secret-pass');
    expect(decrypted).toEqual(sample);
    await expect(decryptJSON(env, 'wrong-pass')).rejects.toThrow();
  });
});
