// Zustand workspace store with IndexedDB persistence, Undo/Redo history,
// optional AES-GCM local lock, and multi-year Binder Shelf actions.

import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import {
  cellKey,
  type AcademicYearBinder,
  type BinderCoverTheme,
  type CellPlan,
  type InkTone,
  type NoteFontMode,
  type PaperSize,
  type PlannerWorkspace,
  type ViewMode,
  type WeeklyNoteItem,
} from '../types/planner';
import { createInitialWorkspace } from '../presets/demoBinder';
import { smartBumpForward, type BumpScope } from '../engine/smartBumpEngine';
import { resolveSchedule } from '../engine/cycleEngine';
import {
  decryptJSON,
  encryptJSON,
  isEncryptedEnvelope,
  type EncryptedEnvelope,
} from './cryptoLock';

const IDB_KEY = 'mvplanner_workspace_v1';
const MAX_HISTORY = 40;

export interface SelectedCell {
  date: string;
  periodId: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline' | 'conflict' | 'error';

interface PlannerState {
  workspace: PlannerWorkspace;
  hydrated: boolean;
  locked: boolean;
  lockedEnvelope: EncryptedEnvelope | null;
  lockPassphrase: string | null; // kept in memory only while unlocked

  // UI view state
  weekIndex: number;
  phoneDayIndex: number;
  viewMode: ViewMode;
  selectedCell: SelectedCell | null;
  toastMessage: string | null;

  // Undo / Redo snapshots of workspace.binders
  past: Record<string, AcademicYearBinder>[];
  future: Record<string, AcademicYearBinder>[];

  // Google Drive sync status
  syncStatus: SyncStatus;
  syncError: string | null;
  dirtyRevision: number;

  // Lifecycle & persistence
  hydrate: () => Promise<void>;
  unlockWithPassphrase: (passphrase: string) => Promise<boolean>;
  enableLocalLock: (passphrase: string) => Promise<void>;
  disableLocalLock: () => Promise<void>;

  // Navigation & UI
  setWeekIndex: (idx: number) => void;
  setPhoneDayIndex: (idx: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedCell: (sel: SelectedCell | null) => void;
  setCoverTheme: (theme: BinderCoverTheme) => void;
  setNoteFont: (font: NoteFontMode) => void;
  setPaperSize: (size: PaperSize) => void;
  showToast: (msg: string) => void;

  // Cell & note editing
  updateCellPlan: (date: string, periodId: string, patch: Partial<CellPlan>) => void;
  bumpCourseForward: (courseId: string, date: string, periodId: string, scope: BumpScope) => number;
  addWeeklyNote: (mondayIso: string, text: string, ink?: InkTone, sourceCellKey?: string) => void;
  updateWeeklyNote: (mondayIso: string, noteId: string, text: string, ink?: InkTone) => void;
  deleteWeeklyNote: (mondayIso: string, noteId: string) => void;
  pinCellToWeeklyNotes: (mondayIso: string, date: string, periodId: string, label: string) => void;

  // Multi-year Binder Shelf
  switchBinder: (binderId: string) => void;
  addBinder: (binder: AcademicYearBinder, activate?: boolean) => void;
  updateActiveBinder: (updater: (b: AcademicYearBinder) => AcademicYearBinder) => void;
  toggleArchiveBinder: (binderId: string) => void;
  deleteBinder: (binderId: string) => void;
  cloneBinderToNewYear: (sourceBinderId: string, newTitle: string, startDate: string, endDate: string, firstCycleDate: string) => string;

  // Workspace replacement & sync
  replaceWorkspace: (next: PlannerWorkspace) => void;
  updateGoogleSync: (patch: Partial<NonNullable<PlannerWorkspace['googleSync']>>) => void;
  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  localSaveStatus: 'idle' | 'saving' | 'saved';
  lastLocalSavedAt: string | null;
  flushPersist: () => Promise<void>;

  // Undo / Redo
  undo: () => void;
  redo: () => void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

async function persistNow(
  workspace: PlannerWorkspace,
  passphrase: string | null,
  onDone?: () => void,
) {
  try {
    if (passphrase) {
      const env = await encryptJSON(workspace, passphrase);
      await idbSet(IDB_KEY, env);
    } else {
      await idbSet(IDB_KEY, workspace);
    }
    onDone?.();
  } catch (err) {
    console.error('Failed to persist workspace to IndexedDB:', err);
  }
}

function schedulePersist(
  workspace: PlannerWorkspace,
  passphrase: string | null,
  onDone?: () => void,
) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow(workspace, passphrase, onDone);
  }, 250);
}

