// Clean NIST 2026–2027 built-in preset (Zero Personal PII — verified against MVP Timetable 2026-2027).
// Exact verification targets:
//   38 teaching weeks · 178 instructional days (A–H = 18 each, I–J = 17 each)
//   A1 = 2026-08-19 (Week 1 / 37 remaining)
//   J8 = 2027-01-11 (Week 18 / 20 remaining)
//   H18 = 2027-06-18 (Week 38 / 0 remaining)

import type {
  AcademicYearBinder,
  CalendarException,
  CourseDefinition,
  PeriodRow,
  RecurringWeekdayRule,
} from '../types/planner';

export const NIST_PERIODS: PeriodRow[] = [
  { id: 'AM', label: 'AM', kind: 'banner', start: '8:00', end: '8:45', acceptsCourses: false, height: 48 },
  { id: 'P1', label: 'P1', kind: 'period', start: '8:50', end: '10:05', endAlt: '10:10', acceptsCourses: true, height: 82 },
  { id: 'BREAK1', label: 'BREAK 1', kind: 'divider', acceptsCourses: false, height: 20 },
  { id: 'P2', label: 'P2', kind: 'period', start: '10:25', end: '11:40', endAlt: '11:45', acceptsCourses: true, height: 82 },
  { id: 'LUNCH', label: 'LUNCH', kind: 'divider', acceptsCourses: true, height: 20 },
  { id: 'P3', label: 'P3', kind: 'period', start: '12:30', end: '13:45', endAlt: '13:50', acceptsCourses: true, height: 82 },
  { id: 'BREAK2', label: 'BREAK 2', kind: 'divider', acceptsCourses: false, height: 20 },
  { id: 'P4', label: 'P4', kind: 'period', start: '14:05', end: '15:20', endAlt: '15:25', acceptsCourses: true, height: 82 },
  { id: 'ECA', label: 'ECA', kind: 'banner', start: '15:30', end: '16:30', acceptsCourses: false, height: 54 },
];

export const NIST_COURSES: Record<string, CourseDefinition> = {
  '13 PHY': { id: '13 PHY', code: '13 PHY', name: 'IB Physics Y13', yearGroup: 'Y13', category: 'class', color: '#d9d1e9' },
  '12 PHY': { id: '12 PHY', code: '12 PHY', name: 'IB Physics Y12', yearGroup: 'Y12', category: 'class', color: '#a4c1f4' },
  '11A SCI': { id: '11A SCI', code: '11A SCI', name: 'MYP Science 11A', yearGroup: 'Y11', category: 'class', color: '#f4cccc' },
  '9.7 SCI': { id: '9.7 SCI', code: '9.7 SCI', name: 'MYP Science 9.7', yearGroup: 'Y9', category: 'class', color: '#d3ebf1' },
  '9.6 SCI': { id: '9.6 SCI', code: '9.6 SCI', name: 'MYP Science 9.6', yearGroup: 'Y9', category: 'class', color: '#fce4cd' },
  '13B ADV': { id: '13B ADV', code: '13B ADV', name: 'Year 13B Advisory', yearGroup: 'Y13', category: 'advisory', color: '#d9ead3' },
  'CMT Y9': { id: 'CMT Y9', code: 'CMT Y9', name: 'Y9 Collaborative Meeting', yearGroup: 'Y9', category: 'meeting', color: '#fff1cc', textColor: '#9a3412' },
  'CMT Y11': { id: 'CMT Y11', code: 'CMT Y11', name: 'Y11 Collaborative Meeting', yearGroup: 'Y11', category: 'meeting', color: '#fff1cc', textColor: '#9a3412' },
  'CMT PHY': { id: 'CMT PHY', code: 'CMT PHY', name: 'Physics Dept Meeting', yearGroup: 'DEPT', category: 'meeting', color: '#fff1cc', textColor: '#9a3412' },
  'DUTY HUB-5': { id: 'DUTY HUB-5', code: 'DUTY HUB-5', name: 'Lunch Duty Hub-5', category: 'duty', color: '#ffff00', textColor: '#1e2022' },
  'DUTY OVAL': { id: 'DUTY OVAL', code: 'DUTY OVAL', name: 'Lunch Duty Oval', category: 'duty', color: '#ffff00', textColor: '#1e2022' },
};

