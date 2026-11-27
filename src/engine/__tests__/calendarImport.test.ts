import { describe, expect, it } from 'vitest';
import {
  buildPreview,
  CalendarFileError,
  guessKind,
  parseCalendarCsv,
  parseCalendarFile,
  parseIcs,
  toException,
} from '../../services/calendarImport';
import { createNist2026Binder } from '../../presets/nist2026_2027';

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20270222',
  'DTEND;VALUE=DATE:20270227',
  'SUMMARY:FEB BREAK',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20270330',
  'DTEND;VALUE=DATE:20270331',
  'SUMMARY:SPT Conference\\, Secondary',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20270115T020000Z',
  'DTEND:20270115T030000Z',
  'SUMMARY:Science fair set-up and a very long title that',
  '  is folded onto the next line',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('School calendar import', () => {
  it('reads all-day .ics events with exclusive end dates', () => {
    const [feb, sptc] = parseIcs(ICS);
    expect(feb).toEqual({ start: '2027-02-22', end: '2027-02-26', label: 'FEB BREAK', kind: 'no-school' });
    expect(sptc).toMatchObject({ start: '2027-03-30', end: '2027-03-30', label: 'SPT Conference, Secondary', kind: 'event' });
  });

  it('unfolds long .ics lines and keeps timed events on their day', () => {
    const fair = parseIcs(ICS)[2];
    expect(fair.label).toBe('Science fair set-up and a very long title that is folded onto the next line');
    expect(fair.start).toBe(fair.end);
  });

  it('reads CSV with ISO or day-first dates, quotes and optional columns', () => {
    const rows = parseCalendarCsv(
      'Date,End Date,Type,Label\n2026-12-21,2027-01-08,no-school,Winter break\n19/03/2027,,,PL DAY\n30.03.2027,,event,"Conference, parents"\n',
    );
    expect(rows).toEqual([
      { start: '2026-12-21', end: '2027-01-08', label: 'Winter break', kind: 'no-school' },
      { start: '2027-03-19', end: '2027-03-19', label: 'PL DAY', kind: 'no-school' },
      { start: '2027-03-30', end: '2027-03-30', label: 'Conference, parents', kind: 'event' },
    ]);
  });

  it('explains a CSV without the right header or with a bad date', () => {
    expect(() => parseCalendarCsv('when,what\n2027-01-01,x')).toThrow(CalendarFileError);
    expect(() => parseCalendarCsv('date,label\nnext tuesday,x')).toThrow(/Row 2/);
  });

  it('guesses no-school vs event from the wording', () => {
    expect(guessKind('Songkran Holiday')).toBe('no-school');
    expect(guessKind('HM King Rama IX Birthday (NO SCHOOL)')).toBe('no-school');
    expect(guessKind('Sports Day')).toBe('event');
    expect(guessKind('Sports Day', 'no-school')).toBe('no-school');
  });

  it('marks dates already in the binder and dates outside the school year', () => {
    const binder = createNist2026Binder();
    const preview = buildPreview(
      binder,
      parseCalendarFile('cal.csv', 'date,end_date,label\n2026-12-21,2027-01-08,Winter break\n2027-01-25,,Founders Day\n2028-01-01,,Next year\n'),
    );
    expect(preview.map((r) => r.status)).toEqual(['duplicate', 'new', 'outside']);
  });

  it('turns no-school days into cycle pauses and events into AM banners', () => {
    expect(toException({ start: '2027-01-25', end: '2027-01-25', label: 'X', kind: 'no-school' }, 1).behavior).toBe('pause_cycle');
    const ev = toException({ start: '2027-01-25', end: '2027-01-25', label: 'Y', kind: 'event' }, 2);
    expect(ev.behavior).toBe('event');
    expect(ev.periodIds).toEqual(['AM']);
  });
});
