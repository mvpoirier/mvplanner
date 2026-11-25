// MVPlanner — core domain & workspace schemas (see mvplanner_design_plan.md §5)

export type InkTone = 'pencil' | 'blue' | 'red';
export type NoteFontMode = 'handwritten' | 'sans';
export type BinderCoverTheme = 'nist-blue' | 'charcoal' | 'forest' | 'burgundy' | 'linen';
export type PaperSize = 'A4' | 'LETTER';
export type ViewMode = 'binder' | 'flat' | 'phone';

export type ExceptionBehavior =
  | 'pause_cycle' // non-instructional day: cycle letter does not advance
  | 'skip_letter' // instructional day, but one letter is skipped before assigning this date
  | 'partial_block' // instructional day with specific periods blocked (assembly, exams…)
  | 'custom_bell' // instructional day on an alternate bell (e.g. Early Dismissal 11:30)
  | 'cohort_override' // instructional day where specific year groups are away (exams, trips)
  | 'event'; // informational banner only (e.g. "1st Day of School", "SPTC")

export type PeriodKind = 'period' | 'divider' | 'banner';

export interface PeriodRow {
  id: string; // 'P1', 'LUNCH', 'AM' …
  label: string; // printed row label
  kind: PeriodKind; // period = timetable slot, divider = thin band (BREAK/LUNCH), banner = AM/ECA strip
  start?: string; // '8:50'
  end?: string; // '10:05'
  endAlt?: string; // '10:10' (staggered/dual dismissal time shown in brackets)
  acceptsCourses: boolean; // whether cycle grid courses/duties can be painted onto this row
  height?: number; // optional screen row height override in px
}

export type CourseCategory = 'class' | 'advisory' | 'meeting' | 'duty' | 'other';

export interface CourseDefinition {
  id: string; // stable key, usually equal to code
  code: string; // '13 PHY'
  name?: string; // 'IB Physics HL Y13'
  room?: string;
  yearGroup?: string; // 'Y13' (used by cohort_override)
  category: CourseCategory;
  color: string; // hex fill
  textColor?: string; // optional hex text override
}

export interface CalendarException {
  id: string;
  title: string;
  start: string; // ISO date (inclusive)
  end: string; // ISO date (inclusive)
  behavior: ExceptionBehavior;
  periodIds?: string[]; // partial_block / custom_bell: periods cancelled; event: rows to show banner in (default AM)
  yearGroups?: string[]; // cohort_override
  bellLabel?: string; // custom_bell label e.g. 'Early Dismissal 11:30'
}

export interface RecurringWeekdayRule {
  id: string;
  weekday: 1 | 2 | 3 | 4 | 5; // 1 = Monday
  periodId: string;
  text: string;
  start: string;
  end: string;
  skipHolidays: boolean;
}

export interface CellPlan {
  text: string;
  ink: InkTone;
  circled?: boolean;
  star?: boolean;
  strike?: boolean;
  pinNote?: boolean;
  seq?: string; // sequence tag e.g. '1/3'
  updatedAt?: string;
}

export interface WeeklyNoteItem {
  id: string;
  text: string;
  ink: InkTone;
  sourceCellKey?: string; // when pinned from a cell
}

export interface TermRange {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface AcademicYearBinder {
  id: string; // e.g. 'nist-2026-2027'
  title: string; // 'NIST 2026–2027'
  schoolLabel: string; // 'NIST 26/27'
  archived: boolean; // true => read-only browsable archive on Binder Shelf
  startDate: string; // '2026-08-03'
  endDate: string; // '2027-06-18'
  firstCycleDate: string; // '2026-08-19'
  cycleLetters: string[]; // ['A','B',…,'J']
  periods: PeriodRow[];
  courses: Record<string, CourseDefinition>;
  cycleGrid: Record<string, Record<string, string>>; // cycleLetter -> periodId -> courseId
  exceptions: CalendarException[];
  recurringRules: RecurringWeekdayRule[];
  cellPlans: Record<string, CellPlan>; // `${date}__${periodId}` -> CellPlan
  weeklyNotes: Record<string, WeeklyNoteItem[]>; // `${mondayIsoDate}` -> notes
  terms?: TermRange[];
  createdAt?: string;
}

export interface PlannerWorkspace {
  schemaVersion: 1;
  activeBinderId: string;
  uiPreferences: {
    coverTheme: BinderCoverTheme;
    noteFont: NoteFontMode;
    paperSize: PaperSize;
  };
  googleSync?: {
    driveFileId?: string;
    lastSyncedAt?: string;
    remoteModifiedTime?: string;
    linkedSpreadsheetId?: string;
    linkedSheetTab?: string;
    clientId?: string;
  };
  binders: Record<string, AcademicYearBinder>;
  updatedAt?: string;
}

export const cellKey = (date: string, periodId: string) => `${date}__${periodId}`;
export const parseCellKey = (key: string) => {
  const [date, periodId] = key.split('__');
  return { date, periodId };
};