export const NIST_CYCLE_GRID: Record<string, Record<string, string>> = {
  A: { P1: '13 PHY', LUNCH: 'DUTY HUB-5', P3: '13B ADV', P4: '12 PHY' },
  B: { P1: '12 PHY', P2: '9.7 SCI', LUNCH: 'CMT Y9', P4: '9.6 SCI' },
  C: { P2: '11A SCI', P3: '13B ADV', P4: '9.6 SCI' },
  D: { P2: '12 PHY', P3: '11A SCI', P4: '9.7 SCI' },
  E: { P1: '13 PHY', LUNCH: 'DUTY OVAL', P3: '9.7 SCI', P4: '11A SCI' },
  F: { P1: '13 PHY', LUNCH: 'DUTY OVAL', P3: '9.6 SCI', P4: '12 PHY' },
  G: { P1: '9.7 SCI', P2: '11A SCI', P3: 'CMT Y11', P4: '12 PHY' },
  H: { P1: '12 PHY', P3: '13 PHY', P4: '9.6 SCI' },
  I: { P1: '11A SCI', P2: '13 PHY', P3: '9.7 SCI' },
  J: { P2: '9.6 SCI', P3: '13 PHY', P4: 'CMT PHY' },
};

export const NIST_2026_2027_EXCEPTIONS: CalendarException[] = [
  // Pre-semester orientation & non-instructional days
  { id: 'ex-ori-1', title: 'New Teachers Start', start: '2026-08-05', end: '2026-08-05', behavior: 'pause_cycle' },
  { id: 'ex-ori-2', title: 'Team Leaders', start: '2026-08-11', end: '2026-08-11', behavior: 'pause_cycle' },
  { id: 'ex-ori-3', title: "HM Queen's Birthday (NO SCHOOL)", start: '2026-08-12', end: '2026-08-12', behavior: 'pause_cycle' },
  { id: 'ex-ori-4', title: 'All Faculty', start: '2026-08-13', end: '2026-08-13', behavior: 'pause_cycle' },
  { id: 'ex-ori-5', title: 'Orientation', start: '2026-08-14', end: '2026-08-14', behavior: 'pause_cycle' },
  { id: 'ex-ori-6', title: 'Ele orientation', start: '2026-08-17', end: '2026-08-17', behavior: 'pause_cycle' },
  { id: 'ex-ori-7', title: 'Sec orientation', start: '2026-08-18', end: '2026-08-18', behavior: 'pause_cycle' },
  { id: 'ex-first-day', title: '1st Day of School', start: '2026-08-19', end: '2026-08-19', behavior: 'event', periodIds: ['AM'] },

  // All 14 cycle-pausing holidays, breaks & PL days
  { id: 'ex-pl-1', title: 'PL DAY', start: '2026-09-18', end: '2026-09-18', behavior: 'pause_cycle' },
  { id: 'ex-oct-break', title: 'OCTOBER BREAK', start: '2026-10-12', end: '2026-10-16', behavior: 'pause_cycle' },
  { id: 'ex-rama-v', title: 'HM KING RAMA V MEMORIAL DAY (NO SCHOOL)', start: '2026-10-23', end: '2026-10-23', behavior: 'pause_cycle' },
  { id: 'ex-pl-2', title: 'PL DAY', start: '2026-11-27', end: '2026-11-27', behavior: 'pause_cycle' },
  { id: 'ex-rama-ix', title: 'HM KING RAMA IX BIRTHDAY (NO SCHOOL)', start: '2026-12-07', end: '2026-12-07', behavior: 'pause_cycle' },
  { id: 'ex-winter', title: 'Winter break', start: '2026-12-21', end: '2027-01-08', behavior: 'pause_cycle' },
  { id: 'ex-feb-break', title: 'FEB BREAK', start: '2027-02-22', end: '2027-02-26', behavior: 'pause_cycle' },
  { id: 'ex-pl-3', title: 'PL DAY', start: '2027-03-19', end: '2027-03-19', behavior: 'pause_cycle' },
  { id: 'ex-chakri', title: 'CHAKRI DAY (NO SCHOOL)', start: '2027-04-06', end: '2027-04-06', behavior: 'pause_cycle' },
  { id: 'ex-songkran', title: 'Songkran Holiday', start: '2027-04-12', end: '2027-04-16', behavior: 'pause_cycle' },
  { id: 'ex-coronation', title: 'CORONATION (NO SCHOOL)', start: '2027-05-04', end: '2027-05-04', behavior: 'pause_cycle' },
  { id: 'ex-vishakha', title: 'VISHAKHA BUCHA DAY (NO SCHOOL)', start: '2027-05-20', end: '2027-05-20', behavior: 'pause_cycle' },
  { id: 'ex-pl-4', title: 'PL DAY', start: '2027-05-21', end: '2027-05-21', behavior: 'pause_cycle' },
  { id: 'ex-queen', title: 'QUEEN BIRTHDAY (NO SCHOOL)', start: '2027-06-03', end: '2027-06-03', behavior: 'pause_cycle' },

  // Instructional-day overlays & alternate bells
  { id: 'ex-sptc-1', title: 'SPTC', start: '2026-10-06', end: '2026-10-06', behavior: 'event', periodIds: ['AM'] },
  { id: 'ex-sptc-2', title: 'SPTC', start: '2026-10-09', end: '2026-10-09', behavior: 'event', periodIds: ['AM'] },
  {
    id: 'ex-ed-1',
    title: 'EARLY DISMISSAL (11:30)',
    start: '2026-12-18',
    end: '2026-12-18',
    behavior: 'custom_bell',
    bellLabel: 'Early Dismissal 11:30',
  },
  { id: 'ex-sptc-3', title: 'SPT Conference', start: '2027-03-30', end: '2027-03-30', behavior: 'event', periodIds: ['AM'] },
  { id: 'ex-sptc-4', title: 'SPT Conference', start: '2027-04-02', end: '2027-04-02', behavior: 'event', periodIds: ['AM'] },
  {
    id: 'ex-ed-2',
    title: 'Early Dismissal (11:30)',
    start: '2027-06-18',
    end: '2027-06-18',
    behavior: 'custom_bell',
    bellLabel: 'Early Dismissal 11:30',
  },
];

