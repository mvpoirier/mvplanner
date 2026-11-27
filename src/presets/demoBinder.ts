// Public zero-PII interactive demo binder for unauthenticated visitors.
// Uses the clean NIST 2026-2027 structure with generic sample physics/science lesson plans.

import { cellKey, type AcademicYearBinder, type PlannerWorkspace } from '../types/planner';
import { createNist2026Binder } from './nist2026_2027';

export function createDemoBinder(): AcademicYearBinder {
  const base = createNist2026Binder({
    id: 'demo-2026-2027',
    title: 'NIST 2026–2027 (Demo)',
    schoolLabel: 'NIST 26/27',
  });

  base.cellPlans = {
    // Week 1 (Aug 17–21)
    [cellKey('2026-08-19', 'P1')]: { text: 'Course intro & IA timeline', ink: 'blue', seq: '1/3' },
    [cellKey('2026-08-19', 'P3')]: { text: 'Welcome circle & CAS check-in', ink: 'pencil' },
    [cellKey('2026-08-19', 'P4')]: { text: 'A1 Kinematics diagnostic', ink: 'blue' },
    [cellKey('2026-08-20', 'P1')]: { text: 'A1 Uncertainties & graphing', ink: 'blue' },
    [cellKey('2026-08-20', 'P2')]: { text: 'Lab safety & Bunsen burner demo', ink: 'pencil' },
    [cellKey('2026-08-21', 'P2')]: { text: 'Criterion B lab expectations', ink: 'blue' },

    // Week 9 (Oct 19–23 — H4, I4, J4, A5, Fri Rama V holiday)
    [cellKey('2026-10-19', 'P1')]: { text: 'A2 Forces & FBDs', ink: 'blue', seq: '1/3' },
    [cellKey('2026-10-19', 'P3')]: { text: 'D1 Gravitation fields', ink: 'blue', seq: '1/2' },
    [cellKey('2026-10-19', 'P4')]: { text: 'Waves intro: transverse vs longitudinal', ink: 'pencil' },
    [cellKey('2026-10-20', 'P1')]: { text: 'Thermal energy transfer lab', ink: 'blue', star: true },
    [cellKey('2026-10-20', 'P2')]: { text: 'D1 Orbital motion & Kepler', ink: 'blue', seq: '2/2', circled: true },
    [cellKey('2026-10-20', 'P3')]: { text: 'Wave speed v = fλ practice', ink: 'pencil' },
    [cellKey('2026-10-21', 'P2')]: { text: 'Reflection & refraction ray box', ink: 'blue' },
    [cellKey('2026-10-21', 'P3')]: { text: 'D2 Electric fields intro', ink: 'blue' },
    [cellKey('2026-10-21', 'P4')]: { text: 'Moderation & assessment calendar', ink: 'red', circled: true },
    [cellKey('2026-10-22', 'P1')]: { text: 'D2 Coulomb law problems', ink: 'blue' },
    [cellKey('2026-10-22', 'P3')]: { text: 'University essay check-in', ink: 'pencil' },
    [cellKey('2026-10-22', 'P4')]: { text: 'A2 Friction lab setup', ink: 'red', star: true, pinNote: true, seq: '2/3' },

    // Week 17 (Dec 14–18 — E8..I8, Early Dismissal Fri)
    [cellKey('2026-12-14', 'P1')]: { text: 'IA Final Draft Review', ink: 'blue', circled: true },
    [cellKey('2026-12-14', 'P3')]: { text: 'Circuits lab wrap-up', ink: 'pencil' },
    [cellKey('2026-12-15', 'P1')]: { text: 'IA Final Polish', ink: 'blue' },
    [cellKey('2026-12-15', 'P4')]: { text: 'Semester 1 Review', ink: 'blue', star: true },
    [cellKey('2026-12-16', 'P4')]: { text: 'Semester 1 Capstone Lab', ink: 'blue' },
    [cellKey('2026-12-17', 'P1')]: { text: 'Unit Quiz', ink: 'blue', circled: true },
    [cellKey('2026-12-18', 'P2')]: { text: 'IA Final Submission DUE', ink: 'red', circled: true, pinNote: true },
  };

  base.weeklyNotes = {
    '2026-08-17': [
      { id: 'dn1', text: 'Welcome back! Set up 13B ADV homeroom & lab safety', ink: 'blue' },
      { id: 'dn2', text: 'Check Year 12 & 13 Physics textbook distribution', ink: 'pencil' },
    ],
    '2026-10-19': [
      { id: 'dn3', text: 'Fri 23-Oct is Rama V Memorial Day — cycle pauses automatically', ink: 'blue' },
      { id: 'dn4', text: 'Thu P4 12 PHY: Prep friction blocks & force sensors', ink: 'red', sourceCellKey: cellKey('2026-10-22', 'P4') },
      { id: 'dn5', text: 'Try clicking any cell + "Bump Forward" to see Smart Bump in action!', ink: 'pencil' },
    ],
    '2026-12-14': [
      { id: 'dn6', text: 'Winter Break Dec 21–Jan 8 (3 non-teaching weeks skipped → Jan 11 is Week 18 of 38)', ink: 'blue' },
      { id: 'dn7', text: 'Fri 18-Dec Early Dismissal 11:30 — IA Final Submission DUE', ink: 'red', sourceCellKey: cellKey('2026-12-18', 'P2') },
    ],
  };

  return base;
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