function defaultWeekIndexForBinder(binder: AcademicYearBinder): number {
  const sched = resolveSchedule(binder);
  // If demo binder, open on Week 9 (Oct 19-23) to match the rich mockup showcase; otherwise open on current week or Week 1
  if (binder.id === 'demo-2026-2027') {
    const wk9 = sched.weeks.findIndex((w) => w.mondayIso === '2026-10-19');
    if (wk9 !== -1) return wk9;
  }
  const firstTeaching = sched.weeks.findIndex((w) => w.isTeachingWeek);
  return firstTeaching >= 0 ? firstTeaching : 0;
}

const initialWorkspace = createInitialWorkspace();

export const usePlannerStore = create<PlannerState>((set, get) => ({
  workspace: initialWorkspace,
  hydrated: false,
  locked: false,
  lockedEnvelope: null,
  lockPassphrase: null,

  weekIndex: defaultWeekIndexForBinder(initialWorkspace.binders[initialWorkspace.activeBinderId]),
  phoneDayIndex: 0,
  viewMode: 'binder',
  selectedCell: null,
  toastMessage: null,

  past: [],
  future: [],

  syncStatus: 'idle',
  syncError: null,
  dirtyRevision: 0,
  localSaveStatus: 'idle',
  lastLocalSavedAt: null,

  flushPersist: async () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const { workspace, lockPassphrase } = get();
    set({ localSaveStatus: 'saving' });
    await persistNow(workspace, lockPassphrase, () => {
      set({ localSaveStatus: 'saved', lastLocalSavedAt: new Date().toISOString() });
    });
  },

  hydrate: async () => {
    try {
      const stored = await idbGet(IDB_KEY);
      if (!stored) {
        set({ hydrated: true });
        return;
      }
      if (isEncryptedEnvelope(stored)) {
        set({ hydrated: true, locked: true, lockedEnvelope: stored });
        return;
      }
      const ws = stored as PlannerWorkspace;
      if (ws && ws.schemaVersion === 1 && ws.binders && ws.activeBinderId && ws.binders[ws.activeBinderId]) {
        const active = ws.binders[ws.activeBinderId];
        set({
          workspace: ws,
          hydrated: true,
          weekIndex: defaultWeekIndexForBinder(active),
        });
      } else {
        set({ hydrated: true });
      }
    } catch (err) {
      console.error('IndexedDB hydrate error:', err);
      set({ hydrated: true });
    }
  },

  unlockWithPassphrase: async (passphrase: string) => {
    const env = get().lockedEnvelope;
    if (!env) return false;
    try {
      const ws = await decryptJSON<PlannerWorkspace>(env, passphrase);
      const active = ws.binders[ws.activeBinderId] ?? Object.values(ws.binders)[0];
      set({
        workspace: ws,
        locked: false,
        lockedEnvelope: null,
        lockPassphrase: passphrase,
        weekIndex: active ? defaultWeekIndexForBinder(active) : 0,
      });
      return true;
    } catch {
      return false;
    }
  },

  enableLocalLock: async (passphrase: string) => {
    const ws = get().workspace;
    const env = await encryptJSON(ws, passphrase);
    await idbSet(IDB_KEY, env);
    set({ lockPassphrase: passphrase });
    get().showToast('AES-GCM passphrase lock enabled for this browser.');
  },

  disableLocalLock: async () => {
    const ws = get().workspace;
    await idbSet(IDB_KEY, ws);
    set({ lockPassphrase: null });
    get().showToast('Local passphrase lock removed.');
  },

  setWeekIndex: (idx) => set({ weekIndex: idx, selectedCell: null }),
  setPhoneDayIndex: (idx) => set({ phoneDayIndex: idx }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedCell: (sel) => set({ selectedCell: sel }),

  setCoverTheme: (coverTheme) => {
    const next: PlannerWorkspace = {
      ...get().workspace,
      uiPreferences: { ...get().workspace.uiPreferences, coverTheme },
      updatedAt: new Date().toISOString(),
    };
    set({ workspace: next, dirtyRevision: get().dirtyRevision + 1 });
    schedulePersist(next, get().lockPassphrase);
  },

  setNoteFont: (noteFont) => {
    const next: PlannerWorkspace = {
      ...get().workspace,
      uiPreferences: { ...get().workspace.uiPreferences, noteFont },
      updatedAt: new Date().toISOString(),
    };
    set({ workspace: next, dirtyRevision: get().dirtyRevision + 1 });
    schedulePersist(next, get().lockPassphrase);
  },

  setPaperSize: (paperSize) => {
    const next: PlannerWorkspace = {
      ...get().workspace,
      uiPreferences: { ...get().workspace.uiPreferences, paperSize },
      updatedAt: new Date().toISOString(),
    };
    set({ workspace: next, dirtyRevision: get().dirtyRevision + 1 });
    schedulePersist(next, get().lockPassphrase);
  },

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: msg });
    toastTimer = setTimeout(() => set({ toastMessage: null }), 3200);
  },

  updateCellPlan: (date, periodId, patch) => {
    const state = get();
    const binder = state.workspace.binders[state.workspace.activeBinderId];
    if (!binder || binder.archived) return;

    const key = cellKey(date, periodId);
    const existing = binder.cellPlans[key] ?? { text: '', ink: 'pencil' as InkTone };
    const updated: CellPlan = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    const nextPlans = { ...binder.cellPlans };
    if (updated.text.trim() === '' && !updated.circled && !updated.star && !updated.strike && !updated.seq) {
      delete nextPlans[key];
    } else {
      nextPlans[key] = updated;
    }

    const nextBinders = {
      ...state.workspace.binders,
      [binder.id]: { ...binder, cellPlans: nextPlans },
    };
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };

    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      dirtyRevision: state.dirtyRevision + 1,
      localSaveStatus: 'saving',
    });
    schedulePersist(nextWs, state.lockPassphrase, () => {
      set({ localSaveStatus: 'saved', lastLocalSavedAt: new Date().toISOString() });
    });
  },

  bumpCourseForward: (courseId, date, periodId, scope) => {
    const state = get();
    const binder = state.workspace.binders[state.workspace.activeBinderId];
    if (!binder || binder.archived) return 0;

    const result = smartBumpForward(binder, courseId, date, periodId, scope);
    if (result.movedCount === 0) {
      state.showToast('No lessons shifted — add a note first or select an earlier slot.');
      return 0;
    }

    const nextBinders = {
      ...state.workspace.binders,
      [binder.id]: { ...binder, cellPlans: result.nextCellPlans },
    };
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };

    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
    state.showToast(
      `Bumped ${result.movedCount} ${courseId} lesson${result.movedCount === 1 ? '' : 's'} forward (${scope === 'blank' ? 'stopped at blank' : 'full term'}). Ctrl+Z to undo.`,
    );
    return result.movedCount;
  },

  addWeeklyNote: (mondayIso, text, ink = 'pencil', sourceCellKey) => {
    const state = get();
    const binder = state.workspace.binders[state.workspace.activeBinderId];
    if (!binder || binder.archived || !text.trim()) return;

    const item: WeeklyNoteItem = {
      id: `wn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: text.trim(),
      ink,
      sourceCellKey,
    };
    const existing = binder.weeklyNotes[mondayIso] ?? [];
    const nextBinders = {
      ...state.workspace.binders,
      [binder.id]: {
        ...binder,
        weeklyNotes: { ...binder.weeklyNotes, [mondayIso]: [...existing, item] },
      },
    };
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
  },

  updateWeeklyNote: (mondayIso, noteId, text, ink) => {
    const state = get();
    const binder = state.workspace.binders[state.workspace.activeBinderId];
    if (!binder || binder.archived) return;
    const existing = binder.weeklyNotes[mondayIso] ?? [];
    const nextList = existing.map((n) =>
      n.id === noteId ? { ...n, text, ink: ink ?? n.ink } : n,
    );
    const nextBinders = {
      ...state.workspace.binders,
      [binder.id]: {
        ...binder,
        weeklyNotes: { ...binder.weeklyNotes, [mondayIso]: nextList },
      },
    };
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
  },

  deleteWeeklyNote: (mondayIso, noteId) => {
    const state = get();
    const binder = state.workspace.binders[state.workspace.activeBinderId];
    if (!binder || binder.archived) return;
    const existing = binder.weeklyNotes[mondayIso] ?? [];
    const nextList = existing.filter((n) => n.id !== noteId);
    const nextBinders = {
      ...state.workspace.binders,
      [binder.id]: {
        ...binder,
        weeklyNotes: { ...binder.weeklyNotes, [mondayIso]: nextList },
      },
    };
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
  },

  pinCellToWeeklyNotes: (mondayIso, date, periodId, label) => {
    const state = get();
    const binder = state.workspace.binders[state.workspace.activeBinderId];
    if (!binder || binder.archived) return;
    const key = cellKey(date, periodId);
    const cell = binder.cellPlans[key];
    if (!cell?.text.trim()) return;

    const alreadyPinned = Boolean(cell.pinNote);
    state.updateCellPlan(date, periodId, { pinNote: !alreadyPinned });

    if (!alreadyPinned) {
      const firstLine = cell.text.split('\n')[0];
      state.addWeeklyNote(mondayIso, `${label}: ${firstLine}`, cell.ink, key);
      state.showToast('Pinned callout to right-page NOTES.');
    }
  },

  switchBinder: (binderId) => {
    const state = get();
    const target = state.workspace.binders[binderId];
    if (!target) return;
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      activeBinderId: binderId,
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      weekIndex: defaultWeekIndexForBinder(target),
      selectedCell: null,
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
  },

  addBinder: (binder, activate = true) => {
    const state = get();
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      activeBinderId: activate ? binder.id : state.workspace.activeBinderId,
      binders: { ...state.workspace.binders, [binder.id]: binder },
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      weekIndex: activate ? defaultWeekIndexForBinder(binder) : state.weekIndex,
      selectedCell: null,
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
  },

  updateActiveBinder: (updater) => {
    const state = get();
    const binder = state.workspace.binders[state.workspace.activeBinderId];
    if (!binder || binder.archived) return;
    const updated = updater(structuredClone(binder));
    const nextBinders = { ...state.workspace.binders, [binder.id]: updated };
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };
    const sched = resolveSchedule(updated);
    const clampedWeek = Math.min(state.weekIndex, Math.max(0, sched.weeks.length - 1));
    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      weekIndex: clampedWeek,
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
  },

  toggleArchiveBinder: (binderId) => {
    const state = get();
    const target = state.workspace.binders[binderId];
    if (!target) return;
    const nextBinders = {
      ...state.workspace.binders,
      [binderId]: { ...target, archived: !target.archived },
    };
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
    state.showToast(target.archived ? `Unarchived "${target.title}".` : `Archived "${target.title}" (read-only).`);
  },

  deleteBinder: (binderId) => {
    const state = get();
    const ids = Object.keys(state.workspace.binders);
    if (ids.length <= 1) {
      state.showToast('Cannot delete the last remaining binder.');
      return;
    }
    const nextBinders = { ...state.workspace.binders };
    delete nextBinders[binderId];
    const nextActiveId =
      state.workspace.activeBinderId === binderId
        ? Object.keys(nextBinders)[0]
        : state.workspace.activeBinderId;
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      activeBinderId: nextActiveId,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: [],
      weekIndex: defaultWeekIndexForBinder(nextBinders[nextActiveId]),
      selectedCell: null,
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
  },

  cloneBinderToNewYear: (sourceBinderId, newTitle, startDate, endDate, firstCycleDate) => {
    const state = get();
    const src = state.workspace.binders[sourceBinderId];
    const id = `binder-${Date.now()}`;
    const cloned: AcademicYearBinder = {
      ...structuredClone(src),
      id,
      title: newTitle,
      schoolLabel: newTitle.slice(0, 14),
      archived: false,
      startDate,
      endDate,
      firstCycleDate,
      exceptions: [],
      recurringRules: [],
      cellPlans: {},
      weeklyNotes: {},
      createdAt: new Date().toISOString(),
    };
    state.addBinder(cloned, true);
    state.showToast(`Cloned "${src.title}" → "${newTitle}" (lesson notes cleared).`);
    return id;
  },

  replaceWorkspace: (next) => {
    const state = get();
    const active = next.binders[next.activeBinderId] ?? Object.values(next.binders)[0];
    set({
      workspace: next,
      weekIndex: active ? defaultWeekIndexForBinder(active) : 0,
      selectedCell: null,
      past: [],
      future: [],
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(next, state.lockPassphrase);
  },

  updateGoogleSync: (patch) => {
    const state = get();
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      googleSync: { ...state.workspace.googleSync, ...patch },
    };
    set({ workspace: nextWs });
    schedulePersist(nextWs, state.lockPassphrase);
  },

  setSyncStatus: (syncStatus, syncError = null) => set({ syncStatus, syncError }),

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const prevBinders = state.past[state.past.length - 1];
    const activeId = prevBinders[state.workspace.activeBinderId]
      ? state.workspace.activeBinderId
      : Object.keys(prevBinders)[0];
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      activeBinderId: activeId,
      binders: prevBinders,
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      past: state.past.slice(0, -1),
      future: [state.workspace.binders, ...state.future.slice(0, MAX_HISTORY - 1)],
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
    state.showToast('Undid last edit.');
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const nextBinders = state.future[0];
    const activeId = nextBinders[state.workspace.activeBinderId]
      ? state.workspace.activeBinderId
      : Object.keys(nextBinders)[0];
    const nextWs: PlannerWorkspace = {
      ...state.workspace,
      activeBinderId: activeId,
      binders: nextBinders,
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: nextWs,
      past: [...state.past.slice(-(MAX_HISTORY - 1)), state.workspace.binders],
      future: state.future.slice(1),
      dirtyRevision: state.dirtyRevision + 1,
    });
    schedulePersist(nextWs, state.lockPassphrase);
    state.showToast('Redid edit.');
  },
}));