export const NIST_2026_2027_RECURRING: RecurringWeekdayRule[] = [
  {
    id: 'rec-tue-am',
    weekday: 2,
    periodId: 'AM',
    text: '8:05 - Morning Meeting',
    start: '2026-10-20',
    end: '2027-01-19',
    skipHolidays: true,
  },
  {
    id: 'rec-wed-eca',
    weekday: 3,
    periodId: 'ECA',
    text: 'ECA - Science Support',
    start: '2026-10-21',
    end: '2027-01-20',
    skipHolidays: true,
  },
];

export function createNist2026Binder(overrides?: Partial<AcademicYearBinder>): AcademicYearBinder {
  return {
    id: 'nist-2026-2027',
    title: 'NIST 2026–2027',
    schoolLabel: 'NIST 26/27',
    archived: false,
    startDate: '2026-08-03',
    endDate: '2027-06-18',
    firstCycleDate: '2026-08-19',
    cycleLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    periods: structuredClone(NIST_PERIODS),
    courses: structuredClone(NIST_COURSES),
    cycleGrid: structuredClone(NIST_CYCLE_GRID),
    exceptions: structuredClone(NIST_2026_2027_EXCEPTIONS),
    recurringRules: structuredClone(NIST_2026_2027_RECURRING),
    cellPlans: {},
    weeklyNotes: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
