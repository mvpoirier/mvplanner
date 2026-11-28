// "Demo Timetable": what a first-time visitor sees. Made-up classes on a simple 5-day cycle;
// only the week it opens on is filled in, with lesson notes that explain how MVPlanner works.
// Every other week is blank on purpose, so nobody starts planning for real in the demo.

import { cellKey, type AcademicYearBinder, type CourseDefinition, type PlannerWorkspace } from '../types/planner';
import { NIST_PERIODS } from './nist2026_2027';
import { currentSchoolYearStart, defaultYearDates } from './schoolYears';
import { locateToday, resolveSchedule } from '../engine/cycleEngine';
import { todayISO } from '../engine/dateUtils';

const course = (
  id: string,
  code: string,
  name: string,
  category: CourseDefinition['category'],
  color: string,
): CourseDefinition => ({ id, code, name, category, color });

const DEMO_COURSES: Record<string, CourseDefinition> = {
  PHY10: course('PHY10', 'Y10 PHY', 'Year 10 Physics', 'class', '#a7c3f2'),
  SCI8: course('SCI8', 'Y8 SCI', 'Year 8 Science', 'class', '#d3eaf1'),
  CHEM11: course('CHEM11', 'Y11 CHEM', 'Year 11 Chemistry', 'class', '#f3cccc'),
  PHY12: course('PHY12', 'Y12 PHY', 'Year 12 Physics', 'class', '#d9d2e9'),
  DUTY: course('DUTY', 'DUTY LIBRARY', 'Library duty', 'duty', '#ffff00'),
};

// Day letter → period → course. One letter per weekday, so the week reads Mon–Fri as A–E.
const DEMO_GRID: Record<string, Record<string, string>> = {
  A: { P1: 'PHY10', P2: 'SCI8', LUNCH: 'DUTY', P4: 'PHY12' },
  B: { P1: 'CHEM11', P3: 'SCI8', P4: 'SCI8' },
  C: { P2: 'PHY12', P3: 'PHY10', P4: 'CHEM11' },
  D: { P1: 'PHY10', LUNCH: 'DUTY', P3: 'SCI8', P4: 'CHEM11' },
  E: { P1: 'CHEM11', P2: 'PHY12', P4: 'PHY10' },
};

// Lesson notes for the demo week: weekday (0 = Mon) → period → note.
const DEMO_NOTES: [number, string, string, Partial<{ ink: 'pencil' | 'blue' | 'red'; star: boolean; circled: boolean }>?][] = [
  [0, 'P1', 'Double-click any lesson to write your plan.'],
  [0, 'P2', 'Notes stay with the date, even when the cycle shifts.'],
  [0, 'P4', 'Right-click a lesson → no reminder for it.'],
  [1, 'P1', 'Press **⌘K** to search every note in the year.'],
  [1, 'P3', '← → flip the weeks. **T** jumps back to today.'],
  [2, 'P2', 'Lost a lesson? **Bump** moves your notes along.', { ink: 'blue' }],
  [2, 'P3', 'Type **1/3** at the start of a line and MVPlanner offers to fill in 2/3 and 3/3.'],
  [3, 'P1', 'Reminders pop up 10 min before each class.', { star: true }],
  [3, 'P3', 'Today’s column is outlined in orange.'],
  [3, 'P4', '**Unit ▾** in the editor plans a whole unit: U2 L1, L2…'],
  [4, 'P1', 'Print or export a week: ☰ → Export.'],
  [4, 'P4', 'Holidays? ☰ → Import School Calendar.', { ink: 'red', circled: true }],
];

export function createDemoBinder(today: string = todayISO()): AcademicYearBinder {
  const year = currentSchoolYearStart(today);
  const dates = defaultYearDates(year);
  const binder: AcademicYearBinder = {
    id: 'demo-timetable',
    title: 'Demo Timetable',
    schoolLabel: 'DEMO',
    archived: false,
    ...dates,
    cycleLetters: ['A', 'B', 'C', 'D', 'E'],
    periods: structuredClone(NIST_PERIODS),
    courses: structuredClone(DEMO_COURSES),
    cycleGrid: structuredClone(DEMO_GRID),
    exceptions: [],
    recurringRules: [],
    cellPlans: {},
    weeklyNotes: {},
    createdAt: new Date().toISOString(),
  };

  // Fill in the week the planner will open on
  const schedule = resolveSchedule(binder);
  const week = schedule.weeks[locateToday(schedule, today).weekIndex];
  if (!week) return binder;
  binder.demoWeek = week.mondayIso;
  for (const [dayIdx, periodId, text, extra] of DEMO_NOTES) {
    const day = week.days[dayIdx];
    if (!day) continue;
    binder.cellPlans[cellKey(day.iso, periodId)] = { text, ink: 'pencil', ...extra };
  }
  binder.weeklyNotes[week.mondayIso] = [
    { id: 'demo-n1', text: 'Welcome! This is a demo — only this week is filled in.', ink: 'pencil' },
    { id: 'demo-n2', text: 'Start your own: ☰ → New Year Setup Wizard', ink: 'blue' },
    { id: 'demo-n3', text: 'Click “Not synced” (bottom right) to save to iCloud or OneDrive.', ink: 'pencil' },
  ];
  return binder;
}

export function createInitialWorkspace(): PlannerWorkspace {
  const demo = createDemoBinder();
  return {
    schemaVersion: 1,
    activeBinderId: demo.id,
    uiPreferences: {
      coverTheme: 'nist-blue',
      noteFont: 'handwritten',
      paperSize: 'A4',
    },
    binders: {
      [demo.id]: demo,
    },
    updatedAt: new Date().toISOString(),
  };
}
